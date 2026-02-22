import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Plan = "free" | "personal" | "pro" | "team" | "enterprise";

function errMessage(e: unknown) {
  return e instanceof Error ? e.message : "Failed";
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, column: string) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes(column.toLowerCase());
}

function normalizeSlug(v: string) {
  return v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function findAvailableSlug(admin: ReturnType<typeof supabaseAdmin>, baseName: string) {
  const base = normalizeSlug(baseName) || "workspace";
  let candidate = base;

  for (let i = 0; i < 30; i++) {
    const { data, error } = await admin
      .from("workspaces")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error && error.code === "42703") return null; // slug column not present yet
    if (error) throw new Error(error.message);
    if (!data) return candidate;
    candidate = `${base}-${i + 2}`;
  }

  return `${base}-${Date.now().toString().slice(-4)}`;
}

async function requireUser() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Unauthorized");
  return { supabase, user: data.user };
}

async function getMyPlan(userId: string): Promise<Plan> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return ((data?.plan ?? "free") as Plan);
}

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const admin = supabaseAdmin();

    const { data: memberships, error: memErr } = await supabase
      .from("workspace_members")
      .select("workspace_id,role")
      .eq("user_id", user.id);
    if (memErr) throw new Error(memErr.message);
    const membershipRoleByWorkspaceId = new Map(
      (memberships ?? []).map((m) => [String(m.workspace_id), String(m.role)])
    );

    const memberWorkspaceIds = Array.from(
      new Set((memberships ?? []).map((m) => m.workspace_id).filter(Boolean))
    );

    const { data: ownedWorkspaces, error: ownedErr } = await admin
      .from("workspaces")
      .select("id,name,slug,created_by,created_at,updated_at,brand_logo_path,brand_logo_updated_at")
      .eq("created_by", user.id);
    if (ownedErr) throw new Error(ownedErr.message);

    const ownedWorkspaceIds = new Set((ownedWorkspaces ?? []).map((w) => w.id));
    const missingOwnerMemberships = (ownedWorkspaces ?? [])
      .filter((w) => !memberWorkspaceIds.includes(w.id))
      .map((w) => ({
        workspace_id: w.id,
        user_id: user.id,
        role: "owner" as const,
      }));

    if (missingOwnerMemberships.length > 0) {
      const { error: healErr } = await admin
        .from("workspace_members")
        .upsert(missingOwnerMemberships, { onConflict: "workspace_id,user_id" });
      if (healErr) throw new Error(healErr.message);
      for (const row of missingOwnerMemberships) memberWorkspaceIds.push(row.workspace_id);
    }

    let memberWorkspaces: Array<{
      id: string;
      name: string;
      created_by: string;
      created_at: string;
      updated_at: string;
      brand_logo_path: string | null;
      brand_logo_updated_at: string | null;
    }> = [];

    const missingIds = memberWorkspaceIds.filter((id) => !ownedWorkspaceIds.has(id));
    if (missingIds.length > 0) {
      const { data: viaMembership, error: viaMembershipErr } = await supabase
        .from("workspaces")
        .select("id,name,slug,created_by,created_at,updated_at,brand_logo_path,brand_logo_updated_at")
        .in("id", missingIds);
      if (viaMembershipErr) throw new Error(viaMembershipErr.message);
      memberWorkspaces = viaMembership ?? [];
    }

    const all = [...(ownedWorkspaces ?? []), ...memberWorkspaces].map((w) => ({
      ...w,
      my_role: (w.created_by === user.id ? "owner" : (membershipRoleByWorkspaceId.get(String(w.id)) ?? "member")),
    }));
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ workspaces: all });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMessage(e) }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = (await req.json().catch(() => null)) as { name?: string; mfa_required?: boolean } | null;

    const name = (body?.name ?? "").trim();
    const mfaRequired = body?.mfa_required === true;
    if (!name) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    }

    const plan = await getMyPlan(user.id);
    if (plan !== "team" && plan !== "enterprise") {
      return NextResponse.json(
        { error: "Workspace creation is available on Team (and Enterprise) plans." },
        { status: 403 }
      );
    }

    const admin = supabaseAdmin();
    const availableSlug = await findAvailableSlug(admin, name);
    if (!availableSlug) {
      return NextResponse.json(
        { error: "Workspace slug support is not configured. Run the workspace slug migration first." },
        { status: 500 }
      );
    }

    // Create workspace (RLS allows insert when created_by = auth.uid())
    let wsSelect = await supabase
      .from("workspaces")
      .insert({
        name,
        created_by: user.id,
        slug: availableSlug,
        mfa_required: mfaRequired,
      })
      .select("id,name,slug,created_at,mfa_required")
      .single();

    let ws = wsSelect.data as
      | { id: string; name: string; slug: string | null; created_at: string; mfa_required?: boolean }
      | null;
    let wsErr = wsSelect.error;
    if (wsErr && isMissingColumnError(wsErr, "mfa_required")) {
      if (mfaRequired) {
        return NextResponse.json(
          { error: "Workspace MFA enforcement is not configured yet. Run the latest SQL migrations first." },
          { status: 500 }
        );
      }
      wsSelect = await supabase
        .from("workspaces")
        .insert({
          name,
          created_by: user.id,
          slug: availableSlug,
        })
        .select("id,name,slug,created_at")
        .single();
      ws = wsSelect.data as { id: string; name: string; slug: string | null; created_at: string } | null;
      wsErr = wsSelect.error;
    }

    if (wsErr) throw new Error(wsErr.message);
    if (!ws) throw new Error("Workspace was not created.");

    // Add membership as owner
    const { error: memErr } = await supabase
      .from("workspace_members")
      .insert({ workspace_id: ws.id, user_id: user.id, role: "owner" });

    if (memErr) throw new Error(memErr.message);

    // Set primary workspace (admin to avoid any RLS mismatch)
    await admin
      .from("profiles")
      .update({ primary_workspace_id: ws.id, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    return NextResponse.json({ workspace: ws });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMessage(e) }, { status: 500 });
  }
}

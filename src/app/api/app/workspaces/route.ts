import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Plan = "free" | "personal" | "pro" | "team" | "enterprise";

function errMessage(e: unknown) {
  return e instanceof Error ? e.message : "Failed";
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

    const memberWorkspaceIds = Array.from(
      new Set((memberships ?? []).map((m) => m.workspace_id).filter(Boolean))
    );

    const { data: ownedWorkspaces, error: ownedErr } = await admin
      .from("workspaces")
      .select("id,name,created_by,created_at,updated_at,brand_logo_path,brand_logo_updated_at")
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
        .select("id,name,created_by,created_at,updated_at,brand_logo_path,brand_logo_updated_at")
        .in("id", missingIds);
      if (viaMembershipErr) throw new Error(viaMembershipErr.message);
      memberWorkspaces = viaMembership ?? [];
    }

    const all = [...(ownedWorkspaces ?? []), ...memberWorkspaces];
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ workspaces: all });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMessage(e) }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = (await req.json().catch(() => null)) as { name?: string } | null;

    const name = (body?.name ?? "").trim();
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

    // Create workspace (RLS allows insert when created_by = auth.uid())
    const { data: ws, error: wsErr } = await supabase
      .from("workspaces")
      .insert({ name, created_by: user.id })
      .select("id,name,created_at")
      .single();

    if (wsErr) throw new Error(wsErr.message);

    // Add membership as owner
    const { error: memErr } = await supabase
      .from("workspace_members")
      .insert({ workspace_id: ws.id, user_id: user.id, role: "owner" });

    if (memErr) throw new Error(memErr.message);

    // Set primary workspace (admin to avoid any RLS mismatch)
    const admin = supabaseAdmin();
    await admin
      .from("profiles")
      .update({ primary_workspace_id: ws.id, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    return NextResponse.json({ workspace: ws });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMessage(e) }, { status: 500 });
  }
}

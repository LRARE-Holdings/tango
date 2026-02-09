import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function isValidSlug(v: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length >= 3 && v.length <= 63;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceIdentifier } = (await ctx.params) as { id: string };
    if (!workspaceIdentifier) {
      return NextResponse.json({ error: "Invalid workspace identifier" }, { status: 400 });
    }

    const supabase = await supabaseServer();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolved = await resolveWorkspaceIdentifier(workspaceIdentifier);
    if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const withSlug = await supabase
      .from("workspaces")
      .select("id,name,slug,created_by,created_at,updated_at,brand_logo_path,brand_logo_updated_at")
      .eq("id", resolved.id)
      .single();

    let workspace = withSlug.data as Record<string, unknown> | null;
    let wsErr = withSlug.error;

    if (wsErr && isMissingColumnError(wsErr, "slug")) {
      const fallback = await supabase
        .from("workspaces")
        .select("id,name,created_by,created_at,updated_at,brand_logo_path,brand_logo_updated_at")
        .eq("id", resolved.id)
        .single();
      workspace = fallback.data as Record<string, unknown> | null;
      wsErr = fallback.error;
      if (workspace) workspace.slug = null;
    }

    if (wsErr) throw new Error(wsErr.message);

    const { data: members, error: memErr } = await supabase
      .from("workspace_members")
      .select("user_id,role,joined_at")
      .eq("workspace_id", resolved.id)
      .order("joined_at", { ascending: true });

    if (memErr) throw new Error(memErr.message);

    return NextResponse.json({ workspace, members: members ?? [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceIdentifier } = (await ctx.params) as { id: string };
    if (!workspaceIdentifier) {
      return NextResponse.json({ error: "Invalid workspace identifier" }, { status: 400 });
    }

    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolved = await resolveWorkspaceIdentifier(workspaceIdentifier);
    if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: member, error: memberErr } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", resolved.id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (memberErr) throw new Error(memberErr.message);
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { name?: string; slug?: string | null } | null;
    const nextName = typeof body?.name === "string" ? body.name.trim() : undefined;
    const slugRaw = typeof body?.slug === "string" ? body.slug : body?.slug === null ? "" : undefined;

    if (nextName !== undefined && nextName.length === 0) {
      return NextResponse.json({ error: "Workspace name is required." }, { status: 400 });
    }

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (nextName !== undefined) payload.name = nextName;

    if (slugRaw !== undefined) {
      const slug = normalizeSlug(slugRaw);
      if (slug.length === 0) {
        payload.slug = null;
      } else if (!isValidSlug(slug)) {
        return NextResponse.json(
          { error: "Slug must be 3-63 chars using lowercase letters, numbers, and hyphens only." },
          { status: 400 }
        );
      } else {
        payload.slug = slug;
      }
    }

    if (Object.keys(payload).length === 1) {
      return NextResponse.json({ error: "No updates provided." }, { status: 400 });
    }

    const result = await admin
      .from("workspaces")
      .update(payload)
      .eq("id", resolved.id)
      .select("id,name,slug,created_by,created_at,updated_at,brand_logo_path,brand_logo_updated_at")
      .single();

    if (result.error && isMissingColumnError(result.error, "slug")) {
      if (slugRaw !== undefined) {
        return NextResponse.json(
          { error: "Slug support is not configured yet. Run the workspace slug migration first." },
          { status: 500 }
        );
      }

      const fallback = await admin
        .from("workspaces")
        .update(payload)
        .eq("id", resolved.id)
        .select("id,name,created_by,created_at,updated_at,brand_logo_path,brand_logo_updated_at")
        .single();

      if (fallback.error) throw new Error(fallback.error.message);
      return NextResponse.json({ workspace: { ...(fallback.data ?? {}), slug: null } });
    }

    if (result.error) {
      if (result.error.code === "23505") {
        return NextResponse.json({ error: "That slug is already taken." }, { status: 409 });
      }
      throw new Error(result.error.message);
    }

    return NextResponse.json({ workspace: result.data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

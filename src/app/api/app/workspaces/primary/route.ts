import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function errMessage(e: unknown) {
  return e instanceof Error ? e.message : "Failed";
}

async function persistPrimaryWorkspace(
  admin: ReturnType<typeof supabaseAdmin>,
  userId: string,
  workspaceId: string | null
) {
  const { error } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        primary_workspace_id: workspaceId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) throw new Error(error.message);

  const { data: prof, error: readErr } = await admin
    .from("profiles")
    .select("primary_workspace_id")
    .eq("id", userId)
    .maybeSingle();

  if (readErr) throw new Error(readErr.message);

  const persisted = (prof?.primary_workspace_id as string | null) ?? null;
  if (persisted !== workspaceId) {
    throw new Error(
      `Workspace switch did not persist (expected ${workspaceId ?? "null"}, got ${persisted ?? "null"})`
    );
  }

  return persisted;
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return authErrorResponse(userErr);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as { workspace_id?: string | null } | null;
    const workspaceIdRaw = body?.workspace_id;
    const workspaceId =
      typeof workspaceIdRaw === "string" && workspaceIdRaw.trim().length > 0
        ? workspaceIdRaw.trim()
        : null;

    // Personal mode: clear active workspace
    if (workspaceId === null) {
      const persisted = await persistPrimaryWorkspace(admin, userData.user.id, null);
      return NextResponse.json({ ok: true, workspace_id: null, persisted_workspace_id: persisted });
    }

    if (!isUuid(workspaceId)) {
      return NextResponse.json({ error: "Invalid workspace id" }, { status: 400 });
    }

    // Validate membership (RLS-protected select)
    const { data: mem, error: memErr } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (memErr) throw new Error(memErr.message);
    if (!mem) {
      // Fallback: allow the workspace creator to switch even if membership row is missing.
      // This can happen with legacy rows or partial migrations.
      const { data: ws, error: wsErr } = await admin
        .from("workspaces")
        .select("id,created_by")
        .eq("id", workspaceId)
        .maybeSingle();

      if (wsErr) throw new Error(wsErr.message);
      if (!ws || ws.created_by !== userData.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Self-heal: restore owner membership so downstream workspace checks stay consistent.
      const { error: insErr } = await admin
        .from("workspace_members")
        .upsert(
          { workspace_id: workspaceId, user_id: userData.user.id, role: "owner" },
          { onConflict: "workspace_id,user_id" }
        );

      if (insErr) throw new Error(insErr.message);
    }

    const persisted = await persistPrimaryWorkspace(admin, userData.user.id, workspaceId);
    return NextResponse.json({ ok: true, workspace_id: workspaceId, persisted_workspace_id: persisted });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMessage(e) }, { status: 500 });
  }
}

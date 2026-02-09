import { NextResponse } from "next/server";
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

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as { workspace_id?: string | null } | null;
    const workspaceIdRaw = body?.workspace_id;
    const workspaceId =
      typeof workspaceIdRaw === "string" && workspaceIdRaw.trim().length > 0
        ? workspaceIdRaw.trim()
        : null;

    // Personal mode: clear active workspace
    if (workspaceId === null) {
      const { error: clearErr } = await admin
        .from("profiles")
        .update({ primary_workspace_id: null, updated_at: new Date().toISOString() })
        .eq("id", userData.user.id);

      if (clearErr) throw new Error(clearErr.message);
      return NextResponse.json({ ok: true, workspace_id: null });
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
    if (!mem) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { error: upErr } = await admin
      .from("profiles")
      .update({ primary_workspace_id: workspaceId, updated_at: new Date().toISOString() })
      .eq("id", userData.user.id);

    if (upErr) throw new Error(upErr.message);

    return NextResponse.json({ ok: true, workspace_id: workspaceId });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMessage(e) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = (await ctx.params) as { id: string };
    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid workspace id" }, { status: 400 });
    }

    const supabase = await supabaseServer();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // RLS should ensure only members can read
    const { data: workspace, error: wsErr } = await supabase
      .from("workspaces")
      .select("id,name,created_by,created_at,updated_at,brand_logo_path,brand_logo_updated_at")
      .eq("id", id)
      .single();

    if (wsErr) throw new Error(wsErr.message);

    const { data: members, error: memErr } = await supabase
      .from("workspace_members")
      .select("user_id,role,joined_at")
      .eq("workspace_id", id)
      .order("joined_at", { ascending: true });

    if (memErr) throw new Error(memErr.message);

    return NextResponse.json({ workspace, members: members ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}

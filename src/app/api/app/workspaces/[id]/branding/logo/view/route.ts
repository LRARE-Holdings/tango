import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "workspace-branding";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceId } = (await ctx.params) as { id: string };
    if (!workspaceId || !isUuid(workspaceId)) {
      return NextResponse.json({ error: "Invalid workspace id" }, { status: 400 });
    }

    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Must be member
    const { data: mem, error: memErr } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (memErr) throw new Error(memErr.message);
    if (!mem) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Get path
    const { data: ws, error: wsErr } = await supabase
      .from("workspaces")
      .select("brand_logo_path")
      .eq("id", workspaceId)
      .maybeSingle();

    if (wsErr) throw new Error(wsErr.message);
    if (!ws?.brand_logo_path) return NextResponse.json({ error: "No logo" }, { status: 404 });

    const { data, error: dlErr } = await admin.storage
      .from(BUCKET)
      .download(ws.brand_logo_path);

    if (dlErr) throw new Error(dlErr.message);

    const arrayBuffer = await data.arrayBuffer();
    return new NextResponse(Buffer.from(arrayBuffer), {
      status: 200,
      headers: {
        "content-type": "image/png",
        "cache-control": "private, max-age=300",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "workspace-branding";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceIdentifier } = (await ctx.params) as { id: string };
    if (!workspaceIdentifier) {
      return NextResponse.json({ error: "Invalid workspace identifier" }, { status: 400 });
    }
    const resolved = await resolveWorkspaceIdentifier(workspaceIdentifier);
    if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const workspaceId = resolved.id;

    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return authErrorResponse(userErr);
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
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

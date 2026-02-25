import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";
import { canManageWorkspaceLicenses, getWorkspaceLicensing } from "@/lib/workspace-licensing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return authErrorResponse(userErr);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: member, error: memberErr } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", resolved.id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (memberErr) throw new Error(memberErr.message);
    if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canManageWorkspaceLicenses(member.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { summary, members } = await getWorkspaceLicensing(admin, resolved.id);

    return NextResponse.json({
      licensing: summary,
      members,
      viewer: {
        user_id: userData.user.id,
        role: member.role,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed";
    if (message.toLowerCase().includes("license_")) {
      return NextResponse.json({ error: "Workspace licensing is not configured yet. Run latest SQL migrations." }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

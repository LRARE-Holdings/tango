import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";
import { canViewAnalytics } from "@/lib/workspace-permissions";
import { getWorkspaceAnalyticsSnapshot } from "@/lib/workspace-analytics";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceIdentifier } = (await ctx.params) as { id: string };
    const access = await requireWorkspaceMember(workspaceIdentifier);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const { supabase, admin, userId, workspaceId, membership } = access;
    const ent = await getWorkspaceEntitlementsForUser(admin, workspaceId, userId);
    if (!ent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!canViewAnalytics(membership, ent.plan)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workspaceRes = await supabase.from("workspaces").select("id,name,slug").eq("id", workspaceId).maybeSingle();
    if (workspaceRes.error) return NextResponse.json({ error: workspaceRes.error.message }, { status: 500 });

    const snapshot = await getWorkspaceAnalyticsSnapshot(supabase, admin, workspaceId);
    return NextResponse.json({
      workspace: workspaceRes.data,
      viewer: {
        role: membership.role,
        can_view_analytics: true,
      },
      plan: ent.plan,
      ...snapshot,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}


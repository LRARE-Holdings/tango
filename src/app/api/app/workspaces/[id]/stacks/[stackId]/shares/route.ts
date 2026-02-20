import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; stackId: string }> | { id: string; stackId: string } }
) {
  try {
    const { id: workspaceIdentifier, stackId } = (await ctx.params) as { id: string; stackId: string };
    const access = await requireWorkspaceMember(workspaceIdentifier);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const { supabase, userId, workspaceId } = access;

    const body = (await req.json().catch(() => null)) as { user_id?: string } | null;
    const targetUserId = String(body?.user_id ?? "").trim();
    if (!targetUserId) return NextResponse.json({ error: "user_id is required." }, { status: 400 });

    const stackRes = await supabase
      .from("receipt_stacks")
      .select("owner_user_id")
      .eq("id", stackId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (stackRes.error) return NextResponse.json({ error: stackRes.error.message }, { status: 500 });
    if (!stackRes.data) return NextResponse.json({ error: "Stack not found." }, { status: 404 });
    if (String((stackRes.data as { owner_user_id: string }).owner_user_id) !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const memberRes = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (memberRes.error) return NextResponse.json({ error: memberRes.error.message }, { status: 500 });
    if (!memberRes.data) return NextResponse.json({ error: "User is not a workspace member." }, { status: 400 });

    const shareRes = await supabase
      .from("receipt_stack_shares")
      .upsert({ stack_id: stackId, user_id: targetUserId, granted_by: userId }, { onConflict: "stack_id,user_id" });
    if (shareRes.error) return NextResponse.json({ error: shareRes.error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}


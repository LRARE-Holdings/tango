import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";

export async function DELETE(
  _req: Request,
  ctx: {
    params:
      | Promise<{ id: string; stackId: string; docId: string }>
      | { id: string; stackId: string; docId: string };
  }
) {
  try {
    const { id: workspaceIdentifier, stackId, docId } = (await ctx.params) as {
      id: string;
      stackId: string;
      docId: string;
    };
    const access = await requireWorkspaceMember(workspaceIdentifier);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const { supabase, userId, workspaceId } = access;

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

    const delRes = await supabase
      .from("receipt_stack_items")
      .delete()
      .eq("stack_id", stackId)
      .eq("document_id", docId);
    if (delRes.error) return NextResponse.json({ error: delRes.error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}


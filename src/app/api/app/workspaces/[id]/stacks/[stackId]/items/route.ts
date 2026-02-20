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

    const body = (await req.json().catch(() => null)) as { document_id?: string } | null;
    const documentId = String(body?.document_id ?? "").trim();
    if (!documentId) return NextResponse.json({ error: "document_id is required." }, { status: 400 });

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

    const docRes = await supabase
      .from("documents")
      .select("id")
      .eq("id", documentId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (docRes.error) return NextResponse.json({ error: docRes.error.message }, { status: 500 });
    if (!docRes.data) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const insRes = await supabase
      .from("receipt_stack_items")
      .upsert({ stack_id: stackId, document_id: documentId, added_by: userId }, { onConflict: "stack_id,document_id" });
    if (insRes.error) return NextResponse.json({ error: insRes.error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}


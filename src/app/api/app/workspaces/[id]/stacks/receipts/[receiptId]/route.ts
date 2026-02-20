import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";
import { canUseStackDelivery } from "@/lib/workspace-permissions";
import { parseStackReceiptEvidence, parseStackReceiptSummary } from "@/lib/stack-receipts";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; receiptId: string }> | { id: string; receiptId: string } }
) {
  try {
    const { id: workspaceIdentifier, receiptId } = (await ctx.params) as { id: string; receiptId: string };
    const access = await requireWorkspaceMember(workspaceIdentifier);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const { supabase, admin, userId, workspaceId, membership } = access;

    const ent = await getWorkspaceEntitlementsForUser(admin, workspaceId, userId);
    if (!ent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canUseStackDelivery(membership, ent.plan)) {
      return NextResponse.json({ error: "Stacks are available on Pro, Team, and Enterprise plans." }, { status: 403 });
    }

    const receiptRes = await supabase
      .from("stack_acknowledgement_receipts")
      .select("id,workspace_id,stack_id,delivery_id,completed_at,created_at,summary,evidence,outstanding_count")
      .eq("workspace_id", workspaceId)
      .eq("id", receiptId)
      .maybeSingle();
    if (receiptRes.error) return NextResponse.json({ error: receiptRes.error.message }, { status: 500 });
    if (!receiptRes.data) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const receipt = receiptRes.data as {
      id: string;
      stack_id: string | null;
      delivery_id: string;
      completed_at: string | null;
      created_at: string;
      summary: unknown;
      evidence: unknown;
      outstanding_count: number;
    };
    const summary = parseStackReceiptSummary(receipt.summary);
    const evidence = parseStackReceiptEvidence(receipt.evidence);

    return NextResponse.json({
      receipt: {
        id: receipt.id,
        stack_id: receipt.stack_id,
        delivery_id: receipt.delivery_id,
        completed_at: receipt.completed_at,
        created_at: receipt.created_at,
        outstanding_count: receipt.outstanding_count ?? 0,
      },
      summary,
      evidence,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}

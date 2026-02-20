import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";
import { canUseStackDelivery } from "@/lib/workspace-permissions";
import { parseStackReceiptEvidence, parseStackReceiptSummary, safeFilename } from "@/lib/stack-receipts";
import { buildStackEvidencePdf } from "@/lib/reports/stack-evidence-report";

export const runtime = "nodejs";

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

    const [receiptRes, workspaceRes] = await Promise.all([
      supabase
        .from("stack_acknowledgement_receipts")
        .select("id,summary,evidence,completed_at")
        .eq("workspace_id", workspaceId)
        .eq("id", receiptId)
        .maybeSingle(),
      supabase.from("workspaces").select("name").eq("id", workspaceId).maybeSingle(),
    ]);
    if (receiptRes.error) return NextResponse.json({ error: receiptRes.error.message }, { status: 500 });
    if (!receiptRes.data) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (workspaceRes.error) return NextResponse.json({ error: workspaceRes.error.message }, { status: 500 });

    const summary = parseStackReceiptSummary((receiptRes.data as { summary?: unknown }).summary);
    const evidence = parseStackReceiptEvidence((receiptRes.data as { evidence?: unknown }).evidence);
    const completedAt = (receiptRes.data as { completed_at?: string | null }).completed_at ?? summary.completed_at;

    const bytes = await buildStackEvidencePdf({
      workspaceName: String((workspaceRes.data as { name?: string } | null)?.name ?? "Workspace"),
      generatedAtIso: new Date().toISOString(),
      receiptId,
      stackTitle: summary.stack_title,
      recipientName: summary.recipient_name,
      recipientEmail: summary.recipient_email || "Unavailable",
      completedAt,
      totalDocuments: summary.total_documents || evidence.documents.length,
      acknowledgedDocuments:
        summary.acknowledged_documents || evidence.documents.filter((doc) => doc.acknowledged).length,
      documents: evidence.documents.map((doc) => ({
        document_title: doc.document_title,
        document_public_id: doc.document_public_id,
        acknowledged: doc.acknowledged,
        method: doc.method,
        acknowledged_at: doc.acknowledged_at,
        acknowledgement_data: doc.acknowledgement_data,
      })),
    });

    const filename = `stack-evidence-${safeFilename(summary.stack_title || "stack")}-${receiptId}.pdf`;

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to generate stack evidence PDF." }, { status: 500 });
  }
}

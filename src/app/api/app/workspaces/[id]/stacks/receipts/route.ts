import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";
import { canUseStackDelivery } from "@/lib/workspace-permissions";
import { parseStackReceiptSummary } from "@/lib/stack-receipts";

function normalizeQuery(v: string | null) {
  return String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceIdentifier } = (await ctx.params) as { id: string };
    const access = await requireWorkspaceMember(workspaceIdentifier);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const { supabase, admin, userId, workspaceId, membership } = access;

    const ent = await getWorkspaceEntitlementsForUser(admin, workspaceId, userId);
    if (!ent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canUseStackDelivery(membership, ent.plan)) {
      return NextResponse.json({ error: "Stacks are available on Pro, Team, and Enterprise plans." }, { status: 403 });
    }

    const reqUrl = new URL(req.url);
    const q = normalizeQuery(reqUrl.searchParams.get("q"));
    const from = reqUrl.searchParams.get("from");
    const to = reqUrl.searchParams.get("to");
    const recipientEmailFilter = normalizeQuery(reqUrl.searchParams.get("recipient_email"));
    const stackIdFilter = String(reqUrl.searchParams.get("stack_id") ?? "").trim();

    let query = supabase
      .from("stack_acknowledgement_receipts")
      .select("id,delivery_id,stack_id,completed_at,created_at,summary,evidence,outstanding_count")
      .eq("workspace_id", workspaceId)
      .order("completed_at", { ascending: false })
      .limit(500);

    if (from) query = query.gte("completed_at", from);
    if (to) query = query.lte("completed_at", to);
    if (stackIdFilter) query = query.eq("stack_id", stackIdFilter);

    const res = await query;
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });

    const receipts = (res.data ?? [])
      .map((row) => {
        const summary = parseStackReceiptSummary((row as { summary?: unknown }).summary);
        const stackTitle = summary.stack_title || "Stack delivery";
        const recipientEmail = summary.recipient_email || "";
        const receiptId = String((row as { id: string }).id);
        const hay = `${stackTitle} ${recipientEmail} ${receiptId}`.toLowerCase();
        if (q && !hay.includes(q)) return null;
        if (recipientEmailFilter && !recipientEmail.toLowerCase().includes(recipientEmailFilter)) return null;
        return {
          id: receiptId,
          delivery_id: String((row as { delivery_id: string }).delivery_id),
          stack_id: String((row as { stack_id?: string | null }).stack_id ?? ""),
          completed_at: String((row as { completed_at?: string }).completed_at ?? ""),
          created_at: String((row as { created_at?: string }).created_at ?? ""),
          outstanding_count: Number((row as { outstanding_count?: number }).outstanding_count ?? 0),
          stack_title: stackTitle,
          recipient_name: summary.recipient_name,
          recipient_email: recipientEmail,
          total_documents: summary.total_documents,
          acknowledged_documents: summary.acknowledged_documents,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    return NextResponse.json({ receipts });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}

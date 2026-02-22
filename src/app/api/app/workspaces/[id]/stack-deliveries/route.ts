import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";
import { canUseStackDelivery } from "@/lib/workspace-permissions";
import { createStackDelivery, parseRecipients } from "@/lib/stack-deliveries";
import { canAccessFeatureByPlan } from "@/lib/workspace-features";
import { parseIdList, resolveWorkspaceRecipients } from "@/lib/workspace-contacts";

type Body = {
  stack_id?: string | null;
  document_ids?: string[];
  title?: string | null;
  send_emails?: boolean;
  recipients?: Array<{ name?: string; email?: string }>;
  contact_ids?: string[];
  contact_group_ids?: string[];
};

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
    if (!canUseStackDelivery(membership, ent.plan)) {
      return NextResponse.json(
        { error: "Stack sending is available on Pro, Team, and Enterprise plans." },
        { status: 403 }
      );
    }

    const res = await supabase
      .from("stack_deliveries")
      .select("id,public_id,title,status,stack_id,created_by,created_at,updated_at,expires_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
    return NextResponse.json({ deliveries: res.data ?? [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}

export async function POST(
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
      return NextResponse.json(
        { error: "Stack sending is available on Pro, Team, and Enterprise plans." },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    const mode = body?.stack_id ? "full_stack" : "selected_documents";

    const manualRecipients = parseRecipients(body?.recipients);
    const contactIds = parseIdList(body?.contact_ids);
    const contactGroupIds = parseIdList(body?.contact_group_ids);

    if ((contactIds.length > 0 || contactGroupIds.length > 0) && !canAccessFeatureByPlan(ent.plan, "contacts")) {
      return NextResponse.json(
        { error: "Contact selections are available on Pro, Team, and Enterprise plans." },
        { status: 403 }
      );
    }

    const resolvedRecipients = await resolveWorkspaceRecipients({
      client: supabase,
      workspaceId,
      manualRecipients,
      contactIds,
      contactGroupIds,
      maxRecipients: 200,
    });

    if (body?.send_emails === true && resolvedRecipients.recipients.length === 0) {
      return NextResponse.json(
        { error: "Select at least one valid recipient email or contact." },
        { status: 400 }
      );
    }

    const result = await createStackDelivery({
      req,
      supabase,
      workspaceId,
      userId,
      mode,
      stackId: body?.stack_id ?? null,
      documentIds: Array.isArray(body?.document_ids) ? body?.document_ids : [],
      title: body?.title ?? null,
      recipients: resolvedRecipients.recipients,
      sendEmails: body?.send_emails === true,
    });

    return NextResponse.json({
      delivery_id: result.deliveryId,
      share_url: result.sharePath,
      share_url_abs: result.shareUrl,
      document_count: result.documentCount,
      emails: result.emails,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}

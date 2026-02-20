import { nanoid } from "nanoid";
import { sendWithResend } from "@/lib/email/resend";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RecipientInput = { name?: string | null; email?: string | null };
type ParsedRecipient = { name: string; email: string };
type SendMode = "selected_documents" | "full_stack";

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim().toLowerCase());
}

export function parseRecipients(input: unknown): ParsedRecipient[] {
  if (!Array.isArray(input)) return [];
  const dedup = new Map<string, ParsedRecipient>();
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const name = String((item as RecipientInput).name ?? "").trim().slice(0, 120);
    const email = String((item as RecipientInput).email ?? "").trim().toLowerCase();
    if (!email || !isEmail(email)) continue;
    dedup.set(email, { name, email });
  }
  return [...dedup.values()].slice(0, 100);
}

function escapeHtml(v: string) {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function appBaseUrl(req: Request) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  return host ? `${proto}://${host}` : "https://www.getreceipt.co";
}

function buildStackEmail(args: {
  recipientName: string;
  workspaceName: string;
  stackTitle: string;
  stackUrl: string;
}) {
  const intro = args.recipientName ? `Hi ${escapeHtml(args.recipientName)},` : "Hello,";
  const safeWorkspace = escapeHtml(args.workspaceName);
  const safeTitle = escapeHtml(args.stackTitle);
  const safeUrl = escapeHtml(args.stackUrl);

  const html = `
  <div style="margin:0;padding:24px;background:#f7f7f8;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:14px;padding:24px;">
      <div style="font-size:11px;letter-spacing:0.08em;color:#666;font-weight:700;">RECEIPT</div>
      <h1 style="margin:10px 0 0;font-size:20px;line-height:1.3;">${safeWorkspace} sent a document stack</h1>
      <p style="margin:14px 0 0;color:#333;font-size:14px;line-height:1.6;">${intro}</p>
      <p style="margin:10px 0 0;color:#333;font-size:14px;line-height:1.6;">Please review and acknowledge each document in:</p>
      <p style="margin:8px 0 0;color:#111;font-size:15px;font-weight:600;">${safeTitle}</p>
      <div style="margin-top:20px;">
        <a href="${safeUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:11px 16px;border-radius:999px;font-size:14px;font-weight:600;">Open stack</a>
      </div>
      <p style="margin:14px 0 0;color:#5f6368;font-size:12px;line-height:1.5;">If the button does not work, open this URL:</p>
      <p style="margin:6px 0 0;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${safeUrl}" style="color:#111;">${safeUrl}</a></p>
    </div>
  </div>`;

  const text = `${args.recipientName ? `Hi ${args.recipientName},` : "Hello,"}

${args.workspaceName} sent you a document stack:
${args.stackTitle}

Open stack: ${args.stackUrl}
`;
  return { html, text };
}

export async function createStackDelivery(args: {
  req: Request;
  supabase: Pick<ReturnType<typeof supabaseAdmin>, "from">;
  workspaceId: string;
  userId: string;
  mode: SendMode;
  stackId?: string | null;
  documentIds?: string[];
  title?: string | null;
  recipients?: ParsedRecipient[];
  sendEmails?: boolean;
}) {
  const { req, supabase, workspaceId, userId, mode } = args;
  const sendEmails = Boolean(args.sendEmails);
  const recipients = args.recipients ?? [];

  let deliveryTitle = String(args.title ?? "").trim();
  let stackId: string | null = null;
  let documentRows: Array<{ id: string; title: string; public_id: string }> = [];

  if (mode === "full_stack") {
    stackId = String(args.stackId ?? "").trim();
    if (!stackId) throw new Error("stack_id is required.");

    const stackRes = await supabase
      .from("receipt_stacks")
      .select("id,name,owner_user_id")
      .eq("id", stackId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (stackRes.error) throw new Error(stackRes.error.message);
    if (!stackRes.data) throw new Error("Stack not found.");

    const [itemsRes, docsRes] = await Promise.all([
      supabase
        .from("receipt_stack_items")
        .select("document_id,added_at")
        .eq("stack_id", stackId)
        .order("added_at", { ascending: true }),
      supabase
        .from("documents")
        .select("id,title,public_id")
        .eq("workspace_id", workspaceId)
        .limit(5000),
    ]);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    if (docsRes.error) throw new Error(docsRes.error.message);

    const docsById = new Map(
      (docsRes.data ?? []).map((doc) => [String((doc as { id: string }).id), doc as { id: string; title: string; public_id: string }])
    );
    documentRows = (itemsRes.data ?? [])
      .map((item) => docsById.get(String((item as { document_id: string }).document_id)))
      .filter((doc): doc is { id: string; title: string; public_id: string } => Boolean(doc));
    if (documentRows.length === 0) throw new Error("This stack has no documents.");
    if (!deliveryTitle) deliveryTitle = String((stackRes.data as { name?: string }).name ?? "Stack delivery");
  } else {
    const rawIds = Array.isArray(args.documentIds) ? args.documentIds : [];
    const documentIds = Array.from(new Set(rawIds.map((x) => String(x).trim()).filter(Boolean))).slice(0, 100);
    if (documentIds.length === 0) throw new Error("At least one document is required.");
    const docsRes = await supabase
      .from("documents")
      .select("id,title,public_id")
      .eq("workspace_id", workspaceId)
      .in("id", documentIds);
    if (docsRes.error) throw new Error(docsRes.error.message);
    documentRows = (docsRes.data ?? []) as Array<{ id: string; title: string; public_id: string }>;
    if (documentRows.length !== documentIds.length) {
      throw new Error("One or more selected documents are unavailable.");
    }
    if (!deliveryTitle) {
      deliveryTitle =
        documentRows.length === 1 ? documentRows[0].title : `Selected documents (${documentRows.length})`;
    }
  }

  const publicId = nanoid(12);
  const insertDelivery = await supabase
    .from("stack_deliveries")
    .insert({
      workspace_id: workspaceId,
      stack_id: stackId,
      created_by: userId,
      title: deliveryTitle || "Stack delivery",
      public_id: publicId,
      status: "active",
    })
    .select("id,public_id,title")
    .single();
  if (insertDelivery.error || !insertDelivery.data) {
    throw new Error(insertDelivery.error?.message ?? "Failed to create stack delivery.");
  }

  const deliveryId = String((insertDelivery.data as { id: string }).id);
  const items = documentRows.map((doc, index) => ({
    delivery_id: deliveryId,
    document_id: doc.id,
    position: index,
    required: true,
  }));
  const insertItems = await supabase.from("stack_delivery_documents").insert(items);
  if (insertItems.error) throw new Error(insertItems.error.message);

  const sharePath = `/d/s/${publicId}`;
  const shareUrl = `${appBaseUrl(req)}${sharePath}`;

  let emailsSent = 0;
  const emailFailures: Array<{ email: string; error: string }> = [];
  if (sendEmails && recipients.length > 0 && process.env.RESEND_API_KEY) {
    const workspaceRes = await supabase.from("workspaces").select("name").eq("id", workspaceId).maybeSingle();
    const workspaceName = String((workspaceRes.data as { name?: string } | null)?.name ?? "Receipt");

    await Promise.all(
      recipients.map(async (recipient) => {
        const content = buildStackEmail({
          recipientName: recipient.name,
          workspaceName,
          stackTitle: deliveryTitle,
          stackUrl: shareUrl,
        });
        const result = await sendWithResend({
          to: recipient.email,
          subject: `${workspaceName} shared a document stack`,
          html: content.html,
          text: content.text,
        });
        if (result.ok) {
          emailsSent += 1;
          return;
        }
        emailFailures.push({ email: recipient.email, error: result.error ?? "Failed to send" });
      })
    );
  }

  return {
    deliveryId,
    publicId,
    title: deliveryTitle,
    sharePath,
    shareUrl,
    documentCount: documentRows.length,
    emails: {
      requested: sendEmails && recipients.length > 0,
      sent: emailsSent,
      failed: emailFailures,
    },
  };
}

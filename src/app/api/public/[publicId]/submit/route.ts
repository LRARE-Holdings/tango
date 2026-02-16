import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { accessCookieName, accessTokenFor, readCookie } from "@/lib/public-access";
import { sendWithResend } from "@/lib/email/resend";

/**
 * Best-effort client IP extraction.
 * - Works on Vercel / reverse proxies
 * - Returns first IP in x-forwarded-for chain
 */
function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  return null;
}

function isMissingPasswordColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes("password_");
}

function isMissingRecipientRequirementColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes("require_recipient_identity");
}

function isMissingAcknowledgerLimitColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  const msg = String(error.message ?? "").toLowerCase();
  return msg.includes("max_acknowledgers") || msg.includes("closed_at");
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

function escapeHtml(v: string) {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatUtc(iso: string) {
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} UTC`;
}

function buildAcknowledgementReceiptEmail(input: {
  recipientName: string | null;
  documentTitle: string;
  timestampUtc: string;
  publicId: string;
}) {
  const intro = input.recipientName ? `Hi ${escapeHtml(input.recipientName)},` : "Hello,";
  const safeTitle = escapeHtml(input.documentTitle);
  const safeTimestamp = escapeHtml(input.timestampUtc);
  const safePublicId = escapeHtml(input.publicId);

  const html = `
  <div style="margin:0;padding:24px;background:#f7f7f8;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:14px;padding:24px;">
      <div style="font-size:11px;letter-spacing:0.08em;color:#666;font-weight:700;">RECEIPT</div>
      <h1 style="margin:10px 0 0;font-size:20px;line-height:1.3;">Acknowledgement receipt</h1>
      <p style="margin:14px 0 0;color:#333;font-size:14px;line-height:1.6;">${intro}</p>
      <p style="margin:10px 0 0;color:#333;font-size:14px;line-height:1.6;">Your acknowledgement has been recorded with the following details:</p>
      <div style="margin-top:14px;border:1px solid #e5e5e5;border-radius:12px;padding:12px 14px;">
        <p style="margin:0 0 8px;font-size:13px;color:#555;">Document</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#111;">${safeTitle}</p>
        <p style="margin:12px 0 8px;font-size:13px;color:#555;">Timestamp</p>
        <p style="margin:0;font-size:14px;color:#111;">${safeTimestamp}</p>
        <p style="margin:12px 0 8px;font-size:13px;color:#555;">Reference</p>
        <p style="margin:0;font-size:14px;color:#111;">${safePublicId}</p>
      </div>
      <p style="margin:14px 0 0;color:#5f6368;font-size:12px;line-height:1.5;">
        This email is a confirmation of submission. Keep it for your records.
      </p>
    </div>
  </div>`;

  const text = `${input.recipientName ? `Hi ${input.recipientName},` : "Hello,"}

Your acknowledgement has been recorded.

Document: ${input.documentTitle}
Timestamp: ${input.timestampUtc}
Reference: ${input.publicId}

Keep this email for your records.
`;

  return { html, text };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ publicId: string }> | { publicId: string } }
) {
  const { publicId } = (await ctx.params) as { publicId: string };
  const admin = supabaseAdmin();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;

  const name = typeof payload.name === "string" ? payload.name.trim() : null;
  const email = typeof payload.email === "string" ? payload.email.trim() : null;

  const acknowledged = Boolean(payload.acknowledged);

  const max_scroll_percent = Math.max(
    0,
    Math.min(100, Number(payload.max_scroll_percent ?? 0))
  );

  const time_on_page_seconds = Math.max(
    0,
    Number(payload.time_on_page_seconds ?? 0)
  );

  const active_seconds = Math.max(0, Number(payload.active_seconds ?? 0));

  // Resolve document from public_id
  const withPasswordCols = await admin
    .from("documents")
    .select(
      "id,title,current_version_id,password_enabled,password_hash,require_recipient_identity,max_acknowledgers_enabled,max_acknowledgers,closed_at"
    )
    .eq("public_id", publicId)
    .maybeSingle();

  let doc = withPasswordCols.data as {
    id: string;
    title?: string | null;
    current_version_id?: string | null;
    password_enabled?: boolean | null;
    password_hash?: string | null;
    require_recipient_identity?: boolean | null;
    max_acknowledgers_enabled?: boolean | null;
    max_acknowledgers?: number | null;
    closed_at?: string | null;
  } | null;
  let docErr = withPasswordCols.error;

  if (
    docErr &&
    (isMissingPasswordColumnError(docErr) ||
      isMissingRecipientRequirementColumnError(docErr) ||
      isMissingAcknowledgerLimitColumnError(docErr))
  ) {
    const fallback = await admin
      .from("documents")
      .select("id,title,current_version_id,password_enabled,password_hash,require_recipient_identity")
      .eq("public_id", publicId)
      .maybeSingle();
    doc = fallback.data as {
      id: string;
      title?: string | null;
      current_version_id?: string | null;
      password_enabled?: boolean | null;
      password_hash?: string | null;
      require_recipient_identity?: boolean | null;
    } | null;
    docErr = fallback.error;
  }

  if (docErr) {
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }

  if (!doc) {
    return NextResponse.json(
      { error: "Not found", publicId },
      { status: 404 }
    );
  }

  const maxAcknowledgersEnabled = Boolean(
    doc && "max_acknowledgers_enabled" in doc && doc.max_acknowledgers_enabled && (doc.max_acknowledgers ?? 0) > 0
  );
  const maxAcknowledgers = maxAcknowledgersEnabled ? Number(doc.max_acknowledgers ?? 0) : 0;
  const isExplicitlyClosed = Boolean(doc && "closed_at" in doc && doc.closed_at);
  if (isExplicitlyClosed) {
    return NextResponse.json(
      { error: "This link is closed. It is no longer accepting acknowledgements." },
      { status: 410 }
    );
  }

  if (acknowledged && maxAcknowledgersEnabled && maxAcknowledgers > 0) {
    const { count, error: countErr } = await admin
      .from("completions")
      .select("id", { head: true, count: "exact" })
      .eq("document_id", doc.id)
      .eq("acknowledged", true);
    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }
    if ((count ?? 0) >= maxAcknowledgers) {
      if ("closed_at" in doc) {
        await admin
          .from("documents")
          .update({ closed_at: new Date().toISOString() })
          .eq("id", doc.id)
          .is("closed_at", null);
      }
      return NextResponse.json(
        { error: "This link is closed. It is no longer accepting acknowledgements." },
        { status: 409 }
      );
    }
  }

  const passwordEnabled = Boolean(doc && "password_enabled" in doc && doc.password_enabled && doc.password_hash);
  if (passwordEnabled) {
    const cookieName = accessCookieName(publicId);
    const cookieValue = readCookie(req.headers.get("cookie"), cookieName);
    const expected = accessTokenFor(publicId, String(doc?.password_hash));
    if (!cookieValue || cookieValue !== expected) {
      return NextResponse.json({ error: "Password required" }, { status: 403 });
    }
  }

  const requireRecipientIdentity = Boolean(doc && "require_recipient_identity" in doc && doc.require_recipient_identity);
  if (requireRecipientIdentity) {
    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required for this document." }, { status: 400 });
    }
    if (!isEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
  }

  // Evidence metadata
  const user_agent = req.headers.get("user-agent");
  const ip = getClientIp(req);

  // Create recipient (even if name/email are null)
  const { data: recipient, error: recErr } = await admin
    .from("recipients")
    .insert({
      document_id: doc.id,
      name,
      email,
    })
    .select("id")
    .single();

  if (recErr || !recipient) {
    return NextResponse.json(
      { error: recErr?.message ?? "Recipient insert failed" },
      { status: 500 }
    );
  }

  // Create completion record
  const submittedAt = new Date().toISOString();
  const completionPayload = {
    document_id: doc.id,
    recipient_id: recipient.id,
    acknowledged,
    max_scroll_percent,
    time_on_page_seconds,
    active_seconds,
    user_agent,
    ip, // full IP stored intentionally
    submitted_at: submittedAt,
    document_version_id: doc.current_version_id ?? null,
  };

  let completion: { id: string } | null = null;
  let compErr: { message?: string; code?: string } | null = null;
  {
    const ins = await admin
      .from("completions")
      .insert(completionPayload)
      .select("id")
      .single();
    if (!ins.error && ins.data) {
      completion = ins.data as { id: string };
    } else {
      compErr = ins.error;
    }
  }

  if (!completion && compErr?.code === "42703") {
    const fallbackInsert = await admin
      .from("completions")
      .insert({
        document_id: doc.id,
        recipient_id: recipient.id,
        acknowledged,
        max_scroll_percent,
        time_on_page_seconds,
        active_seconds,
        user_agent,
        ip,
        submitted_at: submittedAt,
      })
      .select("id")
      .single();
    completion = (fallbackInsert.data as { id: string } | null) ?? null;
    compErr = fallbackInsert.error;
  }

  if (compErr || !completion) {
    return NextResponse.json(
      { error: compErr?.message ?? "Completion insert failed" },
      { status: 500 }
    );
  }

  if (acknowledged && maxAcknowledgersEnabled && maxAcknowledgers > 0) {
    const { count, error: countErr } = await admin
      .from("completions")
      .select("id", { head: true, count: "exact" })
      .eq("document_id", doc.id)
      .eq("acknowledged", true);
    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    if ((count ?? 0) > maxAcknowledgers) {
      await admin.from("completions").delete().eq("id", completion.id);
      await admin.from("recipients").delete().eq("id", recipient.id);
      return NextResponse.json(
        { error: "This link is closed. It is no longer accepting acknowledgements." },
        { status: 409 }
      );
    }

    if ("closed_at" in doc && (count ?? 0) >= maxAcknowledgers) {
      await admin
        .from("documents")
        .update({ closed_at: new Date().toISOString() })
        .eq("id", doc.id)
        .is("closed_at", null);
    }
  }

  let receiptEmailSent = false;
  if (acknowledged && email && isEmail(email) && process.env.RESEND_API_KEY) {
    const content = buildAcknowledgementReceiptEmail({
      recipientName: name,
      documentTitle: String(doc.title ?? "Document"),
      timestampUtc: formatUtc(submittedAt),
      publicId,
    });

    const result = await sendWithResend({
      to: email.toLowerCase(),
      subject: `Acknowledgement receipt: ${String(doc.title ?? "Document")}`,
      html: content.html,
      text: content.text,
    });
    receiptEmailSent = result.ok;
  }

  return NextResponse.json({
    ok: true,
    completion_id: completion.id,
    acknowledgement_receipt_email_sent: receiptEmailSent,
  });
}

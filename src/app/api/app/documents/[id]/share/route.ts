import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { sendWithResend } from "@/lib/email/resend";

type ShareBody = {
  emails?: string[];
};

type DocumentAccessRow = {
  id: string;
  title: string;
  public_id: string;
  workspace_id: string | null;
  owner_id: string;
  password_enabled?: boolean | null;
  password_hash?: string | null;
};

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim().toLowerCase());
}

function appBaseUrl(req: Request) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");

  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  if (host) return `${proto}://${host}`;
  return "https://www.getreceipt.co";
}

function escapeHtml(v: string) {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildShareEmail(input: {
  title: string;
  shareUrl: string;
  passwordProtected: boolean;
}) {
  const safeTitle = escapeHtml(input.title);
  const safeUrl = escapeHtml(input.shareUrl);

  const html = `
  <div style="margin:0;padding:24px;background:#f7f7f8;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:14px;padding:24px;">
      <div style="font-size:11px;letter-spacing:0.08em;color:#666;font-weight:700;">RECEIPT</div>
      <h1 style="margin:10px 0 0;font-size:20px;line-height:1.3;">A document was shared with you</h1>
      <p style="margin:14px 0 0;color:#333;font-size:14px;line-height:1.6;">
        You have been asked to review and acknowledge <strong>${safeTitle}</strong>.
      </p>
      <div style="margin-top:20px;">
        <a href="${safeUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:11px 16px;border-radius:999px;font-size:14px;font-weight:600;">Open document</a>
      </div>
      <p style="margin:14px 0 0;color:#5f6368;font-size:12px;line-height:1.5;">
        If the button does not work, use this URL:<br/><a href="${safeUrl}" style="color:#111;">${safeUrl}</a>
      </p>
      ${
        input.passwordProtected
          ? `<p style="margin:14px 0 0;color:#5f6368;font-size:12px;line-height:1.5;">This link is password-protected. The sender will share the password separately.</p>`
          : ""
      }
    </div>
  </div>`;

  const text = `A document was shared with you

You have been asked to review and acknowledge:
${input.title}

Open document: ${input.shareUrl}
${input.passwordProtected ? "\nThis link is password-protected. The sender will share the password separately." : ""}
`;

  return { html, text };
}

async function resolveDocumentForUser(documentId: string, userId: string) {
  const supabase = await supabaseServer();

  const { data: docData, error: docErr } = await supabase
    .from("documents")
    .select("id,title,public_id,workspace_id,owner_id,password_enabled,password_hash")
    .eq("id", documentId)
    .maybeSingle();

  if (docErr) throw new Error(docErr.message);
  if (!docData) return { allowed: false as const, reason: "Not found" };

  const doc = docData as DocumentAccessRow;
  if (!doc.workspace_id) {
    if (doc.owner_id !== userId) return { allowed: false as const, reason: "Forbidden" };
    return { allowed: true as const, doc };
  }

  const { data: member, error: memErr } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", doc.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (memErr) throw new Error(memErr.message);
  if (!member) return { allowed: false as const, reason: "Forbidden" };

  const role = String((member as { role?: string }).role ?? "");
  if (role !== "owner" && role !== "admin") return { allowed: false as const, reason: "Forbidden" };
  return { allowed: true as const, doc };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = (await ctx.params) as { id: string };
    const supabase = await supabaseServer();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return authErrorResponse(userErr);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const access = await resolveDocumentForUser(id, userData.user.id);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: access.reason === "Not found" ? 404 : 403 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Email sending is not configured yet. Set RESEND_API_KEY (and optionally RECEIPT_FROM_EMAIL)." },
        { status: 500 }
      );
    }

    const body = (await req.json().catch(() => null)) as ShareBody | null;
    const rawEmails = Array.isArray(body?.emails) ? body!.emails : [];
    const emails = Array.from(new Set(rawEmails.map((x) => String(x).trim().toLowerCase()).filter(Boolean)));
    if (emails.length === 0) {
      return NextResponse.json({ error: "At least one email is required." }, { status: 400 });
    }
    const invalid = emails.filter((x) => !isEmail(x));
    if (invalid.length > 0) {
      return NextResponse.json({ error: "One or more emails are invalid." }, { status: 400 });
    }

    const path = access.doc.password_enabled && access.doc.password_hash
      ? `/d/${access.doc.public_id}/access`
      : `/d/${access.doc.public_id}`;
    const fullShareUrl = `${appBaseUrl(req)}${path}`;
    const emailContent = buildShareEmail({
      title: String(access.doc.title ?? "Document"),
      shareUrl: fullShareUrl,
      passwordProtected: Boolean(access.doc.password_enabled && access.doc.password_hash),
    });

    const failures: Array<{ email: string; error: string }> = [];
    await Promise.all(
      emails.map(async (email) => {
        const result = await sendWithResend({
          to: email,
          subject: `Document shared: ${String(access.doc.title ?? "Document")}`,
          html: emailContent.html,
          text: emailContent.text,
        });
        if (!result.ok) failures.push({ email, error: result.error ?? "Failed to send." });
      })
    );

    return NextResponse.json({
      ok: true,
      attempted: emails.length,
      sent: emails.length - failures.length,
      failed: failures,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

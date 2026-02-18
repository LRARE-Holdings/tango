import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import crypto from "crypto";
import { hashPassword, isPasswordStrongEnough } from "@/lib/password";
import { sendWithResend } from "@/lib/email/resend";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";
import { currentUtcMonthRange, getDocumentQuota, normalizeEffectivePlan } from "@/lib/document-limits";

const MAX_MB = 20;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function resolveUploadMeta(file: File) {
  const name = (file.name || "").trim() || "upload";
  const lowerName = name.toLowerCase();
  const type = String(file.type ?? "").toLowerCase();

  const isPdf = type === "application/pdf" || lowerName.endsWith(".pdf");
  const isDocx = type === DOCX_MIME || lowerName.endsWith(".docx");
  if (!isPdf && !isDocx) {
    throw new Error("Only PDF or DOCX files are supported.");
  }

  return {
    ext: isDocx ? "docx" : "pdf",
    contentType: isDocx ? DOCX_MIME : "application/pdf",
  };
}

function errMessage(e: unknown) {
  return e instanceof Error ? e.message : "Server error";
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

type ParsedRecipient = {
  name: string;
  email: string;
};

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim().toLowerCase());
}

function parseRecipients(raw: FormDataEntryValue | null): ParsedRecipient[] {
  if (typeof raw !== "string" || !raw.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: ParsedRecipient[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const name = String((item as { name?: unknown }).name ?? "").trim();
    const email = String((item as { email?: unknown }).email ?? "").trim().toLowerCase();
    if (!email || !isEmail(email)) continue;
    out.push({ name, email });
  }

  const dedup = new Map<string, ParsedRecipient>();
  for (const r of out) dedup.set(r.email, r);
  return [...dedup.values()].slice(0, 50);
}

function appBaseUrl(req: Request) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");

  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  if (host) return `${proto}://${host}`;
  return "https://www.getreceipt.xyz";
}

function escapeHtml(v: string) {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildReceiptEmail({
  recipientName,
  workspaceName,
  title,
  shareUrl,
  passwordEnabled,
}: {
  recipientName: string;
  workspaceName: string | null;
  title: string;
  shareUrl: string;
  passwordEnabled: boolean;
}) {
  const safeTitle = escapeHtml(title);
  const safeWorkspace = workspaceName ? escapeHtml(workspaceName) : "Receipt";
  const intro = recipientName
    ? `Hi ${escapeHtml(recipientName)},`
    : "Hello,";

  const passwordNote = passwordEnabled
    ? `<p style="margin:16px 0 0;color:#5f6368;font-size:13px;line-height:1.5;">This link is password-protected. The sender should share the password separately.</p>`
    : "";

  const html = `
  <div style="margin:0;padding:24px;background:#f7f7f8;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:14px;padding:24px;">
      <div style="font-size:11px;letter-spacing:0.08em;color:#666;font-weight:700;">RECEIPT</div>
      <h1 style="margin:10px 0 0;font-size:20px;line-height:1.3;">${safeWorkspace} shared a document</h1>
      <p style="margin:14px 0 0;color:#333;font-size:14px;line-height:1.6;">${intro}</p>
      <p style="margin:10px 0 0;color:#333;font-size:14px;line-height:1.6;">You have been asked to review and acknowledge:</p>
      <p style="margin:8px 0 0;color:#111;font-size:15px;font-weight:600;">${safeTitle}</p>
      <div style="margin-top:20px;">
        <a href="${shareUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:11px 16px;border-radius:999px;font-size:14px;font-weight:600;">Open document</a>
      </div>
      <p style="margin:14px 0 0;color:#5f6368;font-size:12px;line-height:1.5;">If the button does not work, open this URL:</p>
      <p style="margin:6px 0 0;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${shareUrl}" style="color:#111;">${shareUrl}</a></p>
      ${passwordNote}
    </div>
  </div>`;

  const text = `${recipientName ? `Hi ${recipientName},` : "Hello,"}

${workspaceName ?? "Receipt"} shared a document with you:
${title}

Open document: ${shareUrl}
${passwordEnabled ? "\nThis link is password-protected. The sender should share the password separately." : ""}
`;

  return { html, text };
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const titleRaw = form.get("title");
    const passwordEnabledRaw = String(form.get("password_enabled") ?? "false").toLowerCase() === "true";
    const passwordRaw = typeof form.get("password") === "string" ? String(form.get("password")).trim() : "";
    const requireRecipientIdentityRaw =
      String(form.get("require_recipient_identity") ?? "false").toLowerCase() === "true";
    const maxAcknowledgersEnabledRaw =
      String(form.get("max_acknowledgers_enabled") ?? "false").toLowerCase() === "true";
    const maxAcknowledgersRaw = Number(form.get("max_acknowledgers") ?? 0);
    const maxAcknowledgers = maxAcknowledgersEnabledRaw
      ? clampInt(Number.isFinite(maxAcknowledgersRaw) ? maxAcknowledgersRaw : 1, 1, 1000)
      : null;
    const sendEmailsRaw = String(form.get("send_emails") ?? "false").toLowerCase() === "true";
    const recipients = parseRecipients(form.get("recipients"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      return NextResponse.json({ error: `Max file size is ${MAX_MB}MB` }, { status: 400 });
    }
    const uploadMeta = resolveUploadMeta(file);
    if (passwordEnabledRaw && !isPasswordStrongEnough(passwordRaw)) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const title = typeof titleRaw === "string" && titleRaw.trim().length
      ? titleRaw.trim()
      : "Untitled";

    const supabase = await supabaseServer();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }
    if (!userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const owner_id = userData.user.id;
    let workspace_id: string | null = null;

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("plan,primary_workspace_id")
      .eq("id", owner_id)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    const personalPlan = normalizeEffectivePlan(profile?.plan);
    let effectivePlan = personalPlan;
    let isPaidPlan = personalPlan !== "free";
    let personalPlus =
      personalPlan === "personal" || personalPlan === "pro" || personalPlan === "team" || personalPlan === "enterprise";
    const activeWorkspaceId = (profile?.primary_workspace_id as string | null) ?? null;
    let seatLimitForQuota = 1;
    let quotaByWorkspace = false;

    if (activeWorkspaceId) {
      const { data: membership, error: membershipErr } = await supabase
        .from("workspace_members")
        .select("role,license_active")
        .eq("workspace_id", activeWorkspaceId)
        .eq("user_id", owner_id)
        .maybeSingle();

      if (membershipErr) {
        return NextResponse.json({ error: membershipErr.message }, { status: 500 });
      }
      if (!membership) {
        return NextResponse.json({ error: "Active workspace is invalid for this user." }, { status: 403 });
      }
      if (membership.license_active === false) {
        return NextResponse.json(
          { error: "No active workspace license is assigned to your account." },
          { status: 403 }
        );
      }

      const workspaceEntitlements = await getWorkspaceEntitlementsForUser(admin, activeWorkspaceId, owner_id);
      if (!workspaceEntitlements || !workspaceEntitlements.license_active) {
        return NextResponse.json(
          { error: "No active workspace license is assigned to your account." },
          { status: 403 }
        );
      }
      isPaidPlan = workspaceEntitlements.is_paid;
      personalPlus = workspaceEntitlements.personal_plus;
      effectivePlan = workspaceEntitlements.plan;
      seatLimitForQuota = workspaceEntitlements.seat_limit;
      workspace_id = activeWorkspaceId;
      quotaByWorkspace = true;
    } else if (personalPlan === "team" || personalPlan === "enterprise") {
      const { count: membershipCount, error: countErr } = await supabase
        .from("workspace_members")
        .select("workspace_id", { count: "exact", head: true })
        .eq("user_id", owner_id);

      if (countErr) {
        return NextResponse.json({ error: countErr.message }, { status: 500 });
      }

      if ((membershipCount ?? 0) > 0) {
        return NextResponse.json(
          {
            error:
              "Select an active workspace before creating receipts. Team/Enterprise receipts must belong to a workspace.",
          },
          { status: 409 }
        );
      }
    }

    if (effectivePlan === "team" && !workspace_id) {
      const { data: ent } = await supabase
        .from("profile_entitlements")
        .select("seats")
        .eq("id", owner_id)
        .maybeSingle();
      const seats = Number((ent as { seats?: unknown } | null)?.seats ?? 1);
      seatLimitForQuota = Number.isFinite(seats) && seats > 0 ? Math.floor(seats) : 1;
    }

    const quota = getDocumentQuota(effectivePlan, seatLimitForQuota);
    if (quota.limit !== null) {
      if (quota.window === "total") {
        let countQuery = supabase
          .from("documents")
          .select("id", { count: "exact", head: true });
        if (quotaByWorkspace && workspace_id) {
          countQuery = countQuery.eq("workspace_id", workspace_id);
        } else {
          countQuery = countQuery.eq("owner_id", owner_id);
        }
        const { count, error: countErr } = await countQuery;
        if (countErr) {
          return NextResponse.json({ error: countErr.message }, { status: 500 });
        }
        if ((count ?? 0) >= quota.limit) {
          return NextResponse.json(
            {
              error: `You've reached the Free plan limit of ${quota.limit} receipts total. Upgrade to Personal or Pro to create more.`,
              code: "DOCUMENT_LIMIT_REACHED",
              plan: effectivePlan,
              limit: quota.limit,
              window: quota.window,
              upgrade_url: "/pricing",
            },
            { status: 403 }
          );
        }
      } else if (quota.window === "monthly") {
        const { startIso, endIso } = currentUtcMonthRange();
        let countQuery = supabase
          .from("documents")
          .select("id", { count: "exact", head: true })
          .gte("created_at", startIso)
          .lt("created_at", endIso);
        if (quotaByWorkspace && workspace_id) {
          countQuery = countQuery.eq("workspace_id", workspace_id);
        } else {
          countQuery = countQuery.eq("owner_id", owner_id);
        }
        const { count, error: countErr } = await countQuery;
        if (countErr) {
          return NextResponse.json({ error: countErr.message }, { status: 500 });
        }
        if ((count ?? 0) >= quota.limit) {
          return NextResponse.json(
            {
              error: `You've reached your ${effectivePlan} plan receipt limit for this month (${quota.limit}). Upgrade your plan to create more.`,
              code: "DOCUMENT_LIMIT_REACHED",
              plan: effectivePlan,
              limit: quota.limit,
              window: quota.window,
              upgrade_url: "/pricing",
            },
            { status: 403 }
          );
        }
      }
    }

    if (requireRecipientIdentityRaw && !isPaidPlan) {
      return NextResponse.json(
        { error: "Requiring name/email acknowledgement is available on paid plans." },
        { status: 403 }
      );
    }
    if (sendEmailsRaw && !personalPlus) {
      return NextResponse.json(
        { error: "Email sending is available on Personal plans and above." },
        { status: 403 }
      );
    }
    if (sendEmailsRaw && recipients.length === 0) {
      return NextResponse.json({ error: "Add at least one valid recipient email." }, { status: 400 });
    }
    if (sendEmailsRaw && !process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "Email sending is not configured yet." }, { status: 500 });
    }

    const public_id = nanoid(10);
    const password_hash = passwordEnabledRaw ? await hashPassword(passwordRaw) : null;

    const insertPayload: Record<string, unknown> = {
      owner_id,
      workspace_id,
      public_id,
      title,
      file_path: "pending",
    };

    if (passwordEnabledRaw) {
      insertPayload.password_enabled = true;
      insertPayload.password_hash = password_hash;
    }
    if (requireRecipientIdentityRaw && isPaidPlan) {
      insertPayload.require_recipient_identity = true;
    }
    if (maxAcknowledgersEnabledRaw && maxAcknowledgers) {
      insertPayload.max_acknowledgers_enabled = true;
      insertPayload.max_acknowledgers = maxAcknowledgers;
    }

    // 1) Create the doc row (file_path temp)
    const { data: doc, error: insertErr } = await supabase
      .from("documents")
      .insert(insertPayload)
      .select("id, public_id")
      .single();

    if (insertErr || !doc) {
      if (passwordEnabledRaw && insertErr?.code === "42703") {
        return NextResponse.json(
          { error: "Password protection is not available because required database columns are missing." },
          { status: 500 }
        );
      }
      if (requireRecipientIdentityRaw && insertErr?.code === "42703") {
        return NextResponse.json(
          { error: "Recipient identity requirement is not available because required database columns are missing." },
          { status: 500 }
        );
      }
      if (maxAcknowledgersEnabledRaw && insertErr?.code === "42703") {
        return NextResponse.json(
          { error: "Acknowledgement closure is not available because required database columns are missing." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: insertErr?.message ?? "Insert failed" }, { status: 500 });
    }

    // 2) Upload file to Storage
    const arrayBuffer = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);

    // Compute document integrity hash (hex)
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

    // Path convention: keep it simple for now.
    // Later: consider docs/{userId}/{docId} and enforce Storage RLS.
    const file_path = `public/${doc.id}.${uploadMeta.ext}`;

    const { error: uploadErr } = await admin.storage
      .from("docs")
      .upload(file_path, buf, {
        contentType: uploadMeta.contentType,
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    // 3) Update doc with real file_path
    const { error: updErr } = await supabase
      .from("documents")
      .update({ file_path, sha256 })
      .eq("id", doc.id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const sharePath = passwordEnabledRaw ? `/d/${doc.public_id}/access` : `/d/${doc.public_id}`;
    const shareUrl = `${appBaseUrl(req)}${sharePath}`;

    const emailFailures: Array<{ email: string; error: string }> = [];
    if (sendEmailsRaw && recipients.length > 0) {
      const workspaceName =
        workspace_id
          ? (
              (
                await admin
                  .from("workspaces")
                  .select("name")
                  .eq("id", workspace_id)
                  .maybeSingle()
              ).data as { name?: string } | null
            )?.name ?? null
          : null;

      await Promise.all(
        recipients.map(async (r) => {
          const content = buildReceiptEmail({
            recipientName: r.name,
            workspaceName,
            title,
            shareUrl,
            passwordEnabled: passwordEnabledRaw,
          });
          const subject = `${workspaceName ?? "Receipt"}: ${title}`;
          const result = await sendWithResend({
            to: r.email,
            subject,
            html: content.html,
            text: content.text,
          });
          if (!result.ok) {
            emailFailures.push({ email: r.email, error: result.error ?? "Failed to send." });
          }
        })
      );
    }

    return NextResponse.json({
      ok: true,
      id: doc.id,
      public_id: doc.public_id,
      share_url: sharePath,
      emails: {
        requested: sendEmailsRaw,
        attempted: sendEmailsRaw ? recipients.length : 0,
        sent: sendEmailsRaw ? recipients.length - emailFailures.length : 0,
        failed: emailFailures,
      },
    });
  } catch (e: unknown) {
    const msg = errMessage(e);
    const status = /missing file|pdf|docx|max file size/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

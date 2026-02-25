import { NextResponse } from "next/server";
import { sendWithResend } from "@/lib/email/resend";
import { limitEnterpriseEnquiry } from "@/lib/rate-limit";
import { publicErrorResponse, publicRateLimitResponse } from "@/lib/security/public-errors";
import { extractTurnstileToken, verifyTurnstileToken } from "@/lib/security/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EnquiryPayload = {
  name: string;
  email: string;
  company: string;
  seats: string;
  message: string;
  source: string;
  captchaToken?: string;
  turnstileToken?: string;
  cf_turnstile_response?: string;
};

function wantsJson(req: Request) {
  const accept = String(req.headers.get("accept") ?? "").toLowerCase();
  const contentType = String(req.headers.get("content-type") ?? "").toLowerCase();
  return accept.includes("application/json") || contentType.includes("application/json");
}

function redirectToEnquiryState(req: Request, state: "sent" | "invalid" | "error") {
  const url = new URL("/enterprise", req.url);
  url.searchParams.set("enquiry", state);
  return NextResponse.redirect(url, { status: 303 });
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizePayload(payload: EnquiryPayload) {
  return {
    ...payload,
    name: payload.name.slice(0, 120),
    email: payload.email.slice(0, 160),
    company: payload.company.slice(0, 160),
    seats: payload.seats.slice(0, 40),
    message: payload.message.slice(0, 4000),
    source: payload.source.slice(0, 80),
  };
}

function asPayload(input: unknown): EnquiryPayload {
  const row = (input ?? {}) as Record<string, unknown>;
  return sanitizePayload({
    name: String(row.name ?? "").trim(),
    email: String(row.email ?? "")
      .trim()
      .toLowerCase(),
    company: String(row.company ?? "").trim(),
    seats: String(row.seats ?? "").trim(),
    message: String(row.message ?? "").trim(),
    source: String(row.source ?? "enterprise").trim(),
    captchaToken: typeof row.captchaToken === "string" ? row.captchaToken : undefined,
    turnstileToken: typeof row.turnstileToken === "string" ? row.turnstileToken : undefined,
    cf_turnstile_response:
      typeof row.cf_turnstile_response === "string" ? row.cf_turnstile_response : undefined,
  });
}

async function parsePayload(req: Request): Promise<EnquiryPayload | null> {
  const contentType = String(req.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return null;
    return asPayload(body);
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return null;
  return asPayload({
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company"),
    seats: formData.get("seats"),
    message: formData.get("message"),
    source: formData.get("source"),
    captchaToken: formData.get("captchaToken"),
    turnstileToken: formData.get("turnstileToken"),
    cf_turnstile_response: formData.get("cf_turnstile_response"),
  });
}

function sendResult(req: Request, state: "sent" | "invalid" | "error", body?: Record<string, unknown>) {
  if (wantsJson(req)) {
    if (state === "sent") return NextResponse.json({ ok: true, ...(body ?? {}) });
    return NextResponse.json({ ok: false, ...(body ?? {}) }, { status: state === "invalid" ? 400 : 500 });
  }
  return redirectToEnquiryState(req, state);
}

export async function POST(req: Request) {
  const payload = await parsePayload(req);
  if (!payload) {
    if (wantsJson(req)) {
      return publicErrorResponse({
        status: 400,
        code: "INVALID_JSON",
        message: "Invalid enquiry payload.",
      });
    }
    return redirectToEnquiryState(req, "invalid");
  }

  if (!payload.name || !payload.email || !payload.company || !payload.message || !isEmail(payload.email)) {
    if (wantsJson(req)) {
      return publicErrorResponse({
        status: 400,
        code: "INVALID_REQUEST",
        message: "Name, work email, company, and message are required.",
      });
    }
    return redirectToEnquiryState(req, "invalid");
  }

  const turnstileToken = extractTurnstileToken(payload);
  if (!turnstileToken) {
    if (wantsJson(req)) {
      return publicErrorResponse({
        status: 400,
        code: "CAPTCHA_REQUIRED",
        message: "Security check is required.",
      });
    }
    return redirectToEnquiryState(req, "error");
  }

  const captcha = await verifyTurnstileToken({
    req,
    token: turnstileToken,
    expectedAction: "enterprise_enquiry",
  });
  if (!captcha.ok) {
    if (wantsJson(req)) {
      return publicErrorResponse({
        status: captcha.status,
        code: captcha.code,
        message: captcha.message,
      });
    }
    return redirectToEnquiryState(req, "error");
  }

  const rate = await limitEnterpriseEnquiry(req, payload.email);
  if (!rate.success) {
    if (rate.misconfigured) {
      if (wantsJson(req)) {
        return publicErrorResponse({
          status: 503,
          code: "SECURITY_MISCONFIGURED",
          message: "Service temporarily unavailable.",
        });
      }
      return redirectToEnquiryState(req, "error");
    }
    if (wantsJson(req)) return publicRateLimitResponse(rate, "Too many enquiries. Please try again later.");
    return redirectToEnquiryState(req, "error");
  }

  const inquiryDestination = String(
    process.env.RECEIPT_ENTERPRISE_INBOX || process.env.RECEIPT_FROM_EMAIL || ""
  ).trim();
  if (!inquiryDestination) {
    return sendResult(req, "error", { error: "Enterprise inbox is not configured." });
  }

  const createdAt = new Date().toISOString();
  const subject = `Enterprise enquiry: ${payload.company}`;
  const text = `New enterprise enquiry

Name: ${payload.name}
Email: ${payload.email}
Company: ${payload.company}
Seats: ${payload.seats || "Not specified"}
Source: ${payload.source || "enterprise"}
Created at: ${createdAt}

Message:
${payload.message}
`;

  const safe = {
    name: escapeHtml(payload.name),
    email: escapeHtml(payload.email),
    company: escapeHtml(payload.company),
    seats: escapeHtml(payload.seats || "Not specified"),
    source: escapeHtml(payload.source || "enterprise"),
    createdAt: escapeHtml(createdAt),
    message: escapeHtml(payload.message),
  };

  const html = `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#111;">
    <h2 style="margin:0 0 12px;">New enterprise enquiry</h2>
    <p><strong>Name:</strong> ${safe.name}</p>
    <p><strong>Email:</strong> ${safe.email}</p>
    <p><strong>Company:</strong> ${safe.company}</p>
    <p><strong>Seats:</strong> ${safe.seats}</p>
    <p><strong>Source:</strong> ${safe.source}</p>
    <p><strong>Created at:</strong> ${safe.createdAt}</p>
    <p><strong>Message:</strong></p>
    <pre style="white-space:pre-wrap;background:#f7f7f8;padding:12px;border-radius:8px;">${safe.message}</pre>
  </div>`;

  const sent = await sendWithResend({
    to: inquiryDestination,
    subject,
    html,
    text,
  });

  if (!sent.ok) {
    return sendResult(req, "error", { error: "Could not send enquiry right now." });
  }

  return sendResult(req, "sent");
}

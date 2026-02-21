import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  accessCookieName,
  accessTokenFor,
  constantTimeEquals,
  readCookie,
} from "@/lib/public-access";
import { limitPublicAccessAttempt, limitPublicRead } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/password";
import { publicErrorResponse, publicRateLimitResponse } from "@/lib/security/public-errors";
import { extractTurnstileToken, verifyTurnstileToken } from "@/lib/security/turnstile";

type DocRow = {
  id: string;
  title: string;
  password_enabled?: boolean | null;
  password_hash?: string | null;
  max_acknowledgers_enabled?: boolean | null;
  max_acknowledgers?: number | null;
  closed_at?: string | null;
};

function isMissingPasswordColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes("password_");
}

function isMissingAcknowledgerLimitColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  const msg = String(error.message ?? "").toLowerCase();
  return msg.includes("max_acknowledgers") || msg.includes("closed_at");
}

async function loadDoc(publicId: string) {
  const admin = supabaseAdmin();
  const withAllCols = await admin
    .from("documents")
    .select("id,title,password_enabled,password_hash,max_acknowledgers_enabled,max_acknowledgers,closed_at")
    .eq("public_id", publicId)
    .maybeSingle();

  if (withAllCols.error && isMissingAcknowledgerLimitColumnError(withAllCols.error)) {
    const withoutAckLimit = await admin
      .from("documents")
      .select("id,title,password_enabled,password_hash")
      .eq("public_id", publicId)
      .maybeSingle();
    return { data: withoutAckLimit.data as DocRow | null, error: withoutAckLimit.error };
  }

  if (withAllCols.error && isMissingPasswordColumnError(withAllCols.error)) {
    const fallback = await admin
      .from("documents")
      .select("id,title")
      .eq("public_id", publicId)
      .maybeSingle();
    return { data: fallback.data as DocRow | null, error: fallback.error };
  }

  return { data: withAllCols.data as DocRow | null, error: withAllCols.error };
}

async function isClosedForAcknowledgement(doc: DocRow) {
  if (doc.closed_at) return { closed: true };

  const limitEnabled = Boolean(doc.max_acknowledgers_enabled && (doc.max_acknowledgers ?? 0) > 0);
  if (!limitEnabled) return { closed: false };

  const admin = supabaseAdmin();
  const maxAcknowledgers = Number(doc.max_acknowledgers ?? 0);
  const { count, error } = await admin
    .from("completions")
    .select("id", { head: true, count: "exact" })
    .eq("document_id", doc.id)
    .eq("acknowledged", true);

  if (error) {
    return { closed: false, error: error.message };
  }
  return { closed: (count ?? 0) >= maxAcknowledgers };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ publicId: string }> | { publicId: string } }
) {
  const { publicId } = (await ctx.params) as { publicId: string };
  const readRate = await limitPublicRead(req, `doc-access:${publicId}`);
  if (!readRate.success) {
    if (readRate.misconfigured) {
      return publicErrorResponse({
        status: 503,
        code: "SECURITY_MISCONFIGURED",
        message: "Service temporarily unavailable.",
      });
    }
    return publicRateLimitResponse(readRate);
  }
  const { data: doc, error } = await loadDoc(publicId);

  if (error) {
    return publicErrorResponse({
      status: 500,
      code: "DOCUMENT_LOOKUP_FAILED",
      message: "Could not load access status.",
    });
  }
  if (!doc) return publicErrorResponse({ status: 404, code: "NOT_FOUND", message: "Not found." });

  const closure = await isClosedForAcknowledgement(doc);
  if (closure.error) {
    return publicErrorResponse({
      status: 500,
      code: "DOCUMENT_LOOKUP_FAILED",
      message: "Could not load access status.",
    });
  }
  if (closure.closed) {
    return publicErrorResponse({
      status: 410,
      code: "LINK_CLOSED",
      message: "This link is closed. It is no longer accepting acknowledgements.",
    });
  }

  const requiresPassword = Boolean(doc.password_enabled && doc.password_hash);
  if (!requiresPassword) {
    return NextResponse.json({
      title: doc.title ?? "Document",
      requires_password: false,
      access_granted: true,
    });
  }

  const cookieName = accessCookieName(publicId);
  const cookieValue = readCookie(req.headers.get("cookie"), cookieName);
  const expected = accessTokenFor(publicId, String(doc.password_hash));

  return NextResponse.json({
    title: doc.title ?? "Document",
    requires_password: true,
    access_granted: constantTimeEquals(cookieValue, expected),
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ publicId: string }> | { publicId: string } }
) {
  const { publicId } = (await ctx.params) as { publicId: string };
  const body = (await req.json().catch(() => null)) as
    | { password?: string; captchaToken?: string; turnstileToken?: string; cf_turnstile_response?: string }
    | null;

  const { data: doc, error } = await loadDoc(publicId);

  if (error) {
    return publicErrorResponse({
      status: 500,
      code: "DOCUMENT_LOOKUP_FAILED",
      message: "Could not verify access.",
    });
  }
  if (!doc) return publicErrorResponse({ status: 404, code: "NOT_FOUND", message: "Not found." });

  const closure = await isClosedForAcknowledgement(doc);
  if (closure.error) {
    return publicErrorResponse({
      status: 500,
      code: "DOCUMENT_LOOKUP_FAILED",
      message: "Could not verify access.",
    });
  }
  if (closure.closed) {
    return publicErrorResponse({
      status: 410,
      code: "LINK_CLOSED",
      message: "This link is closed. It is no longer accepting acknowledgements.",
    });
  }

  const requiresPassword = Boolean(doc.password_enabled && doc.password_hash);
  if (!requiresPassword) {
    return NextResponse.json({ ok: true, requires_password: false });
  }

  const rate = await limitPublicAccessAttempt(req, publicId);
  if (!rate.success) {
    if (rate.misconfigured) {
      return publicErrorResponse({
        status: 503,
        code: "SECURITY_MISCONFIGURED",
        message: "Service temporarily unavailable.",
      });
    }
    return publicRateLimitResponse(rate, "Too many attempts. Try again later.");
  }

  const captcha = await verifyTurnstileToken({
    req,
    token: extractTurnstileToken(body),
    expectedAction: "public_access",
  });
  if (!captcha.ok) {
    return publicErrorResponse({
      status: captcha.status,
      code: captcha.code,
      message: captcha.message,
    });
  }

  const password = typeof body?.password === "string" ? body.password : "";

  const ok = await verifyPassword(password, String(doc.password_hash));
  if (!ok) {
    return publicErrorResponse({
      status: 401,
      code: "PASSWORD_INVALID",
      message: "Incorrect password.",
    });
  }

  const token = accessTokenFor(publicId, String(doc.password_hash));
  const res = NextResponse.json({ ok: true, requires_password: true });
  res.cookies.set(accessCookieName(publicId), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return res;
}

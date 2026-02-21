import { NextResponse } from "next/server";
import { limitPasswordResetAttempt } from "@/lib/rate-limit";
import { publicErrorResponse, publicRateLimitResponse } from "@/lib/security/public-errors";
import { supabaseServer } from "@/lib/supabase/server";
import { extractTurnstileToken, verifyTurnstileToken } from "@/lib/security/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const sessionProbe = await supabase.auth.getUser().catch(() => null);
  const isAuthenticatedRequest = Boolean(sessionProbe?.data?.user);

  let body: {
    email?: string;
    captchaToken?: string;
    turnstileToken?: string;
    cf_turnstile_response?: string;
  };
  try {
    body = (await req.json()) as {
      email?: string;
      captchaToken?: string;
      turnstileToken?: string;
      cf_turnstile_response?: string;
    };
  } catch {
    return publicErrorResponse({
      status: 400,
      code: "INVALID_JSON",
      message: "Invalid JSON.",
    });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) {
    return publicErrorResponse({
      status: 400,
      code: "EMAIL_REQUIRED",
      message: "Email is required.",
    });
  }

  const rate = await limitPasswordResetAttempt(req, email);
  if (!rate.success) {
    if (rate.misconfigured) {
      return publicErrorResponse({
        status: 503,
        code: "SECURITY_MISCONFIGURED",
        message: "Service temporarily unavailable.",
      });
    }
    return publicRateLimitResponse(rate, "Too many reset attempts. Try again later.");
  }

  if (!isAuthenticatedRequest) {
    const captcha = await verifyTurnstileToken({
      req,
      token: extractTurnstileToken(body),
    });
    if (!captcha.ok) {
      return publicErrorResponse({
        status: captcha.status,
        code: captcha.code,
        message: captcha.message,
      });
    }
  }

  // Where the user lands after clicking the reset email
  // (must be allowed in Supabase Auth redirect URLs)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.getreceipt.co";
  const redirectTo = `${baseUrl}/auth/reset`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    return publicErrorResponse({
      status: 500,
      code: "PASSWORD_RESET_FAILED",
      message: "Could not process password reset.",
    });
  }

  // Don't reveal whether the email exists
  return NextResponse.json({ ok: true });
}

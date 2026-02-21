import { NextResponse } from "next/server";
import {
  RECEIPT_LAUNCH_UNLOCK_COOKIE,
  isReceiptLaunchLive,
  isValidReceiptLaunchPassword,
} from "@/lib/launch-access";
import { limitLaunchAccessAttempt } from "@/lib/rate-limit";
import { publicErrorResponse, publicRateLimitResponse } from "@/lib/security/public-errors";
import { extractTurnstileToken, verifyTurnstileToken } from "@/lib/security/turnstile";

export async function POST(req: Request) {
  const rate = await limitLaunchAccessAttempt(req);
  if (!rate.success) {
    if (rate.misconfigured) {
      return publicErrorResponse({
        status: 503,
        code: "SECURITY_MISCONFIGURED",
        message: "Service temporarily unavailable.",
      });
    }
    return publicRateLimitResponse(rate);
  }

  const body = (await req.json().catch(() => null)) as
    | { password?: string; captchaToken?: string; turnstileToken?: string; cf_turnstile_response?: string }
    | null;
  const password = typeof body?.password === "string" ? body.password : "";

  const captcha = await verifyTurnstileToken({
    req,
    token: extractTurnstileToken(body),
    expectedAction: "launch_access",
  });
  if (!captcha.ok) {
    return publicErrorResponse({
      status: captcha.status,
      code: captcha.code,
      message: captcha.message,
    });
  }

  if (!isReceiptLaunchLive() && !isValidReceiptLaunchPassword(password)) {
    return publicErrorResponse({
      status: 401,
      code: "LAUNCH_PASSWORD_INVALID",
      message: "Incorrect access password.",
    });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: RECEIPT_LAUNCH_UNLOCK_COOKIE,
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

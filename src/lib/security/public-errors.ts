import { NextResponse } from "next/server";

type ErrorHeaders = Record<string, string>;

type RateLimitShape = {
  limit?: number;
  remaining?: number;
  reset?: number;
};

export function publicErrorResponse({
  status,
  code,
  message,
  headers,
}: {
  status: number;
  code: string;
  message: string;
  headers?: ErrorHeaders;
}) {
  return NextResponse.json(
    {
      error: message,
      code,
    },
    {
      status,
      headers,
    }
  );
}

export function publicRateLimitResponse(rate: RateLimitShape, message = "Too many requests. Try again later.") {
  const retryAfter = rate.reset ? Math.max(1, Math.ceil((rate.reset - Date.now()) / 1000)) : 60;
  return publicErrorResponse({
    status: 429,
    code: "RATE_LIMITED",
    message,
    headers: {
      "Retry-After": String(retryAfter),
      ...(typeof rate.limit === "number" ? { "X-RateLimit-Limit": String(rate.limit) } : {}),
      ...(typeof rate.remaining === "number" ? { "X-RateLimit-Remaining": String(rate.remaining) } : {}),
    },
  });
}


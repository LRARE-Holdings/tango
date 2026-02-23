import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateLimitResult = {
  success: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
  misconfigured?: boolean;
};

function getClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || req.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

function createLimiter(tokens: number, window: `${number} s` | `${number} m` | `${number} h`, prefix: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redis = new Redis({ url, token });
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix,
  });
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

const accessAttemptLimiter = createLimiter(8, "10 m", "rl:public-access-attempt");
const submitLimiter = createLimiter(30, "10 m", "rl:public-submit");
const passwordResetLimiter = createLimiter(10, "10 m", "rl:password-reset");
const stackSubmitLimiter = createLimiter(20, "10 m", "rl:public-stack-submit");
const stackFinalizeLimiter = createLimiter(12, "10 m", "rl:public-stack-finalize");
const publicReadLimiter = createLimiter(180, "10 m", "rl:public-read");
const enterpriseEnquiryLimiter = createLimiter(6, "10 m", "rl:enterprise-enquiry");

async function limitBy(
  limiter: Ratelimit | null,
  key: string
): Promise<RateLimitResult> {
  if (!limiter) {
    if (isProduction()) {
      return { success: false, misconfigured: true };
    }
    return { success: true };
  }
  return limiter.limit(key);
}

export async function limitPublicAccessAttempt(req: Request, publicId: string) {
  return limitBy(accessAttemptLimiter, `${publicId}:${getClientIp(req)}`);
}

export async function limitPublicSubmit(req: Request, publicId: string) {
  return limitBy(submitLimiter, `${publicId}:${getClientIp(req)}`);
}

export async function limitPublicRead(req: Request, identifier: string) {
  return limitBy(publicReadLimiter, `${identifier}:${getClientIp(req)}`);
}

export async function limitPublicStackSubmit(req: Request, stackPublicId: string) {
  return limitBy(stackSubmitLimiter, `${stackPublicId}:${getClientIp(req)}`);
}

export async function limitPublicStackFinalize(req: Request, stackPublicId: string) {
  return limitBy(stackFinalizeLimiter, `${stackPublicId}:${getClientIp(req)}`);
}

export async function limitPasswordResetAttempt(req: Request, email: string) {
  const normalized = String(email ?? "").trim().toLowerCase();
  return limitBy(passwordResetLimiter, `${normalized}:${getClientIp(req)}`);
}

export async function limitEnterpriseEnquiry(req: Request, email: string) {
  const normalized = String(email ?? "").trim().toLowerCase();
  return limitBy(enterpriseEnquiryLimiter, `${normalized}:${getClientIp(req)}`);
}

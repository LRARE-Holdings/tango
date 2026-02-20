import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateLimitResult = {
  success: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
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

const accessAttemptLimiter = createLimiter(8, "10 m", "rl:public-access-attempt");
const submitLimiter = createLimiter(30, "10 m", "rl:public-submit");

async function limitBy(
  limiter: Ratelimit | null,
  key: string
): Promise<RateLimitResult> {
  if (!limiter) return { success: true };
  return limiter.limit(key);
}

export async function limitPublicAccessAttempt(req: Request, publicId: string) {
  return limitBy(accessAttemptLimiter, `${publicId}:${getClientIp(req)}`);
}

export async function limitPublicSubmit(req: Request, publicId: string) {
  return limitBy(submitLimiter, `${publicId}:${getClientIp(req)}`);
}

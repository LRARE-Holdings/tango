import crypto from "crypto";

const DEFAULT_LAUNCH_AT = "2026-02-23T00:00:00Z";

function parseLaunchAt(raw: string | undefined) {
  const candidate = String(raw ?? "").trim() || DEFAULT_LAUNCH_AT;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("RECEIPT_LAUNCH_AT must be a valid ISO date/time.");
  }
  return parsed;
}

function launchPasswordFromEnv() {
  const value = String(process.env.RECEIPT_LAUNCH_PASSWORD ?? "").trim();

  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("RECEIPT_LAUNCH_PASSWORD is not configured.");
  }

  return value;
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export const RECEIPT_LAUNCH_AT = parseLaunchAt(process.env.RECEIPT_LAUNCH_AT);
export const RECEIPT_LAUNCH_UNLOCK_COOKIE = "receipt_launch_access";

export function isReceiptLaunchLive(now = new Date()) {
  return now.getTime() >= RECEIPT_LAUNCH_AT.getTime();
}

export function isValidReceiptLaunchPassword(password: string) {
  const expected = launchPasswordFromEnv();
  if (!expected) return false;
  return safeCompare(password.trim(), expected);
}

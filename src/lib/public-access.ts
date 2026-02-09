import crypto from "crypto";

function accessSecret() {
  const secret =
    process.env.RECEIPT_PUBLIC_ACCESS_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret || secret.trim().length < 16) {
    throw new Error("Public access secret is not configured. Set RECEIPT_PUBLIC_ACCESS_SECRET.");
  }

  return secret;
}

export function accessCookieName(publicId: string) {
  return `receipt_access_${publicId}`;
}

export function accessTokenFor(publicId: string, passwordHash: string) {
  return crypto
    .createHmac("sha256", accessSecret())
    .update(`${publicId}:${passwordHash}`)
    .digest("base64url");
}

export function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const entries = cookieHeader.split(";");
  for (const entry of entries) {
    const [rawKey, ...rest] = entry.split("=");
    if (!rawKey) continue;
    if (rawKey.trim() !== name) continue;
    return decodeURIComponent(rest.join("=").trim());
  }
  return null;
}

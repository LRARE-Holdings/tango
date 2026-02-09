import crypto from "crypto";

const SCRYPT_KEYLEN = 64;
const MIN_PASSWORD_LENGTH = 6;

function toBase64(buf: Buffer) {
  return buf.toString("base64");
}

function fromBase64(v: string) {
  return Buffer.from(v, "base64");
}

export function isPasswordStrongEnough(password: string) {
  return typeof password === "string" && password.trim().length >= MIN_PASSWORD_LENGTH;
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${toBase64(salt)}$${toBase64(key)}`;
}

export function verifyPassword(password: string, hash: string) {
  if (!password || !hash) return false;
  const parts = hash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  try {
    const salt = fromBase64(parts[1]);
    const expected = fromBase64(parts[2]);
    const candidate = crypto.scryptSync(password, salt, expected.length);
    return crypto.timingSafeEqual(expected, candidate);
  } catch {
    return false;
  }
}


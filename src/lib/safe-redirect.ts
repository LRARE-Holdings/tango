export function isSafeInternalPath(value: string | null | undefined): value is string {
  if (!value) return false;
  const candidate = value.trim();
  if (!candidate.startsWith("/")) return false;
  if (candidate.startsWith("//")) return false;
  if (candidate.includes("\\")) return false;
  if (/[\u0000-\u001F\u007F]/.test(candidate)) return false;
  if (candidate.includes("\r") || candidate.includes("\n")) return false;

  try {
    const parsed = new URL(candidate, "https://receipt.local");
    if (parsed.origin !== "https://receipt.local") return false;
  } catch {
    return false;
  }

  return true;
}

export function safeInternalPath(value: string | null | undefined, fallback = "/app") {
  if (!value) return fallback;
  const candidate = value.trim();
  return isSafeInternalPath(candidate) ? candidate : fallback;
}

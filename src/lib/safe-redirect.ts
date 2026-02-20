export function isSafeInternalPath(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  return true;
}

export function safeInternalPath(value: string | null | undefined, fallback = "/app") {
  return isSafeInternalPath(value) ? value : fallback;
}

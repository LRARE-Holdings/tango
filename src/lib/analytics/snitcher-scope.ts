export function isPublicTrackingPath(pathname: string): boolean {
  const path = String(pathname || "/").trim() || "/";
  if (path === "/app" || path.startsWith("/app/")) return false;

  if (path === "/") return true;
  if (path === "/auth" || path.startsWith("/auth/")) return true;
  if (path === "/get-started" || path.startsWith("/get-started/")) return true;
  if (path === "/launch-access" || path.startsWith("/launch-access/")) return true;
  if (path === "/d" || path.startsWith("/d/")) return true;

  // Default allow for non-app pages.
  return true;
}

import { expect, test } from "@playwright/test";

const workspaceIdentifier = process.env.WORKSPACE_IDENTIFIER || "";
const ownerCookie = process.env.WORKSPACE_OWNER_COOKIE || process.env.WORKSPACE_MEMBER_COOKIE || "";

function authHeaders(cookie: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return headers;
}

test.describe("app shell visual contract", () => {
  test("personal dashboard renders redesigned modules", async ({ request }) => {
    test.skip(!ownerCookie, "WORKSPACE_OWNER_COOKIE or WORKSPACE_MEMBER_COOKIE not configured.");

    const res = await request.get("/app", {
      headers: authHeaders(ownerCookie),
      maxRedirects: 0,
    });

    expect([200, 302, 307, 308]).toContain(res.status());
    if (res.status() !== 200) return;

    const html = await res.text();
    expect(html).toContain("Needs attention");
    expect(html).toContain("Recent activity");
    expect(html).toContain("app-v2-stats-grid");
  });

  test("workspace dashboard renders usage rail", async ({ request }) => {
    test.skip(!ownerCookie || !workspaceIdentifier, "WORKSPACE_OWNER_COOKIE/WORKSPACE_IDENTIFIER not configured.");

    const res = await request.get(`/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/dashboard`, {
      headers: authHeaders(ownerCookie),
      maxRedirects: 0,
    });

    expect([200, 302, 307, 308]).toContain(res.status());
    if (res.status() !== 200) return;

    const html = await res.text();
    expect(html).toContain("Workspace");
    expect(html).toContain("Recent activity");
    expect(html).toContain("app-v2-dashboard-grid");
  });

  test("theme script remains present for light/dark mode handling", async ({ request }) => {
    const res = await request.get("/auth");
    expect(res.ok()).toBeTruthy();
    const html = await res.text();
    expect(html).toContain("receipt-theme");
  });
});

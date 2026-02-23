import { expect, test } from "@playwright/test";

const marketingRoutes = [
  "/",
  "/product",
  "/pricing",
  "/use-cases",
  "/security",
  "/enterprise",
  "/privacy",
  "/terms",
  "/dpa",
  "/data-retention",
  "/get-started",
  "/auth",
  "/maintenance",
];

const canonicalRoutes = ["/", "/product", "/pricing", "/use-cases", "/security", "/enterprise", "/privacy", "/terms", "/dpa", "/data-retention"];
const protectedAppRoutes = ["/app", "/app/new", "/app/files", "/app/account", "/app/workspaces"];

test.describe("marketing and public surfaces", () => {
  for (const route of marketingRoutes) {
    test(`route responds: ${route}`, async ({ request }) => {
      const res = await request.get(route, { maxRedirects: 0 });
      expect([200, 302, 307, 308]).toContain(res.status());
    });
  }

  for (const route of canonicalRoutes) {
    test(`canonical metadata present: ${route}`, async ({ request }) => {
      const res = await request.get(route);
      expect(res.ok()).toBeTruthy();
      const html = await res.text();
      expect(html.toLowerCase()).toContain('rel="canonical"');
    });
  }

  test("home contains core CTA paths", async ({ request }) => {
    const res = await request.get("/");
    expect(res.ok()).toBeTruthy();
    const html = await res.text();
    expect(html).toContain("/get-started");
    expect(html).toContain("/product");
    expect(html).toContain("/pricing");
  });

  for (const route of protectedAppRoutes) {
    test(`protected app route redirects to auth: ${route}`, async ({ request }) => {
      const res = await request.get(route, { maxRedirects: 0 });
      expect([302, 307, 308]).toContain(res.status());

      const location = res.headers()["location"] || "";
      expect(location).toContain("/auth");
    });
  }

  test("auth and get-started remain directly reachable", async ({ request }) => {
    for (const route of ["/auth", "/get-started"]) {
      const res = await request.get(route, { maxRedirects: 0 });
      expect([200, 302, 307, 308]).toContain(res.status());
    }
  });
});

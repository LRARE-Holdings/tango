import { expect, test } from "@playwright/test";
import { isTruthy } from "../helpers/env";

test.describe("api security controls", () => {
  test("unauthenticated app API is rejected", async ({ request }) => {
    const me = await request.get("/api/app/me");
    expect(me.status()).toBe(401);

    const docs = await request.get("/api/app/documents");
    expect(docs.status()).toBe(401);
  });

  test("billing webhook rejects missing signature", async ({ request }) => {
    const res = await request.post("/api/billing/webhook", {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("custom checkout session endpoint rejects unauthenticated requests", async ({ request }) => {
    const res = await request.post("/api/billing/checkout/session", {
      data: {
        plan: "personal",
        billing: "monthly",
      },
    });
    expect(res.status()).toBe(401);
  });

  test("billing portal deep-link endpoint rejects unauthenticated requests", async ({ request }) => {
    const res = await request.post("/api/billing/portal", {
      data: { flow: "subscription_update" },
    });
    expect(res.status()).toBe(401);
  });

  test("debug endpoints are gated by env flag", async ({ request }) => {
    const enabled = isTruthy(process.env.ENABLE_DEBUG_ENDPOINTS);

    const debugMe = await request.get("/api/debug/me");
    const sentryExample = await request.get("/api/sentry-example-api");

    if (enabled) {
      expect([200, 401, 500]).toContain(debugMe.status());
      expect([500]).toContain(sentryExample.status());
      return;
    }

    expect(debugMe.status()).toBe(404);
    expect(sentryExample.status()).toBe(404);
  });

  test("standard security headers are present", async ({ request }) => {
    const res = await request.get("/");
    expect(res.ok()).toBeTruthy();

    const headers = res.headers();
    expect(headers["strict-transport-security"]).toBeTruthy();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
  });

  test("security headers are also present on API responses", async ({ request }) => {
    const res = await request.get("/api/app/me");
    expect([200, 401]).toContain(res.status());

    const headers = res.headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
  });

  test("private surfaces are noindex tagged", async ({ request }) => {
    const appPage = await request.get("/app", { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(appPage.status());
    expect(appPage.headers()["x-robots-tag"]).toContain("noindex");

    const checkoutPage = await request.get("/checkout", { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(checkoutPage.status());
    expect(checkoutPage.headers()["x-robots-tag"]).toContain("noindex");

    const onboardingPage = await request.get("/onboarding");
    expect([200, 302, 307]).toContain(onboardingPage.status());
    expect(onboardingPage.headers()["x-robots-tag"]).toContain("noindex");
  });
});

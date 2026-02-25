import { expect, test } from "@playwright/test";
import { isTruthy } from "../helpers/env";

const publicDocId = process.env.PUBLIC_DOC_ID || "";
const publicDocWrongPassword = process.env.PUBLIC_DOC_WRONG_PASSWORD || "incorrect-password";
const turnstileToken = process.env.TURNSTILE_TEST_TOKEN || "";
const stackPublicId = process.env.PUBLIC_STACK_ID || "";
const stackRecipientEmail = process.env.PUBLIC_STACK_RECIPIENT_EMAIL || "";

test.describe("public flow abuse/security contract", () => {
  test("public document submit requires captcha", async ({ request }) => {
    test.skip(!publicDocId, "PUBLIC_DOC_ID not configured.");

    const res = await request.post(`/api/public/${encodeURIComponent(publicDocId)}/submit`, {
      data: {
        acknowledged: true,
      },
    });

    expect([400, 403]).toContain(res.status());
  });

  test("public access wrong password yields 401 when valid captcha token is provided", async ({ request }) => {
    test.skip(!publicDocId || !turnstileToken, "PUBLIC_DOC_ID or TURNSTILE_TEST_TOKEN not configured.");

    const res = await request.post(`/api/public/${encodeURIComponent(publicDocId)}/access`, {
      data: {
        password: publicDocWrongPassword,
        captchaToken: turnstileToken,
        turnstileToken,
        cf_turnstile_response: turnstileToken,
      },
    });

    expect(res.status()).toBe(401);
  });

  test("stack finalize requires captcha", async ({ request }) => {
    test.skip(!stackPublicId || !stackRecipientEmail, "PUBLIC_STACK_ID or PUBLIC_STACK_RECIPIENT_EMAIL not configured.");

    const res = await request.post(`/api/public/stacks/${encodeURIComponent(stackPublicId)}/finalize`, {
      data: {
        email: stackRecipientEmail,
      },
    });
    expect([400, 403]).toContain(res.status());
  });

  test("optional rate-limit stress check for password reset", async ({ request }) => {
    test.skip(!isTruthy(process.env.ENABLE_RATE_LIMIT_STRESS_TEST), "ENABLE_RATE_LIMIT_STRESS_TEST is not enabled.");

    let saw429 = false;
    for (let i = 0; i < 15; i += 1) {
      const res = await request.post("/api/auth/password-reset", {
        data: {
          email: "stress-test@example.com",
          captchaToken: "invalid-token",
        },
      });
      if (res.status() === 429) {
        saw429 = true;
        break;
      }
    }

    expect(saw429).toBeTruthy();
  });

  test("enterprise enquiry endpoint requires captcha", async ({ request }) => {
    const res = await request.post("/api/public/enterprise-enquiry", {
      data: {
        name: "Security Test",
        email: "security-test@example.com",
        company: "Receipt QA",
        message: "Verify captcha requirement for enterprise enquiries.",
      },
    });

    expect([400, 403]).toContain(res.status());
  });
});

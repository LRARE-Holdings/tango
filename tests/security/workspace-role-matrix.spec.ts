import { expect, test } from "@playwright/test";

const workspaceId = process.env.WORKSPACE_IDENTIFIER || "";
const ownerCookie = process.env.WORKSPACE_OWNER_COOKIE || "";
const memberCookie = process.env.WORKSPACE_MEMBER_COOKIE || "";

function authHeaders(cookie: string) {
  return cookie ? { cookie } : {};
}

test.describe("workspace role matrix (env-driven)", () => {
  test("owner can reach workspace settings endpoint", async ({ request }) => {
    test.skip(!workspaceId || !ownerCookie, "WORKSPACE_IDENTIFIER or WORKSPACE_OWNER_COOKIE not configured.");

    const res = await request.get(`/api/app/workspaces/${encodeURIComponent(workspaceId)}`, {
      headers: authHeaders(ownerCookie),
    });

    expect(res.status()).toBe(200);
  });

  test("member cannot reach admin settings layout data endpoint", async ({ request }) => {
    test.skip(!workspaceId || !memberCookie, "WORKSPACE_IDENTIFIER or WORKSPACE_MEMBER_COOKIE not configured.");

    const res = await request.patch(`/api/app/workspaces/${encodeURIComponent(workspaceId)}`, {
      headers: {
        ...authHeaders(memberCookie),
        "content-type": "application/json",
      },
      data: { name: "forbidden-update-attempt" },
    });

    expect(res.status()).toBe(403);
  });
});


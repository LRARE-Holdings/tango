import { expect, test } from "@playwright/test";

const workspaceId = process.env.WORKSPACE_IDENTIFIER || "";
const ownerCookie = process.env.WORKSPACE_OWNER_COOKIE || "";
const memberCookie = process.env.WORKSPACE_MEMBER_COOKIE || "";
const groupsWorkspaceId = process.env.WORKSPACE_GROUPS_WORKSPACE_IDENTIFIER || workspaceId;
const groupsMutationEnabled = process.env.WORKSPACE_GROUPS_MUTATION_EXPECT_ENABLED === "1";
const featureGatedWorkspaceId = process.env.FEATURE_GATED_WORKSPACE_IDENTIFIER || "";
const featureGatedCookie = process.env.FEATURE_GATED_MEMBER_COOKIE || memberCookie;

function authHeaders(cookie: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return headers;
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

  test("member cannot mutate workspace profile photo policy", async ({ request }) => {
    test.skip(!workspaceId || !memberCookie, "WORKSPACE_IDENTIFIER or WORKSPACE_MEMBER_COOKIE not configured.");

    const res = await request.patch(`/api/app/workspaces/${encodeURIComponent(workspaceId)}`, {
      headers: {
        ...authHeaders(memberCookie),
        "content-type": "application/json",
      },
      data: { member_profile_photo_mode: "company" },
    });

    expect(res.status()).toBe(403);
  });

  test("member cannot mutate contact groups endpoint", async ({ request }) => {
    test.skip(!groupsWorkspaceId || !memberCookie, "WORKSPACE_GROUPS_WORKSPACE_IDENTIFIER/WORKSPACE_MEMBER_COOKIE not configured.");

    const res = await request.post(`/api/app/workspaces/${encodeURIComponent(groupsWorkspaceId)}/contact-groups`, {
      headers: {
        ...authHeaders(memberCookie),
        "content-type": "application/json",
      },
      data: {
        name: `forbidden-group-${Date.now()}`,
      },
    });

    expect(res.status()).toBe(403);
  });

  test("owner can mutate contact groups endpoint", async ({ request }) => {
    test.skip(
      !groupsWorkspaceId || !ownerCookie || !groupsMutationEnabled,
      "Set WORKSPACE_GROUPS_WORKSPACE_IDENTIFIER, WORKSPACE_OWNER_COOKIE, and WORKSPACE_GROUPS_MUTATION_EXPECT_ENABLED=1."
    );

    const createRes = await request.post(`/api/app/workspaces/${encodeURIComponent(groupsWorkspaceId)}/contact-groups`, {
      headers: {
        ...authHeaders(ownerCookie),
        "content-type": "application/json",
      },
      data: {
        name: `security-group-${Date.now()}`,
      },
    });

    const createJson = (await createRes.json().catch(() => null)) as { group?: { id?: string }; error?: string } | null;
    expect(createRes.status()).toBe(201);

    const groupId = String(createJson?.group?.id ?? "");
    if (groupId) {
      const deleteRes = await request.delete(
        `/api/app/workspaces/${encodeURIComponent(groupsWorkspaceId)}/contact-groups/${encodeURIComponent(groupId)}`,
        {
          headers: authHeaders(ownerCookie),
        }
      );
      expect([200, 204]).toContain(deleteRes.status());
    }
  });

  test("owner can patch workspace profile photo policy", async ({ request }) => {
    test.skip(
      !workspaceId || !ownerCookie || process.env.WORKSPACE_PHOTO_POLICY_EXPECT_ENABLED !== "1",
      "Set WORKSPACE_IDENTIFIER, WORKSPACE_OWNER_COOKIE, and WORKSPACE_PHOTO_POLICY_EXPECT_ENABLED=1."
    );

    const getRes = await request.get(`/api/app/workspaces/${encodeURIComponent(workspaceId)}`, {
      headers: authHeaders(ownerCookie),
    });
    expect(getRes.status()).toBe(200);
    const getJson = (await getRes.json().catch(() => null)) as
      | { workspace?: { member_profile_photo_mode?: "allow" | "disabled" | "company" } }
      | null;
    const current = getJson?.workspace?.member_profile_photo_mode ?? "allow";

    const patchRes = await request.patch(`/api/app/workspaces/${encodeURIComponent(workspaceId)}`, {
      headers: {
        ...authHeaders(ownerCookie),
        "content-type": "application/json",
      },
      data: { member_profile_photo_mode: current },
    });

    expect(patchRes.status()).toBe(200);
  });

  test("feature-gated templates endpoint denies non-entitled workspace", async ({ request }) => {
    test.skip(
      !featureGatedWorkspaceId || !featureGatedCookie,
      "FEATURE_GATED_WORKSPACE_IDENTIFIER/FEATURE_GATED_MEMBER_COOKIE not configured."
    );

    const res = await request.get(`/api/app/workspaces/${encodeURIComponent(featureGatedWorkspaceId)}/templates`, {
      headers: authHeaders(featureGatedCookie),
    });

    expect(res.status()).toBe(403);
  });
});

import { supabaseAdmin } from "@/lib/supabase/admin";

export type WorkspaceRole = "owner" | "admin" | "member";

export type WorkspaceLicenseMember = {
  user_id: string;
  role: WorkspaceRole;
  license_active: boolean;
  can_view_analytics: boolean;
  license_assigned_at: string | null;
  license_assigned_by: string | null;
  license_revoked_at: string | null;
  license_revoked_by: string | null;
  joined_at: string | null;
};

export type WorkspaceLicensingSummary = {
  workspace_id: string;
  billing_owner_user_id: string;
  plan: EffectivePlan;
  seat_limit: number;
  used_seats: number;
  available_seats: number;
};

export type EffectivePlan = "free" | "personal" | "pro" | "team" | "enterprise";

export type WorkspaceEntitlementsForUser = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  license_active: boolean;
  billing_owner_user_id: string;
  plan: EffectivePlan;
  is_paid: boolean;
  personal_plus: boolean;
  workspace_plus: boolean;
  seat_limit: number;
  used_seats: number;
  available_seats: number;
};

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, column: string) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes(column.toLowerCase());
}

function asSeatLimit(input: unknown) {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function normalizePlan(v: unknown): EffectivePlan {
  const p = String(v ?? "free").trim().toLowerCase();
  if (p === "personal" || p === "pro" || p === "team" || p === "enterprise") return p;
  return "free";
}

export async function getWorkspaceLicensing(
  admin: ReturnType<typeof supabaseAdmin>,
  workspaceId: string
): Promise<{ summary: WorkspaceLicensingSummary; members: WorkspaceLicenseMember[] }> {
  let billingOwnerUserId: string | null = null;
  let createdBy: string | null = null;

  const workspaceWithBilling = await admin
    .from("workspaces")
    .select("id,created_by,billing_owner_user_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceWithBilling.error && isMissingColumnError(workspaceWithBilling.error, "billing_owner_user_id")) {
    const fallback = await admin
      .from("workspaces")
      .select("id,created_by")
      .eq("id", workspaceId)
      .maybeSingle();

    if (fallback.error) throw new Error(fallback.error.message);
    createdBy = String((fallback.data as { created_by?: string } | null)?.created_by ?? "") || null;
  } else {
    if (workspaceWithBilling.error) throw new Error(workspaceWithBilling.error.message);
    const row = workspaceWithBilling.data as { created_by?: string; billing_owner_user_id?: string | null } | null;
    createdBy = row?.created_by ? String(row.created_by) : null;
    billingOwnerUserId = row?.billing_owner_user_id ? String(row.billing_owner_user_id) : null;
  }

  const billingOwner = billingOwnerUserId ?? createdBy;
  if (!billingOwner) throw new Error("Workspace billing owner is not configured.");

  const seatsRes = await admin
    .from("profile_entitlements")
    .select("plan,seats")
    .eq("id", billingOwner)
    .maybeSingle();

  let workspacePlan: EffectivePlan = "free";
  let seatLimit = 1;
  if (seatsRes.error) {
    const fallback = await admin
      .from("profiles")
      .select("plan")
      .eq("id", billingOwner)
      .maybeSingle();
    if (fallback.error) throw new Error(fallback.error.message);
    workspacePlan = normalizePlan((fallback.data as { plan?: unknown } | null)?.plan);
  } else {
    workspacePlan = normalizePlan((seatsRes.data as { plan?: unknown } | null)?.plan);
    seatLimit = asSeatLimit((seatsRes.data as { seats?: unknown } | null)?.seats);
  }

  const memberWithLicense = await admin
    .from("workspace_members")
    .select(
      "user_id,role,joined_at,license_active,can_view_analytics,license_assigned_at,license_assigned_by,license_revoked_at,license_revoked_by"
    )
    .eq("workspace_id", workspaceId)
    .order("joined_at", { ascending: true });

  let members: WorkspaceLicenseMember[] = [];

  if (
    memberWithLicense.error &&
    (isMissingColumnError(memberWithLicense.error, "license_active") ||
      isMissingColumnError(memberWithLicense.error, "can_view_analytics"))
  ) {
    const fallback = await admin
      .from("workspace_members")
      .select("user_id,role,joined_at")
      .eq("workspace_id", workspaceId)
      .order("joined_at", { ascending: true });

    if (fallback.error) throw new Error(fallback.error.message);

    members = ((fallback.data ?? []) as Array<{ user_id: string; role: WorkspaceRole; joined_at?: string | null }>).map(
      (m) => ({
        user_id: String(m.user_id),
        role: m.role,
        joined_at: m.joined_at ?? null,
        license_active: true,
        can_view_analytics: false,
        license_assigned_at: m.joined_at ?? null,
        license_assigned_by: null,
        license_revoked_at: null,
        license_revoked_by: null,
      })
    );
  } else {
    if (memberWithLicense.error) throw new Error(memberWithLicense.error.message);
    members = (
      (memberWithLicense.data ?? []) as Array<{
        user_id: string;
        role: WorkspaceRole;
        joined_at?: string | null;
        license_active?: boolean;
        can_view_analytics?: boolean;
        license_assigned_at?: string | null;
        license_assigned_by?: string | null;
        license_revoked_at?: string | null;
        license_revoked_by?: string | null;
      }>
    ).map((m) => ({
      user_id: String(m.user_id),
      role: m.role,
      joined_at: m.joined_at ?? null,
      license_active: Boolean(m.license_active ?? true),
      can_view_analytics: Boolean(m.can_view_analytics ?? false),
      license_assigned_at: m.license_assigned_at ?? null,
      license_assigned_by: m.license_assigned_by ?? null,
      license_revoked_at: m.license_revoked_at ?? null,
      license_revoked_by: m.license_revoked_by ?? null,
    }));
  }

  const usedSeats = members.filter((m) => m.license_active).length;

  return {
    summary: {
      workspace_id: workspaceId,
      billing_owner_user_id: billingOwner,
      plan: workspacePlan,
      seat_limit: seatLimit,
      used_seats: usedSeats,
      available_seats: Math.max(0, seatLimit - usedSeats),
    },
    members,
  };
}

export function canManageWorkspaceLicenses(role: string | null | undefined) {
  return role === "owner" || role === "admin";
}

export async function getWorkspaceEntitlementsForUser(
  admin: ReturnType<typeof supabaseAdmin>,
  workspaceId: string,
  userId: string
): Promise<WorkspaceEntitlementsForUser | null> {
  const { summary, members } = await getWorkspaceLicensing(admin, workspaceId);
  const member = members.find((m) => m.user_id === userId);
  if (!member) return null;
  const effectivePlan: EffectivePlan = member.license_active ? summary.plan : "free";
  const isPaid = effectivePlan !== "free";
  const personalPlus =
    effectivePlan === "personal" ||
    effectivePlan === "pro" ||
    effectivePlan === "team" ||
    effectivePlan === "enterprise";
  const workspacePlus = effectivePlan === "team" || effectivePlan === "enterprise";

  return {
    workspace_id: workspaceId,
    user_id: userId,
    role: member.role,
    license_active: member.license_active,
    billing_owner_user_id: summary.billing_owner_user_id,
    plan: effectivePlan,
    is_paid: isPaid,
    personal_plus: personalPlus,
    workspace_plus: workspacePlus,
    seat_limit: summary.seat_limit,
    used_seats: summary.used_seats,
    available_seats: summary.available_seats,
  };
}

import type { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";

type DbErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type MfaFactorLike = {
  id?: unknown;
  status?: unknown;
};

type MfaFactorsLike = {
  all?: unknown;
  totp?: unknown;
  phone?: unknown;
  webauthn?: unknown;
};

type QueryResultLike = {
  data: Record<string, unknown> | null;
  error: DbErrorLike | null;
};

type QueryBuilderLike = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<QueryResultLike>;
    };
  };
};

type UserSupabaseQueryClient = {
  from: (table: string) => QueryBuilderLike;
};

export type MfaRequirementReason = "workspace_policy";

export type MfaStatus = {
  enabled: boolean;
  verifiedFactorCount: number;
};

function asString(value: unknown) {
  return String(value ?? "").trim();
}

export function isMissingColumnError(error: DbErrorLike | null | undefined, column: string) {
  if (!error) return false;
  if (error.code === "42703") return true;
  const allText = [error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
  if (!allText) return false;
  return allText.includes(column.toLowerCase());
}

function isVerifiedFactor(factor: unknown) {
  const status = asString((factor as MfaFactorLike | null | undefined)?.status).toLowerCase();
  return status === "verified";
}

function factorId(factor: unknown) {
  return asString((factor as MfaFactorLike | null | undefined)?.id);
}

function toArray(input: unknown): unknown[] {
  return Array.isArray(input) ? input : [];
}

function verifiedFactorCount(data: unknown) {
  const factors = (data ?? {}) as MfaFactorsLike;
  const allFactors = toArray(factors.all);

  if (allFactors.length > 0) {
    return allFactors.filter(isVerifiedFactor).length;
  }

  const verified = [
    ...toArray(factors.totp),
    ...toArray(factors.phone),
    ...toArray(factors.webauthn),
  ];

  if (verified.length === 0) return 0;

  const ids = new Set<string>();
  for (const factor of verified) {
    const id = factorId(factor);
    if (id) ids.add(id);
  }

  return ids.size > 0 ? ids.size : verified.length;
}

export async function getVerifiedMfaStatus(supabase: {
  auth: {
    mfa?: {
      listFactors?: () => Promise<{ data: unknown; error: { message?: string } | null }>;
    };
  };
}): Promise<MfaStatus> {
  const listFactors = supabase.auth.mfa?.listFactors;
  if (!listFactors) return { enabled: false, verifiedFactorCount: 0 };

  const { data, error } = await listFactors();
  if (error) throw new Error(error.message ?? "Could not read MFA factors.");

  const count = verifiedFactorCount(data);
  return { enabled: count > 0, verifiedFactorCount: count };
}

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function workspaceIdentifierFromPath(pathname: string) {
  const appMatch = pathname.match(/^\/app\/workspaces\/([^/]+)/i);
  if (appMatch?.[1]) return decodePathSegment(appMatch[1]);

  const apiMatch = pathname.match(/^\/api\/app\/workspaces\/([^/]+)/i);
  if (apiMatch?.[1]) return decodePathSegment(apiMatch[1]);

  return null;
}

export async function getWorkspaceMfaRequirementForUser({
  admin,
  userId,
  workspaceIdentifier,
}: {
  admin: ReturnType<typeof supabaseAdmin>;
  userId: string;
  workspaceIdentifier: string;
}): Promise<{ required: boolean; workspaceId: string | null }> {
  const resolved = await resolveWorkspaceIdentifier(workspaceIdentifier);
  if (!resolved) return { required: false, workspaceId: null };

  const entitlements = await getWorkspaceEntitlementsForUser(admin, resolved.id, userId);
  if (!entitlements || !entitlements.license_active) {
    return { required: false, workspaceId: resolved.id };
  }

  const wsRes = await admin
    .from("workspaces")
    .select("mfa_required")
    .eq("id", resolved.id)
    .maybeSingle();

  if (wsRes.error && isMissingColumnError(wsRes.error as DbErrorLike, "mfa_required")) {
    return { required: false, workspaceId: resolved.id };
  }
  if (wsRes.error) throw new Error(wsRes.error.message);

  const required = (wsRes.data as { mfa_required?: unknown } | null)?.mfa_required === true;
  return { required, workspaceId: resolved.id };
}

export async function getPrimaryWorkspaceMfaRequirementForUser({
  supabase,
  admin,
  userId,
}: {
  supabase: unknown;
  admin: ReturnType<typeof supabaseAdmin>;
  userId: string;
}): Promise<{ required: boolean; workspaceId: string | null }> {
  const client = supabase as UserSupabaseQueryClient;
  const profileRes = await client
    .from("profiles")
    .select("primary_workspace_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileRes.error && !isMissingColumnError(profileRes.error as DbErrorLike, "primary_workspace_id")) {
    throw new Error(profileRes.error.message);
  }

  const primaryWorkspaceId = asString(
    (profileRes.data as { primary_workspace_id?: unknown } | null)?.primary_workspace_id ?? ""
  );
  if (!primaryWorkspaceId) return { required: false, workspaceId: null };

  const entitlements = await getWorkspaceEntitlementsForUser(admin, primaryWorkspaceId, userId);
  if (!entitlements || !entitlements.license_active) {
    return { required: false, workspaceId: primaryWorkspaceId };
  }

  const wsRes = await admin
    .from("workspaces")
    .select("mfa_required")
    .eq("id", primaryWorkspaceId)
    .maybeSingle();

  if (wsRes.error && isMissingColumnError(wsRes.error as DbErrorLike, "mfa_required")) {
    return { required: false, workspaceId: primaryWorkspaceId };
  }
  if (wsRes.error) throw new Error(wsRes.error.message);

  const required = (wsRes.data as { mfa_required?: unknown } | null)?.mfa_required === true;
  return { required, workspaceId: primaryWorkspaceId };
}

import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";

export type WorkspaceMembership = {
  user_id: string;
  role: "owner" | "admin" | "member";
  license_active: boolean;
  can_view_analytics: boolean;
};

type RequireWorkspaceMemberResult =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof supabaseServer>>;
      admin: ReturnType<typeof supabaseAdmin>;
      userId: string;
      workspaceId: string;
      workspaceSlug: string | null;
      membership: WorkspaceMembership;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, column: string) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes(column.toLowerCase());
}

export async function requireWorkspaceMember(
  workspaceIdentifier: string
): Promise<RequireWorkspaceMemberResult> {
  const resolved = await resolveWorkspaceIdentifier(workspaceIdentifier);
  if (!resolved) return { ok: false, status: 404, error: "Not found" };

  const supabase = await supabaseServer();
  const admin = supabaseAdmin();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) return { ok: false, status: 500, error: userErr.message };
  if (!userData.user) return { ok: false, status: 401, error: "Unauthorized" };

  const memberRes = await supabase
    .from("workspace_members")
    .select("role,license_active,can_view_analytics")
    .eq("workspace_id", resolved.id)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  let memberData = memberRes.data as
    | { role?: "owner" | "admin" | "member"; license_active?: boolean; can_view_analytics?: boolean }
    | null;
  let memberErr = memberRes.error;

  if (
    memberErr &&
    (isMissingColumnError(memberErr, "license_active") || isMissingColumnError(memberErr, "can_view_analytics"))
  ) {
    const fallback = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", resolved.id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    memberData = fallback.data
      ? {
          role: (fallback.data as { role?: "owner" | "admin" | "member" }).role ?? "member",
          license_active: true,
          can_view_analytics: false,
        }
      : null;
    memberErr = fallback.error;
  }

  if (memberErr) return { ok: false, status: 500, error: memberErr.message };
  if (!memberData?.role) return { ok: false, status: 403, error: "Forbidden" };
  if (memberData.license_active === false) {
    return { ok: false, status: 403, error: "No active workspace license is assigned to your account." };
  }

  return {
    ok: true,
    supabase,
    admin,
    userId: userData.user.id,
    workspaceId: resolved.id,
    workspaceSlug: resolved.slug,
    membership: {
      user_id: userData.user.id,
      role: memberData.role,
      license_active: Boolean(memberData.license_active ?? true),
      can_view_analytics: memberData.can_view_analytics === true,
    },
  };
}

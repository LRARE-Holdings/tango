import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";

type WorkspaceRole = "owner" | "admin" | "member";

function isManageableRole(v: string): v is "admin" | "member" {
  return v === "admin" || v === "member";
}

async function getOwnerCount(admin: ReturnType<typeof supabaseAdmin>, workspaceId: string) {
  const { count, error } = await admin
    .from("workspace_members")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("role", "owner");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: workspaceIdentifier, userId: targetUserId } = (await ctx.params) as {
      id: string;
      userId: string;
    };

    const resolved = await resolveWorkspaceIdentifier(workspaceIdentifier);
    if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return authErrorResponse(userErr);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const actorUserId = userData.user.id;
    const body = (await req.json().catch(() => null)) as { role?: string; can_view_analytics?: unknown } | null;
    const requestedRole = String(body?.role ?? "").trim().toLowerCase();
    const hasRoleUpdate = typeof body?.role === "string";
    const hasAnalyticsUpdate = typeof body?.can_view_analytics === "boolean";

    if (!hasRoleUpdate && !hasAnalyticsUpdate) {
      return NextResponse.json({ error: "No updates provided." }, { status: 400 });
    }
    if (hasRoleUpdate && !isManageableRole(requestedRole)) {
      return NextResponse.json({ error: "Role must be member or admin." }, { status: 400 });
    }
    if (hasRoleUpdate && targetUserId === actorUserId) {
      return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
    }

    const { data: actorMember, error: actorErr } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", resolved.id)
      .eq("user_id", actorUserId)
      .maybeSingle();
    if (actorErr) throw new Error(actorErr.message);

    const actorRole = (actorMember?.role ?? null) as WorkspaceRole | null;
    if (actorRole !== "owner" && actorRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: targetMember, error: targetErr } = await admin
      .from("workspace_members")
      .select("user_id,role")
      .eq("workspace_id", resolved.id)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (targetErr) throw new Error(targetErr.message);
    if (!targetMember) return NextResponse.json({ error: "Member not found." }, { status: 404 });

    const targetRole = targetMember.role as WorkspaceRole;

    if (actorRole === "admin" && targetRole === "owner") {
      return NextResponse.json({ error: "Admins cannot manage owners." }, { status: 403 });
    }

    if (targetRole === "owner" && actorRole !== "owner") {
      return NextResponse.json({ error: "Only owners can manage owners." }, { status: 403 });
    }

    if (hasRoleUpdate && targetRole === "owner") {
      const ownerCount = await getOwnerCount(admin, resolved.id);
      if (ownerCount <= 1) {
        return NextResponse.json({ error: "Workspace must keep at least one owner." }, { status: 400 });
      }
    }

    const updates: Record<string, unknown> = {};
    if (hasRoleUpdate) updates.role = requestedRole;
    if (hasAnalyticsUpdate) updates.can_view_analytics = body?.can_view_analytics === true;

    const { error: updErr } = await admin
      .from("workspace_members")
      .update(updates)
      .eq("workspace_id", resolved.id)
      .eq("user_id", targetUserId);
    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: workspaceIdentifier, userId: targetUserId } = (await ctx.params) as {
      id: string;
      userId: string;
    };

    const resolved = await resolveWorkspaceIdentifier(workspaceIdentifier);
    if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return authErrorResponse(userErr);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const actorUserId = userData.user.id;
    if (targetUserId === actorUserId) {
      return NextResponse.json({ error: "You cannot remove yourself." }, { status: 400 });
    }

    const { data: actorMember, error: actorErr } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", resolved.id)
      .eq("user_id", actorUserId)
      .maybeSingle();
    if (actorErr) throw new Error(actorErr.message);

    const actorRole = (actorMember?.role ?? null) as WorkspaceRole | null;
    if (actorRole !== "owner" && actorRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: targetMember, error: targetErr } = await admin
      .from("workspace_members")
      .select("user_id,role")
      .eq("workspace_id", resolved.id)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (targetErr) throw new Error(targetErr.message);
    if (!targetMember) return NextResponse.json({ error: "Member not found." }, { status: 404 });

    const targetRole = targetMember.role as WorkspaceRole;

    if (actorRole === "admin" && targetRole === "owner") {
      return NextResponse.json({ error: "Admins cannot remove owners." }, { status: 403 });
    }

    if (targetRole === "owner") {
      if (actorRole !== "owner") {
        return NextResponse.json({ error: "Only owners can remove owners." }, { status: 403 });
      }
      const ownerCount = await getOwnerCount(admin, resolved.id);
      if (ownerCount <= 1) {
        return NextResponse.json({ error: "Workspace must keep at least one owner." }, { status: 400 });
      }
    }

    const { error: delErr } = await admin
      .from("workspace_members")
      .delete()
      .eq("workspace_id", resolved.id)
      .eq("user_id", targetUserId);
    if (delErr) throw new Error(delErr.message);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

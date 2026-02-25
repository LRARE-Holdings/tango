import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";
import { canManageWorkspaceLicenses, getWorkspaceLicensing, type WorkspaceRole } from "@/lib/workspace-licensing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function activeOwnerCount(members: Array<{ role: WorkspaceRole; license_active: boolean }>) {
  return members.filter((m) => m.role === "owner" && m.license_active).length;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; userId: string }> | { id: string; userId: string } }
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

    const { data: actorMembership, error: actorErr } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", resolved.id)
      .eq("user_id", actorUserId)
      .maybeSingle();

    if (actorErr) throw new Error(actorErr.message);
    if (!actorMembership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const actorRole = String(actorMembership.role ?? "") as WorkspaceRole;
    if (!canManageWorkspaceLicenses(actorRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { license_active?: unknown } | null;
    if (typeof body?.license_active !== "boolean") {
      return NextResponse.json({ error: "license_active must be boolean." }, { status: 400 });
    }

    const requestedActive = body.license_active;

    const { summary, members } = await getWorkspaceLicensing(admin, resolved.id);
    const target = members.find((m) => m.user_id === targetUserId);
    if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404 });

    if (actorRole === "admin" && target.role === "owner") {
      return NextResponse.json({ error: "Admins cannot manage owner licenses." }, { status: 403 });
    }

    if (requestedActive === target.license_active) {
      return NextResponse.json({ ok: true, licensing: summary });
    }

    if (requestedActive && !target.license_active && summary.available_seats <= 0) {
      return NextResponse.json({ error: "No available seats." }, { status: 409 });
    }

    if (!requestedActive && target.role === "owner") {
      const owners = activeOwnerCount(members);
      if (owners <= 1) {
        return NextResponse.json({ error: "Workspace must keep at least one active owner license." }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const updatePayload = requestedActive
      ? {
          license_active: true,
          license_assigned_at: now,
          license_assigned_by: actorUserId,
          license_revoked_at: null,
          license_revoked_by: null,
        }
      : {
          license_active: false,
          license_revoked_at: now,
          license_revoked_by: actorUserId,
        };

    const { error: updErr } = await admin
      .from("workspace_members")
      .update(updatePayload)
      .eq("workspace_id", resolved.id)
      .eq("user_id", targetUserId);

    if (updErr) throw new Error(updErr.message);

    const refreshed = await getWorkspaceLicensing(admin, resolved.id);

    return NextResponse.json({ ok: true, licensing: refreshed.summary });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed";
    if (message.toLowerCase().includes("license_")) {
      return NextResponse.json({ error: "Workspace licensing is not configured yet. Run latest SQL migrations." }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

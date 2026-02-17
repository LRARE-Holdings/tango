import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getWorkspaceLicensing } from "@/lib/workspace-licensing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, column: string) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes(column.toLowerCase());
}

export async function POST() {
  try {
    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = (userData.user.email ?? "").trim().toLowerCase();
    if (!email) return NextResponse.json({ ok: true, accepted: 0 });

    const { data: invites, error: invErr } = await admin
      .from("workspace_invites")
      .select("id,workspace_id,role,status")
      .eq("email", email)
      .eq("status", "pending");

    if (invErr) throw new Error(invErr.message);

    const list = invites ?? [];
    if (list.length === 0) return NextResponse.json({ ok: true, accepted: 0 });
    const acceptedWorkspaceIds: string[] = [];
    const blocked: Array<{ workspace_id: string; reason: "no_available_seats" }> = [];
    const seatAvailabilityByWorkspace = new Map<string, number>();

    // Insert memberships (idempotent)
    for (const inv of list) {
      const workspaceId = String(inv.workspace_id);
      const { data: existingMember, error: memberCheckErr } = await admin
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (memberCheckErr) throw new Error(memberCheckErr.message);

      if (!existingMember) {
        let availableSeats = seatAvailabilityByWorkspace.get(workspaceId);
        if (availableSeats === undefined) {
          const { summary } = await getWorkspaceLicensing(admin, workspaceId);
          availableSeats = summary.available_seats;
          seatAvailabilityByWorkspace.set(workspaceId, availableSeats);
        }

        if (availableSeats <= 0) {
          const updateBlocked = await admin
            .from("workspace_invites")
            .update({ activation_blocked_reason: "no_available_seats" })
            .eq("id", inv.id);

          if (updateBlocked.error && !isMissingColumnError(updateBlocked.error, "activation_blocked_reason")) {
            throw new Error(updateBlocked.error.message);
          }

          blocked.push({ workspace_id: workspaceId, reason: "no_available_seats" });
          continue;
        }

        const insert = await admin
          .from("workspace_members")
          .upsert(
            {
              workspace_id: workspaceId,
              user_id: userData.user.id,
              role: inv.role,
              license_active: true,
              license_assigned_at: new Date().toISOString(),
            },
            { onConflict: "workspace_id,user_id" }
          );

        if (insert.error && isMissingColumnError(insert.error, "license_active")) {
          const fallback = await admin
            .from("workspace_members")
            .upsert(
              { workspace_id: workspaceId, user_id: userData.user.id, role: inv.role },
              { onConflict: "workspace_id,user_id" }
            );
          if (fallback.error) throw new Error(fallback.error.message);
        } else if (insert.error) {
          throw new Error(insert.error.message);
        }

        seatAvailabilityByWorkspace.set(workspaceId, availableSeats - 1);
      }

      const acceptedUpdate = await admin
        .from("workspace_invites")
        .update({ status: "accepted", accepted_at: new Date().toISOString(), activation_blocked_reason: null })
        .eq("id", inv.id);

      if (acceptedUpdate.error && isMissingColumnError(acceptedUpdate.error, "activation_blocked_reason")) {
        const fallback = await admin
          .from("workspace_invites")
          .update({ status: "accepted", accepted_at: new Date().toISOString() })
          .eq("id", inv.id);
        if (fallback.error) throw new Error(fallback.error.message);
      } else if (acceptedUpdate.error) {
        throw new Error(acceptedUpdate.error.message);
      }

      acceptedWorkspaceIds.push(workspaceId);
    }

    const firstWorkspaceId = acceptedWorkspaceIds[0] ?? null;
    if (firstWorkspaceId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("primary_workspace_id,onboarding_completed")
        .eq("id", userData.user.id)
        .maybeSingle();

      const updates: Record<string, unknown> = {};
      if (!profile?.primary_workspace_id) updates.primary_workspace_id = firstWorkspaceId;
      if (!profile?.onboarding_completed) {
        updates.onboarding_completed = true;
        updates.onboarding_completed_at = new Date().toISOString();
      }

      if (Object.keys(updates).length > 0) {
        await admin.from("profiles").update(updates).eq("id", userData.user.id);
      }
    }

    return NextResponse.json({
      ok: true,
      accepted: acceptedWorkspaceIds.length,
      blocked,
      primary_workspace_id: firstWorkspaceId,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

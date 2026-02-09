import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    // Insert memberships (idempotent)
    for (const inv of list) {
      await admin
        .from("workspace_members")
        .upsert(
          { workspace_id: inv.workspace_id, user_id: userData.user.id, role: inv.role },
          { onConflict: "workspace_id,user_id" }
        );

      await admin
        .from("workspace_invites")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", inv.id);

      acceptedWorkspaceIds.push(String(inv.workspace_id));
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

    return NextResponse.json({ ok: true, accepted: list.length, primary_workspace_id: firstWorkspaceId });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

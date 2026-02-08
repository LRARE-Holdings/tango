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
    }

    return NextResponse.json({ ok: true, accepted: list.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
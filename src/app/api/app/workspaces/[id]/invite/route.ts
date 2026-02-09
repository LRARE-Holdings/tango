import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

type Role = "owner" | "admin" | "member";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceId } = (await ctx.params) as { id: string };
    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as { email?: string; role?: Role } | null;
    const email = (body?.email ?? "").trim().toLowerCase();
    const role = (body?.role ?? "member") as Role;

    if (!isEmail(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (!["member", "admin"].includes(role)) {
      // Don’t allow inviting owners via API
      return NextResponse.json({ error: "Role must be member or admin" }, { status: 400 });
    }

    // Confirm inviter is admin for this workspace (RLS on select is fine)
    const { data: myMember, error: memErr } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (memErr) throw new Error(memErr.message);
    if (!myMember || (myMember.role !== "owner" && myMember.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Insert/Upsert invite record (admin to avoid any RLS mismatch)
    const { error: invErr } = await admin
      .from("workspace_invites")
      .insert({
        workspace_id: workspaceId,
        email,
        role,
        invited_by: userData.user.id,
        status: "pending",
      });

    if (invErr) throw new Error(invErr.message);

    // Trigger Supabase invite email (their template)
    const redirectTo =
      process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/app`
        : "https://www.getreceipt.xyz/app";

    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });

    if (inviteErr) throw new Error(inviteErr.message);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
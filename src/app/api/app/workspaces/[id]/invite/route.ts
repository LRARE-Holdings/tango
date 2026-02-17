import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, column: string) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes(column.toLowerCase());
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

type Role = "owner" | "admin" | "member";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceIdentifier } = (await ctx.params) as { id: string };
    if (!workspaceIdentifier) {
      return NextResponse.json({ error: "Invalid workspace identifier" }, { status: 400 });
    }
    const resolved = await resolveWorkspaceIdentifier(workspaceIdentifier);
    if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const workspaceId = resolved.id;

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
    const insertInvite = await admin
      .from("workspace_invites")
      .insert({
        workspace_id: workspaceId,
        email,
        role,
        invited_by: userData.user.id,
        status: "pending",
        activation_blocked_reason: null,
      });

    if (insertInvite.error && isMissingColumnError(insertInvite.error, "activation_blocked_reason")) {
      const fallback = await admin
        .from("workspace_invites")
        .insert({
          workspace_id: workspaceId,
          email,
          role,
          invited_by: userData.user.id,
          status: "pending",
        });
      if (fallback.error) throw new Error(fallback.error.message);
    } else if (insertInvite.error) {
      throw new Error(insertInvite.error.message);
    }

    // Trigger Supabase invite email (their template)
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
      : "https://www.getreceipt.xyz";
    const nextPath = `/app/workspaces/${workspaceId}/dashboard`;
    const redirectTo =
      `${appBaseUrl}/auth/confirm?next=${encodeURIComponent(nextPath)}`;

    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });

    if (inviteErr) throw new Error(inviteErr.message);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

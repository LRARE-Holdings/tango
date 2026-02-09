import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { isWorkspaceUuid, resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";

export async function DELETE(
  _req: Request,
  ctx: {
    params:
      | Promise<{ id: string; domainId: string }>
      | { id: string; domainId: string };
  }
) {
  try {
    const { id: workspaceIdentifier, domainId } = (await ctx.params) as { id: string; domainId: string };
    if (!workspaceIdentifier || !domainId || !isWorkspaceUuid(domainId)) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const resolved = await resolveWorkspaceIdentifier(workspaceIdentifier);
    if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const workspaceId = resolved.id;

    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: member, error: memberErr } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (memberErr) throw new Error(memberErr.message);
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await admin
      .from("workspace_domains")
      .delete()
      .eq("id", domainId)
      .eq("workspace_id", workspaceId);

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

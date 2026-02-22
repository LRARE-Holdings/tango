import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";
import { canAccessFeatureByPlan } from "@/lib/workspace-features";
import { parseIdList } from "@/lib/workspace-contacts";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";

type ReplaceMembersBody = {
  contact_ids?: string[];
};

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string; groupId: string }> | { id: string; groupId: string } }
) {
  try {
    const { id: workspaceIdentifier, groupId } = (await ctx.params) as { id: string; groupId: string };

    const access = await requireWorkspaceMember(workspaceIdentifier);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const { supabase, admin, userId, workspaceId, membership } = access;
    const ent = await getWorkspaceEntitlementsForUser(admin, workspaceId, userId);
    if (!ent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canAccessFeatureByPlan(ent.plan, "contacts")) {
      return NextResponse.json({ error: "Contact groups are available on Pro, Team, and Enterprise plans." }, { status: 403 });
    }
    if (membership.role !== "owner" && membership.role !== "admin") {
      return NextResponse.json({ error: "Only workspace owners or admins can manage contact groups." }, { status: 403 });
    }

    const groupRes = await supabase
      .from("contact_groups")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("id", groupId)
      .maybeSingle();

    if (groupRes.error) return NextResponse.json({ error: groupRes.error.message }, { status: 500 });
    if (!groupRes.data) return NextResponse.json({ error: "Contact group not found." }, { status: 404 });

    const body = (await req.json().catch(() => null)) as ReplaceMembersBody | null;
    const contactIds = parseIdList(body?.contact_ids, 1000);

    if (contactIds.length > 0) {
      const contactsRes = await supabase
        .from("workspace_contacts")
        .select("id")
        .eq("workspace_id", workspaceId)
        .in("id", contactIds);

      if (contactsRes.error) return NextResponse.json({ error: contactsRes.error.message }, { status: 500 });

      const existingIds = new Set((contactsRes.data ?? []).map((row) => String((row as { id: string }).id)));
      const missing = contactIds.filter((id) => !existingIds.has(id));
      if (missing.length > 0) {
        return NextResponse.json({ error: "One or more selected contacts are unavailable." }, { status: 400 });
      }
    }

    const removeExisting = await supabase
      .from("contact_group_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("group_id", groupId);

    if (removeExisting.error) return NextResponse.json({ error: removeExisting.error.message }, { status: 500 });

    if (contactIds.length > 0) {
      const insertMembers = await supabase.from("contact_group_members").insert(
        contactIds.map((contactId) => ({
          workspace_id: workspaceId,
          group_id: groupId,
          contact_id: contactId,
        }))
      );

      if (insertMembers.error) return NextResponse.json({ error: insertMembers.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, member_count: contactIds.length });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update contact group members." },
      { status: 500 }
    );
  }
}

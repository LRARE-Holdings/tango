import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";
import { canAccessFeatureByPlan } from "@/lib/workspace-features";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";
import { parseIdList } from "@/lib/workspace-contacts";

type CreateGroupBody = {
  name?: string;
  description?: string | null;
  contact_ids?: string[];
};

type GroupRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type GroupMemberRow = {
  group_id: string;
  contact_id: string;
};

type ContactRow = {
  id: string;
  name: string;
  email: string;
};

function normalizeLimit(input: string | null, fallback = 25) {
  const value = Number(input ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(100, Math.floor(value)));
}

function normalizeOffset(input: string | null) {
  const value = Number(input ?? 0);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeName(input: string) {
  return input.trim().replace(/\s+/g, " ").slice(0, 120);
}

function normalizeDescription(input: string) {
  const value = input.trim();
  return value ? value.slice(0, 280) : null;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceIdentifier } = (await ctx.params) as { id: string };
    const access = await requireWorkspaceMember(workspaceIdentifier);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const { supabase, admin, userId, workspaceId, membership } = access;
    const ent = await getWorkspaceEntitlementsForUser(admin, workspaceId, userId);
    if (!ent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canAccessFeatureByPlan(ent.plan, "contacts")) {
      return NextResponse.json({ error: "Contact groups are available on Pro, Team, and Enterprise plans." }, { status: 403 });
    }

    const reqUrl = new URL(req.url);
    const q = String(reqUrl.searchParams.get("q") ?? "").trim();
    const includeMembers = reqUrl.searchParams.get("include_members") === "true";
    const limit = normalizeLimit(reqUrl.searchParams.get("limit"), 25);
    const offset = normalizeOffset(reqUrl.searchParams.get("offset"));
    const fetchLimit = limit + 1;

    let groupsQuery = supabase
      .from("contact_groups")
      .select("id,workspace_id,name,description,created_at,updated_at")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true })
      .range(offset, offset + fetchLimit - 1);

    if (q.length > 0) {
      groupsQuery = groupsQuery.ilike("name", `%${q}%`);
    }

    const groupsRes = await groupsQuery;
    if (groupsRes.error) return NextResponse.json({ error: groupsRes.error.message }, { status: 500 });

    const fetchedGroups = (groupsRes.data ?? []) as GroupRow[];
    const hasMore = fetchedGroups.length > limit;
    const groups = hasMore ? fetchedGroups.slice(0, limit) : fetchedGroups;
    const groupIds = groups.map((group) => group.id);

    if (groupIds.length === 0) {
      return NextResponse.json({
        groups: [],
        can_manage: membership.role === "owner" || membership.role === "admin",
        next_offset: null,
      });
    }

    const membersRes = await supabase
      .from("contact_group_members")
      .select("group_id,contact_id")
      .eq("workspace_id", workspaceId)
      .in("group_id", groupIds);

    if (membersRes.error) return NextResponse.json({ error: membersRes.error.message }, { status: 500 });

    const memberships = (membersRes.data ?? []) as GroupMemberRow[];
    const contactIds = Array.from(new Set(memberships.map((membership) => String(membership.contact_id))));

    const contactsById = new Map<string, ContactRow>();
    if (includeMembers && contactIds.length > 0) {
      const contactsRes = await supabase
        .from("workspace_contacts")
        .select("id,name,email")
        .eq("workspace_id", workspaceId)
        .in("id", contactIds);

      if (contactsRes.error) return NextResponse.json({ error: contactsRes.error.message }, { status: 500 });

      for (const row of (contactsRes.data ?? []) as ContactRow[]) {
        contactsById.set(row.id, row);
      }
    }

    const membersByGroupId = new Map<string, GroupMemberRow[]>();
    for (const membershipRow of memberships) {
      const list = membersByGroupId.get(membershipRow.group_id) ?? [];
      list.push(membershipRow);
      membersByGroupId.set(membershipRow.group_id, list);
    }

    return NextResponse.json({
      groups: groups.map((group) => {
        const memberRows = membersByGroupId.get(group.id) ?? [];
        const members = includeMembers
          ? memberRows
              .map((memberRow) => {
                const contact = contactsById.get(memberRow.contact_id);
                if (!contact) return null;
                return {
                  contact_id: contact.id,
                  name: contact.name,
                  email: contact.email,
                };
              })
              .filter((member): member is { contact_id: string; name: string; email: string } => Boolean(member))
          : [];

        return {
          ...group,
          member_count: memberRows.length,
          members,
        };
      }),
      can_manage: membership.role === "owner" || membership.role === "admin",
      next_offset: hasMore ? offset + limit : null,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load contact groups." }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceIdentifier } = (await ctx.params) as { id: string };
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

    const body = (await req.json().catch(() => null)) as CreateGroupBody | null;
    const name = normalizeName(String(body?.name ?? ""));
    const description = normalizeDescription(String(body?.description ?? ""));
    const contactIds = parseIdList(body?.contact_ids, 300);

    if (!name) return NextResponse.json({ error: "Group name is required." }, { status: 400 });

    const insertGroup = await supabase
      .from("contact_groups")
      .insert({
        workspace_id: workspaceId,
        name,
        description,
      })
      .select("id,workspace_id,name,description,created_at,updated_at")
      .single();

    if (insertGroup.error) {
      if (insertGroup.error.code === "23505") {
        return NextResponse.json({ error: "A group with that name already exists." }, { status: 409 });
      }
      return NextResponse.json({ error: insertGroup.error.message }, { status: 500 });
    }

    const group = insertGroup.data as GroupRow;

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

      const memberships = contactIds.map((contactId) => ({
        workspace_id: workspaceId,
        group_id: group.id,
        contact_id: contactId,
      }));

      const insertMemberships = await supabase.from("contact_group_members").insert(memberships);
      if (insertMemberships.error) {
        return NextResponse.json({ error: insertMemberships.error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      group: {
        ...group,
        member_count: contactIds.length,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create contact group." }, { status: 500 });
  }
}

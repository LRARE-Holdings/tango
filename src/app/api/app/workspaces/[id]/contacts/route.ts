import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";
import { canAccessFeatureByPlan } from "@/lib/workspace-features";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";
import { ensureWorkspaceMemberContacts, type WorkspaceContactSource } from "@/lib/workspace-contacts";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CreateContactBody = {
  name?: string;
  email?: string;
};

function normalizeEmail(input: string) {
  return input.trim().toLowerCase();
}

function normalizeName(input: string) {
  return input.trim().replace(/\s+/g, " ").slice(0, 120);
}

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

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceIdentifier } = (await ctx.params) as { id: string };
    const access = await requireWorkspaceMember(workspaceIdentifier);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const { supabase, admin, userId, workspaceId } = access;
    const ent = await getWorkspaceEntitlementsForUser(admin, workspaceId, userId);
    if (!ent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canAccessFeatureByPlan(ent.plan, "contacts")) {
      return NextResponse.json({ error: "Contacts are available on Pro, Team, and Enterprise plans." }, { status: 403 });
    }

    const { memberEmails } = await ensureWorkspaceMemberContacts({
      admin,
      workspaceId,
      actorUserId: userId,
    });

    const reqUrl = new URL(req.url);
    const q = String(reqUrl.searchParams.get("q") ?? "").trim();
    const groupId = String(reqUrl.searchParams.get("group_id") ?? "").trim();
    const limit = normalizeLimit(reqUrl.searchParams.get("limit"), 25);
    const offset = normalizeOffset(reqUrl.searchParams.get("offset"));
    const fetchLimit = limit + 1;

    let contactIds: string[] | null = null;
    if (groupId) {
      const memberships = await supabase
        .from("contact_group_members")
        .select("contact_id")
        .eq("workspace_id", workspaceId)
        .eq("group_id", groupId);

      if (memberships.error) return NextResponse.json({ error: memberships.error.message }, { status: 500 });
      contactIds = (memberships.data ?? []).map((row) => String((row as { contact_id: string }).contact_id));
      if (contactIds.length === 0) {
        return NextResponse.json({ contacts: [], next_offset: null });
      }
    }

    let query = supabase
      .from("workspace_contacts")
      .select("id,workspace_id,name,email,created_by,created_at,updated_at")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true })
      .range(offset, offset + fetchLimit - 1);

    if (q.length > 0) {
      const pattern = `%${q}%`;
      query = query.or(`name.ilike.${pattern},email.ilike.${pattern}`);
    }

    if (contactIds) {
      query = query.in("id", contactIds);
    }

    const result = await query;
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

    const rows = (result.data ?? []) as Array<{
      id: string;
      workspace_id: string;
      name: string;
      email: string;
      created_by: string | null;
      created_at: string;
      updated_at: string;
    }>;

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      contacts: pageRows.map((row) => ({
        id: row.id,
        workspace_id: row.workspace_id,
        name: row.name,
        email: row.email,
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        source: (memberEmails.has(normalizeEmail(row.email)) ? "workspace_member" : "external") as WorkspaceContactSource,
      })),
      next_offset: hasMore ? offset + limit : null,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load contacts." }, { status: 500 });
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

    const { supabase, admin, userId, workspaceId } = access;
    const ent = await getWorkspaceEntitlementsForUser(admin, workspaceId, userId);
    if (!ent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canAccessFeatureByPlan(ent.plan, "contacts")) {
      return NextResponse.json({ error: "Contacts are available on Pro, Team, and Enterprise plans." }, { status: 403 });
    }

    await ensureWorkspaceMemberContacts({
      admin,
      workspaceId,
      actorUserId: userId,
    });

    const body = (await req.json().catch(() => null)) as CreateContactBody | null;
    const name = normalizeName(String(body?.name ?? ""));
    const email = normalizeEmail(String(body?.email ?? ""));

    if (!name) {
      return NextResponse.json({ error: "Contact name is required." }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "A valid contact email is required." }, { status: 400 });
    }

    const insert = await supabase
      .from("workspace_contacts")
      .insert({
        workspace_id: workspaceId,
        name,
        email,
        created_by: userId,
      })
      .select("id,workspace_id,name,email,created_by,created_at,updated_at")
      .single();

    if (insert.error) {
      if (insert.error.code === "23505") {
        return NextResponse.json({ error: "A contact with that email already exists." }, { status: 409 });
      }
      return NextResponse.json({ error: insert.error.message }, { status: 500 });
    }

    return NextResponse.json({
      contact: {
        ...insert.data,
        source: "external" as WorkspaceContactSource,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create contact." }, { status: 500 });
  }
}

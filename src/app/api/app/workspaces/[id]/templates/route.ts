import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";
import { canAccessFeatureByPlan } from "@/lib/workspace-features";
import { normalizeTemplateSettings } from "@/lib/template-settings";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";

type CreateTemplateBody = {
  name?: string;
  description?: string | null;
  settings?: unknown;
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
    if (!canAccessFeatureByPlan(ent.plan, "templates")) {
      return NextResponse.json({ error: "Templates are available on Pro, Team, and Enterprise plans." }, { status: 403 });
    }

    const reqUrl = new URL(req.url);
    const q = String(reqUrl.searchParams.get("q") ?? "").trim();
    const limit = normalizeLimit(reqUrl.searchParams.get("limit"), 25);
    const offset = normalizeOffset(reqUrl.searchParams.get("offset"));
    const fetchLimit = limit + 1;

    let query = supabase
      .from("workspace_templates")
      .select("id,workspace_id,name,description,settings,created_by,updated_by,created_at,updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + fetchLimit - 1);

    if (q.length > 0) {
      query = query.ilike("name", `%${q}%`);
    }

    const result = await query;
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

    const rows = (result.data ?? []) as Array<{
      id: string;
      workspace_id: string;
      name: string;
      description: string | null;
      settings: unknown;
      created_by: string;
      updated_by: string | null;
      created_at: string;
      updated_at: string;
    }>;

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      templates: pageRows.map((row) => ({
        ...row,
        settings: normalizeTemplateSettings(row.settings),
      })),
      can_manage: membership.role === "owner" || membership.role === "admin",
      next_offset: hasMore ? offset + limit : null,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load templates." }, { status: 500 });
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
    if (!canAccessFeatureByPlan(ent.plan, "templates")) {
      return NextResponse.json({ error: "Templates are available on Pro, Team, and Enterprise plans." }, { status: 403 });
    }
    if (membership.role !== "owner" && membership.role !== "admin") {
      return NextResponse.json({ error: "Only workspace owners or admins can manage templates." }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as CreateTemplateBody | null;
    const name = normalizeName(String(body?.name ?? ""));
    const description = normalizeDescription(String(body?.description ?? ""));
    const settings = normalizeTemplateSettings(body?.settings ?? {});

    if (!name) return NextResponse.json({ error: "Template name is required." }, { status: 400 });

    const insert = await supabase
      .from("workspace_templates")
      .insert({
        workspace_id: workspaceId,
        name,
        description,
        settings,
        created_by: userId,
        updated_by: userId,
      })
      .select("id,workspace_id,name,description,settings,created_by,updated_by,created_at,updated_at")
      .single();

    if (insert.error) {
      if (insert.error.code === "23505") {
        return NextResponse.json({ error: "A template with that name already exists." }, { status: 409 });
      }
      return NextResponse.json({ error: insert.error.message }, { status: 500 });
    }

    return NextResponse.json({ template: insert.data }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create template." }, { status: 500 });
  }
}

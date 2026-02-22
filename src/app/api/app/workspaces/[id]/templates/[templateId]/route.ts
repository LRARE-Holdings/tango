import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";
import { canAccessFeatureByPlan } from "@/lib/workspace-features";
import { normalizeTemplateSettings } from "@/lib/template-settings";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";

type UpdateTemplateBody = {
  name?: string;
  description?: string | null;
  settings?: unknown;
};

function normalizeName(input: string) {
  return input.trim().replace(/\s+/g, " ").slice(0, 120);
}

function normalizeDescription(input: string) {
  const value = input.trim();
  return value ? value.slice(0, 280) : null;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; templateId: string }> | { id: string; templateId: string } }
) {
  try {
    const { id: workspaceIdentifier, templateId } = (await ctx.params) as { id: string; templateId: string };
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

    const body = (await req.json().catch(() => null)) as UpdateTemplateBody | null;
    if (!body || (body.name === undefined && body.description === undefined && body.settings === undefined)) {
      return NextResponse.json({ error: "No updates provided." }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };

    if (body.name !== undefined) {
      const name = normalizeName(String(body.name));
      if (!name) return NextResponse.json({ error: "Template name is required." }, { status: 400 });
      updates.name = name;
    }

    if (body.description !== undefined) {
      updates.description = normalizeDescription(String(body.description ?? ""));
    }

    if (body.settings !== undefined) {
      updates.settings = normalizeTemplateSettings(body.settings);
    }

    const update = await supabase
      .from("workspace_templates")
      .update(updates)
      .eq("workspace_id", workspaceId)
      .eq("id", templateId)
      .select("id,workspace_id,name,description,settings,created_by,updated_by,created_at,updated_at")
      .maybeSingle();

    if (update.error) {
      if (update.error.code === "23505") {
        return NextResponse.json({ error: "A template with that name already exists." }, { status: 409 });
      }
      return NextResponse.json({ error: update.error.message }, { status: 500 });
    }

    if (!update.data) return NextResponse.json({ error: "Template not found." }, { status: 404 });

    return NextResponse.json({ template: update.data });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update template." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; templateId: string }> | { id: string; templateId: string } }
) {
  try {
    const { id: workspaceIdentifier, templateId } = (await ctx.params) as { id: string; templateId: string };
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

    const remove = await supabase
      .from("workspace_templates")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("id", templateId)
      .select("id")
      .maybeSingle();

    if (remove.error) return NextResponse.json({ error: remove.error.message }, { status: 500 });
    if (!remove.data) return NextResponse.json({ error: "Template not found." }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete template." }, { status: 500 });
  }
}

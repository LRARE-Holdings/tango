import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";
import { canAccessFeatureByPlan } from "@/lib/workspace-features";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";

type UpdateGroupBody = {
  name?: string;
  description?: string | null;
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

    const body = (await req.json().catch(() => null)) as UpdateGroupBody | null;
    if (!body || (body.name === undefined && body.description === undefined)) {
      return NextResponse.json({ error: "No updates provided." }, { status: 400 });
    }

    const updates: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      const name = normalizeName(String(body.name));
      if (!name) return NextResponse.json({ error: "Group name is required." }, { status: 400 });
      updates.name = name;
    }

    if (body.description !== undefined) {
      updates.description = normalizeDescription(String(body.description ?? ""));
    }

    const update = await supabase
      .from("contact_groups")
      .update(updates)
      .eq("workspace_id", workspaceId)
      .eq("id", groupId)
      .select("id,workspace_id,name,description,created_at,updated_at")
      .maybeSingle();

    if (update.error) {
      if (update.error.code === "23505") {
        return NextResponse.json({ error: "A group with that name already exists." }, { status: 409 });
      }
      return NextResponse.json({ error: update.error.message }, { status: 500 });
    }

    if (!update.data) return NextResponse.json({ error: "Contact group not found." }, { status: 404 });

    return NextResponse.json({ group: update.data });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update contact group." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
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

    const remove = await supabase
      .from("contact_groups")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("id", groupId)
      .select("id")
      .maybeSingle();

    if (remove.error) return NextResponse.json({ error: remove.error.message }, { status: 500 });
    if (!remove.data) return NextResponse.json({ error: "Contact group not found." }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete contact group." }, { status: 500 });
  }
}

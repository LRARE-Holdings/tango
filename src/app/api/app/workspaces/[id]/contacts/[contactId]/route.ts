import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";
import { canAccessFeatureByPlan } from "@/lib/workspace-features";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type UpdateContactBody = {
  name?: string;
  email?: string;
};

function normalizeName(input: string) {
  return input.trim().replace(/\s+/g, " ").slice(0, 120);
}

function normalizeEmail(input: string) {
  return input.trim().toLowerCase();
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; contactId: string }> | { id: string; contactId: string } }
) {
  try {
    const { id: workspaceIdentifier, contactId } = (await ctx.params) as { id: string; contactId: string };
    const access = await requireWorkspaceMember(workspaceIdentifier);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const { supabase, admin, userId, workspaceId } = access;
    const ent = await getWorkspaceEntitlementsForUser(admin, workspaceId, userId);
    if (!ent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canAccessFeatureByPlan(ent.plan, "contacts")) {
      return NextResponse.json({ error: "Contacts are available on Pro, Team, and Enterprise plans." }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as UpdateContactBody | null;
    if (!body || (body.name === undefined && body.email === undefined)) {
      return NextResponse.json({ error: "No updates provided." }, { status: 400 });
    }

    const updates: Record<string, string> = {};

    if (body.name !== undefined) {
      const name = normalizeName(String(body.name));
      if (!name) return NextResponse.json({ error: "Contact name is required." }, { status: 400 });
      updates.name = name;
    }

    if (body.email !== undefined) {
      const email = normalizeEmail(String(body.email));
      if (!EMAIL_REGEX.test(email)) {
        return NextResponse.json({ error: "A valid contact email is required." }, { status: 400 });
      }
      updates.email = email;
    }

    const update = await supabase
      .from("workspace_contacts")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("id", contactId)
      .select("id,workspace_id,name,email,created_by,created_at,updated_at")
      .maybeSingle();

    if (update.error) {
      if (update.error.code === "23505") {
        return NextResponse.json({ error: "A contact with that email already exists." }, { status: 409 });
      }
      return NextResponse.json({ error: update.error.message }, { status: 500 });
    }

    if (!update.data) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

    return NextResponse.json({ contact: update.data });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update contact." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; contactId: string }> | { id: string; contactId: string } }
) {
  try {
    const { id: workspaceIdentifier, contactId } = (await ctx.params) as { id: string; contactId: string };
    const access = await requireWorkspaceMember(workspaceIdentifier);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const { supabase, admin, userId, workspaceId } = access;
    const ent = await getWorkspaceEntitlementsForUser(admin, workspaceId, userId);
    if (!ent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canAccessFeatureByPlan(ent.plan, "contacts")) {
      return NextResponse.json({ error: "Contacts are available on Pro, Team, and Enterprise plans." }, { status: 403 });
    }

    const remove = await supabase
      .from("workspace_contacts")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("id", contactId)
      .select("id")
      .maybeSingle();

    if (remove.error) return NextResponse.json({ error: remove.error.message }, { status: 500 });
    if (!remove.data) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete contact." }, { status: 500 });
  }
}

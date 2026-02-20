import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42P01") return true;
  return String(error.message ?? "").toLowerCase().includes("receipt_stack");
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; stackId: string }> | { id: string; stackId: string } }
) {
  try {
    const { id: workspaceIdentifier, stackId } = (await ctx.params) as { id: string; stackId: string };
    const access = await requireWorkspaceMember(workspaceIdentifier);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const { supabase, userId, workspaceId } = access;

    const stackRes = await supabase
      .from("receipt_stacks")
      .select("id,workspace_id,owner_user_id,name,description,created_at,updated_at")
      .eq("id", stackId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (stackRes.error) return NextResponse.json({ error: stackRes.error.message }, { status: 500 });
    if (!stackRes.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [itemsRes, sharesRes] = await Promise.all([
      supabase
        .from("receipt_stack_items")
        .select("document_id,added_at")
        .eq("stack_id", stackId)
        .order("added_at", { ascending: false }),
      supabase.from("receipt_stack_shares").select("user_id,granted_at").eq("stack_id", stackId),
    ]);
    if (itemsRes.error) return NextResponse.json({ error: itemsRes.error.message }, { status: 500 });
    if (sharesRes.error) return NextResponse.json({ error: sharesRes.error.message }, { status: 500 });

    return NextResponse.json({
      stack: stackRes.data,
      items: itemsRes.data ?? [],
      shares: sharesRes.data ?? [],
      can_manage: String((stackRes.data as { owner_user_id: string }).owner_user_id) === userId,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; stackId: string }> | { id: string; stackId: string } }
) {
  try {
    const { id: workspaceIdentifier, stackId } = (await ctx.params) as { id: string; stackId: string };
    const access = await requireWorkspaceMember(workspaceIdentifier);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const { supabase, userId, workspaceId } = access;

    const currentRes = await supabase
      .from("receipt_stacks")
      .select("id,owner_user_id")
      .eq("id", stackId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (currentRes.error) return NextResponse.json({ error: currentRes.error.message }, { status: 500 });
    if (!currentRes.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (String((currentRes.data as { owner_user_id: string }).owner_user_id) !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { name?: string; description?: string | null } | null;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body?.name === "string") {
      const clean = body.name.trim();
      if (!clean) return NextResponse.json({ error: "Stack name is required." }, { status: 400 });
      updates.name = clean.slice(0, 120);
    }
    if (typeof body?.description === "string" || body?.description === null) {
      updates.description = body?.description ? body.description.trim().slice(0, 400) : null;
    }

    const res = await supabase
      .from("receipt_stacks")
      .update(updates)
      .eq("id", stackId)
      .eq("workspace_id", workspaceId)
      .select("id,workspace_id,owner_user_id,name,description,created_at,updated_at")
      .single();
    if (res.error) {
      if (isMissingTableError(res.error)) {
        return NextResponse.json(
          { error: "Stacks are not configured yet. Run the latest SQL migrations first." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }

    return NextResponse.json({ stack: res.data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; stackId: string }> | { id: string; stackId: string } }
) {
  try {
    const { id: workspaceIdentifier, stackId } = (await ctx.params) as { id: string; stackId: string };
    const access = await requireWorkspaceMember(workspaceIdentifier);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const { supabase, userId, workspaceId } = access;

    const currentRes = await supabase
      .from("receipt_stacks")
      .select("id,owner_user_id")
      .eq("id", stackId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (currentRes.error) return NextResponse.json({ error: currentRes.error.message }, { status: 500 });
    if (!currentRes.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (String((currentRes.data as { owner_user_id: string }).owner_user_id) !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const delRes = await supabase.from("receipt_stacks").delete().eq("id", stackId).eq("workspace_id", workspaceId);
    if (delRes.error) return NextResponse.json({ error: delRes.error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}


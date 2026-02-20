import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42P01") return true;
  const msg = String(error.message ?? "").toLowerCase();
  return msg.includes("receipt_stacks") || msg.includes("receipt_stack_items") || msg.includes("receipt_stack_shares");
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceIdentifier } = (await ctx.params) as { id: string };
    const access = await requireWorkspaceMember(workspaceIdentifier);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const { supabase, workspaceId } = access;
    const stackRes = await supabase
      .from("receipt_stacks")
      .select("id,workspace_id,owner_user_id,name,description,created_at,updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false });
    if (stackRes.error) {
      if (isMissingTableError(stackRes.error)) {
        return NextResponse.json(
          { error: "Stacks are not configured yet. Run the latest SQL migrations first." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: stackRes.error.message }, { status: 500 });
    }

    const stacks = stackRes.data ?? [];
    const stackIds = stacks.map((s) => String((s as { id: string }).id));
    if (stackIds.length === 0) return NextResponse.json({ stacks: [] });

    const [itemsRes, sharesRes] = await Promise.all([
      supabase.from("receipt_stack_items").select("stack_id,document_id").in("stack_id", stackIds),
      supabase.from("receipt_stack_shares").select("stack_id,user_id").in("stack_id", stackIds),
    ]);
    if (itemsRes.error) return NextResponse.json({ error: itemsRes.error.message }, { status: 500 });
    if (sharesRes.error) return NextResponse.json({ error: sharesRes.error.message }, { status: 500 });

    const itemCountByStack = new Map<string, number>();
    for (const row of itemsRes.data ?? []) {
      const stackId = String((row as { stack_id: string }).stack_id);
      itemCountByStack.set(stackId, (itemCountByStack.get(stackId) ?? 0) + 1);
    }
    const shareUserIdsByStack = new Map<string, string[]>();
    for (const row of sharesRes.data ?? []) {
      const stackId = String((row as { stack_id: string }).stack_id);
      const userId = String((row as { user_id: string }).user_id);
      const list = shareUserIdsByStack.get(stackId) ?? [];
      list.push(userId);
      shareUserIdsByStack.set(stackId, list);
    }

    return NextResponse.json({
      stacks: stacks.map((stack) => {
        const id = String((stack as { id: string }).id);
        return {
          ...stack,
          item_count: itemCountByStack.get(id) ?? 0,
          shared_user_ids: shareUserIdsByStack.get(id) ?? [],
        };
      }),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
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

    const { supabase, userId, workspaceId } = access;
    const body = (await req.json().catch(() => null)) as { name?: string; description?: string | null } | null;
    const name = String(body?.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Stack name is required." }, { status: 400 });

    const res = await supabase
      .from("receipt_stacks")
      .insert({
        workspace_id: workspaceId,
        owner_user_id: userId,
        name: name.slice(0, 120),
        description: String(body?.description ?? "").trim().slice(0, 400) || null,
      })
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


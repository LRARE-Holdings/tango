import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";
import { canUseStackDelivery } from "@/lib/workspace-permissions";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; deliveryId: string }> | { id: string; deliveryId: string } }
) {
  try {
    const { id: workspaceIdentifier, deliveryId } = (await ctx.params) as { id: string; deliveryId: string };
    const access = await requireWorkspaceMember(workspaceIdentifier);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const { supabase, admin, userId, workspaceId, membership } = access;
    const ent = await getWorkspaceEntitlementsForUser(admin, workspaceId, userId);
    if (!ent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canUseStackDelivery(membership, ent.plan)) {
      return NextResponse.json(
        { error: "Stack sending is available on Pro, Team, and Enterprise plans." },
        { status: 403 }
      );
    }

    const deliveryRes = await supabase
      .from("stack_deliveries")
      .select("id,public_id,title,status,stack_id,workspace_id,created_by,created_at,updated_at,expires_at")
      .eq("workspace_id", workspaceId)
      .eq("id", deliveryId)
      .maybeSingle();
    if (deliveryRes.error) return NextResponse.json({ error: deliveryRes.error.message }, { status: 500 });
    if (!deliveryRes.data) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const docsRes = await supabase
      .from("stack_delivery_documents")
      .select("document_id,position,required")
      .eq("delivery_id", deliveryId)
      .order("position", { ascending: true });
    if (docsRes.error) return NextResponse.json({ error: docsRes.error.message }, { status: 500 });

    const documentIds = (docsRes.data ?? []).map((row) => String((row as { document_id: string }).document_id));
    const documentsRes =
      documentIds.length > 0
        ? await supabase.from("documents").select("id,title,public_id,priority,labels,tags").in("id", documentIds)
        : { data: [], error: null as { message?: string } | null };
    if (documentsRes.error) return NextResponse.json({ error: documentsRes.error.message }, { status: 500 });

    const docsById = new Map(
      (documentsRes.data ?? []).map((doc) => [
        String((doc as { id: string }).id),
        {
          id: String((doc as { id: string }).id),
          title: String((doc as { title?: string }).title ?? "Untitled"),
          public_id: String((doc as { public_id?: string }).public_id ?? ""),
          priority: String((doc as { priority?: string }).priority ?? "normal"),
          labels: Array.isArray((doc as { labels?: unknown }).labels)
            ? ((doc as { labels: unknown[] }).labels.map((x) => String(x)))
            : [],
          tags:
            (doc as { tags?: unknown }).tags && typeof (doc as { tags?: unknown }).tags === "object"
              ? ((doc as { tags: Record<string, string> }).tags)
              : {},
        },
      ])
    );

    const documents = (docsRes.data ?? [])
      .map((row) => {
        const doc = docsById.get(String((row as { document_id: string }).document_id));
        if (!doc) return null;
        return {
          ...doc,
          required: (row as { required?: boolean }).required !== false,
          position: Number((row as { position?: number }).position ?? 0),
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    return NextResponse.json({
      delivery: deliveryRes.data,
      documents,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { limitPublicRead } from "@/lib/rate-limit";
import { publicErrorResponse, publicRateLimitResponse } from "@/lib/security/public-errors";
import { supabaseAdmin } from "@/lib/supabase/admin";

type StackRecipient = {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  completed_at: string | null;
};

function normalizeEmail(v: string | null) {
  return String(v ?? "").trim().toLowerCase();
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ stackPublicId: string }> | { stackPublicId: string } }
) {
  try {
    const { stackPublicId } = (await ctx.params) as { stackPublicId: string };
    const readRate = await limitPublicRead(req, `stack:${stackPublicId}`);
    if (!readRate.success) {
      if (readRate.misconfigured) {
        return publicErrorResponse({
          status: 503,
          code: "SECURITY_MISCONFIGURED",
          message: "Service temporarily unavailable.",
        });
      }
      return publicRateLimitResponse(readRate);
    }
    const admin = supabaseAdmin();
    const email = normalizeEmail(new URL(req.url).searchParams.get("recipient_email"));

    const deliveryRes = await admin
      .from("stack_deliveries")
      .select("id,workspace_id,stack_id,title,public_id,status,expires_at,created_at")
      .eq("public_id", stackPublicId)
      .maybeSingle();
    if (deliveryRes.error) {
      return publicErrorResponse({
        status: 500,
        code: "STACK_LOOKUP_FAILED",
        message: "Could not load this stack.",
      });
    }
    if (!deliveryRes.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const delivery = deliveryRes.data as {
      id: string;
      workspace_id: string;
      title: string;
      status: string;
      expires_at: string | null;
      stack_id: string | null;
      created_at: string;
    };
    if (delivery.status !== "active") {
      return NextResponse.json({ error: "This stack link is no longer active." }, { status: 410 });
    }
    if (delivery.expires_at && new Date(delivery.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "This stack link has expired." }, { status: 410 });
    }

    const [docsRes, workspaceRes] = await Promise.all([
      admin
        .from("stack_delivery_documents")
        .select(
          "position,required,document:documents(id,title,public_id,priority,labels,tags,require_recipient_identity)"
        )
        .eq("delivery_id", delivery.id)
        .order("position", { ascending: true }),
      admin.from("workspaces").select("name").eq("id", delivery.workspace_id).maybeSingle(),
    ]);
    if (docsRes.error || workspaceRes.error) {
      return publicErrorResponse({
        status: 500,
        code: "STACK_LOOKUP_FAILED",
        message: "Could not load this stack.",
      });
    }

    let recipient: StackRecipient | null = null;
    if (email) {
      const recipientRes = await admin
        .from("stack_delivery_recipients")
        .select("id,recipient_email,recipient_name,completed_at")
        .eq("delivery_id", delivery.id)
        .eq("recipient_email", email)
        .maybeSingle();
      if (recipientRes.error) {
        return publicErrorResponse({
          status: 500,
          code: "STACK_LOOKUP_FAILED",
          message: "Could not load this stack.",
        });
      }
      recipient = (recipientRes.data as StackRecipient | null) ?? null;
    }

    let acknowledgements: { data: unknown[] | null; error: { message?: string } | null };
    if (recipient?.id) {
      const query = await admin
        .from("stack_document_acknowledgements")
        .select("document_id,acknowledged_at,ack_method")
        .eq("delivery_recipient_id", recipient.id);
      acknowledgements = {
        data: (query.data as unknown[] | null) ?? [],
        error: query.error ? { message: query.error.message } : null,
      };
    } else {
      acknowledgements = { data: [], error: null };
    }
    if (acknowledgements.error) {
      return publicErrorResponse({
        status: 500,
        code: "STACK_LOOKUP_FAILED",
        message: "Could not load this stack.",
      });
    }
    const ackByDoc = new Map(
      (acknowledgements.data ?? []).map((row) => [
        String((row as { document_id: string }).document_id),
        {
          acknowledged_at: (row as { acknowledged_at?: string | null }).acknowledged_at ?? null,
          ack_method: String((row as { ack_method?: string }).ack_method ?? "public_link"),
        },
      ])
    );

    const documents = (docsRes.data ?? [])
      .map((row) => {
        const relation = (row as { document?: unknown }).document;
        const rawDoc = Array.isArray(relation) ? relation[0] : relation;
        if (!rawDoc || typeof rawDoc !== "object") return null;
        const doc = rawDoc as Record<string, unknown>;
        const id = String(doc.id ?? "");
        if (!id) return null;
        const ack = ackByDoc.get(id) ?? null;
        return {
          id,
          title: String(doc.title ?? "Untitled"),
          public_id: String(doc.public_id ?? ""),
          priority: String(doc.priority ?? "normal"),
          labels: Array.isArray(doc.labels) ? doc.labels.map((x) => String(x)) : [],
          tags: doc.tags && typeof doc.tags === "object" ? (doc.tags as Record<string, string>) : {},
          require_recipient_identity: doc.require_recipient_identity === true,
          required: (row as { required?: boolean }).required !== false,
          position: Number((row as { position?: number }).position ?? 0),
          acknowledged: Boolean(ack),
          acknowledged_at: ack?.acknowledged_at ?? null,
          ack_method: ack?.ack_method ?? null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const requiredTotal = documents.filter((doc) => doc.required).length;
    const requiredAcknowledged = documents.filter((doc) => doc.required && doc.acknowledged).length;

    return NextResponse.json({
      stack: {
        id: delivery.id,
        public_id: stackPublicId,
        title: delivery.title,
        workspace_name: String((workspaceRes.data as { name?: string } | null)?.name ?? "Workspace"),
        created_at: delivery.created_at,
        required_total: requiredTotal,
        required_acknowledged: requiredAcknowledged,
      },
      recipient,
      documents,
    });
  } catch {
    return publicErrorResponse({
      status: 500,
      code: "STACK_LOOKUP_FAILED",
      message: "Could not load this stack.",
    });
  }
}

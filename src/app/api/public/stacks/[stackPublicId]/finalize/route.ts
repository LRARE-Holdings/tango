import { NextResponse } from "next/server";
import { limitPublicStackFinalize } from "@/lib/rate-limit";
import { publicErrorResponse, publicRateLimitResponse } from "@/lib/security/public-errors";
import { extractTurnstileToken, verifyTurnstileToken } from "@/lib/security/turnstile";
import { supabaseAdmin } from "@/lib/supabase/admin";

function normalizeEmail(v: string | null) {
  return String(v ?? "").trim().toLowerCase();
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ stackPublicId: string }> | { stackPublicId: string } }
) {
  try {
    const { stackPublicId } = (await ctx.params) as { stackPublicId: string };
    const rate = await limitPublicStackFinalize(req, stackPublicId);
    if (!rate.success) {
      if (rate.misconfigured) {
        return publicErrorResponse({
          status: 503,
          code: "SECURITY_MISCONFIGURED",
          message: "Service temporarily unavailable.",
        });
      }
      return publicRateLimitResponse(rate, "Too many finalize attempts. Try again later.");
    }

    const body = (await req.json().catch(() => null)) as
      | { email?: string; captchaToken?: string; turnstileToken?: string; cf_turnstile_response?: string }
      | null;

    const captcha = await verifyTurnstileToken({
      req,
      token: extractTurnstileToken(body),
      expectedAction: "public_stack",
    });
    if (!captcha.ok) {
      return publicErrorResponse({
        status: captcha.status,
        code: captcha.code,
        message: captcha.message,
      });
    }

    const email = normalizeEmail(body?.email ?? null);
    if (!email) return NextResponse.json({ error: "email is required." }, { status: 400 });

    const admin = supabaseAdmin();
    const deliveryRes = await admin
      .from("stack_deliveries")
      .select("id,workspace_id,stack_id,title,status,created_at")
      .eq("public_id", stackPublicId)
      .maybeSingle();
    if (deliveryRes.error) {
      return publicErrorResponse({
        status: 500,
        code: "STACK_LOOKUP_FAILED",
        message: "Could not finalize this stack.",
      });
    }
    if (!deliveryRes.data) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const delivery = deliveryRes.data as {
      id: string;
      workspace_id: string;
      stack_id: string | null;
      title: string;
      status: string;
      created_at: string;
    };
    if (delivery.status !== "active" && delivery.status !== "completed") {
      return NextResponse.json({ error: "This stack link is no longer active." }, { status: 410 });
    }

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
        message: "Could not finalize this stack.",
      });
    }
    if (!recipientRes.data) {
      return NextResponse.json({ error: "No acknowledgement activity found for this recipient." }, { status: 404 });
    }
    const deliveryRecipient = recipientRes.data as {
      id: string;
      recipient_email: string;
      recipient_name: string | null;
      completed_at: string | null;
    };

    const docsRes = await admin
      .from("stack_delivery_documents")
      .select("position,required,document:documents(id,title,public_id,priority,labels,tags)")
      .eq("delivery_id", delivery.id)
      .order("position", { ascending: true });
    if (docsRes.error) {
      return publicErrorResponse({
        status: 500,
        code: "STACK_LOOKUP_FAILED",
        message: "Could not finalize this stack.",
      });
    }

    const ackRes = await admin
      .from("stack_document_acknowledgements")
      .select("document_id,acknowledged_at,ack_method,metadata,completion_id")
      .eq("delivery_recipient_id", deliveryRecipient.id);
    if (ackRes.error) {
      return publicErrorResponse({
        status: 500,
        code: "STACK_LOOKUP_FAILED",
        message: "Could not finalize this stack.",
      });
    }
    const ackByDoc = new Map(
      (ackRes.data ?? []).map((row) => [
        String((row as { document_id: string }).document_id),
        row as {
          acknowledged_at?: string | null;
          ack_method?: string | null;
          metadata?: Record<string, unknown> | null;
          completion_id?: string | null;
        },
      ])
    );

    const compiled = (docsRes.data ?? [])
      .map((row) => {
        const relation = (row as { document?: unknown }).document;
        const rawDoc = Array.isArray(relation) ? relation[0] : relation;
        if (!rawDoc || typeof rawDoc !== "object") return null;
        const doc = rawDoc as Record<string, unknown>;
        const docId = String(doc.id ?? "");
        if (!docId) return null;
        const ack = ackByDoc.get(docId) ?? null;
        return {
          document_id: docId,
          document_title: String(doc.title ?? "Untitled"),
          document_public_id: String(doc.public_id ?? ""),
          required: (row as { required?: boolean }).required !== false,
          position: Number((row as { position?: number }).position ?? 0),
          priority: String(doc.priority ?? "normal"),
          labels: Array.isArray(doc.labels) ? doc.labels.map((x) => String(x)) : [],
          tags: doc.tags && typeof doc.tags === "object" ? (doc.tags as Record<string, string>) : {},
          acknowledged: Boolean(ack),
          acknowledged_at: ack?.acknowledged_at ?? null,
          method: ack?.ack_method ?? null,
          completion_id: ack?.completion_id ?? null,
          acknowledgement_data: ack?.metadata ?? {},
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => a.position - b.position);

    const requiredDocs = compiled.filter((doc) => doc.required);
    const outstandingDocs = requiredDocs.filter((doc) => !doc.acknowledged);
    const outstandingCount = outstandingDocs.length;

    if (outstandingCount > 0) {
      return NextResponse.json(
        {
          error: "Outstanding acknowledgements remain.",
          outstanding_count: outstandingCount,
          outstanding_documents: outstandingDocs.map((doc) => ({
            document_id: doc.document_id,
            document_title: doc.document_title,
            document_public_id: doc.document_public_id,
          })),
        },
        { status: 409 }
      );
    }

    const nowIso = new Date().toISOString();
    const summary = {
      stack_title: delivery.title,
      recipient_name: deliveryRecipient.recipient_name,
      recipient_email: deliveryRecipient.recipient_email,
      total_documents: compiled.length,
      required_documents: requiredDocs.length,
      acknowledged_documents: compiled.filter((doc) => doc.acknowledged).length,
      completed_at: nowIso,
    };
    const evidence = {
      stack_public_id: stackPublicId,
      delivery_id: delivery.id,
      generated_at: nowIso,
      documents: compiled,
    };

    const receiptUpsert = await admin
      .from("stack_acknowledgement_receipts")
      .upsert(
        {
          delivery_recipient_id: deliveryRecipient.id,
          workspace_id: delivery.workspace_id,
          stack_id: delivery.stack_id,
          delivery_id: delivery.id,
          completed_at: nowIso,
          summary,
          evidence,
          outstanding_count: 0,
        },
        { onConflict: "delivery_recipient_id,delivery_id" }
      )
      .select("id,completed_at")
      .single();
    if (receiptUpsert.error || !receiptUpsert.data) {
      return publicErrorResponse({
        status: 500,
        code: "STACK_FINALIZE_FAILED",
        message: "Could not finalize this stack.",
      });
    }

    await Promise.all([
      admin
        .from("stack_delivery_recipients")
        .update({ completed_at: nowIso, updated_at: nowIso, last_activity_at: nowIso })
        .eq("id", deliveryRecipient.id),
      admin
        .from("stack_deliveries")
        .update({ status: "completed", updated_at: nowIso })
        .eq("id", delivery.id)
        .eq("status", "active"),
    ]);

    return NextResponse.json({
      ok: true,
      receipt_id: String((receiptUpsert.data as { id: string }).id),
      completed_at: String((receiptUpsert.data as { completed_at: string }).completed_at),
      summary,
    });
  } catch {
    return publicErrorResponse({
      status: 500,
      code: "STACK_FINALIZE_FAILED",
      message: "Could not finalize this stack.",
    });
  }
}

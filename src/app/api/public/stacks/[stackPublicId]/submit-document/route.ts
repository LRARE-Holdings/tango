import { NextResponse } from "next/server";
import { limitPublicStackSubmit } from "@/lib/rate-limit";
import { publicErrorResponse, publicRateLimitResponse } from "@/lib/security/public-errors";
import { extractTurnstileToken, verifyTurnstileToken } from "@/lib/security/turnstile";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { accessCookieName, accessTokenFor, constantTimeEquals, readCookie } from "@/lib/public-access";

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  return null;
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim().toLowerCase());
}

type Body = {
  document_public_id?: string;
  name?: string | null;
  email?: string | null;
  acknowledged?: boolean;
  max_scroll_percent?: number;
  time_on_page_seconds?: number;
  active_seconds?: number;
  captchaToken?: string | null;
  turnstileToken?: string | null;
  cf_turnstile_response?: string | null;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ stackPublicId: string }> | { stackPublicId: string } }
) {
  try {
    const { stackPublicId } = (await ctx.params) as { stackPublicId: string };
    const rate = await limitPublicStackSubmit(req, stackPublicId);
    if (!rate.success) {
      if (rate.misconfigured) {
        return publicErrorResponse({
          status: 503,
          code: "SECURITY_MISCONFIGURED",
          message: "Service temporarily unavailable.",
        });
      }
      return publicRateLimitResponse(rate, "Too many submissions. Please try again later.");
    }

    const admin = supabaseAdmin();
    const body = (await req.json().catch(() => null)) as Body | null;
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

    const documentPublicId = String(body?.document_public_id ?? "").trim();
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const acknowledged = body?.acknowledged !== false;
    const maxScroll = Math.max(0, Math.min(100, Number(body?.max_scroll_percent ?? 0)));
    const timeOnPage = Math.max(0, Number(body?.time_on_page_seconds ?? 0));
    const activeSeconds = Math.max(0, Number(body?.active_seconds ?? 0));

    if (!documentPublicId) return NextResponse.json({ error: "document_public_id is required." }, { status: 400 });
    if (!email || !isEmail(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });

    const deliveryRes = await admin
      .from("stack_deliveries")
      .select("id,workspace_id,stack_id,status,expires_at")
      .eq("public_id", stackPublicId)
      .maybeSingle();
    if (deliveryRes.error) {
      return publicErrorResponse({
        status: 500,
        code: "STACK_LOOKUP_FAILED",
        message: "Could not process this acknowledgement.",
      });
    }
    if (!deliveryRes.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const delivery = deliveryRes.data as { id: string; workspace_id: string; stack_id: string | null; status: string; expires_at: string | null };
    if (delivery.status !== "active") {
      return NextResponse.json({ error: "This stack link is no longer active." }, { status: 410 });
    }
    if (delivery.expires_at && new Date(delivery.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "This stack link has expired." }, { status: 410 });
    }

    const allowedDocRes = await admin
      .from("stack_delivery_documents")
      .select("document:documents(id,public_id,title,current_version_id,password_enabled,password_hash,require_recipient_identity,max_acknowledgers_enabled,max_acknowledgers,closed_at)")
      .eq("delivery_id", delivery.id);
    if (allowedDocRes.error) {
      return publicErrorResponse({
        status: 500,
        code: "STACK_LOOKUP_FAILED",
        message: "Could not process this acknowledgement.",
      });
    }

    const allowedDocs = (allowedDocRes.data ?? [])
      .map((row) => {
        const relation = (row as { document?: unknown }).document;
        const rawDoc = Array.isArray(relation) ? relation[0] : relation;
        if (!rawDoc || typeof rawDoc !== "object") return null;
        return rawDoc as Record<string, unknown>;
      })
      .filter((doc): doc is Record<string, unknown> => Boolean(doc))
      .map((doc) => ({
        id: String(doc.id ?? ""),
        public_id: String(doc.public_id ?? ""),
        title: String(doc.title ?? "Document"),
        current_version_id: (doc.current_version_id ? String(doc.current_version_id) : null) as string | null,
        password_enabled: doc.password_enabled === true,
        password_hash: doc.password_hash ? String(doc.password_hash) : null,
        require_recipient_identity: doc.require_recipient_identity === true,
        max_acknowledgers_enabled: doc.max_acknowledgers_enabled === true,
        max_acknowledgers: Number(doc.max_acknowledgers ?? 0),
        closed_at: doc.closed_at ? String(doc.closed_at) : null,
      }));

    const doc = allowedDocs.find((candidate) => candidate.public_id === documentPublicId);
    if (!doc) return NextResponse.json({ error: "Document not in this stack delivery." }, { status: 404 });
    if (doc.closed_at) return NextResponse.json({ error: "This document link is closed." }, { status: 410 });
    if (doc.require_recipient_identity && !name) {
      return NextResponse.json({ error: "Name is required for this document." }, { status: 400 });
    }

    if (doc.password_enabled && doc.password_hash) {
      const cookieName = accessCookieName(documentPublicId);
      const cookieValue = readCookie(req.headers.get("cookie"), cookieName);
      const expected = accessTokenFor(documentPublicId, String(doc.password_hash));
      if (!constantTimeEquals(cookieValue, expected)) {
        return NextResponse.json({ error: "Password required", requires_password: true }, { status: 403 });
      }
    }

    if (acknowledged && doc.max_acknowledgers_enabled && doc.max_acknowledgers > 0) {
      const { count, error: countErr } = await admin
        .from("completions")
        .select("id", { head: true, count: "exact" })
        .eq("document_id", doc.id)
        .eq("acknowledged", true);
      if (countErr) {
        return publicErrorResponse({
          status: 500,
          code: "SUBMISSION_FAILED",
          message: "Could not process this acknowledgement.",
        });
      }
      if ((count ?? 0) >= doc.max_acknowledgers) {
        return NextResponse.json({ error: "This document link is closed." }, { status: 409 });
      }
    }

    const nowIso = new Date().toISOString();
    const userAgent = req.headers.get("user-agent");
    const ip = getClientIp(req);

    const recipientInsert = await admin
      .from("recipients")
      .insert({
        document_id: doc.id,
        name: name || null,
        email,
      })
      .select("id")
      .single();
    if (recipientInsert.error || !recipientInsert.data) {
      return publicErrorResponse({
        status: 500,
        code: "SUBMISSION_FAILED",
        message: "Could not process this acknowledgement.",
      });
    }

    const completionInsert = await admin
      .from("completions")
      .insert({
        document_id: doc.id,
        recipient_id: (recipientInsert.data as { id: string }).id,
        acknowledged,
        max_scroll_percent: maxScroll,
        time_on_page_seconds: timeOnPage,
        active_seconds: activeSeconds,
        user_agent: userAgent,
        ip,
        submitted_at: nowIso,
        document_version_id: doc.current_version_id ?? null,
      })
      .select("id")
      .single();
    if (completionInsert.error || !completionInsert.data) {
      return publicErrorResponse({
        status: 500,
        code: "SUBMISSION_FAILED",
        message: "Could not process this acknowledgement.",
      });
    }

    const stackRecipient = await admin
      .from("stack_delivery_recipients")
      .upsert(
        {
          delivery_id: delivery.id,
          recipient_email: email,
          recipient_name: name || null,
          last_activity_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "delivery_id,recipient_email" }
      )
      .select("id")
      .single();
    if (stackRecipient.error || !stackRecipient.data) {
      return publicErrorResponse({
        status: 500,
        code: "SUBMISSION_FAILED",
        message: "Could not process this acknowledgement.",
      });
    }

    const stackAck = await admin
      .from("stack_document_acknowledgements")
      .upsert(
        {
          delivery_recipient_id: String((stackRecipient.data as { id: string }).id),
          document_id: doc.id,
          completion_id: String((completionInsert.data as { id: string }).id),
          acknowledged_at: nowIso,
          ack_method: "public_link",
          metadata: {
            max_scroll_percent: maxScroll,
            time_on_page_seconds: timeOnPage,
            active_seconds: activeSeconds,
            ip,
            user_agent: userAgent,
          },
        },
        { onConflict: "delivery_recipient_id,document_id" }
      );
    if (stackAck.error) {
      return publicErrorResponse({
        status: 500,
        code: "SUBMISSION_FAILED",
        message: "Could not process this acknowledgement.",
      });
    }

    return NextResponse.json({
      ok: true,
      completion_id: String((completionInsert.data as { id: string }).id),
    });
  } catch {
    return publicErrorResponse({
      status: 500,
      code: "SUBMISSION_FAILED",
      message: "Could not process this acknowledgement.",
    });
  }
}

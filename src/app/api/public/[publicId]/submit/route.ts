import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { accessCookieName, accessTokenFor, readCookie } from "@/lib/public-access";

/**
 * Best-effort client IP extraction.
 * - Works on Vercel / reverse proxies
 * - Returns first IP in x-forwarded-for chain
 */
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

function isMissingPasswordColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes("password_");
}

function isMissingRecipientRequirementColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes("require_recipient_identity");
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ publicId: string }> | { publicId: string } }
) {
  const { publicId } = (await ctx.params) as { publicId: string };
  const admin = supabaseAdmin();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;

  const name = typeof payload.name === "string" ? payload.name.trim() : null;
  const email = typeof payload.email === "string" ? payload.email.trim() : null;

  const acknowledged = Boolean(payload.acknowledged);

  const max_scroll_percent = Math.max(
    0,
    Math.min(100, Number(payload.max_scroll_percent ?? 0))
  );

  const time_on_page_seconds = Math.max(
    0,
    Number(payload.time_on_page_seconds ?? 0)
  );

  const active_seconds = Math.max(0, Number(payload.active_seconds ?? 0));

  // Resolve document from public_id
  const withPasswordCols = await admin
    .from("documents")
    .select("id,password_enabled,password_hash,require_recipient_identity")
    .eq("public_id", publicId)
    .maybeSingle();

  let doc = withPasswordCols.data as {
    id: string;
    password_enabled?: boolean | null;
    password_hash?: string | null;
    require_recipient_identity?: boolean | null;
  } | null;
  let docErr = withPasswordCols.error;

  if (docErr && (isMissingPasswordColumnError(docErr) || isMissingRecipientRequirementColumnError(docErr))) {
    const fallback = await admin
      .from("documents")
      .select("id")
      .eq("public_id", publicId)
      .maybeSingle();
    doc = fallback.data as { id: string } | null;
    docErr = fallback.error;
  }

  if (docErr) {
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }

  if (!doc) {
    return NextResponse.json(
      { error: "Not found", publicId },
      { status: 404 }
    );
  }

  const passwordEnabled = Boolean(doc && "password_enabled" in doc && doc.password_enabled && doc.password_hash);
  if (passwordEnabled) {
    const cookieName = accessCookieName(publicId);
    const cookieValue = readCookie(req.headers.get("cookie"), cookieName);
    const expected = accessTokenFor(publicId, String(doc?.password_hash));
    if (!cookieValue || cookieValue !== expected) {
      return NextResponse.json({ error: "Password required" }, { status: 403 });
    }
  }

  const requireRecipientIdentity = Boolean(doc && "require_recipient_identity" in doc && doc.require_recipient_identity);
  if (requireRecipientIdentity) {
    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required for this document." }, { status: 400 });
    }
    if (!isEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
  }

  // Evidence metadata
  const user_agent = req.headers.get("user-agent");
  const ip = getClientIp(req);

  // Create recipient (even if name/email are null)
  const { data: recipient, error: recErr } = await admin
    .from("recipients")
    .insert({
      document_id: doc.id,
      name,
      email,
    })
    .select("id")
    .single();

  if (recErr || !recipient) {
    return NextResponse.json(
      { error: recErr?.message ?? "Recipient insert failed" },
      { status: 500 }
    );
  }

  // Create completion record
  const { data: completion, error: compErr } = await admin
    .from("completions")
    .insert({
      document_id: doc.id,
      recipient_id: recipient.id,
      acknowledged,
      max_scroll_percent,
      time_on_page_seconds,
      active_seconds,
      user_agent,
      ip, // full IP stored intentionally
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (compErr || !completion) {
    return NextResponse.json(
      { error: compErr?.message ?? "Completion insert failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    completion_id: completion.id,
  });
}

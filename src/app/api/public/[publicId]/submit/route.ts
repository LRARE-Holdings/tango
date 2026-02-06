import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

export async function POST(
  req: Request,
  ctx: { params: Promise<{ publicId: string }> | { publicId: string } }
) {
  const { publicId } = (await ctx.params) as { publicId: string };
  const admin = supabaseAdmin();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : null;
  const email = typeof body?.email === "string" ? body.email.trim() : null;

  const acknowledged = Boolean(body?.acknowledged);

  const max_scroll_percent = Math.max(
    0,
    Math.min(100, Number(body?.max_scroll_percent ?? 0))
  );

  const time_on_page_seconds = Math.max(
    0,
    Number(body?.time_on_page_seconds ?? 0)
  );

  const active_seconds = Math.max(0, Number(body?.active_seconds ?? 0));

  // Resolve document from public_id
  const { data: doc, error: docErr } = await admin
    .from("documents")
    .select("id")
    .eq("public_id", publicId)
    .maybeSingle();

  if (docErr) {
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }

  if (!doc) {
    return NextResponse.json(
      { error: "Not found", publicId },
      { status: 404 }
    );
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
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  accessCookieName,
  accessTokenFor,
  constantTimeEquals,
  readCookie,
} from "@/lib/public-access";
import { limitPublicAccessAttempt } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/password";

type DocRow = {
  id: string;
  title: string;
  password_enabled?: boolean | null;
  password_hash?: string | null;
  max_acknowledgers_enabled?: boolean | null;
  max_acknowledgers?: number | null;
  closed_at?: string | null;
};

function isMissingPasswordColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes("password_");
}

function isMissingAcknowledgerLimitColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  const msg = String(error.message ?? "").toLowerCase();
  return msg.includes("max_acknowledgers") || msg.includes("closed_at");
}

async function loadDoc(publicId: string) {
  const admin = supabaseAdmin();
  const withAllCols = await admin
    .from("documents")
    .select("id,title,password_enabled,password_hash,max_acknowledgers_enabled,max_acknowledgers,closed_at")
    .eq("public_id", publicId)
    .maybeSingle();

  if (withAllCols.error && isMissingAcknowledgerLimitColumnError(withAllCols.error)) {
    const withoutAckLimit = await admin
      .from("documents")
      .select("id,title,password_enabled,password_hash")
      .eq("public_id", publicId)
      .maybeSingle();
    return { data: withoutAckLimit.data as DocRow | null, error: withoutAckLimit.error };
  }

  if (withAllCols.error && isMissingPasswordColumnError(withAllCols.error)) {
    const fallback = await admin
      .from("documents")
      .select("id,title")
      .eq("public_id", publicId)
      .maybeSingle();
    return { data: fallback.data as DocRow | null, error: fallback.error };
  }

  return { data: withAllCols.data as DocRow | null, error: withAllCols.error };
}

async function isClosedForAcknowledgement(doc: DocRow) {
  if (doc.closed_at) return { closed: true };

  const limitEnabled = Boolean(doc.max_acknowledgers_enabled && (doc.max_acknowledgers ?? 0) > 0);
  if (!limitEnabled) return { closed: false };

  const admin = supabaseAdmin();
  const maxAcknowledgers = Number(doc.max_acknowledgers ?? 0);
  const { count, error } = await admin
    .from("completions")
    .select("id", { head: true, count: "exact" })
    .eq("document_id", doc.id)
    .eq("acknowledged", true);

  if (error) {
    return { closed: false, error: error.message };
  }
  return { closed: (count ?? 0) >= maxAcknowledgers };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ publicId: string }> | { publicId: string } }
) {
  const { publicId } = (await ctx.params) as { publicId: string };
  const { data: doc, error } = await loadDoc(publicId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const closure = await isClosedForAcknowledgement(doc);
  if (closure.error) return NextResponse.json({ error: closure.error }, { status: 500 });
  if (closure.closed) {
    return NextResponse.json(
      { error: "This link is closed. It is no longer accepting acknowledgements." },
      { status: 410 }
    );
  }

  const requiresPassword = Boolean(doc.password_enabled && doc.password_hash);
  if (!requiresPassword) {
    return NextResponse.json({
      title: doc.title ?? "Document",
      requires_password: false,
      access_granted: true,
    });
  }

  const cookieName = accessCookieName(publicId);
  const cookieValue = readCookie(req.headers.get("cookie"), cookieName);
  const expected = accessTokenFor(publicId, String(doc.password_hash));

  return NextResponse.json({
    title: doc.title ?? "Document",
    requires_password: true,
    access_granted: constantTimeEquals(cookieValue, expected),
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ publicId: string }> | { publicId: string } }
) {
  const { publicId } = (await ctx.params) as { publicId: string };
  const { data: doc, error } = await loadDoc(publicId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const closure = await isClosedForAcknowledgement(doc);
  if (closure.error) return NextResponse.json({ error: closure.error }, { status: 500 });
  if (closure.closed) {
    return NextResponse.json(
      { error: "This link is closed. It is no longer accepting acknowledgements." },
      { status: 410 }
    );
  }

  const requiresPassword = Boolean(doc.password_enabled && doc.password_hash);
  if (!requiresPassword) {
    return NextResponse.json({ ok: true, requires_password: false });
  }

  const rate = await limitPublicAccessAttempt(req, publicId);
  if (!rate.success) {
    const retryAfter = rate.reset ? Math.max(1, Math.ceil((rate.reset - Date.now()) / 1000)) : 60;
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          ...(typeof rate.limit === "number" ? { "X-RateLimit-Limit": String(rate.limit) } : {}),
          ...(typeof rate.remaining === "number" ? { "X-RateLimit-Remaining": String(rate.remaining) } : {}),
        },
      }
    );
  }

  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  const password = typeof body?.password === "string" ? body.password : "";

  const ok = await verifyPassword(password, String(doc.password_hash));
  if (!ok) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = accessTokenFor(publicId, String(doc.password_hash));
  const res = NextResponse.json({ ok: true, requires_password: true });
  res.cookies.set(accessCookieName(publicId), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return res;
}

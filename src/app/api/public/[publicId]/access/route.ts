import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { accessCookieName, accessTokenFor, readCookie } from "@/lib/public-access";
import { verifyPassword } from "@/lib/password";

type DocRow = {
  id: string;
  title: string;
  password_enabled?: boolean | null;
  password_hash?: string | null;
};

function isMissingPasswordColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes("password_");
}

async function loadDoc(publicId: string) {
  const admin = supabaseAdmin();
  const withPasswordCols = await admin
    .from("documents")
    .select("id,title,password_enabled,password_hash")
    .eq("public_id", publicId)
    .maybeSingle();

  if (withPasswordCols.error && isMissingPasswordColumnError(withPasswordCols.error)) {
    const fallback = await admin
      .from("documents")
      .select("id,title")
      .eq("public_id", publicId)
      .maybeSingle();
    return { data: fallback.data as DocRow | null, error: fallback.error };
  }

  return { data: withPasswordCols.data as DocRow | null, error: withPasswordCols.error };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ publicId: string }> | { publicId: string } }
) {
  const { publicId } = (await ctx.params) as { publicId: string };
  const { data: doc, error } = await loadDoc(publicId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
    access_granted: cookieValue === expected,
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

  const requiresPassword = Boolean(doc.password_enabled && doc.password_hash);
  if (!requiresPassword) {
    return NextResponse.json({ ok: true, requires_password: false });
  }

  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  const password = typeof body?.password === "string" ? body.password : "";

  const ok = verifyPassword(password, String(doc.password_hash));
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


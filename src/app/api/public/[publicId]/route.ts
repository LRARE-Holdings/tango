import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { accessCookieName, accessTokenFor, readCookie } from "@/lib/public-access";

type DocRow = {
  id: string;
  title: string;
  file_path: string;
  created_at: string;
  public_id: string;
  password_enabled?: boolean | null;
  password_hash?: string | null;
};

function isMissingPasswordColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes("password_");
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ publicId: string }> | { publicId: string } }
) {
  const { publicId } = (await ctx.params) as { publicId: string };

  const admin = supabaseAdmin();

  const withPasswordCols = await admin
    .from("documents")
    .select("id,title,file_path,created_at,public_id,password_enabled,password_hash")
    .eq("public_id", publicId)
    .maybeSingle();

  let doc = withPasswordCols.data as DocRow | null;
  let error = withPasswordCols.error;

  if (error && isMissingPasswordColumnError(error)) {
    const fallback = await admin
      .from("documents")
      .select("id,title,file_path,created_at,public_id")
      .eq("public_id", publicId)
      .maybeSingle();
    doc = fallback.data as DocRow | null;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json(
      { error: "Supabase query failed", message: error.message },
      { status: 500 }
    );
  }

  if (!doc) {
    return NextResponse.json(
      { error: "No matching document", publicId },
      { status: 404 }
    );
  }

  if (!doc.file_path || doc.file_path === "pending") {
    return NextResponse.json(
      { error: "Document has no uploaded file yet", doc },
      { status: 500 }
    );
  }

  const passwordEnabled = Boolean(doc.password_enabled && doc.password_hash);
  if (passwordEnabled) {
    const cookieName = accessCookieName(publicId);
    const cookieValue = readCookie(req.headers.get("cookie"), cookieName);
    const expected = accessTokenFor(publicId, String(doc.password_hash));
    if (!cookieValue || cookieValue !== expected) {
      return NextResponse.json({ error: "Password required", requires_password: true }, { status: 403 });
    }
  }

  const { data: signed, error: signErr } = await admin.storage
    .from("docs")
    .createSignedUrl(doc.file_path, 60 * 10);

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: "Could not sign URL", message: signErr?.message ?? "unknown" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    document: {
      id: doc.id,
      title: doc.title,
      created_at: doc.created_at,
    },
    signedUrl: signed.signedUrl,
  });
}

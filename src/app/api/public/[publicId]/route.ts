import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ publicId: string }> | { publicId: string } }
) {
  const { publicId } = (await ctx.params) as { publicId: string };

  const admin = supabaseAdmin();

  const { data: doc, error } = await admin
    .from("documents")
    .select("id,title,file_path,created_at,public_id")
    .eq("public_id", publicId)
    .maybeSingle();

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
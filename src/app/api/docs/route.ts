import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MAX_MB = 20;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const titleRaw = form.get("title");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDFs only" }, { status: 400 });
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      return NextResponse.json({ error: `Max file size is ${MAX_MB}MB` }, { status: 400 });
    }

    const title = typeof titleRaw === "string" && titleRaw.trim().length
      ? titleRaw.trim()
      : "Untitled";

    const admin = supabaseAdmin();

    // No auth yet: use a placeholder owner_id.
    // Later: replace with session user id.
    const owner_id = "00000000-0000-0000-0000-000000000000";

    const public_id = nanoid(10);

    // 1) Create the doc row (file_path temp)
    const { data: doc, error: insertErr } = await admin
      .from("documents")
      .insert({
        owner_id,
        public_id,
        title,
        file_path: "pending",
      })
      .select("id, public_id")
      .single();

    if (insertErr || !doc) {
      return NextResponse.json({ error: insertErr?.message ?? "Insert failed" }, { status: 500 });
    }

    // 2) Upload PDF to Storage
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Path convention (no auth yet): keep it simple
    // Later: docs/{userId}/{docId}.pdf and enforce Storage RLS.
    const file_path = `public/${doc.id}.pdf`;

    const { error: uploadErr } = await admin.storage
      .from("docs")
      .upload(file_path, bytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    // 3) Update doc with real file_path
    const { error: updErr } = await admin
      .from("documents")
      .update({ file_path })
      .eq("id", doc.id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      id: doc.id,
      public_id: doc.public_id,
      share_url: `/d/${doc.public_id}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
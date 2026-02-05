import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

function safeFilename(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = (await ctx.params) as { id: string };

  const supabase = await supabaseServer();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }
  if (!userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id,title,public_id,file_path,created_at,sha256")
    .eq("id", id)
    .maybeSingle();

  if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: comps, error: compErr } = await admin
    .from("completions")
    .select(
      "id,acknowledged,max_scroll_percent,time_on_page_seconds,submitted_at,ip,user_agent,recipients(id,name,email)"
    )
    .eq("document_id", id)
    .order("submitted_at", { ascending: false });

  if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 });

  const record = {
    schema: "receipt.evidence.v1",
    generated_at: new Date().toISOString(),

    document: {
      id: doc.id,
      title: doc.title,
      public_id: doc.public_id,
      created_at: doc.created_at,
      storage_path: doc.file_path,
      sha256: doc.sha256 ?? null, // null is fine for now
    },

    completions: (comps ?? []).map((c: any) => ({
      id: c.id,
      submitted_at: c.submitted_at ?? null,
      acknowledged: Boolean(c.acknowledged),
      max_scroll_percent: c.max_scroll_percent ?? null,
      time_on_page_seconds: c.time_on_page_seconds ?? null,
      ip: c.ip ?? null,
      user_agent: c.user_agent ?? null,
      recipient: c.recipients
        ? {
            id: c.recipients.id,
            name: c.recipients.name ?? null,
            email: c.recipients.email ?? null,
          }
        : null,
    })),
  };

  const filename = `receipt-record-${safeFilename(doc.title || "document")}-${doc.id}.json`;

  return new NextResponse(JSON.stringify(record, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type EvidenceCompletion = {
  id: string;
  acknowledged: boolean | null;
  max_scroll_percent: number | null;
  time_on_page_seconds: number | null;
  active_seconds: number | null;
  submitted_at: string | null;
  ip: string | null;
  user_agent: string | null;
  recipients?:
    | { id: string; name: string | null; email: string | null }
    | Array<{ id: string; name: string | null; email: string | null }>
    | null;
};

function normalizeRecipient(
  value: EvidenceCompletion["recipients"]
): { id: string; name: string | null; email: string | null } | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

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
  if (userErr) return authErrorResponse(userErr);
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
      // ip + user_agent are intentionally included as part of the evidence record
      "id,acknowledged,max_scroll_percent,time_on_page_seconds,active_seconds,submitted_at,ip,user_agent,recipients(id,name,email)"
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

    completions: ((comps ?? []) as EvidenceCompletion[]).map((c) => {
      const recipient = normalizeRecipient(c.recipients);
      return {
      id: c.id,
      submitted_at: c.submitted_at ?? null,
      acknowledged: Boolean(c.acknowledged),
      max_scroll_percent: c.max_scroll_percent ?? null,
      time_on_page_seconds: c.time_on_page_seconds ?? null,
      active_seconds: c.active_seconds ?? null,
      ip: c.ip ?? null, // full client IP as observed by the server
      user_agent: c.user_agent ?? null,
      recipient: recipient
        ? {
            id: recipient.id,
            name: recipient.name ?? null,
            email: recipient.email ?? null,
          }
        : null,
    };
    }),
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

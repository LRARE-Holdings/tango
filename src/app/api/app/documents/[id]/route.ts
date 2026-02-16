import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type RecipientRow = {
  id: string;
  name: string | null;
  email: string | null;
};

type CompletionRow = {
  id: string;
  document_id: string;
  document_version_id?: string | null;
  recipient_id: string;
  acknowledged: boolean | null;
  max_scroll_percent: number | null;
  time_on_page_seconds: number | null;
  submitted_at: string | null;
  ip: string | null;
  user_agent: string | null;
  recipients?: RecipientRow | null;
};

type DocumentRow = {
  id: string;
  title: string;
  public_id: string;
  file_path: string;
  created_at: string;
  current_version_id?: string | null;
  version_count?: number | null;
};

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

  // Document
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id,title,public_id,file_path,created_at,current_version_id,version_count")
    .eq("id", id)
    .maybeSingle();

  if (docErr) {
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const document = doc as DocumentRow;

  // Completions (no join)
  const { data: comps, error: compErr } = await admin
    .from("completions")
    .select(
      "id,document_id,document_version_id,recipient_id,acknowledged,max_scroll_percent,time_on_page_seconds,submitted_at,ip,user_agent"
    )
    .eq("document_id", id)
    .order("submitted_at", { ascending: false });

  if (compErr) {
    return NextResponse.json({ error: compErr.message }, { status: 500 });
  }

  const completions = (comps ?? []) as Array<Omit<CompletionRow, "recipients">>;

  // Fetch recipients separately
  const recipientIds = Array.from(
    new Set(completions.map((c) => c.recipient_id).filter(Boolean))
  );

  const recipientsById = new Map<string, RecipientRow>();

  if (recipientIds.length > 0) {
    const { data: recs, error: recErr } = await admin
      .from("recipients")
      .select("id,name,email")
      .in("id", recipientIds);

    if (recErr) {
      return NextResponse.json({ error: recErr.message }, { status: 500 });
    }

    for (const r of recs ?? []) {
      const rr = r as RecipientRow;
      recipientsById.set(rr.id, rr);
    }
  }

  const completionsWithRecipients: CompletionRow[] = completions.map((c) => ({
    ...(c as CompletionRow),
    recipients: recipientsById.get(c.recipient_id) ?? null,
  }));

  const acknowledgements = completionsWithRecipients.filter(
    (c) => c.acknowledged
  ).length;

  const latestAcknowledgedAt =
    completionsWithRecipients.find((c) => c.acknowledged && c.submitted_at)
      ?.submitted_at ?? null;

  return NextResponse.json({
    document: {
      id: document.id,
      title: document.title,
      publicId: document.public_id,
      createdAt: document.created_at,
      filePath: document.file_path,
      currentVersionId: (document as { current_version_id?: string | null }).current_version_id ?? null,
      versionCount: Number((document as { version_count?: number | null }).version_count ?? 1),
      status: acknowledgements > 0 ? "Acknowledged" : "Pending",
      acknowledgements,
      latestAcknowledgedAt,
    },
    completions: completionsWithRecipients,
  });
}

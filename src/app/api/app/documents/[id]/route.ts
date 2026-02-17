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
  workspace_id?: string | null;
  tags?: unknown;
  current_version_id?: string | null;
  version_count?: number | null;
};

type TagField = { key: string; label: string; placeholder?: string };

function normalizeTagKey(v: string) {
  return v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseTagFields(input: unknown): TagField[] {
  if (!Array.isArray(input)) return [];
  const out: TagField[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const label = String((item as { label?: unknown }).label ?? "").trim();
    if (!label) continue;
    const key = normalizeTagKey(String((item as { key?: unknown }).key ?? "").trim() || label);
    if (!key || seen.has(key)) continue;
    const placeholder = String((item as { placeholder?: unknown }).placeholder ?? "").trim();
    out.push({ key, label: label.slice(0, 64), ...(placeholder ? { placeholder: placeholder.slice(0, 120) } : {}) });
    seen.add(key);
    if (out.length >= 12) break;
  }
  return out;
}

function parseDocumentTags(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const key = normalizeTagKey(String(k));
    if (!key) continue;
    const val = String(v ?? "").trim();
    if (!val) continue;
    out[key] = val.slice(0, 120);
  }
  return out;
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, column: string) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes(column.toLowerCase());
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

  // Document
  const withTags = await supabase
    .from("documents")
    .select("id,title,public_id,file_path,created_at,workspace_id,tags,current_version_id,version_count")
    .eq("id", id)
    .maybeSingle();
  let doc = withTags.data;
  let docErr = withTags.error;
  if (docErr && isMissingColumnError(docErr, "tags")) {
    const fallback = await supabase
      .from("documents")
      .select("id,title,public_id,file_path,created_at,workspace_id,current_version_id,version_count")
      .eq("id", id)
      .maybeSingle();
    doc = fallback.data as any;
    docErr = fallback.error;
  }

  if (docErr) {
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const document = doc as DocumentRow;
  let workspaceTagFields: TagField[] = [];
  if (document.workspace_id) {
    const wsTagRes = await supabase
      .from("workspaces")
      .select("document_tag_fields")
      .eq("id", document.workspace_id)
      .maybeSingle();
    if (!wsTagRes.error && wsTagRes.data) {
      workspaceTagFields = parseTagFields(
        (wsTagRes.data as { document_tag_fields?: unknown }).document_tag_fields
      );
    }
  }

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
      workspaceId: document.workspace_id ?? null,
      tags: parseDocumentTags(document.tags),
      workspaceTagFields,
      status: acknowledgements > 0 ? "Acknowledged" : "Pending",
      acknowledgements,
      latestAcknowledgedAt,
    },
    completions: completionsWithRecipients,
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = (await ctx.params) as { id: string };
    const supabase = await supabaseServer();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id,owner_id,workspace_id")
      .eq("id", id)
      .maybeSingle();
    if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const me = userData.user.id;
    let canEdit = String((doc as { owner_id?: string }).owner_id ?? "") === me;

    const workspaceId = (doc as { workspace_id?: string | null }).workspace_id ?? null;
    if (workspaceId) {
      const { data: member, error: memberErr } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", me)
        .maybeSingle();
      if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });
      const role = String((member as { role?: string } | null)?.role ?? "");
      if (role === "owner" || role === "admin" || role === "member") canEdit = true;
    }

    if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json().catch(() => null)) as { tags?: unknown } | null;
    const rawTags = parseDocumentTags(body?.tags);
    const tags: Record<string, string> = {};

    if (workspaceId) {
      const wsTagRes = await supabase
        .from("workspaces")
        .select("document_tag_fields")
        .eq("id", workspaceId)
        .maybeSingle();
      if (wsTagRes.error && !isMissingColumnError(wsTagRes.error, "document_tag_fields")) {
        return NextResponse.json({ error: wsTagRes.error.message }, { status: 500 });
      }
      const fields = parseTagFields((wsTagRes.data as { document_tag_fields?: unknown } | null)?.document_tag_fields);
      const allowedKeys = new Set(fields.map((f) => f.key));
      for (const [k, v] of Object.entries(rawTags)) {
        if (allowedKeys.has(k)) tags[k] = v;
      }
    }

    const upd = await supabase.from("documents").update({ tags }).eq("id", id);
    if (upd.error) {
      if (isMissingColumnError(upd.error, "tags")) {
        return NextResponse.json(
          { error: "Document tags are not configured yet. Run the document tags migration first." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: upd.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, tags });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

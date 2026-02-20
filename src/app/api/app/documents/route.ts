import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type DocRow = {
  id: string;
  title: string;
  public_id: string;
  created_at: string;
};

type CompletionRow = {
  document_id: string;
  acknowledged: boolean | null;
  submitted_at: string | null;
};

function isUnauthorizedAuthError(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "PGRST301") return true;
  const msg = String(error.message ?? "").toLowerCase();
  return msg.includes("auth session missing") || msg.includes("invalid jwt") || msg.includes("jwt");
}

export async function GET() {
  const supabase = await supabaseServer();
  const { data: userData, error: userErr } = await supabase.auth.getUser();

  if (userErr) {
    return NextResponse.json(
      { error: isUnauthorizedAuthError(userErr) ? "Unauthorized" : userErr.message },
      { status: isUnauthorizedAuthError(userErr) ? 401 : 500 }
    );
  }

  if (!userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin is used only for completions aggregation for the already-authorized doc IDs.
  // Later (once you add RLS to completions), switch this to the session client as well.
  const admin = supabaseAdmin();

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("primary_workspace_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  const activeWorkspaceId = (profile?.primary_workspace_id as string | null) ?? null;

  // 1) Fetch documents
  let docsQuery = supabase
    .from("documents")
    .select("id,title,public_id,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  docsQuery = activeWorkspaceId
    ? docsQuery.eq("workspace_id", activeWorkspaceId)
    : docsQuery.is("workspace_id", null);

  const { data: docs, error: docsErr } = await docsQuery;

  if (docsErr) {
    return NextResponse.json({ error: docsErr.message }, { status: 500 });
  }

  const documents = (docs ?? []) as DocRow[];

  if (documents.length === 0) {
    return NextResponse.json({ documents: [] });
  }

  // 2) Fetch completions for those docs (aggregated client-side)
  const ids = documents.map((d) => d.id);

  const { data: completions, error: compErr } = await admin
    .from("completions")
    .select("document_id,acknowledged,submitted_at")
    .in("document_id", ids)
    .order("submitted_at", { ascending: false });

  if (compErr) {
    return NextResponse.json({ error: compErr.message }, { status: 500 });
  }

  const completionRows = (completions ?? []) as CompletionRow[];

  // Map document_id → { count, latestSubmittedAt }
  const agg = new Map<
    string,
    { acknowledgements: number; latestSubmittedAt: string | null }
  >();

  for (const c of completionRows) {
    const key = c.document_id;
    const curr = agg.get(key) ?? { acknowledgements: 0, latestSubmittedAt: null };
    // In your current flow, completion = acknowledgement (acknowledged=true)
    // We'll still treat it defensively.
    if (c.acknowledged) curr.acknowledgements += 1;
    if (!curr.latestSubmittedAt && c.submitted_at) curr.latestSubmittedAt = c.submitted_at;
    agg.set(key, curr);
  }

  const out = documents.map((d) => {
    const a = agg.get(d.id);
    const acknowledgements = a?.acknowledgements ?? 0;

    return {
      id: d.id,
      title: d.title,
      publicId: d.public_id,
      createdAt: d.created_at,
      acknowledgements,
      latestAcknowledgedAt: a?.latestSubmittedAt ?? null,
      status: acknowledgements > 0 ? "Acknowledged" : "Pending",
    };
  });

  return NextResponse.json({ documents: out });
}

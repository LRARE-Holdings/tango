import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";

type DocRow = {
  id: string;
  title: string;
  public_id: string;
  created_at: string;
  owner_id: string;
  tags?: unknown;
  priority?: string | null;
  labels?: unknown;
};

type CompletionRow = {
  document_id: string;
  acknowledged: boolean | null;
  submitted_at: string | null;
};

function normalizeQuery(v: string | null) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined, table: string) {
  if (!error) return false;
  if (error.code === "42P01") return true;
  return String(error.message ?? "").toLowerCase().includes(table.toLowerCase());
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, column: string) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes(column.toLowerCase());
}

function normalizeTagKey(v: string) {
  return v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseTagFields(input: unknown) {
  if (!Array.isArray(input)) return [] as Array<{ key: string; label: string; placeholder?: string }>;
  const out: Array<{ key: string; label: string; placeholder?: string }> = [];
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

function parseDocumentTags(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {} as Record<string, string>;
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

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceIdentifier } = (await ctx.params) as { id: string };
    if (!workspaceIdentifier) {
      return NextResponse.json({ error: "Invalid workspace identifier" }, { status: 400 });
    }

    const resolved = await resolveWorkspaceIdentifier(workspaceIdentifier);
    if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return authErrorResponse(userErr);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = userData.user.id;

    const workspaceEntitlements = await getWorkspaceEntitlementsForUser(admin, resolved.id, userId);
    if (!workspaceEntitlements) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!workspaceEntitlements.license_active) {
      return NextResponse.json(
        { error: "No active workspace license is assigned to your account." },
        { status: 403 }
      );
    }
    if (!workspaceEntitlements.workspace_plus) {
      return NextResponse.json({ error: "We couldn't find any documents for you." }, { status: 403 });
    }

    const member = { role: workspaceEntitlements.role };

    const withTagFields = await supabase
      .from("workspaces")
      .select("id,name,slug,document_tag_fields,policy_mode_enabled")
      .eq("id", resolved.id)
      .maybeSingle();
    let workspace = withTagFields.data as Record<string, unknown> | null;
    let wsErr = withTagFields.error;
    if (wsErr && isMissingColumnError(wsErr, "document_tag_fields")) {
      const fallback = await supabase
        .from("workspaces")
        .select("id,name,slug")
        .eq("id", resolved.id)
        .maybeSingle();
      workspace = fallback.data as Record<string, unknown> | null;
      wsErr = fallback.error;
      if (workspace) workspace.document_tag_fields = [];
      if (workspace) workspace.policy_mode_enabled = false;
    }
    if (wsErr) throw new Error(wsErr.message);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const reqUrl = new URL(req.url);
    const q = normalizeQuery(reqUrl.searchParams.get("q"));
    const priorityFilter = normalizeQuery(reqUrl.searchParams.get("priority"));
    const labelFilter = normalizeQuery(reqUrl.searchParams.get("label"));

    const withTags = await supabase
      .from("documents")
      .select("id,title,public_id,created_at,owner_id,tags,priority,labels")
      .eq("workspace_id", resolved.id)
      .order("created_at", { ascending: false })
      .limit(250);
    let docs = withTags.data as DocRow[] | null;
    let docsErr = withTags.error;
    if (
      docsErr &&
      (isMissingColumnError(docsErr, "tags") ||
        isMissingColumnError(docsErr, "priority") ||
        isMissingColumnError(docsErr, "labels"))
    ) {
      const fallback = await supabase
        .from("documents")
        .select("id,title,public_id,created_at,owner_id")
        .eq("workspace_id", resolved.id)
        .order("created_at", { ascending: false })
        .limit(250);
      docs = fallback.data as DocRow[] | null;
      docsErr = fallback.error;
    }
    if (docsErr) throw new Error(docsErr.message);

    let documents = (docs ?? []) as DocRow[];

    if (member.role === "member" && documents.length > 0) {
      const docIds = documents.map((d) => d.id);
      const { data: assignedRows, error: assignedErr } = await supabase
        .from("document_responsibilities")
        .select("document_id")
        .eq("workspace_id", resolved.id)
        .eq("user_id", userId)
        .in("document_id", docIds);

      if (assignedErr && !isMissingTableError(assignedErr, "document_responsibilities")) {
        throw new Error(assignedErr.message);
      }

      const assigned = new Set((assignedRows ?? []).map((r) => String((r as { document_id: string }).document_id)));
      documents = documents.filter((d) => d.owner_id === userId || assigned.has(d.id));
    }
    if (q) {
      documents = documents.filter((d) => {
        const tags = parseDocumentTags(d.tags);
        const labels = Array.isArray(d.labels) ? d.labels.map((x) => String(x)) : [];
        const tagHay = Object.entries(tags)
          .map(([k, v]) => `${k} ${v}`)
          .join(" ");
        const hay = `${d.title ?? ""} ${d.public_id ?? ""} ${tagHay} ${labels.join(" ")}`.toLowerCase();
        return hay.includes(q);
      });
    }
    if (priorityFilter) {
      documents = documents.filter((d) => String(d.priority ?? "normal").toLowerCase() === priorityFilter);
    }
    if (labelFilter) {
      documents = documents.filter((d) =>
        Array.isArray(d.labels)
          ? d.labels.some((label) => String(label).toLowerCase().includes(labelFilter))
          : false
      );
    }

    if (documents.length === 0) {
      return NextResponse.json({
        workspace: {
          id: String(workspace.id),
          name: String(workspace.name ?? ""),
          slug: (workspace as { slug?: string | null }).slug ?? null,
          document_tag_fields: parseTagFields((workspace as { document_tag_fields?: unknown }).document_tag_fields),
          policy_mode_enabled: (workspace as { policy_mode_enabled?: unknown }).policy_mode_enabled === true,
        },
        viewer: {
          user_id: userId,
          role: member.role,
        },
        documents: [],
      });
    }

    const ids = documents.map((d) => d.id);
    const { data: completions, error: compErr } = await admin
      .from("completions")
      .select("document_id,acknowledged,submitted_at")
      .in("document_id", ids)
      .order("submitted_at", { ascending: false });
    if (compErr) throw new Error(compErr.message);

    const completionRows = (completions ?? []) as CompletionRow[];
    const agg = new Map<string, { acknowledgements: number; latestSubmittedAt: string | null }>();

    for (const c of completionRows) {
      const current = agg.get(c.document_id) ?? { acknowledgements: 0, latestSubmittedAt: null };
      if (c.acknowledged) current.acknowledgements += 1;
      if (!current.latestSubmittedAt && c.submitted_at) current.latestSubmittedAt = c.submitted_at;
      agg.set(c.document_id, current);
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
        status: acknowledgements > 0 ? ("Acknowledged" as const) : ("Pending" as const),
        tags: parseDocumentTags(d.tags),
        priority: String(d.priority ?? "normal").toLowerCase(),
        labels: Array.isArray(d.labels) ? d.labels.map((x) => String(x)) : [],
      };
    });

    return NextResponse.json({
      workspace: {
        id: String(workspace.id),
        name: String(workspace.name ?? ""),
        slug: (workspace as { slug?: string | null }).slug ?? null,
        document_tag_fields: parseTagFields((workspace as { document_tag_fields?: unknown }).document_tag_fields),
        policy_mode_enabled: (workspace as { policy_mode_enabled?: unknown }).policy_mode_enabled === true,
      },
      viewer: {
        user_id: userId,
        role: member.role,
      },
      documents: out,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

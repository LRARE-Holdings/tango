"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type WorkspaceInfo = {
  id: string;
  name: string;
  slug: string | null;
  document_tag_fields?: Array<{ key: string; label: string; placeholder?: string }>;
  policy_mode_enabled?: boolean;
};

type DocItem = {
  id: string;
  title: string;
  publicId: string;
  createdAt: string;
  acknowledgements: number;
  latestAcknowledgedAt: string | null;
  status: "Acknowledged" | "Pending";
  tags?: Record<string, string>;
  priority?: "low" | "normal" | "high" | string;
  labels?: string[];
};

type ViewerRole = "owner" | "admin" | "member";

type ResponsibilityMember = {
  user_id: string;
  email: string | null;
  role: ViewerRole;
};

type StackSummary = {
  id: string;
  name: string;
  description?: string | null;
  owner_user_id: string;
  item_count: number;
  shared_user_ids?: string[];
};

type StackDetail = {
  stack: StackSummary;
  items: Array<{ document_id: string; added_at: string | null }>;
  shares: Array<{ user_id: string; granted_at?: string | null }>;
  can_manage: boolean;
};

type WorkspaceMemberLite = {
  user_id: string;
  email: string | null;
  role: ViewerRole;
};

type SortMode = "created_desc" | "created_asc" | "title_asc" | "title_desc" | "status" | "tag";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
}

function StatusBadge({ status }: { status: DocItem["status"] }) {
  const style: React.CSSProperties =
    status === "Acknowledged"
      ? { background: "var(--fg)", color: "var(--bg)" }
      : { background: "transparent", color: "var(--muted)", border: "1px solid var(--border)" };
  return (
    <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold" style={{ borderRadius: 10, ...style }}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: DocItem["priority"] }) {
  const normalized = String(priority ?? "normal").toLowerCase();
  const tone =
    normalized === "high"
      ? { background: "#7f1d1d", color: "#fecaca" }
      : normalized === "low"
        ? { background: "#1f2937", color: "#bfdbfe" }
        : { background: "var(--card2)", color: "var(--fg)" };
  const label = normalized === "high" ? "High" : normalized === "low" ? "Low" : "Normal";
  return (
    <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold" style={{ borderRadius: 10, ...tone }}>
      {label}
    </span>
  );
}

export default function WorkspaceDocumentsPage() {
  const params = useParams<{ id?: string }>();
  const workspaceIdentifier = typeof params?.id === "string" ? params.id.trim() : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [viewerRole, setViewerRole] = useState<ViewerRole>("member");
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tagValues, setTagValues] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "acknowledged">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "low" | "normal" | "high">("all");
  const [tagFilterKey, setTagFilterKey] = useState<string>("__all");
  const [tagFilterValue, setTagFilterValue] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("created_desc");
  const [sortTagKey, setSortTagKey] = useState<string>("");
  const [policyOnly, setPolicyOnly] = useState(false);
  const [ownershipDoc, setOwnershipDoc] = useState<DocItem | null>(null);
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [ownershipSaving, setOwnershipSaving] = useState(false);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [ownershipMembers, setOwnershipMembers] = useState<ResponsibilityMember[]>([]);
  const [ownershipSelectedUserIds, setOwnershipSelectedUserIds] = useState<string[]>([]);
  const [ownershipOwnerUserId, setOwnershipOwnerUserId] = useState<string | null>(null);
  const [ownershipCanManage, setOwnershipCanManage] = useState(false);
  const [tagEditorDoc, setTagEditorDoc] = useState<DocItem | null>(null);
  const [tagEditorValues, setTagEditorValues] = useState<Record<string, string>>({});
  const [tagEditorSaving, setTagEditorSaving] = useState(false);
  const [tagEditorError, setTagEditorError] = useState<string | null>(null);
  const [stacks, setStacks] = useState<StackSummary[]>([]);
  const [stacksLoading, setStacksLoading] = useState(false);
  const [stacksError, setStacksError] = useState<string | null>(null);
  const [newStackName, setNewStackName] = useState("");
  const [selectedStackByDoc, setSelectedStackByDoc] = useState<Record<string, string>>({});
  const [stackDetail, setStackDetail] = useState<StackDetail | null>(null);
  const [stackDetailLoading, setStackDetailLoading] = useState(false);
  const [stackActionBusy, setStackActionBusy] = useState(false);
  const [stackShareUserId, setStackShareUserId] = useState("");
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberLite[]>([]);

  useEffect(() => {
    let alive = true;
    if (!workspaceIdentifier) {
      setLoading(false);
      setError("Invalid workspace.");
      return () => {
        alive = false;
      };
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const q = search.trim();
        const qs = q ? `?q=${encodeURIComponent(q)}` : "";
        const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/documents${qs}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load workspace documents");
        if (!alive) return;
        setWorkspace((json?.workspace ?? null) as WorkspaceInfo | null);
        setDocuments((json?.documents ?? []) as DocItem[]);
        setViewerRole((json?.viewer?.role ?? "member") as ViewerRole);
      } catch (e: unknown) {
        if (alive) setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (alive) setLoading(false);
      }
    }

    const t = window.setTimeout(load, 180);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [workspaceIdentifier, search]);

  useEffect(() => {
    let active = true;
    if (!workspaceIdentifier) return () => { active = false; };
    async function loadStacks() {
      setStacksLoading(true);
      setStacksError(null);
      try {
        const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/stacks`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load stacks");
        if (!active) return;
        setStacks((json?.stacks ?? []) as StackSummary[]);
      } catch (e: unknown) {
        if (!active) return;
        setStacksError(e instanceof Error ? e.message : "Failed to load stacks");
      } finally {
        if (active) setStacksLoading(false);
      }
    }
    void loadStacks();
    return () => {
      active = false;
    };
  }, [workspaceIdentifier]);

  useEffect(() => {
    let active = true;
    if (!workspaceIdentifier) return () => { active = false; };
    async function loadMembers() {
      try {
        const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!active || !res.ok) return;
        setWorkspaceMembers((json?.members ?? []) as WorkspaceMemberLite[]);
      } catch {
        if (!active) return;
        setWorkspaceMembers([]);
      }
    }
    void loadMembers();
    return () => {
      active = false;
    };
  }, [workspaceIdentifier]);

  async function createDocument() {
    if (creating) return;
    setError(null);

    if (!file) {
      setError("Choose a PDF or DOCX file.");
      return;
    }

    setCreating(true);
    try {
      const form = new FormData();
      form.append("title", title.trim() || "Untitled");
      form.append("send_emails", "false");
      form.append("recipients", "[]");
      form.append("require_recipient_identity", String(workspace?.policy_mode_enabled === true));
      form.append("password_enabled", "false");
      form.append("max_acknowledgers_enabled", "false");
      form.append("max_acknowledgers", "0");
      form.append("tags", JSON.stringify(tagValues));
      form.append("priority", "normal");
      form.append("labels", "");
      if (file) {
        form.append("file", file);
      }

      const res = await fetch("/api/app/documents/create-from-source", { method: "POST", body: form });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to create document");

      setTitle("");
      setFile(null);
      setTagValues({});
      const q = search.trim();
      const qs = q ? `?q=${encodeURIComponent(q)}` : "";
      const docsRes = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/documents${qs}`, {
        cache: "no-store",
      });
      const docsJson = await docsRes.json().catch(() => null);
      if (docsRes.ok) setDocuments((docsJson?.documents ?? []) as DocItem[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create document");
    } finally {
      setCreating(false);
    }
  }

  const counts = useMemo(() => {
    const acknowledged = documents.filter((d) => d.status === "Acknowledged").length;
    return { total: documents.length, acknowledged, pending: documents.length - acknowledged };
  }, [documents]);

  const tagFieldOptions = useMemo(() => workspace?.document_tag_fields ?? [], [workspace?.document_tag_fields]);

  const tagFilterSuggestions = useMemo(() => {
    const values = new Set<string>();
    for (const doc of documents) {
      const entries = Object.entries(doc.tags ?? {});
      for (const [k, v] of entries) {
        if (tagFilterKey !== "__all" && k !== tagFilterKey) continue;
        const clean = String(v ?? "").trim();
        if (clean) values.add(clean);
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [documents, tagFilterKey]);

  const filteredDocuments = useMemo(() => {
    const tagNeedle = tagFilterValue.trim().toLowerCase();
    const out = documents.filter((doc) => {
      if (policyOnly) {
        const policyTag = String((doc.tags ?? {}).policy ?? "").trim().toLowerCase();
        if (policyTag !== "policy") return false;
      }
      if (statusFilter === "pending" && doc.status !== "Pending") return false;
      if (statusFilter === "acknowledged" && doc.status !== "Acknowledged") return false;
      if (priorityFilter !== "all" && String(doc.priority ?? "normal").toLowerCase() !== priorityFilter) return false;
      if (!tagNeedle) return true;

      const entries = Object.entries(doc.tags ?? {});
      if (tagFilterKey === "__all") {
        return entries.some(([k, v]) => `${k} ${v}`.toLowerCase().includes(tagNeedle));
      }
      const selectedValue = (doc.tags ?? {})[tagFilterKey] ?? "";
      return String(selectedValue).toLowerCase().includes(tagNeedle);
    });

    out.sort((a, b) => {
      if (sortMode === "created_asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortMode === "created_desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortMode === "title_asc") return a.title.localeCompare(b.title);
      if (sortMode === "title_desc") return b.title.localeCompare(a.title);
      if (sortMode === "status") return a.status.localeCompare(b.status);
      if (sortMode === "tag") {
        const av = String((a.tags ?? {})[sortTagKey] ?? "");
        const bv = String((b.tags ?? {})[sortTagKey] ?? "");
        return av.localeCompare(bv);
      }
      return 0;
    });

    return out;
  }, [documents, policyOnly, statusFilter, priorityFilter, tagFilterKey, tagFilterValue, sortMode, sortTagKey]);

  const filteredCounts = useMemo(() => {
    const acknowledged = filteredDocuments.filter((d) => d.status === "Acknowledged").length;
    return { total: filteredDocuments.length, acknowledged, pending: filteredDocuments.length - acknowledged };
  }, [filteredDocuments]);

  const suggestedStackGroups = useMemo(() => {
    const groups = new Map<string, number>();
    for (const doc of documents) {
      for (const label of Array.isArray(doc.labels) ? doc.labels : []) {
        const key = `Label: ${label}`;
        groups.set(key, (groups.get(key) ?? 0) + 1);
      }
      for (const [k, v] of Object.entries(doc.tags ?? {})) {
        const key = `${k}: ${v}`;
        groups.set(key, (groups.get(key) ?? 0) + 1);
      }
    }
    return Array.from(groups.entries())
      .map(([name, count]) => ({ name, count }))
      .filter((x) => x.count >= 2)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [documents]);

  async function openOwnership(doc: DocItem) {
    setOwnershipDoc(doc);
    setOwnershipLoading(true);
    setOwnershipSaving(false);
    setOwnershipError(null);
    setOwnershipMembers([]);
    setOwnershipSelectedUserIds([]);
    setOwnershipOwnerUserId(null);
    setOwnershipCanManage(false);
    try {
      const res = await fetch(`/api/app/documents/${doc.id}/responsibilities`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to load ownership settings.");

      const members = (json?.members ?? []) as ResponsibilityMember[];
      const selected = ((json?.responsibilities ?? []) as Array<{ user_id: string }>).map((r) => String(r.user_id));
      setOwnershipMembers(members);
      setOwnershipSelectedUserIds(selected);
      setOwnershipOwnerUserId(typeof json?.owner_user_id === "string" ? json.owner_user_id : null);
      setOwnershipCanManage(Boolean(json?.can_manage));
    } catch (e: unknown) {
      setOwnershipError(e instanceof Error ? e.message : "Failed to load ownership settings.");
    } finally {
      setOwnershipLoading(false);
    }
  }

  function closeOwnership() {
    setOwnershipDoc(null);
    setOwnershipLoading(false);
    setOwnershipSaving(false);
    setOwnershipError(null);
    setOwnershipMembers([]);
    setOwnershipSelectedUserIds([]);
    setOwnershipOwnerUserId(null);
    setOwnershipCanManage(false);
  }

  function toggleOwnershipUser(userId: string) {
    setOwnershipSelectedUserIds((list) =>
      list.includes(userId) ? list.filter((x) => x !== userId) : [...list, userId]
    );
  }

  async function saveOwnership() {
    if (!ownershipDoc) return;
    setOwnershipSaving(true);
    setOwnershipError(null);
    try {
      const res = await fetch(`/api/app/documents/${ownershipDoc.id}/responsibilities`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_ids: ownershipSelectedUserIds }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to save ownership settings.");
      closeOwnership();
    } catch (e: unknown) {
      setOwnershipError(e instanceof Error ? e.message : "Failed to save ownership settings.");
    } finally {
      setOwnershipSaving(false);
    }
  }

  function openTagEditor(doc: DocItem) {
    const next: Record<string, string> = {};
    for (const field of tagFieldOptions) {
      next[field.key] = String((doc.tags ?? {})[field.key] ?? "");
    }
    setTagEditorDoc(doc);
    setTagEditorValues(next);
    setTagEditorSaving(false);
    setTagEditorError(null);
  }

  function closeTagEditor() {
    setTagEditorDoc(null);
    setTagEditorValues({});
    setTagEditorSaving(false);
    setTagEditorError(null);
  }

  async function saveTagEditor() {
    if (!tagEditorDoc) return;
    setTagEditorSaving(true);
    setTagEditorError(null);
    try {
      const res = await fetch(`/api/app/documents/${tagEditorDoc.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tags: tagEditorValues }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string; tags?: Record<string, string> } | null;
      if (!res.ok) throw new Error(json?.error ?? "Failed to save tags");
      const saved = json?.tags ?? {};
      setDocuments((list) => list.map((d) => (d.id === tagEditorDoc.id ? { ...d, tags: saved } : d)));
      closeTagEditor();
    } catch (e: unknown) {
      setTagEditorError(e instanceof Error ? e.message : "Failed to save tags");
    } finally {
      setTagEditorSaving(false);
    }
  }

  async function createStack() {
    if (!workspaceIdentifier || !newStackName.trim()) return;
    setStacksError(null);
    try {
      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/stacks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newStackName.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to create stack");
      setNewStackName("");
      const refresh = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/stacks`, {
        cache: "no-store",
      });
      const refreshJson = await refresh.json().catch(() => null);
      if (refresh.ok) setStacks((refreshJson?.stacks ?? []) as StackSummary[]);
    } catch (e: unknown) {
      setStacksError(e instanceof Error ? e.message : "Failed to create stack");
    }
  }

  async function addToStack(stackId: string, documentId: string) {
    if (!workspaceIdentifier) return;
    try {
      const res = await fetch(
        `/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/stacks/${encodeURIComponent(stackId)}/items`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ document_id: documentId }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to add to stack");
      setStacks((list) => list.map((s) => (s.id === stackId ? { ...s, item_count: s.item_count + 1 } : s)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add to stack");
    }
  }

  async function openStack(stackId: string) {
    if (!workspaceIdentifier) return;
    setStackDetailLoading(true);
    setStacksError(null);
    try {
      const res = await fetch(
        `/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/stacks/${encodeURIComponent(stackId)}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to load stack");
      setStackDetail(json as StackDetail);
    } catch (e: unknown) {
      setStacksError(e instanceof Error ? e.message : "Failed to load stack");
    } finally {
      setStackDetailLoading(false);
    }
  }

  async function removeFromStack(stackId: string, documentId: string) {
    if (!workspaceIdentifier) return;
    setStackActionBusy(true);
    try {
      const res = await fetch(
        `/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/stacks/${encodeURIComponent(stackId)}/items/${encodeURIComponent(documentId)}`,
        { method: "DELETE" }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to remove document from stack");
      await openStack(stackId);
    } catch (e: unknown) {
      setStacksError(e instanceof Error ? e.message : "Failed to remove document from stack");
    } finally {
      setStackActionBusy(false);
    }
  }

  async function addStackShare() {
    if (!workspaceIdentifier || !stackDetail?.stack.id || !stackShareUserId) return;
    setStackActionBusy(true);
    setStacksError(null);
    try {
      const res = await fetch(
        `/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/stacks/${encodeURIComponent(stackDetail.stack.id)}/shares`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ user_id: stackShareUserId }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to share stack");
      setStackShareUserId("");
      await openStack(stackDetail.stack.id);
    } catch (e: unknown) {
      setStacksError(e instanceof Error ? e.message : "Failed to share stack");
    } finally {
      setStackActionBusy(false);
    }
  }

  async function removeStackShare(userId: string) {
    if (!workspaceIdentifier || !stackDetail?.stack.id) return;
    setStackActionBusy(true);
    try {
      const res = await fetch(
        `/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/stacks/${encodeURIComponent(stackDetail.stack.id)}/shares/${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to remove share");
      await openStack(stackDetail.stack.id);
    } catch (e: unknown) {
      setStacksError(e instanceof Error ? e.message : "Failed to remove share");
    } finally {
      setStackActionBusy(false);
    }
  }

  async function deleteStack(stackId: string) {
    if (!workspaceIdentifier) return;
    setStackActionBusy(true);
    setStacksError(null);
    try {
      const res = await fetch(
        `/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/stacks/${encodeURIComponent(stackId)}`,
        { method: "DELETE" }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete stack");
      setStackDetail(null);
      const refresh = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/stacks`, {
        cache: "no-store",
      });
      const refreshJson = await refresh.json().catch(() => null);
      if (refresh.ok) setStacks((refreshJson?.stacks ?? []) as StackSummary[]);
    } catch (e: unknown) {
      setStacksError(e instanceof Error ? e.message : "Failed to delete stack");
    } finally {
      setStackActionBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="app-content-card p-6 md:p-7">
        <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
          <div>
            <div className="app-section-kicker">FILES</div>
            <h1 className="app-hero-title mt-2 text-4xl md:text-5xl">
              {workspace?.name ?? "Workspace"} documents
            </h1>
            <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
              Search, triage by priority, and organise documents into private or shared stacks.
            </p>
          </div>
          <Link
            href="/app/new"
            className="focus-ring inline-flex items-center px-4 py-2 text-sm font-semibold"
            style={{ borderRadius: 999, background: "var(--fg)", color: "var(--bg)" }}
          >
            New Receipt
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="app-chip inline-flex items-center px-3 py-1 text-xs">{counts.total} total</span>
          <span className="app-chip inline-flex items-center px-3 py-1 text-xs">{counts.pending} pending</span>
          <span className="app-chip inline-flex items-center px-3 py-1 text-xs">{counts.acknowledged} acknowledged</span>
          {workspace?.policy_mode_enabled ? (
            <button
              type="button"
              onClick={() => setPolicyOnly((v) => !v)}
              className="focus-ring inline-flex items-center px-3 py-1 text-xs font-semibold transition"
              style={{
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: policyOnly ? "var(--fg)" : "color-mix(in srgb, var(--card2) 50%, #fff)",
                color: policyOnly ? "var(--bg)" : "var(--muted)",
              }}
            >
              {policyOnly ? "Policy filter on" : "Policy filter off"}
            </button>
          ) : null}
        </div>
      </section>

      <section className="app-content-card p-4">
        <div className="flex items-center justify-between gap-3 flex-col sm:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, public ID, or tags…"
            className="focus-ring w-full sm:w-110 border px-4 py-3 text-sm bg-transparent"
            style={{ borderColor: "var(--border)", borderRadius: 10 }}
          />
          <div className="text-xs" style={{ color: "var(--muted2)" }}>
            {filteredCounts.total} shown / {counts.total} total • {filteredCounts.pending} pending • {filteredCounts.acknowledged} acknowledged
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "pending" | "acknowledged")}
            className="focus-ring border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "var(--border)", borderRadius: 10 }}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending (Open)</option>
            <option value="acknowledged">Acknowledged</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as "all" | "low" | "normal" | "high")}
            className="focus-ring border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "var(--border)", borderRadius: 10 }}
          >
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
          <select
            value={tagFilterKey}
            onChange={(e) => setTagFilterKey(e.target.value)}
            className="focus-ring border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "var(--border)", borderRadius: 10 }}
          >
            <option value="__all">All tag fields</option>
            {tagFieldOptions.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <input
            value={tagFilterValue}
            onChange={(e) => setTagFilterValue(e.target.value)}
            placeholder="Filter tag value (e.g. Open, Matter-123)"
            list="workspace-tag-filter-values"
            className="focus-ring border px-3 py-2 text-sm bg-transparent lg:col-span-2"
            style={{ borderColor: "var(--border)", borderRadius: 10 }}
          />
          <datalist id="workspace-tag-filter-values">
            {tagFilterSuggestions.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="focus-ring border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "var(--border)", borderRadius: 10 }}
          >
            <option value="created_desc">Newest first</option>
            <option value="created_asc">Oldest first</option>
            <option value="title_asc">Title A-Z</option>
            <option value="title_desc">Title Z-A</option>
            <option value="status">Status</option>
            <option value="tag">Tag value</option>
          </select>
        </div>
        {sortMode === "tag" ? (
          <div className="mt-2">
            <select
              value={sortTagKey}
              onChange={(e) => setSortTagKey(e.target.value)}
              className="focus-ring border px-3 py-2 text-sm bg-transparent"
              style={{ borderColor: "var(--border)", borderRadius: 10 }}
            >
              <option value="">Select tag field for sorting</option>
              {tagFieldOptions.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="app-content-card p-4 space-y-3">
          <div className="app-section-kicker">QUICK UPLOAD</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Employee onboarding pack"
            className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "var(--border)", borderRadius: 10 }}
          />
          {Array.isArray(workspace?.document_tag_fields) && workspace.document_tag_fields.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {workspace.document_tag_fields.map((f) => (
                <input
                  key={f.key}
                  value={tagValues[f.key] ?? ""}
                  onChange={(e) => setTagValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder || f.label}
                  className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
                  style={{ borderColor: "var(--border)", borderRadius: 10 }}
                />
              ))}
            </div>
          ) : null}
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "var(--border)", borderRadius: 10 }}
          />
          <div>
            <button
              type="button"
              onClick={() => void createDocument()}
              disabled={creating}
              className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 999 }}
            >
              {creating ? "Creating…" : "Create document"}
            </button>
          </div>
        </div>
        <div className="app-content-card p-4 space-y-3">
          <div className="app-section-kicker">STACKS</div>
          <div className="flex gap-2 flex-col sm:flex-row">
            <input
              value={newStackName}
              onChange={(e) => setNewStackName(e.target.value)}
              placeholder="Create stack (e.g. Quarterly policy rollout)"
              className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
              style={{ borderColor: "var(--border)", borderRadius: 10 }}
            />
            <button
              type="button"
              onClick={() => void createStack()}
              className="focus-ring px-3 py-2 text-sm font-semibold hover:opacity-90"
              style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 999 }}
            >
              Create
            </button>
          </div>
          {stacksLoading ? <div className="text-xs" style={{ color: "var(--muted2)" }}>Loading stacks…</div> : null}
          {stacksError ? <div className="text-xs" style={{ color: "#b91c1c" }}>{stacksError}</div> : null}
          {!stacksLoading && stacks.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {stacks.map((stack) => (
                <button
                  type="button"
                  key={stack.id}
                  onClick={() => void openStack(stack.id)}
                  className="focus-ring border p-3 text-left"
                  style={{
                    borderColor: stackDetail?.stack.id === stack.id ? "var(--fg)" : "var(--border)",
                    borderRadius: 10,
                    background: stackDetail?.stack.id === stack.id ? "color-mix(in srgb, var(--card2) 65%, #fff)" : "transparent",
                  }}
                >
                  <div className="text-sm font-semibold">{stack.name}</div>
                  <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                    {stack.item_count} documents
                  </div>
                </button>
              ))}
            </div>
          ) : null}
          {suggestedStackGroups.length > 0 ? (
            <div className="pt-2">
              <div className="text-xs font-semibold" style={{ color: "var(--muted2)" }}>
                Suggested groups
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {suggestedStackGroups.map((group) => (
                  <span
                    key={group.name}
                    className="inline-flex items-center px-2 py-1 text-xs"
                    style={{ borderRadius: 999, background: "var(--card2)", color: "var(--muted)" }}
                  >
                    {group.name} ({group.count})
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

      </section>

      {stackDetail ? (
        <section className="app-content-card p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="app-section-kicker">ACTIVE STACK</div>
              <div className="mt-1 text-lg font-semibold">{stackDetail.stack.name}</div>
              <div className="text-xs" style={{ color: "var(--muted2)" }}>
                {stackDetail.items.length} documents • {stackDetail.shares.length} shared users
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/app/new?mode=full_stack&stackId=${encodeURIComponent(stackDetail.stack.id)}`}
                className="focus-ring px-3 py-2 text-xs font-semibold"
                style={{ borderRadius: 999, border: "1px solid var(--border)", color: "var(--fg)" }}
              >
                Send stack
              </Link>
              {stackDetail.can_manage ? (
                <button
                  type="button"
                  onClick={() => void deleteStack(stackDetail.stack.id)}
                  disabled={stackActionBusy}
                  className="focus-ring px-3 py-2 text-xs font-semibold"
                  style={{ borderRadius: 999, border: "1px solid var(--border)", color: "#991b1b" }}
                >
                  Delete stack
                </button>
              ) : null}
            </div>
          </div>
          {stackDetailLoading ? <div className="text-sm" style={{ color: "var(--muted)" }}>Loading stack…</div> : null}
          {!stackDetailLoading ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs font-semibold" style={{ color: "var(--muted2)" }}>DOCUMENTS</div>
                {stackDetail.items.map((item) => {
                  const doc = documents.find((d) => d.id === item.document_id);
                  return (
                    <div key={item.document_id} className="border rounded-xl px-3 py-2" style={{ borderColor: "var(--border2)" }}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium truncate">{doc?.title ?? item.document_id}</div>
                        {stackDetail.can_manage ? (
                          <button
                            type="button"
                            onClick={() => void removeFromStack(stackDetail.stack.id, item.document_id)}
                            disabled={stackActionBusy}
                            className="focus-ring text-xs"
                            style={{ color: "var(--muted)" }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {stackDetail.items.length === 0 ? (
                  <div className="text-sm" style={{ color: "var(--muted)" }}>No documents yet in this stack.</div>
                ) : null}
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold" style={{ color: "var(--muted2)" }}>SHARING</div>
                {stackDetail.can_manage ? (
                  <div className="flex gap-2">
                    <select
                      value={stackShareUserId}
                      onChange={(e) => setStackShareUserId(e.target.value)}
                      className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
                      style={{ borderColor: "var(--border)", borderRadius: 10 }}
                    >
                      <option value="">Select member…</option>
                      {workspaceMembers
                        .filter((m) => m.user_id !== stackDetail.stack.owner_user_id)
                        .map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.email ?? m.user_id}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void addStackShare()}
                      disabled={!stackShareUserId || stackActionBusy}
                      className="focus-ring px-3 py-2 text-sm font-semibold disabled:opacity-50"
                      style={{ borderRadius: 999, border: "1px solid var(--border)" }}
                    >
                      Share
                    </button>
                  </div>
                ) : null}
                {stackDetail.shares.map((share) => {
                  const member = workspaceMembers.find((m) => m.user_id === share.user_id);
                  return (
                    <div key={share.user_id} className="border rounded-xl px-3 py-2" style={{ borderColor: "var(--border2)" }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm">{member?.email ?? share.user_id}</div>
                        {stackDetail.can_manage ? (
                          <button
                            type="button"
                            onClick={() => void removeStackShare(share.user_id)}
                            disabled={stackActionBusy}
                            className="focus-ring text-xs"
                            style={{ color: "var(--muted)" }}
                          >
                            Unshare
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {stackDetail.shares.length === 0 ? (
                  <div className="text-sm" style={{ color: "var(--muted)" }}>Private stack. No shared members.</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {loading && <div className="text-sm" style={{ color: "var(--muted)" }}>Loading…</div>}

      {error && (
        <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}>
          <div className="text-sm font-semibold">Couldn’t load workspace documents</div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {error}
          </div>
        </div>
      )}

      {!loading && !error && filteredDocuments.length === 0 && (
        <div className="border p-6" style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}>
          <div className="text-sm font-semibold">No documents match your filters</div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Adjust search, status, or tag filters.
          </div>
        </div>
      )}

      {!loading && !error && filteredDocuments.length > 0 && (
        <div className="border" style={{ borderColor: "var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div className="px-5 py-3 text-xs tracking-wide" style={{ background: "var(--card2)", color: "var(--muted2)" }}>
            CATALOGUE
          </div>
          <div>
            {filteredDocuments.map((d) => (
              <div key={d.id} className="px-5 py-4" style={{ borderTop: "1px solid var(--border2)" }}>
                <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-sm font-semibold truncate">{d.title}</div>
                      <PriorityBadge priority={d.priority} />
                      <StatusBadge status={d.status} />
                      <div className="text-xs" style={{ color: "var(--muted2)" }}>
                        {d.publicId}
                      </div>
                    </div>

                    <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                      Created: {formatDate(d.createdAt)} • Acknowledgements: {d.acknowledgements}
                      {d.latestAcknowledgedAt ? ` • Latest: ${formatDate(d.latestAcknowledgedAt)}` : ""}
                    </div>
                    {String((d.tags ?? {}).policy ?? "").trim().toLowerCase() === "policy" ? (
                      <div className="mt-1">
                        <span
                          className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            borderRadius: 999,
                            border: "1px solid var(--border)",
                            color: "var(--muted)",
                            background: "var(--card)",
                          }}
                        >
                          Policy
                        </span>
                      </div>
                    ) : null}
                    {d.tags && Object.keys(d.tags).length > 0 ? (
                      <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                        {Object.entries(d.tags)
                          .map(([k, v]) => {
                            const label =
                              workspace?.document_tag_fields?.find((f) => f.key === k)?.label ?? k;
                            return `${label}: ${v}`;
                          })
                          .join(" • ")}
                      </div>
                    ) : null}
                    {Array.isArray(d.labels) && d.labels.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {d.labels.map((label) => (
                          <span
                            key={label}
                            className="inline-flex items-center px-2 py-0.5 text-[11px]"
                            style={{ borderRadius: 999, background: "var(--card2)", color: "var(--muted)" }}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex gap-2">
                    {stacks.length > 0 ? (
                      <>
                        <select
                          value={selectedStackByDoc[d.id] ?? ""}
                          onChange={(e) =>
                            setSelectedStackByDoc((prev) => ({ ...prev, [d.id]: e.target.value }))
                          }
                          className="focus-ring px-2 py-2 text-xs bg-transparent border"
                          style={{ borderColor: "var(--border)", borderRadius: 10, color: "var(--muted)" }}
                        >
                          <option value="">Stack…</option>
                          {stacks.map((stack) => (
                            <option key={stack.id} value={stack.id}>
                              {stack.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!selectedStackByDoc[d.id]}
                          onClick={() => {
                            const stackId = selectedStackByDoc[d.id];
                            if (stackId) void addToStack(stackId, d.id);
                          }}
                          className="focus-ring px-3 py-2 text-sm hover:opacity-80 disabled:opacity-50"
                          style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
                        >
                          Add to stack
                        </button>
                      </>
                    ) : null}
                    {tagFieldOptions.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => openTagEditor(d)}
                        className="focus-ring px-3 py-2 text-sm hover:opacity-80"
                        style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
                      >
                        Tags
                      </button>
                    ) : null}
                    {(viewerRole === "owner" || viewerRole === "admin") ? (
                      <button
                        type="button"
                        onClick={() => void openOwnership(d)}
                        className="focus-ring px-3 py-2 text-sm hover:opacity-80"
                        style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
                      >
                        Ownership
                      </button>
                    ) : null}
                    <Link
                      href={`/app/docs/${d.id}`}
                      className="focus-ring px-3 py-2 text-sm hover:opacity-80"
                      style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
                    >
                      View
                    </Link>
                    <Link
                      href={`/d/${d.publicId}`}
                      className="focus-ring px-3 py-2 text-sm hover:opacity-80"
                      style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
                    >
                      Open link
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ownershipDoc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "var(--bg)" }}>
          <div
            className="w-full max-w-xl border p-5 md:p-6"
            style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}
          >
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              CROSS-OWNERSHIP
            </div>
            <h3 className="mt-1 text-lg font-semibold">{ownershipDoc.title}</h3>
            <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              Assign shared responsibility across team members to maintain department coverage.
            </div>

            {ownershipLoading ? (
              <div className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
                Loading ownership settings…
              </div>
            ) : (
              <div className="mt-4 max-h-64 overflow-auto space-y-2">
                {ownershipMembers.map((m) => {
                  const isDocumentOwner = ownershipOwnerUserId === m.user_id;
                  const checked = isDocumentOwner || ownershipSelectedUserIds.includes(m.user_id);
                  return (
                    <label key={m.user_id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOwnershipUser(m.user_id)}
                        disabled={!ownershipCanManage || isDocumentOwner || ownershipSaving}
                      />
                      <span>{m.email ?? m.user_id}</span>
                      <span className="text-xs" style={{ color: "var(--muted2)" }}>
                        ({m.role}{isDocumentOwner ? ", owner" : ""})
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {ownershipError ? (
              <div className="mt-3 text-sm" style={{ color: "#ff3b30" }}>
                {ownershipError}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeOwnership}
                disabled={ownershipSaving}
                className="focus-ring px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
              >
                Close
              </button>
              {ownershipCanManage ? (
                <button
                  type="button"
                  onClick={() => void saveOwnership()}
                  disabled={ownershipSaving || ownershipLoading}
                  className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
                >
                  {ownershipSaving ? "Saving…" : "Save ownership"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tagEditorDoc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "var(--bg)" }}>
          <div
            className="w-full max-w-xl border p-5 md:p-6"
            style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}
          >
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              DOCUMENT TAGS
            </div>
            <h3 className="mt-1 text-lg font-semibold">{tagEditorDoc.title}</h3>
            <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              Add values such as Open and a matter/project reference.
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
              {tagFieldOptions.map((f) => (
                <input
                  key={f.key}
                  value={tagEditorValues[f.key] ?? ""}
                  onChange={(e) => setTagEditorValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder || f.label}
                  className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
                  style={{ borderColor: "var(--border)", borderRadius: 10 }}
                />
              ))}
            </div>

            {tagEditorError ? (
              <div className="mt-3 text-sm" style={{ color: "#ff3b30" }}>
                {tagEditorError}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeTagEditor}
                disabled={tagEditorSaving}
                className="focus-ring px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void saveTagEditor()}
                disabled={tagEditorSaving}
                className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
              >
                {tagEditorSaving ? "Saving…" : "Save tags"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

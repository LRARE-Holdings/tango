"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { UiButton, UiInput, UiModal, UiPanel, UiSectionCaption } from "@/components/ui/system";

type WorkspaceInfo = {
  id: string;
  name: string;
  slug: string | null;
};

type DocItem = {
  id: string;
  title: string;
  publicId: string;
  createdAt: string;
  acknowledgements: number;
  latestAcknowledgedAt: string | null;
  status: "Acknowledged" | "Pending";
};

type ViewerRole = "owner" | "admin" | "member";

type ResponsibilityMember = {
  user_id: string;
  email: string | null;
  role: ViewerRole;
};

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
  const [creating, setCreating] = useState(false);
  const [ownershipDoc, setOwnershipDoc] = useState<DocItem | null>(null);
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [ownershipSaving, setOwnershipSaving] = useState(false);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [ownershipMembers, setOwnershipMembers] = useState<ResponsibilityMember[]>([]);
  const [ownershipSelectedUserIds, setOwnershipSelectedUserIds] = useState<string[]>([]);
  const [ownershipOwnerUserId, setOwnershipOwnerUserId] = useState<string | null>(null);
  const [ownershipCanManage, setOwnershipCanManage] = useState(false);

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
      form.append("source_type", "upload");
      form.append("title", title.trim() || "Untitled");
      form.append("send_emails", "false");
      form.append("recipients", "[]");
      form.append("require_recipient_identity", "false");
      form.append("password_enabled", "false");
      form.append("max_acknowledgers_enabled", "false");
      form.append("max_acknowledgers", "0");
      if (file) {
        form.append("file", file);
      }

      const res = await fetch("/api/app/documents/create-from-source", { method: "POST", body: form });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to create document");

      setTitle("");
      setFile(null);
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            {workspace?.name ?? "Workspace documents"}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Team document catalogue with search across titles and public IDs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/new"
            className="focus-ring px-3 py-2 text-sm font-semibold hover:opacity-90"
            style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
          >
            Add document
          </Link>
          <Link
            href="/app/onboarding"
            className="focus-ring px-3 py-2 text-sm hover:opacity-90"
            style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
          >
            Onboarding
          </Link>
        </div>
      </div>

      <UiPanel className="p-4">
        <div className="flex items-center justify-between gap-3 flex-col sm:flex-row">
          <UiInput
            value={search}
            onChange={setSearch}
            placeholder="Search title or public ID…"
            className="sm:w-[440px] px-4 py-3"
          />
          <div className="text-xs" style={{ color: "var(--muted2)" }}>
            {counts.total} total • {counts.pending} pending • {counts.acknowledged} acknowledged
          </div>
        </div>
      </UiPanel>

      <UiPanel className="space-y-3 p-4">
        <UiSectionCaption>ADD DOCUMENT</UiSectionCaption>
        <UiInput
          value={title}
          onChange={setTitle}
          placeholder="e.g. Employee onboarding pack"
        />
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="focus-ring w-full rounded-xl border bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--fg)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--bg)]"
          style={{ borderColor: "var(--border)" }}
        />
        <div>
          <UiButton
            onClick={() => void createDocument()}
            disabled={creating}
            variant="primary"
          >
            {creating ? "Creating…" : "Create document"}
          </UiButton>
        </div>
      </UiPanel>

      {loading && <div className="text-sm" style={{ color: "var(--muted)" }}>Loading…</div>}

      {error && (
        <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}>
          <div className="text-sm font-semibold">Couldn’t load workspace documents</div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {error}
          </div>
        </div>
      )}

      {!loading && !error && documents.length === 0 && (
        <div className="border p-6" style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}>
          <div className="text-sm font-semibold">No documents found</div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Create a receipt or refine your search.
          </div>
        </div>
      )}

      {!loading && !error && documents.length > 0 && (
        <div className="border" style={{ borderColor: "var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div className="px-5 py-3 text-xs tracking-wide" style={{ background: "var(--card2)", color: "var(--muted2)" }}>
            CATALOGUE
          </div>
          <div>
            {documents.map((d) => (
              <div key={d.id} className="px-5 py-4" style={{ borderTop: "1px solid var(--border2)" }}>
                <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-sm font-semibold truncate">{d.title}</div>
                      <StatusBadge status={d.status} />
                      <div className="text-xs" style={{ color: "var(--muted2)" }}>
                        {d.publicId}
                      </div>
                    </div>

                    <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                      Created: {formatDate(d.createdAt)} • Acknowledgements: {d.acknowledgements}
                      {d.latestAcknowledgedAt ? ` • Latest: ${formatDate(d.latestAcknowledgedAt)}` : ""}
                    </div>
                  </div>

                  <div className="flex gap-2">
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
        <UiModal className="max-w-xl rounded-xl">
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
              <UiButton
                onClick={closeOwnership}
                disabled={ownershipSaving}
              >
                Close
              </UiButton>
              {ownershipCanManage ? (
                <UiButton
                  onClick={() => void saveOwnership()}
                  disabled={ownershipSaving || ownershipLoading}
                  variant="primary"
                >
                  {ownershipSaving ? "Saving…" : "Save ownership"}
                </UiButton>
              ) : null}
            </div>
        </UiModal>
      ) : null}
    </div>
  );
}

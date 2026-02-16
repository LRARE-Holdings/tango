"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DocumentSourceChooser, type DocumentSourceType } from "@/components/document-source-chooser";

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
  const [search, setSearch] = useState("");
  const [sourceType, setSourceType] = useState<DocumentSourceType>("upload");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cloudFileUrl, setCloudFileUrl] = useState("");
  const [cloudFileId, setCloudFileId] = useState("");
  const [cloudRevisionId, setCloudRevisionId] = useState("");
  const [creating, setCreating] = useState(false);

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

    if (sourceType === "upload" && !file) {
      setError("Choose a PDF file.");
      return;
    }
    if (sourceType !== "upload" && !cloudFileUrl.trim()) {
      setError("Cloud URL is required.");
      return;
    }

    setCreating(true);
    try {
      const form = new FormData();
      form.append("source_type", sourceType);
      form.append("title", title.trim() || "Untitled");
      form.append("send_emails", "false");
      form.append("recipients", "[]");
      form.append("require_recipient_identity", "false");
      form.append("password_enabled", "false");
      form.append("max_acknowledgers_enabled", "false");
      form.append("max_acknowledgers", "0");
      if (sourceType === "upload" && file) {
        form.append("file", file);
      } else {
        form.append("cloud_file_url", cloudFileUrl.trim());
        form.append("cloud_file_id", cloudFileId.trim());
        form.append("cloud_revision_id", cloudRevisionId.trim());
      }

      const res = await fetch("/api/app/documents/create-from-source", { method: "POST", body: form });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to create document");

      setTitle("");
      setFile(null);
      setCloudFileUrl("");
      setCloudFileId("");
      setCloudRevisionId("");
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

      <div className="border p-4" style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}>
        <div className="flex items-center justify-between gap-3 flex-col sm:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or public ID…"
            className="focus-ring w-full sm:w-[440px] border px-4 py-3 text-sm bg-transparent"
            style={{ borderColor: "var(--border)", borderRadius: 10 }}
          />
          <div className="text-xs" style={{ color: "var(--muted2)" }}>
            {counts.total} total • {counts.pending} pending • {counts.acknowledged} acknowledged
          </div>
        </div>
      </div>

      <div className="border p-4 space-y-3" style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}>
        <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
          ADD DOCUMENT
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Employee onboarding pack"
          className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
          style={{ borderColor: "var(--border)", borderRadius: 10 }}
        />
        <DocumentSourceChooser
          sourceType={sourceType}
          onSourceTypeChange={setSourceType}
          cloud={{ fileUrl: cloudFileUrl, fileId: cloudFileId, revisionId: cloudRevisionId }}
          onCloudChange={(patch) => {
            if (typeof patch.fileUrl === "string") setCloudFileUrl(patch.fileUrl);
            if (typeof patch.fileId === "string") setCloudFileId(patch.fileId);
            if (typeof patch.revisionId === "string") setCloudRevisionId(patch.revisionId);
          }}
          disabled={creating}
        />
        {sourceType === "upload" ? (
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "var(--border)", borderRadius: 10 }}
          />
        ) : null}
        <div>
          <button
            type="button"
            onClick={() => void createDocument()}
            disabled={creating}
            className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
          >
            {creating ? "Creating…" : "Create document"}
          </button>
        </div>
      </div>

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
    </div>
  );
}

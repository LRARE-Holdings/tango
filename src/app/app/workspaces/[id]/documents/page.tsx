"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type WorkspaceInfo = {
  id: string;
  name: string;
  slug: string | null;
};

type Viewer = {
  user_id: string;
  role: "owner" | "admin" | "member";
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
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [search, setSearch] = useState("");

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
        setViewer((json?.viewer ?? null) as Viewer | null);
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

  const idForLinks = workspace?.slug ?? workspaceIdentifier;
  const canManageSettings = viewer?.role === "owner" || viewer?.role === "admin";

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
        <div className="flex gap-2">
          <Link
            href={`/app/workspaces/${idForLinks}/dashboard`}
            className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
          >
            Dashboard
          </Link>
          {canManageSettings ? (
            <Link
              href={`/app/workspaces/${idForLinks}/settings`}
              className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
              style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
            >
              Settings
            </Link>
          ) : null}
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

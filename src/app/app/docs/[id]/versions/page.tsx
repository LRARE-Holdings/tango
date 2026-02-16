"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";

type DocSummary = {
  id: string;
  title: string;
  publicId: string;
  currentVersionId?: string | null;
  versionCount?: number;
};

type VersionRow = {
  id: string;
  version_number: number;
  version_label?: string | null;
  source_type: string;
  created_at: string | null;
  source_file_id?: string | null;
  source_revision_id?: string | null;
  sha256?: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return ",";
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
}

export default function DocumentVersionsPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = use(params as any) as { id: string };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocSummary | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [docRes, verRes] = await Promise.all([
          fetch(`/api/app/documents/${id}`, { cache: "no-store" }),
          fetch(`/api/app/documents/${id}/versions`, { cache: "no-store" }),
        ]);
        const docJson = await docRes.json().catch(() => null);
        const verJson = await verRes.json().catch(() => null);
        if (!docRes.ok) throw new Error(docJson?.error ?? "Failed to load document.");
        if (!verRes.ok) throw new Error(verJson?.error ?? "Failed to load versions.");
        if (!alive) return;
        setDoc(docJson?.document ?? null);
        setVersions((verJson?.versions ?? []) as VersionRow[]);
      } catch (e: unknown) {
        if (alive) setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [id]);

  const currentVersion = useMemo(() => {
    if (!doc?.currentVersionId) return null;
    return versions.find((v) => v.id === doc.currentVersionId) ?? null;
  }, [doc?.currentVersionId, versions]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div>
          <div className="text-xs tracking-widest" style={{ color: "var(--muted2)" }}>
            DOCUMENT VERSIONS
          </div>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">
            {doc?.title ?? "Document"}
          </h1>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Current:{" "}
            {currentVersion ? `v${currentVersion.version_label ?? currentVersion.version_number}` : `v${doc?.versionCount ?? 1}`}
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/app/docs/${id}`}
            className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            Back to document
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          Loading…
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="text-sm font-semibold">Couldn’t load versions</div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {error}
          </div>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="px-4 py-3 text-xs tracking-wide" style={{ color: "var(--muted2)", background: "var(--card2)" }}>
            VERSION HISTORY
          </div>
          {versions.length === 0 ? (
            <div className="px-4 py-4 text-sm" style={{ color: "var(--muted)" }}>
              No versions found.
            </div>
          ) : (
            versions.map((v) => {
              const isCurrent = doc?.currentVersionId === v.id;
              return (
                <div
                  key={v.id}
                  className="px-4 py-4"
                  style={{ borderTop: "1px solid var(--border2)", background: isCurrent ? "var(--card2)" : "transparent" }}
                >
                  <div className="flex items-start justify-between gap-3 flex-col md:flex-row">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">
                        v{v.version_label ?? v.version_number}
                        {isCurrent ? (
                          <span className="ml-2 text-xs" style={{ color: "var(--muted2)" }}>
                            CURRENT
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                        Source: {String(v.source_type ?? "upload")}
                      </div>
                      <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                        Created: {formatDate(v.created_at)}
                      </div>
                      {v.source_revision_id ? (
                        <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                          Source revision: {v.source_revision_id}
                        </div>
                      ) : null}
                      {v.sha256 ? (
                        <div className="mt-1 text-xs break-all" style={{ color: "var(--muted2)" }}>
                          SHA256: {v.sha256}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}


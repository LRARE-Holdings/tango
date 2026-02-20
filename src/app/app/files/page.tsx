"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DocItem = {
  id: string;
  title: string;
  publicId: string;
  createdAt: string;
  acknowledgements: number;
  status: "Acknowledged" | "Pending";
};

function normalizeQuery(q: string) {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function FilesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/app/documents", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load files");
        if (!alive) return;
        setDocuments((json?.documents ?? []) as DocItem[]);
      } catch (e: unknown) {
        if (alive) setError(e instanceof Error ? e.message : "Failed to load files");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = normalizeQuery(query);
    if (!needle) return documents;
    return documents.filter((doc) => `${doc.title} ${doc.publicId}`.toLowerCase().includes(needle));
  }, [documents, query]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
        <Link
          href="/app/new"
          className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90"
          style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
        >
          Create new Receipt
        </Link>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search files"
        className="focus-ring w-full border px-4 py-3 text-sm bg-transparent"
        style={{ borderColor: "var(--border)", borderRadius: 12 }}
      />

      {loading ? <div className="text-sm" style={{ color: "var(--muted)" }}>Loading…</div> : null}
      {error ? <div className="text-sm" style={{ color: "#b91c1c" }}>{error}</div> : null}

      {!loading && !error ? (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <Link
              key={doc.id}
              href={`/app/docs/${doc.id}`}
              className="block border p-4 hover:opacity-90"
              style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}
            >
              <div className="text-sm font-semibold">{doc.title}</div>
              <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                {doc.status} · {doc.acknowledgements} acknowledgements
              </div>
            </Link>
          ))}
          {filtered.length === 0 ? (
            <div className="border p-4 text-sm" style={{ borderColor: "var(--border)", borderRadius: 12 }}>
              No files found.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


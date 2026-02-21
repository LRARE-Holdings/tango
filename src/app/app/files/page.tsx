"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppHero, AppPage, AppPanel } from "@/components/app/page-layout";

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
    <AppPage>
      <AppHero
        kicker="FILES"
        title="Files"
        description="Find and manage all receipts from one place."
        actions={
          <Link href="/app/new" className="focus-ring app-btn-primary">
            Create new Receipt
          </Link>
        }
      />

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files" className="app-input" />

      {loading ? <div className="app-subtle text-sm">Loading…</div> : null}
      {error ? <div className="app-error">{error}</div> : null}

      {!loading && !error ? (
        <AppPanel title="All files">
          <div className="space-y-2">
            {filtered.map((doc) => (
              <Link key={doc.id} href={`/app/docs/${doc.id}`} className="app-list-item p-4">
                <div className="text-sm font-semibold">{doc.title}</div>
                <div className="app-subtle-2 mt-1 text-xs">
                  {doc.status} · {doc.acknowledgements} acknowledgements
                </div>
              </Link>
            ))}
            {filtered.length === 0 ? <div className="app-empty">No files found.</div> : null}
          </div>
        </AppPanel>
      ) : null}
    </AppPage>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DocItem = {
  id: string;
  title: string;
  publicId: string;
  createdAt: string;
};

export default function OnboardingDocumentsPage() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocItem[]>([]);

  async function loadDocs() {
    const res = await fetch("/api/app/documents", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error ?? "Failed to load documents");
    setDocuments((json?.documents ?? []) as DocItem[]);
  }

  useEffect(() => {
    loadDocs().catch(() => {});
  }, []);

  async function createDocument() {
    setError(null);
    setCreatedLink(null);
    if (!file) {
      setError("Choose a PDF or DOCX file to continue.");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("source_type", "upload");
      form.append("title", title.trim() || "Untitled onboarding document");
      form.append("send_emails", "false");
      form.append("recipients", "[]");
      form.append("require_recipient_identity", "true");
      form.append("password_enabled", "false");
      form.append("max_acknowledgers_enabled", "false");
      form.append("max_acknowledgers", "0");
      if (file) {
        form.append("file", file);
      }

      const res = await fetch("/api/app/documents/create-from-source", { method: "POST", body: form });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Could not create document");

      const link = typeof json?.share_url === "string" ? json.share_url : null;
      setCreatedLink(link);
      setTitle("");
      setFile(null);
      await loadDocs();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Onboarding Documents</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Create onboarding documents from local PDF or DOCX upload.
          </p>
        </div>
        <Link
          href="/app/new"
          className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90"
          style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
        >
          Full Create Flow
        </Link>
      </div>

      <div className="border p-5" style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}>
        <div className="grid grid-cols-1 gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Employee Handbook v1"
            className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "var(--border)", borderRadius: 10 }}
          />

          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "var(--border)", borderRadius: 10 }}
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void createDocument()}
              disabled={loading}
              className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
            >
              {loading ? "Creating…" : "Create onboarding document"}
            </button>
          </div>

          {error ? (
            <div className="text-sm" style={{ color: "#ff3b30" }}>
              {error}
            </div>
          ) : null}
          {createdLink ? (
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              Created:{" "}
              <Link href={createdLink} className="underline underline-offset-2">
                {createdLink}
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <div className="border" style={{ borderColor: "var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div className="px-4 py-3 text-xs tracking-wide" style={{ color: "var(--muted2)", background: "var(--card2)" }}>
          DOCUMENT LIBRARY
        </div>
        <div>
          {documents.length === 0 ? (
            <div className="px-4 py-4 text-sm" style={{ color: "var(--muted)" }}>
              No documents yet.
            </div>
          ) : (
            documents.map((d) => (
              <div key={d.id} className="px-4 py-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border2)" }}>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{d.title}</div>
                  <div className="text-xs" style={{ color: "var(--muted2)" }}>
                    {d.publicId}
                  </div>
                </div>
                <Link
                  href={`/app/docs/${d.id}`}
                  className="focus-ring px-3 py-2 text-sm hover:opacity-90"
                  style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
                >
                  Open
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="focus-ring rounded-full px-6 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
      style={{ background: "var(--fg)", color: "var(--bg)" }}
    >
      {children}
    </button>
  );
}

function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="focus-ring inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium border transition hover:opacity-80"
      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
    >
      {children}
    </Link>
  );
}

export default function NewReceipt() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const fileLabel = useMemo(() => {
    if (!file) return "Choose a PDF";
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `${file.name} (${mb}MB)`;
  }, [file]);

  async function create() {
    setError(null);
    setShareUrl(null);

    if (!file) {
      setError("Please choose a PDF.");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("title", title || "Untitled");
      form.append("file", file);

      const res = await fetch("/api/docs", { method: "POST", body: form });
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error ?? "Upload failed");

      setShareUrl(json.share_url);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    const abs = `${window.location.origin}${shareUrl}`;
    await navigator.clipboard.writeText(abs);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Create receipt</h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          Upload a PDF to generate a share link. When the recipient acknowledges, you’ll collect a Receipt Record.
        </p>
      </div>

      <div
        className="rounded-3xl border p-6 md:p-8"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              TITLE (OPTIONAL)
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Client Care Letter — Residential Conveyancing"
              className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm bg-transparent focus-ring"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          <div>
            <label className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              PDF
            </label>
            <div
              className="mt-2 rounded-2xl border px-4 py-3 text-sm flex items-center justify-between gap-3"
              style={{ borderColor: "var(--border)" }}
            >
              <span style={{ color: "var(--muted)" }} className="truncate">
                {fileLabel}
              </span>
              <label
                className="focus-ring rounded-full border px-3 py-1.5 text-xs cursor-pointer hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                Browse
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <div className="mt-2 text-xs" style={{ color: "var(--muted2)" }}>
              Max 20MB. PDF only.
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <PrimaryButton onClick={create} disabled={loading}>
            {loading ? "Creating…" : "Create share link"}
          </PrimaryButton>
          <GhostLink href="/app">Back</GhostLink>
        </div>

        {error && (
          <div className="mt-4 text-sm" style={{ color: "#ff3b30" }}>
            {error}
          </div>
        )}

        {shareUrl && (
          <div
            className="mt-6 rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--card2)" }}
          >
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              SHARE LINK
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <Link className="underline underline-offset-4 text-sm" href={shareUrl}>
                {shareUrl}
              </Link>

              <button
                className="focus-ring rounded-full border px-3 py-1.5 text-xs hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                onClick={copyLink}
                type="button"
              >
                Copy
              </button>
            </div>

            <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
              Recipients will be able to open the PDF via a signed link (we’ll wire that next).
            </div>
          </div>
        )}
      </div>

      <div className="text-xs leading-relaxed max-w-2xl" style={{ color: "var(--muted2)" }}>
        Next: build <code>/d/[publicId]</code> + <code>/api/public/[publicId]</code> to return a signed URL, then
        <code>/api/public/[publicId]/submit</code> to record acknowledgements.
      </div>
    </div>
  );
}
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Workspace = {
  id: string;
  name: string;
  brand_logo_updated_at?: string | null;
};

export default function WorkspaceBrandingPage({ params }: { params: { id: string } }) {
  const workspaceId = params.id;

  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/app/workspaces/${workspaceId}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load");
        if (!alive) return;
        setWorkspace(json?.workspace ?? null);
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Something went wrong");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  const logoSrc = useMemo(() => {
    if (!workspace?.id) return null;
    return `/api/app/workspaces/${workspace.id}/branding/logo/view${
      workspace.brand_logo_updated_at ? `?v=${encodeURIComponent(workspace.brand_logo_updated_at)}` : ""
    }`;
  }, [workspace?.id, workspace?.brand_logo_updated_at]);

  async function upload() {
    if (!file) return;

    setUploading(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`/api/app/workspaces/${workspaceId}/branding/logo`, {
        method: "POST",
        body: form,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Upload failed");

      setMsg("Logo updated.");
      setFile(null);

      // Reload workspace to refresh cache-busting timestamp
      const wsRes = await fetch(`/api/app/workspaces/${workspaceId}`, { cache: "no-store" });
      const wsJson = await wsRes.json().catch(() => null);
      if (wsRes.ok) setWorkspace(wsJson?.workspace ?? null);
    } catch (e: any) {
      setMsg(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight truncate">
            {loading ? "Loading…" : workspace?.name ?? "Branding"}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Team branding v1: logo only. Colours and typography stay fixed.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/app/workspaces/${workspaceId}`}
            className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
          >
            Back
          </Link>
          <Link
            href={`/app/workspaces/${workspaceId}/members`}
            className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
          >
            Members
          </Link>
        </div>
      </div>

      {error && (
        <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}>
          <div className="text-sm font-semibold">Couldn’t load branding</div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {error}
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="border p-6" style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-semibold">Current logo</div>
              <div className="mt-3 border p-4" style={{ borderColor: "var(--border2)", background: "var(--bg)", borderRadius: 12 }}>
                {logoSrc ? (
                  <img
                    src={logoSrc}
                    alt="Workspace logo"
                    className="h-12 w-auto"
                    style={{ objectFit: "contain" }}
                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                  />
                ) : (
                  <div className="text-sm" style={{ color: "var(--muted)" }}>
                    No logo uploaded yet.
                  </div>
                )}
              </div>
              <div className="mt-3 text-xs" style={{ color: "var(--muted2)" }}>
                PNG only (v1). Recommended: transparent background, 512×512.
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold">Upload a new logo</div>

              <div className="mt-3 flex items-center justify-between gap-3 border px-4 py-3"
                   style={{ borderColor: "var(--border2)", borderRadius: 12 }}>
                <div className="min-w-0">
                  <div className="text-sm truncate">{file ? file.name : "Choose a PNG"}</div>
                  <div className="text-xs" style={{ color: "var(--muted2)" }}>
                    Max 1MB
                  </div>
                </div>
                <label
                  className="focus-ring px-3 py-2 text-sm font-medium hover:opacity-80"
                  style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
                >
                  Browse
                  <input
                    type="file"
                    accept="image/png"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void upload()}
                  disabled={!file || uploading}
                  className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
                >
                  {uploading ? "Uploading…" : "Upload logo"}
                </button>

                {msg ? (
                  <div className="text-sm" style={{ color: msg === "Logo updated." ? "var(--muted)" : "#ff3b30" }}>
                    {msg}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
                v1 keeps brand consistent: only the logo changes (no colours, no typography changes).
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
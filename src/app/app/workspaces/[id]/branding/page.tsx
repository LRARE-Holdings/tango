"use client";

import { useParams } from "next/navigation";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Workspace = {
  id: string;
  name: string;
  slug?: string | null;
  brand_logo_updated_at?: string | null;
  brand_logo_width_px?: number | null;
};

export default function WorkspaceBrandingPage() {
  const params = useParams<{ id?: string }>();
  const workspaceId = typeof params?.id === "string" ? params.id : "";
  const workspaceIdentifier = useMemo(() => workspaceId.trim(), [workspaceId]);

  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [logoWidthPx, setLogoWidthPx] = useState<number>(104);
  const [savingSize, setSavingSize] = useState(false);
  const [sizeMsg, setSizeMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    if (!workspaceIdentifier) {
      setWorkspace(null);
      setLoading(false);
      setError(workspaceId ? "Invalid workspace." : null);
      return () => {
        alive = false;
      };
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load");
        if (!alive) return;
        setWorkspace(json?.workspace ?? null);
        const width = Number(json?.workspace?.brand_logo_width_px ?? 104);
        setLogoWidthPx(Number.isFinite(width) ? Math.max(48, Math.min(320, Math.floor(width))) : 104);
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
  }, [workspaceIdentifier, workspaceId]);

  const logoSrc = useMemo(() => {
    if (!workspace?.id) return null;
    return `/api/app/workspaces/${workspace.id}/branding/logo/view${
      workspace.brand_logo_updated_at ? `?v=${encodeURIComponent(workspace.brand_logo_updated_at)}` : ""
    }`;
  }, [workspace?.id, workspace?.brand_logo_updated_at]);

  async function upload() {
    if (!file || !workspaceIdentifier) return;

    setUploading(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/branding/logo`, {
        method: "POST",
        body: form,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Upload failed");

      setMsg("Logo updated.");
      setFile(null);

      // Reload workspace to refresh cache-busting timestamp
      const wsRes = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}`, { cache: "no-store" });
      const wsJson = await wsRes.json().catch(() => null);
      if (wsRes.ok) setWorkspace(wsJson?.workspace ?? null);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveLogoSize(nextWidth: number) {
    if (!workspaceIdentifier) return;
    setSavingSize(true);
    setSizeMsg(null);
    try {
      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/branding/logo`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brand_logo_width_px: nextWidth }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to save logo size.");
      setSizeMsg("Logo size saved.");
      setWorkspace((prev) => (prev ? { ...prev, brand_logo_width_px: nextWidth } : prev));
    } catch (e: unknown) {
      setSizeMsg(e instanceof Error ? e.message : "Failed to save logo size.");
    } finally {
      setSavingSize(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight truncate">
            {loading ? "Loading…" : workspace?.name ?? "Branding"}
          </h1>
        </div>

        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted2)" }}>
          Branding
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
                  <Image
                    src={logoSrc}
                    alt="Workspace logo"
                    width={logoWidthPx}
                    height={Math.max(20, Math.round(logoWidthPx / 4))}
                    unoptimized
                    className="w-auto"
                    style={{ objectFit: "contain", width: `${logoWidthPx}px`, height: "auto", maxWidth: "100%" }}
                  />
                ) : (
                  <div className="text-sm" style={{ color: "var(--muted)" }}>
                    No logo uploaded yet.
                  </div>
                )}
              </div>
              <div className="mt-3 text-xs" style={{ color: "var(--muted2)" }}>
                PNG only. Recommended: transparent background, 512×512.
              </div>
              <div className="mt-4 rounded-xl border p-4" style={{ borderColor: "var(--border2)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Header logo size</div>
                  <div className="text-xs" style={{ color: "var(--muted2)" }}>{logoWidthPx}px</div>
                </div>
                <input
                  type="range"
                  min={48}
                  max={320}
                  step={1}
                  value={logoWidthPx}
                  onChange={(e) => setLogoWidthPx(Math.max(48, Math.min(320, Math.floor(Number(e.target.value) || 104))))}
                  className="mt-3 w-full"
                />
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void saveLogoSize(logoWidthPx)}
                    disabled={savingSize}
                    className="focus-ring px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                    style={{ borderRadius: 999, border: "1px solid var(--border)" }}
                  >
                    {savingSize ? "Saving…" : "Save size"}
                  </button>
                  {sizeMsg ? (
                    <div className="text-xs" style={{ color: sizeMsg === "Logo size saved." ? "var(--muted)" : "#ff3b30" }}>
                      {sizeMsg}
                    </div>
                  ) : null}
                </div>
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
                Branding currently supports logo updates only (no colour or typography changes).
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

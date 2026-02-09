"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Workspace = {
  id: string;
  name: string;
  slug: string | null;
};

export default function WorkspaceGeneralSettingsPage() {
  const params = useParams<{ id?: string }>();
  const workspaceId = typeof params?.id === "string" ? params.id : "";
  const workspaceIdentifier = useMemo(() => workspaceId.trim(), [workspaceId]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    let alive = true;
    if (!workspaceIdentifier) {
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
        if (!res.ok) throw new Error(json?.error ?? "Failed to load workspace");
        if (!alive) return;

        const ws = (json?.workspace ?? null) as Workspace | null;
        setWorkspace(ws);
        setName(ws?.name ?? "");
        setSlug(ws?.slug ?? "");
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

  const previewSlug = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  async function save() {
    if (!workspaceIdentifier) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          slug: slug.trim().length > 0 ? slug : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to save settings");

      const ws = (json?.workspace ?? null) as Workspace | null;
      setWorkspace(ws);
      setName(ws?.name ?? "");
      setSlug(ws?.slug ?? "");
      setMessage("Saved.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="border p-6"
        style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}
      >
        <div className="text-lg font-semibold">General</div>
        <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Workspace identity and URL slug.
        </div>

        {loading ? (
          <div className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
            Loading…
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                WORKSPACE NAME
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full border px-4 py-3 text-sm bg-transparent focus-ring"
                style={{ borderColor: "var(--border)", borderRadius: 10 }}
                placeholder="Acme Legal"
              />
            </div>

            <div>
              <label className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                WORKSPACE SLUG
              </label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="mt-2 w-full border px-4 py-3 text-sm bg-transparent focus-ring"
                style={{ borderColor: "var(--border)", borderRadius: 10 }}
                placeholder="acme-legal"
              />
              <div className="mt-2 text-xs" style={{ color: "var(--muted2)" }}>
                Public URL preview: {previewSlug ? `getreceipt.xyz/workspaces/${previewSlug}` : "set a slug"}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading || !workspace}
            className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {message ? <div className="text-sm" style={{ color: "var(--muted)" }}>{message}</div> : null}
          {error ? <div className="text-sm" style={{ color: "#ff3b30" }}>{error}</div> : null}
        </div>
      </div>
    </div>
  );
}

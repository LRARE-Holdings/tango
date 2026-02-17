"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TagField = {
  key: string;
  label: string;
  placeholder?: string;
};

type Workspace = {
  id: string;
  name: string;
  slug: string | null;
  document_tag_fields?: TagField[];
};

function normalizeTagKey(v: string) {
  return v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function WorkspaceDocumentSettingsPage() {
  const params = useParams<{ id?: string }>();
  const workspaceId = typeof params?.id === "string" ? params.id : "";
  const workspaceIdentifier = useMemo(() => workspaceId.trim(), [workspaceId]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [fields, setFields] = useState<TagField[]>([]);

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
        setFields(Array.isArray(ws?.document_tag_fields) ? ws!.document_tag_fields! : []);
      } catch (e: unknown) {
        if (alive) setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [workspaceIdentifier, workspaceId]);

  function addField() {
    setFields((list) => [...list, { key: "", label: "", placeholder: "" }]);
  }

  function removeField(index: number) {
    setFields((list) => list.filter((_, i) => i !== index));
  }

  function updateField(index: number, patch: Partial<TagField>) {
    setFields((list) => list.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  async function save() {
    if (!workspaceIdentifier) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const clean = fields
        .map((f) => {
          const label = String(f.label ?? "").trim();
          const key = normalizeTagKey(String(f.key ?? "").trim() || label);
          const placeholder = String(f.placeholder ?? "").trim();
          return {
            key,
            label,
            ...(placeholder ? { placeholder } : {}),
          };
        })
        .filter((f) => f.label.length > 0 && f.key.length > 0)
        .slice(0, 12);

      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ document_tag_fields: clean }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to save settings");

      const ws = (json?.workspace ?? null) as Workspace | null;
      setWorkspace(ws);
      setFields(Array.isArray(ws?.document_tag_fields) ? ws!.document_tag_fields! : []);
      setMessage("Tag fields saved.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save tag fields");
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
        <div className="text-lg font-semibold">Document tags</div>
        <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Define workspace tag fields for document classification (for example: Matter ID, Client ID, Project Codename).
        </div>
        {workspace?.name ? (
          <div className="mt-2 text-xs" style={{ color: "var(--muted2)" }}>
            Workspace: {workspace.name}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
            Loading…
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {fields.map((field, index) => (
              <div
                key={`${index}-${field.key}`}
                className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center"
              >
                <input
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  placeholder="Field label (e.g. Matter ID)"
                  className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
                  style={{ borderColor: "var(--border)", borderRadius: 10 }}
                />
                <input
                  value={field.key}
                  onChange={(e) => updateField(index, { key: e.target.value })}
                  placeholder="Field key (optional)"
                  className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
                  style={{ borderColor: "var(--border)", borderRadius: 10 }}
                />
                <input
                  value={field.placeholder ?? ""}
                  onChange={(e) => updateField(index, { placeholder: e.target.value })}
                  placeholder="Placeholder (optional)"
                  className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
                  style={{ borderColor: "var(--border)", borderRadius: 10 }}
                />
                <button
                  type="button"
                  onClick={() => removeField(index)}
                  className="focus-ring px-3 py-2 text-xs hover:opacity-80"
                  style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
                >
                  Remove
                </button>
              </div>
            ))}

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <button
                type="button"
                onClick={addField}
                className="focus-ring px-4 py-2 text-sm hover:opacity-90"
                style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
              >
                Add tag field
              </button>

              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || loading}
                className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
              >
                {saving ? "Saving…" : "Save tag settings"}
              </button>
            </div>
          </div>
        )}

        {message ? <div className="mt-3 text-sm" style={{ color: "var(--muted)" }}>{message}</div> : null}
        {error ? <div className="mt-3 text-sm" style={{ color: "#ff3b30" }}>{error}</div> : null}
      </div>
    </div>
  );
}


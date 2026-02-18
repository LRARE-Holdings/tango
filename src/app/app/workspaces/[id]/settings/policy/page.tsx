"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Workspace = {
  id: string;
  name: string;
  slug: string | null;
  policy_mode_enabled?: boolean;
};

type Licensing = {
  plan?: string;
};

export default function WorkspacePolicySettingsPage() {
  const params = useParams<{ id?: string }>();
  const workspaceId = typeof params?.id === "string" ? params.id : "";
  const workspaceIdentifier = useMemo(() => workspaceId.trim(), [workspaceId]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [licensing, setLicensing] = useState<Licensing | null>(null);
  const [enabled, setEnabled] = useState(false);

  const policyEligible = useMemo(() => {
    const plan = String(licensing?.plan ?? "").toLowerCase();
    return plan === "team" || plan === "enterprise";
  }, [licensing?.plan]);

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
        const lic = (json?.licensing ?? null) as Licensing | null;
        setWorkspace(ws);
        setLicensing(lic);
        setEnabled(ws?.policy_mode_enabled === true);
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

  async function save() {
    if (!workspaceIdentifier || !workspace) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          policy_mode_enabled: enabled,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to save policy settings");

      const ws = (json?.workspace ?? null) as Workspace | null;
      setWorkspace(ws);
      setEnabled(ws?.policy_mode_enabled === true);
      setMessage("Policy mode settings saved.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save policy settings");
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
        <div className="text-lg font-semibold">Policy mode</div>
        <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Team/Enterprise workflow presets for workplace policy acknowledgements.
        </div>

        {loading ? (
          <div className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
            Loading…
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {!policyEligible ? (
              <div
                className="text-sm border px-4 py-3"
                style={{ borderColor: "var(--border)", borderRadius: 10, color: "var(--muted)" }}
              >
                Policy mode is available on Team and Enterprise workspaces only.
              </div>
            ) : (
              <>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                  />
                  <span>Enable Policy mode for this workspace</span>
                </label>

                <div
                  className="text-xs border px-4 py-3"
                  style={{ borderColor: "var(--border)", borderRadius: 10, color: "var(--muted2)" }}
                >
                  Default behavior in Policy mode:
                  <br />
                  • No maximum acknowledgements (unlimited)
                  <br />
                  • Uses bulk email plus share-link flow
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading || !workspace || !policyEligible}
            className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
          >
            {saving ? "Saving…" : "Save policy settings"}
          </button>
          {message ? <div className="text-sm" style={{ color: "var(--muted)" }}>{message}</div> : null}
          {error ? <div className="text-sm" style={{ color: "#ff3b30" }}>{error}</div> : null}
        </div>
      </div>
    </div>
  );
}

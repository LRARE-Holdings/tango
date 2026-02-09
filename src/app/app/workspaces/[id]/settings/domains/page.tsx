"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type DomainItem = {
  id: string;
  domain: string;
  status: "pending" | "verified" | "failed";
  verification_record_name: string;
  verification_record_type: string;
  verification_record_value: string;
  verified_at: string | null;
  created_at: string;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export default function WorkspaceDomainsSettingsPage() {
  const params = useParams<{ id?: string }>();
  const workspaceId = typeof params?.id === "string" ? params.id : "";
  const validWorkspaceId = useMemo(() => (workspaceId && isUuid(workspaceId) ? workspaceId : null), [workspaceId]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [domainInput, setDomainInput] = useState("");
  const [domains, setDomains] = useState<DomainItem[]>([]);

  const loadDomains = useCallback(async () => {
    if (!validWorkspaceId) return;

    const res = await fetch(`/api/app/workspaces/${validWorkspaceId}/domains`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error ?? "Failed to load domains");
    setDomains((json?.domains ?? []) as DomainItem[]);
  }, [validWorkspaceId]);

  useEffect(() => {
    let alive = true;
    if (!validWorkspaceId) {
      setLoading(false);
      setError(workspaceId ? "Invalid workspace id." : null);
      return () => {
        alive = false;
      };
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        await loadDomains();
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
  }, [loadDomains, validWorkspaceId, workspaceId]);

  async function addDomain() {
    if (!validWorkspaceId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/app/workspaces/${validWorkspaceId}/domains`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: domainInput }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to add domain");
      setDomainInput("");
      setMessage("Domain added. Configure DNS TXT record to verify.");
      await loadDomains();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add domain");
    } finally {
      setSaving(false);
    }
  }

  async function removeDomain(domainId: string) {
    if (!validWorkspaceId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/app/workspaces/${validWorkspaceId}/domains/${domainId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to remove domain");
      setMessage("Domain removed.");
      await loadDomains();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to remove domain");
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
        <div className="text-lg font-semibold">Domains</div>
        <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Add a custom domain now, then verify via DNS TXT. Serving traffic through your domain is the next phase.
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="receipt.company.com"
            className="w-full md:w-[360px] border px-4 py-3 text-sm bg-transparent focus-ring"
            style={{ borderColor: "var(--border)", borderRadius: 10 }}
          />
          <button
            type="button"
            onClick={() => void addDomain()}
            disabled={saving || loading || !domainInput.trim()}
            className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
          >
            Add domain
          </button>
        </div>

        {message ? <div className="mt-3 text-sm" style={{ color: "var(--muted)" }}>{message}</div> : null}
        {error ? <div className="mt-3 text-sm" style={{ color: "#ff3b30" }}>{error}</div> : null}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            Loading…
          </div>
        ) : domains.length === 0 ? (
          <div
            className="border p-5 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12, color: "var(--muted)" }}
          >
            No domains configured yet.
          </div>
        ) : (
          domains.map((d) => (
            <div
              key={d.id}
              className="border p-5"
              style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold">{d.domain}</div>
                  <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                    Status: {d.status.toUpperCase()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void removeDomain(d.id)}
                  disabled={saving}
                  className="focus-ring px-3 py-2 text-xs font-medium hover:opacity-80 disabled:opacity-50"
                  style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
                >
                  Remove
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                    RECORD TYPE
                  </div>
                  <div className="mt-1 text-sm">{d.verification_record_type}</div>
                </div>
                <div>
                  <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                    RECORD NAME
                  </div>
                  <div className="mt-1 text-sm break-all">{d.verification_record_name}</div>
                </div>
                <div>
                  <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                    RECORD VALUE
                  </div>
                  <div className="mt-1 text-sm break-all">{d.verification_record_value}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

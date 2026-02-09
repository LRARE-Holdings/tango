"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Workspace = {
  id: string;
  name: string;
  brand_logo_path?: string | null;
  brand_logo_updated_at?: string | null;
};

type MeResponse = {
  email?: string | null;
  plan?: string | null;
  primary_workspace_id?: string | null;
};

type SwitchWorkspaceResponse = {
  ok?: boolean;
  workspace_id?: string | null;
  persisted_workspace_id?: string | null;
  error?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const [meRes, wsRes] = await Promise.all([
          fetch("/api/app/me", { cache: "no-store" }),
          fetch("/api/app/workspaces", { cache: "no-store" }),
        ]);

        const meJson = meRes.ok ? ((await meRes.json()) as MeResponse) : null;
        const wsJson = wsRes.ok ? await wsRes.json() : { workspaces: [] };

        if (!alive) return;
        setMe(meJson);
        setWorkspaces(wsJson?.workspaces ?? []);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  const active = useMemo(() => {
    const id = me?.primary_workspace_id ?? null;
    if (!id) return null;
    return workspaces.find((w) => w.id === id) ?? null;
  }, [me?.primary_workspace_id, workspaces]);

  async function setPrimary(workspaceId: string | null) {
    setSwitching(workspaceId ?? "__personal__");
    setSwitchError(null);
    try {
      const res = await fetch("/api/app/workspaces/primary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      const json = (await res.json().catch(() => null)) as SwitchWorkspaceResponse | null;
      if (!res.ok) throw new Error(json?.error ?? "Failed to switch workspace");

      const persisted = json?.persisted_workspace_id ?? workspaceId ?? null;
      setMe((m) => ({ ...(m ?? {}), primary_workspace_id: persisted }));
      setOpen(false);

      // Hard refresh gives immediate consistency everywhere without plumbing context yet
      window.location.reload();
    } catch (e: unknown) {
      setSwitchError(e instanceof Error ? e.message : "Failed to switch workspace");
    } finally {
      setSwitching(null);
    }
  }

  const label = loading
    ? "Loading context…"
    : active?.name
      ? active.name
      : me?.primary_workspace_id
        ? "Workspace selected"
        : "Personal account";

  // Optional logo preview: secure route (member-only)
  const logoSrc = active?.id
    ? `/api/app/workspaces/${active.id}/branding/logo/view${
        active.brand_logo_updated_at ? `?v=${encodeURIComponent(active.brand_logo_updated_at)}` : ""
      }`
    : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="focus-ring inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 10,
          color: "var(--fg)",
          background: "transparent",
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {logoSrc ? (
          <img
            src={logoSrc}
            alt=""
            className="h-5 w-5"
            style={{ objectFit: "contain" }}
            draggable={false}
          />
        ) : (
          <span
            className="inline-block h-2 w-2"
            style={{ background: "var(--fg)", borderRadius: 999 }}
          />
        )}
        <span className="max-w-40 truncate">{label}</span>
        <span style={{ color: "var(--muted)" }}>▾</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[320px] border shadow-sm"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg)",
            borderRadius: 12,
          }}
          role="menu"
        >
          <div className="px-3 py-2 text-xs" style={{ color: "var(--muted2)" }}>
            ACTIVE CONTEXT
          </div>

          <div className="max-h-90 overflow-auto">
            <button
              type="button"
              onClick={() => void setPrimary(null)}
              disabled={switching !== null}
              className={cx(
                "w-full px-3 py-2 text-left text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
              )}
              style={{
                background: me?.primary_workspace_id ? "transparent" : "var(--card2)",
                borderTop: "1px solid var(--border2)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">Personal account</div>
                  <div className="text-xs truncate" style={{ color: "var(--muted2)" }}>
                    Individual receipts
                  </div>
                </div>
                {!me?.primary_workspace_id ? (
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    Active
                  </span>
                ) : switching === "__personal__" ? (
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    Switching…
                  </span>
                ) : null}
              </div>
            </button>

            {workspaces.length > 0 ? (
              workspaces.map((w) => {
                const isActive = me?.primary_workspace_id === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => void setPrimary(w.id)}
                    disabled={switching !== null}
                    className={cx(
                      "w-full px-3 py-2 text-left text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
                    )}
                    style={{
                      background: isActive ? "var(--card2)" : "transparent",
                      borderTop: "1px solid var(--border2)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{w.name}</div>
                        <div className="text-xs truncate" style={{ color: "var(--muted2)" }}>
                          Workspace
                        </div>
                      </div>

                      {isActive ? (
                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                          Active
                        </span>
                      ) : switching === w.id ? (
                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                          Switching…
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-xs" style={{ color: "var(--muted2)", borderTop: "1px solid var(--border2)" }}>
                No workspaces yet.
              </div>
            )}
          </div>

          <div
            className="px-3 py-3 flex items-center justify-between"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div className="w-full">
              <div className="text-xs" style={{ color: "var(--muted2)" }}>
                WORKSPACE MENU
              </div>
              <div className="mt-2 flex items-center justify-between">
                <Link
                  href="/app/workspaces"
                  className="focus-ring text-sm font-semibold hover:opacity-80"
                  style={{ color: "var(--fg)" }}
                  onClick={() => setOpen(false)}
                >
                  Manage workspaces
                </Link>
                <Link
                  href="/app/workspaces/new"
                  className="focus-ring text-sm hover:opacity-80"
                  style={{ color: "var(--muted)" }}
                  onClick={() => setOpen(false)}
                >
                  Create new →
                </Link>
              </div>
            </div>
          </div>
          {switchError ? (
            <div className="px-3 pb-3 text-xs" style={{ color: "#ff3b30" }}>
              {switchError}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

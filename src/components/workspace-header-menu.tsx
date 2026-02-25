"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type WorkspaceSummary = {
  id: string;
  slug?: string | null;
  name?: string;
};

type ViewerSummary = {
  role?: "owner" | "admin" | "member";
};

type WorkspaceResponse = {
  workspace?: WorkspaceSummary | null;
  viewer?: ViewerSummary | null;
};

function currentWorkspaceIdentifier(pathname: string) {
  const match = pathname.match(/^\/app\/workspaces\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function WorkspaceHeaderMenu() {
  const pathname = usePathname();
  const workspaceIdentifier = useMemo(() => currentWorkspaceIdentifier(pathname), [pathname]);

  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [viewerRole, setViewerRole] = useState<ViewerSummary["role"]>(undefined);

  useEffect(() => {
    let active = true;
    if (typeof workspaceIdentifier !== "string" || workspaceIdentifier.length === 0) {
      return () => {
        active = false;
      };
    }
    const identifier = workspaceIdentifier;

    async function load() {
      try {
        const res = await fetch(`/api/app/workspaces/${encodeURIComponent(identifier)}`, {
          cache: "no-store",
        });
        const json = (await res.json().catch(() => null)) as WorkspaceResponse | null;
        if (!res.ok || !active) return;
        setWorkspace((json?.workspace ?? null) as WorkspaceSummary | null);
        setViewerRole((json?.viewer?.role ?? undefined) as ViewerSummary["role"]);
      } catch {
        // noop
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [workspaceIdentifier]);

  if (!workspaceIdentifier) return null;

  const idForLinks = workspace?.slug ?? workspaceIdentifier;
  const canManageSettings = viewerRole === "owner" || viewerRole === "admin";
  const canSeeTeamManagement = viewerRole === "owner" || viewerRole === "admin";

  const links = [
    { href: `/app/workspaces/${idForLinks}/dashboard`, label: "Dashboard" },
    { href: `/app/workspaces/${idForLinks}/documents`, label: "Documents" },
    ...(canSeeTeamManagement
      ? [
          { href: `/app/workspaces/${idForLinks}/members`, label: "Members" },
          { href: `/app/workspaces/${idForLinks}/branding`, label: "Branding" },
        ]
      : []),
    ...(canManageSettings ? [{ href: `/app/workspaces/${idForLinks}/settings`, label: "Workspace settings" }] : []),
  ];

  return (
    <div
      className="mt-3 flex items-center justify-between gap-3 flex-wrap border-t pt-3"
      style={{ borderColor: "var(--border2)" }}
    >
      <div className="text-xs font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>
        {workspace?.name ? workspace.name.toUpperCase() : "WORKSPACE"}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {links.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={{
                border: "1px solid var(--border)",
                borderRadius: 999,
                color: active ? "var(--fg)" : "var(--muted)",
                background: active ? "var(--card2)" : "transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

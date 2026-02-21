"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { PlanMenu } from "@/components/app/plan-menu";
import { SettingsCog } from "@/components/app/settings-cog";
import { canAccessAdminSettings, canAccessKeySettings, canUseStackDelivery, canViewAnalytics } from "@/lib/workspace-permissions";

type Plan = "free" | "personal" | "pro" | "team" | "enterprise";
type WorkspaceRole = "owner" | "admin" | "member";

type WorkspaceContext = {
  slug?: string | null;
  viewer?: { user_id: string; role: WorkspaceRole };
  licensing?: { plan?: Plan };
  members?: Array<{ user_id: string; role: WorkspaceRole; license_active?: boolean; can_view_analytics?: boolean }>;
};

function normalizePlan(input: string | null | undefined): Plan {
  const plan = String(input ?? "free").trim().toLowerCase();
  if (plan === "personal" || plan === "pro" || plan === "team" || plan === "enterprise") return plan;
  return "free";
}

function extractWorkspaceIdentifier(pathname: string) {
  const match = pathname.match(/^\/app\/workspaces\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function TopbarNav({
  mePlan,
  primaryWorkspaceId,
}: {
  mePlan: string | null | undefined;
  primaryWorkspaceId: string | null | undefined;
}) {
  const pathname = usePathname();
  const workspaceIdentifier = useMemo(() => extractWorkspaceIdentifier(pathname), [pathname]);
  const [persistedWorkspaceId, setPersistedWorkspaceId] = useState<string | null>(null);
  const primaryWorkspaceIdentifier =
    typeof primaryWorkspaceId === "string" && primaryWorkspaceId.trim() ? primaryWorkspaceId.trim() : null;
  const contextWorkspaceIdentifier =
    workspaceIdentifier ??
    primaryWorkspaceIdentifier ??
    (pathname.startsWith("/app/new") ? persistedWorkspaceId : null);
  const [workspaceCtx, setWorkspaceCtx] = useState<WorkspaceContext | null>(null);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem("receipt:last-workspace-id");
        const clean = String(stored ?? "").trim();
        setPersistedWorkspaceId(clean || null);
      } catch {
        setPersistedWorkspaceId(null);
      }
    });
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    if (!workspaceIdentifier) return;
    try {
      window.localStorage.setItem("receipt:last-workspace-id", workspaceIdentifier);
    } catch {
      // noop
    }
    const rafId = window.requestAnimationFrame(() => {
      setPersistedWorkspaceId(workspaceIdentifier);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [workspaceIdentifier]);

  useEffect(() => {
    let active = true;
    const identifier = contextWorkspaceIdentifier ?? "";
    if (!identifier) return () => { active = false; };

    async function load() {
      try {
        const res = await fetch(`/api/app/workspaces/${encodeURIComponent(identifier)}`, {
          cache: "no-store",
        });
        const json = (await res.json().catch(() => null)) as WorkspaceContext | null;
        if (!active || !res.ok) return;
        setWorkspaceCtx(json);
      } catch {
        // noop
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [contextWorkspaceIdentifier]);

  const activeWorkspaceCtx = workspaceCtx;

  const activePlan = normalizePlan(activeWorkspaceCtx?.licensing?.plan ?? mePlan);
  const idForLinks =
    activeWorkspaceCtx?.slug ??
    workspaceIdentifier ??
    primaryWorkspaceIdentifier;

  const homeHref = idForLinks ? `/app/workspaces/${idForLinks}/dashboard` : "/app";
  const sendHref = "/app/new";
  const filesHref = idForLinks ? `/app/workspaces/${idForLinks}/documents` : "/app/files";

  const currentMember = useMemo(() => {
    const viewerId = activeWorkspaceCtx?.viewer?.user_id;
    if (!viewerId) return null;
    return activeWorkspaceCtx?.members?.find((m) => m.user_id === viewerId) ?? null;
  }, [activeWorkspaceCtx]);

  const showAnalytics = Boolean(
    idForLinks &&
      (activePlan === "team" || activePlan === "enterprise") &&
      canViewAnalytics(
        currentMember
          ? {
              role: currentMember.role,
              license_active: currentMember.license_active !== false,
              can_view_analytics: currentMember.can_view_analytics === true,
            }
          : null,
        activePlan
      )
  );
  const showStacks = Boolean(
    idForLinks &&
      canUseStackDelivery(
        currentMember
          ? {
              role: currentMember.role,
              license_active: currentMember.license_active !== false,
              can_view_analytics: currentMember.can_view_analytics === true,
            }
          : null,
        activePlan
      )
  );

  const items = [
    { href: homeHref, label: "Home" },
    { href: sendHref, label: "Send" },
    { href: filesHref, label: "Files" },
    ...(showStacks && idForLinks ? [{ href: `/app/workspaces/${idForLinks}/stacks`, label: "Stacks" }] : []),
    ...(showAnalytics && idForLinks ? [{ href: `/app/workspaces/${idForLinks}/analytics`, label: "Analytics" }] : []),
  ];

  const settingsHref = (() => {
    if (!idForLinks || !activeWorkspaceCtx?.viewer?.role) return "/app/account";
    if (canAccessAdminSettings(activeWorkspaceCtx.viewer.role)) {
      return `/app/workspaces/${idForLinks}/settings`;
    }
    if (
      canAccessKeySettings({
        role: activeWorkspaceCtx.viewer.role,
        license_active: currentMember?.license_active !== false,
      })
    ) {
      return "/app/account";
    }
    return "/app/account";
  })();

  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4" style={{ borderColor: "var(--border2)" }}>
      <PlanMenu items={items} />
      <SettingsCog href={settingsHref} />
    </div>
  );
}

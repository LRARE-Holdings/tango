"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { PlanMenu } from "@/components/app/plan-menu";
import {
  canAccessAdminSettings,
  canUseStackDelivery,
  canViewAnalytics,
} from "@/lib/workspace-permissions";
import { canAccessFeatureByPlan } from "@/lib/workspace-features";

type Plan = "free" | "personal" | "pro" | "team" | "enterprise";
type WorkspaceRole = "owner" | "admin" | "member";

type WorkspaceContext = {
  workspace?: {
    id: string;
    slug?: string | null;
    name?: string | null;
    brand_logo_path?: string | null;
    brand_logo_updated_at?: string | null;
    member_profile_photo_updated_at?: string | null;
  } | null;
  viewer?: { user_id: string; role: WorkspaceRole };
  licensing?: { plan?: Plan };
  members?: Array<{ user_id: string; role: WorkspaceRole; license_active?: boolean; can_view_analytics?: boolean }>;
};

type SidebarMe = {
  email?: string | null;
  display_name?: string | null;
  plan?: string | null;
  primary_workspace_id?: string | null;
  has_profile_photo?: boolean | null;
  profile_photo_updated_at?: string | null;
  active_workspace_photo_policy?: "allow" | "disabled" | "company" | "none" | null;
  active_workspace_has_company_photo?: boolean | null;
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

function initialsFromMe(displayName: string | null | undefined, email: string | null | undefined) {
  const clean = String(displayName ?? "").trim();
  if (clean) {
    const tokens = clean.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
    return `${tokens[0][0] ?? ""}${tokens[1][0] ?? ""}`.toUpperCase();
  }
  const local = String(email ?? "").trim().split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase() || "ME";
}

function displayName(displayNameValue: string | null | undefined, email: string | null | undefined) {
  const display = String(displayNameValue ?? "").trim();
  if (display) return display;
  const local = String(email ?? "").trim().split("@")[0] ?? "";
  return local || "Account";
}

function SidebarControlIcon({
  kind,
}: {
  kind: "close" | "collapse" | "expand" | "plus";
}) {
  switch (kind) {
    case "close":
      return (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="app-sidebar-link-icon"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 6 12 12" />
          <path d="m18 6-12 12" />
        </svg>
      );
    case "collapse":
      return (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="app-sidebar-link-icon"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4.5 4.5h5v15h-5z" />
          <path d="m15.7 8.5-3.6 3.5 3.6 3.5" />
        </svg>
      );
    case "expand":
      return (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="app-sidebar-link-icon"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4.5 4.5h5v15h-5z" />
          <path d="m12.2 8.5 3.6 3.5-3.6 3.5" />
        </svg>
      );
    case "plus":
      return (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="app-sidebar-link-icon"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
  }
}

export function AppSidebar({
  me,
  meLoading,
  collapsed,
  onToggleCollapse,
  onNavigate,
  onSignOut,
  signingOut,
  isMobile = false,
  onRequestCloseMobile,
}: {
  me: SidebarMe | null;
  meLoading: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
  onSignOut: () => void;
  signingOut: boolean;
  isMobile?: boolean;
  onRequestCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const workspaceIdentifier = useMemo(() => extractWorkspaceIdentifier(pathname), [pathname]);
  const [persistedWorkspaceId, setPersistedWorkspaceId] = useState<string | null>(null);
  const [workspaceCtx, setWorkspaceCtx] = useState<WorkspaceContext | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const accountMenuId = useId();
  const accountMenuButtonRef = useRef<HTMLButtonElement | null>(null);

  const primaryWorkspaceIdentifier =
    typeof me?.primary_workspace_id === "string" && me.primary_workspace_id.trim()
      ? me.primary_workspace_id.trim()
      : null;
  const contextWorkspaceIdentifier =
    workspaceIdentifier ?? primaryWorkspaceIdentifier ?? (pathname.startsWith("/app/new") ? persistedWorkspaceId : null);

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

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-account-menu-root='true']")) return;
      setMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen((open) => {
        if (!open) return open;
        window.requestAnimationFrame(() => accountMenuButtonRef.current?.focus());
        return false;
      });
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setMenuOpen(false);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [pathname, collapsed]);

  const activeWorkspaceCtx = workspaceCtx;
  const activePlan = normalizePlan(activeWorkspaceCtx?.licensing?.plan ?? me?.plan);
  const idForLinks = activeWorkspaceCtx?.workspace?.slug ?? workspaceIdentifier ?? primaryWorkspaceIdentifier;

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

  const showTemplates = Boolean(
    idForLinks &&
      currentMember &&
      currentMember.license_active !== false &&
      canAccessFeatureByPlan(activeWorkspaceCtx?.licensing?.plan ?? "free", "templates")
  );

  const showContacts = Boolean(
    idForLinks &&
      currentMember &&
      currentMember.license_active !== false &&
      canAccessFeatureByPlan(activeWorkspaceCtx?.licensing?.plan ?? "free", "contacts")
  );

  const navItems = [
    { href: homeHref, label: "Home", icon: "home" as const },
    { href: sendHref, label: "Send", icon: "send" as const },
    { href: filesHref, label: "Files", icon: "files" as const },
    ...(showTemplates ? [{ href: "/app/templates", label: "Templates", icon: "templates" as const }] : []),
    ...(showContacts ? [{ href: "/app/contacts", label: "Contacts", icon: "contacts" as const }] : []),
    ...(showStacks && idForLinks ? [{ href: `/app/workspaces/${idForLinks}/stacks`, label: "Stacks", icon: "stacks" as const }] : []),
    ...(showAnalytics && idForLinks ? [{ href: `/app/workspaces/${idForLinks}/analytics`, label: "Analytics", icon: "analytics" as const }] : []),
  ];

  const workspaceSettingsHref =
    idForLinks && activeWorkspaceCtx?.viewer?.role && canAccessAdminSettings(activeWorkspaceCtx.viewer.role)
      ? `/app/workspaces/${idForLinks}/settings`
      : null;

  const avatarWorkspaceIdentifier = activeWorkspaceCtx?.workspace?.slug ?? contextWorkspaceIdentifier;
  const companyPolicyActive = me?.active_workspace_photo_policy === "company";
  const companyAvatarSrc =
    companyPolicyActive && me?.active_workspace_has_company_photo && avatarWorkspaceIdentifier
      ? `/api/app/workspaces/${encodeURIComponent(avatarWorkspaceIdentifier)}/branding/profile-photo/view${
          activeWorkspaceCtx?.workspace?.member_profile_photo_updated_at
            ? `?v=${encodeURIComponent(String(activeWorkspaceCtx.workspace.member_profile_photo_updated_at))}`
            : ""
        }`
      : null;

  const personalAvatarSrc = me?.has_profile_photo
    ? `/api/app/account/profile-photo/view${
        me?.profile_photo_updated_at ? `?v=${encodeURIComponent(String(me.profile_photo_updated_at))}` : ""
      }`
    : null;

  const avatarSrc = companyAvatarSrc ?? personalAvatarSrc;
  const accountDisplayName = displayName(me?.display_name ?? null, me?.email ?? null);
  const workspaceName = String(activeWorkspaceCtx?.workspace?.name ?? "").trim();
  const brandWorkspaceIdentifier =
    activeWorkspaceCtx?.workspace?.slug ?? contextWorkspaceIdentifier ?? idForLinks ?? null;
  const useWorkspaceBranding = Boolean(
    brandWorkspaceIdentifier && (activePlan === "team" || activePlan === "enterprise")
  );
  const workspaceBrandLogoPath = String(activeWorkspaceCtx?.workspace?.brand_logo_path ?? "").trim();
  const workspaceBrandLogoSrc =
    useWorkspaceBranding && workspaceBrandLogoPath
      ? `/api/app/workspaces/${encodeURIComponent(brandWorkspaceIdentifier ?? "")}/branding/logo/view${
          activeWorkspaceCtx?.workspace?.brand_logo_updated_at
            ? `?v=${encodeURIComponent(String(activeWorkspaceCtx.workspace.brand_logo_updated_at))}`
            : ""
        }`
      : null;
  const brandAlt = workspaceName ? `${workspaceName} logo` : "Workspace logo";

  return (
    <div className="app-sidebar-content">
      <div className="app-sidebar-top">
        <div className="app-sidebar-brand-row">
          <button
            type="button"
            onClick={() => {
              if (isMobile) {
                onRequestCloseMobile?.();
                return;
              }
              onToggleCollapse();
            }}
            aria-label={isMobile ? "Close sidebar" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="focus-ring app-sidebar-icon-btn app-sidebar-tooltip"
            data-tooltip={isMobile ? "Close sidebar" : `${collapsed ? "Expand" : "Collapse"} sidebar (Ctrl/Cmd+B)`}
          >
            <SidebarControlIcon kind={isMobile ? "close" : collapsed ? "expand" : "collapse"} />
          </button>

          {!collapsed ? (
            <Link href={homeHref} className="focus-ring app-sidebar-brand-link" onClick={onNavigate}>
              <span className="app-sidebar-brand-mark">
                {workspaceBrandLogoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={workspaceBrandLogoSrc}
                    alt={brandAlt}
                    className="app-sidebar-brand-logo app-sidebar-brand-logo-workspace"
                  />
                ) : (
                  <Image
                    src="/receipt-logo.svg"
                    alt="Receipt"
                    width={62}
                    height={16}
                    className="app-sidebar-brand-logo app-sidebar-brand-logo-receipt"
                    priority
                  />
                )}
              </span>
            </Link>
          ) : null}
        </div>

        <Link
          href="/app/new"
          onClick={onNavigate}
          className={
            collapsed
              ? "focus-ring app-sidebar-icon-btn app-sidebar-tooltip"
              : "focus-ring app-btn-primary w-full justify-center gap-2"
          }
          aria-label="Create new receipt"
          data-tooltip="New receipt"
        >
          {collapsed ? (
            <>
              <SidebarControlIcon kind="plus" />
              <span className="sr-only">New Receipt</span>
            </>
          ) : (
            <>
              <SidebarControlIcon kind="plus" />
              <span>New Receipt</span>
            </>
          )}
        </Link>

        <PlanMenu items={navItems} vertical collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      <div className="app-sidebar-bottom" data-account-menu-root="true">
        <button
          type="button"
          className="focus-ring app-account-trigger app-sidebar-tooltip"
          ref={accountMenuButtonRef}
          onClick={() => setMenuOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={accountMenuId}
          aria-label="Account menu"
          data-tooltip={collapsed ? "Account menu" : undefined}
        >
          <div className="app-account-avatar">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span>{initialsFromMe(me?.display_name ?? null, me?.email ?? null)}</span>
            )}
          </div>
          {!collapsed ? (
            <div className="app-account-meta min-w-0 text-left">
              <div className="truncate text-sm font-semibold">{meLoading ? "Loading…" : accountDisplayName}</div>
              <div className="truncate text-xs" style={{ color: "var(--muted2)" }}>
                {me?.email ?? ""}
              </div>
            </div>
          ) : null}
        </button>

        {menuOpen ? (
          <div id={accountMenuId} className="app-account-menu" role="menu" aria-label="Account actions">
            <Link
              href="/app/account"
              onClick={() => {
                setMenuOpen(false);
                onNavigate?.();
              }}
              className="focus-ring app-account-menu-item"
              role="menuitem"
            >
              Account settings
            </Link>
            {workspaceSettingsHref ? (
              <Link
                href={workspaceSettingsHref}
                onClick={() => {
                  setMenuOpen(false);
                  onNavigate?.();
                }}
                className="focus-ring app-account-menu-item"
                role="menuitem"
              >
                Workspace settings
              </Link>
            ) : null}
            <div className="app-account-menu-separator" aria-hidden />
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onSignOut();
              }}
              className="focus-ring app-account-menu-item text-left"
              disabled={signingOut}
              role="menuitem"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

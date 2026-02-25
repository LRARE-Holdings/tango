"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { ToastProvider } from "@/components/toast";
import { useToast } from "@/components/toast";
import { EmailVerificationGate } from "@/components/email-verification-gate";
import { OnboardingGate } from "@/components/onboarding-gate";
import { RouteTransitionOverlay } from "@/components/app/route-transition-overlay";
import { AppSidebar } from "@/components/app/app-sidebar";

type MeSummary = {
  email?: string | null;
  plan?: string | null;
  workspace_plan?: string | null;
  primary_workspace_id?: string | null;
  display_name?: string | null;
  has_profile_photo?: boolean | null;
  profile_photo_updated_at?: string | null;
  active_workspace_photo_policy?: "allow" | "disabled" | "company" | "none" | null;
  active_workspace_has_company_photo?: boolean | null;
};

function extractWorkspaceIdentifier(pathname: string) {
  const match = pathname.match(/^\/app\/workspaces\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function InviteReconcileNotifier() {
  const toast = useToast();

  useEffect(() => {
    let active = true;

    async function reconcileInvites() {
      try {
        const res = await fetch("/api/app/invites/reconcile", { method: "POST" });
        const json = (await res.json().catch(() => null)) as
          | { blocked?: Array<{ reason?: string }> }
          | null;
        if (!active || !res.ok) return;
        const blocked = Array.isArray(json?.blocked) ? json.blocked : [];
        if (blocked.length > 0) {
          toast.info(
            "Some workspace invites are blocked",
            "No available seats. Ask an owner/admin to free seats or increase seats in billing."
          );
        }
      } catch {
        // noop
      }
    }

    void reconcileInvites();
    return () => {
      active = false;
    };
  }, [toast]);

  return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const pathname = usePathname();

  const [me, setMe] = useState<MeSummary | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem("receipt:app-sidebar-collapsed");
        setSidebarCollapsed(stored === "1");
      } catch {
        setSidebarCollapsed(false);
      }
    });

    return () => window.cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadMe() {
      setMeLoading(true);
      try {
        const workspaceIdentifier = extractWorkspaceIdentifier(pathname);
        const query = workspaceIdentifier
          ? `?workspace_id=${encodeURIComponent(workspaceIdentifier)}`
          : "";
        const res = await fetch(`/api/app/me${query}`, { cache: "no-store" });
        if (!res.ok) {
          const { data } = await supabase.auth.getUser();
          if (!active) return;
          setMe((prev) => ({ ...(prev ?? {}), email: data.user?.email ?? null }));
          return;
        }
        const json = (await res.json()) as MeSummary;
        if (!active) return;
        setMe(json);
      } catch {
        const { data } = await supabase.auth.getUser();
        if (!active) return;
        setMe((prev) => ({ ...(prev ?? {}), email: data.user?.email ?? null }));
      } finally {
        if (active) setMeLoading(false);
      }
    }

    void loadMe();
    return () => {
      active = false;
    };
  }, [supabase, pathname]);

  useEffect(() => {
    let active = true;
    async function pingSeen() {
      if (!active) return;
      try {
        await fetch("/api/app/session/seen", { method: "POST" });
      } catch {
        // noop
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void pingSeen();
      }
    };

    void pingSeen();
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void pingSeen();
      }
    }, 60_000);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    async function enforceSession() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.replace("/auth");
      }
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void enforceSession();
      }
    };

    const { data: authSub } = supabase.auth.onAuthStateChange((event: string, session: unknown) => {
      if (event === "SIGNED_OUT" || !session) {
        window.location.replace("/auth");
      }
    });

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      authSub.subscription.unsubscribe();
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [supabase]);

  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem("receipt:app-sidebar-collapsed", next ? "1" : "0");
      } catch {
        // noop
      }
      return next;
    });
  }

  async function signOut() {
    setSigningOut(true);
    try {
      setMe(null);
      document.body.style.opacity = "0";
      await supabase.auth.signOut();
      window.location.replace("/auth");
      return;
    } catch {
      document.body.style.opacity = "";
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <ToastProvider>
      <InviteReconcileNotifier />
      <Suspense fallback={null}>
        <EmailVerificationGate />
        <OnboardingGate />
      </Suspense>

      <div className="app-shell min-h-screen">
        <RouteTransitionOverlay />
        <div className="app-layout-frame">
          <button
            type="button"
            className="focus-ring app-mobile-menu-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            ☰
          </button>

          <aside className={`app-sidebar ${sidebarCollapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`.trim()}>
            <AppSidebar
              me={me}
              meLoading={meLoading}
              collapsed={sidebarCollapsed}
              onToggleCollapse={toggleSidebarCollapsed}
              onNavigate={() => setMobileOpen(false)}
              onSignOut={signOut}
              signingOut={signingOut}
            />
          </aside>

          {mobileOpen ? (
            <button
              type="button"
              aria-label="Close navigation menu"
              className="app-sidebar-backdrop"
              onClick={() => setMobileOpen(false)}
            />
          ) : null}

          <div className="app-main-shell">
            <main className="app-main-content">
              <Suspense fallback={null}>{children}</Suspense>
            </main>

            <footer className="app-main-footer">
              <div
                className="pt-6 text-xs flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                style={{ borderTop: "1px solid var(--border)", color: "var(--muted)" }}
              >
                <span>
                  © {new Date().getFullYear()} LRARE Holdings Ltd. Registered Company no. 16807366.
                </span>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}

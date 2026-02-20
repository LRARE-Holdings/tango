"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { ToastProvider } from "@/components/toast";
import { useToast } from "@/components/toast";
import { EmailVerificationGate } from "@/components/email-verification-gate";
import { OnboardingGate } from "@/components/onboarding-gate";
import { TopbarNav } from "@/components/app/topbar-nav";
import { RouteTransitionOverlay } from "@/components/app/route-transition-overlay";

type MeSummary = {
  email?: string | null;
  plan?: string | null;
  primary_workspace_id?: string | null;
};

function PrimaryCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="focus-ring inline-flex items-center justify-center px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
      style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 999 }}
    >
      {children}
    </Link>
  );
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

  const [me, setMe] = useState<MeSummary | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    async function loadMe() {
      setMeLoading(true);
      try {
        const res = await fetch("/api/app/me", { cache: "no-store" });
        if (!res.ok) {
          // Fallback to client auth state to avoid false "Not signed in" during transient API errors.
          const { data } = await supabase.auth.getUser();
          setMe((prev) => ({ ...(prev ?? {}), email: data.user?.email ?? null }));
          return;
        }
        const json = (await res.json()) as MeSummary;
        setMe(json);
      } catch {
        const { data } = await supabase.auth.getUser();
        setMe((prev) => ({ ...(prev ?? {}), email: data.user?.email ?? null }));
      } finally {
        setMeLoading(false);
      }
    }
    loadMe();
  }, [supabase]);

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

  const dashboardHref = me?.primary_workspace_id
    ? `/app/workspaces/${me.primary_workspace_id}/dashboard`
    : "/app";
  return (
    <ToastProvider>
      <InviteReconcileNotifier />
      <Suspense fallback={null}>
        <EmailVerificationGate />
        <OnboardingGate />
      </Suspense>
      <style>{`
        /* Logo inversion in system dark mode (since svg is black) */
        .receipt-logo { height: 26px; width: auto; display: block; }
        @media (prefers-color-scheme: dark) {
          .receipt-logo { filter: invert(1) hue-rotate(180deg); }
        }
      `}</style>

      <div className="app-shell min-h-screen">
        <RouteTransitionOverlay />
        {/* Top bar */}
        <header className="app-topbar sticky top-0 z-50">
          <div className="mx-auto max-w-7xl px-6">
            <div className="py-4">
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <Link href={dashboardHref} className="flex items-center">
                    <Image src="/receipt-logo.svg" alt="Receipt" width={104} height={26} className="receipt-logo" priority />
                  </Link>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden md:block text-xs" style={{ color: "var(--muted)" }}>
                    {meLoading ? "Loading…" : me?.email ? `Signed in as ${me.email}` : "Session unavailable"}
                  </div>

                  <button
                    type="button"
                    onClick={signOut}
                    disabled={signingOut}
                    className="focus-ring px-3 py-2 text-sm font-medium transition disabled:opacity-50"
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      color: "var(--muted)",
                      background: "color-mix(in srgb, var(--card2) 58%, #fff)",
                    }}
                  >
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>

                  <PrimaryCta href="/app/new">New Receipt</PrimaryCta>
                </div>
              </div>
              <TopbarNav mePlan={me?.plan ?? null} primaryWorkspaceId={me?.primary_workspace_id ?? null} />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto max-w-7xl px-6 py-10">
          <Suspense fallback={null}>{children}</Suspense>
        </main>

        {/* Footer */}
        <footer className="mx-auto max-w-7xl px-6 pb-10">
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
    </ToastProvider>
  );
}

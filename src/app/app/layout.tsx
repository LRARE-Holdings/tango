"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { ToastProvider } from "@/components/toast";
import { EmailVerificationGate } from "@/components/email-verification-gate";
import { OnboardingGate } from "@/components/onboarding-gate";

function NavItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="focus-ring text-sm font-medium transition-opacity hover:opacity-70"
      style={{ color: "var(--muted)" }}
    >
      {children}
    </Link>
  );
}

function PrimaryCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="focus-ring inline-flex items-center justify-center px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
      style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
    >
      {children}
    </Link>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [meEmail, setMeEmail] = useState<string | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    async function loadMe() {
      setMeLoading(true);
      try {
        const res = await fetch("/api/app/me", { cache: "no-store" });
        if (!res.ok) {
          setMeEmail(null);
          return;
        }
        const json = await res.json();
        setMeEmail(json.email ?? null);
      } finally {
        setMeLoading(false);
      }
    }
    loadMe();
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.replace("/auth");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <ToastProvider>
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

      <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--fg)" }}>
        {/* Top bar */}
        <header
          className="sticky top-0 z-50"
          style={{
            background: "color-mix(in srgb, var(--bg) 92%, transparent)",
            borderBottom: "1px solid var(--border)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex items-center justify-between gap-6 py-4">
              <div className="flex items-center gap-6">
                <Link href="/app" className="flex items-center">
                  <img src="/receipt-logo.svg" alt="Receipt" className="receipt-logo" draggable={false} />
                </Link>
              </div>

              <div className="flex items-center gap-3">
                <nav className="hidden sm:flex items-center gap-4">
                  <NavItem href="/app">Dashboard</NavItem>
                  <NavItem href="/app/account">Account</NavItem>
                </nav>

                <div className="hidden md:block text-xs" style={{ color: "var(--muted)" }}>
                  {meLoading ? "Loading…" : meEmail ? `Signed in as ${meEmail}` : "Not signed in"}
                </div>

                <button
                  type="button"
                  onClick={signOut}
                  disabled={signingOut}
                  className="focus-ring px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    color: "var(--muted)",
                    background: "transparent",
                  }}
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>

                                <PrimaryCta href="/app/new">+</PrimaryCta>
                                
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto max-w-6xl px-6 py-10">
          <Suspense fallback={null}>{children}</Suspense>
        </main>

        {/* Footer */}
        <footer className="mx-auto max-w-6xl px-6 pb-10">
          <div
            className="pt-6 text-xs flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
            style={{ borderTop: "1px solid var(--border)", color: "var(--muted)" }}
          >
            <span>Receipt is a product by LRARE Holdings Ltd.</span>
            <span>
              © {new Date().getFullYear()} LRARE Holdings Ltd. Registered Company no. 16807366.
            </span>
          </div>
        </footer>
      </div>
    </ToastProvider>
  );
}
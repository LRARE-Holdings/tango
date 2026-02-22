"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

function safeNext(next: string | null, fallback = "/app") {
  if (next && next.startsWith("/")) return next;
  return fallback.startsWith("/") ? fallback : "/app";
}

export function OnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const supabase = supabaseBrowser();

  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // Don’t gate auth routes or the onboarding route itself
        if (
          pathname.startsWith("/auth") ||
          pathname.startsWith("/onboarding") ||
          pathname.startsWith("/app/billing/checkout")
        ) {
          if (!cancelled) setChecked(true);
          return;
        }

        // Only gate app routes
        if (!pathname.startsWith("/app")) {
          if (!cancelled) setChecked(true);
          return;
        }

        // Reconcile pending workspace invites first so invited members are
        // linked to their workspace before onboarding checks run.
        await fetch("/api/app/invites/reconcile", { method: "POST" }).catch(() => {});

        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          if (!cancelled) setChecked(true);
          return;
        }

        // Workspace members should not be forced through personal plan onboarding.
        const meRes = await fetch("/api/app/me", { cache: "no-store" }).catch(() => null);
        if (meRes?.ok) {
          const me = (await meRes.json().catch(() => null)) as
            | { primary_workspace_id?: string | null }
            | null;
          if (typeof me?.primary_workspace_id === "string" && me.primary_workspace_id.length > 0) {
            if (!cancelled) setChecked(true);
            return;
          }
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", userData.user.id)
          .maybeSingle();

        // If profiles row missing or query blocked, fail open (don’t trap user)
        if (error || !data) {
          if (!cancelled) setChecked(true);
          return;
        }

        if (!data.onboarding_completed) {
          const next = safeNext(sp.get("next"), pathname || "/app");
          router.replace(`/onboarding?next=${encodeURIComponent(next)}`);
          return;
        }

        if (!cancelled) setChecked(true);
      } catch {
        if (!cancelled) setChecked(true);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [pathname, router, sp, supabase]);

  if (!checked && pathname.startsWith("/app")) {
    return (
      <div className="px-6 py-10 text-sm" style={{ color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  return null;
}

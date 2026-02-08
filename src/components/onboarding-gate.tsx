"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

function safeNext(next: string | null) {
  return next && next.startsWith("/") ? next : "/app";
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
        if (pathname.startsWith("/auth") || pathname.startsWith("/onboarding")) {
          if (!cancelled) setChecked(true);
          return;
        }

        // Only gate app routes
        if (!pathname.startsWith("/app")) {
          if (!cancelled) setChecked(true);
          return;
        }

        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          if (!cancelled) setChecked(true);
          return;
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
          const next = safeNext(sp.get("next")) || pathname;
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
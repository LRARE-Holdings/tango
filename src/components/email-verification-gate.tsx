"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

function isEmailConfirmed(user: { email_confirmed_at?: string | null; confirmed_at?: string | null } | null | undefined) {
  // Supabase/GoTrue commonly exposes one or both of these
  return Boolean(user?.email_confirmed_at || user?.confirmed_at);
}

export function EmailVerificationGate() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const supabase = supabaseBrowser();

  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // If we’re already on auth pages, don’t gate.
        if (pathname.startsWith("/auth") || pathname.startsWith("/app/billing/checkout")) {
          if (!cancelled) setChecked(true);
          return;
        }

        const { data, error } = await supabase.auth.getUser();
        if (error) {
          if (!cancelled) setChecked(true);
          return;
        }

        const user = data?.user;

        // Not signed in: let your existing auth guard/middleware handle it
        if (!user) {
          if (!cancelled) setChecked(true);
          return;
        }

        // Signed in but not confirmed: send to verify page
        if (!isEmailConfirmed(user)) {
          const next = sp.get("next");
          const redirectTo = next && next.startsWith("/") ? next : pathname || "/app";
          router.replace(`/auth/check-email?next=${encodeURIComponent(redirectTo)}`);
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

  // Don’t block rendering forever; this just prevents flashes on app pages.
  // If you want, you can render a tiny “Checking…” overlay instead.
  if (!checked && !pathname.startsWith("/auth")) {
    return (
      <div className="px-6 py-10 text-sm" style={{ color: "var(--muted)" }}>
        Checking session…
      </div>
    );
  }

  return null;
}

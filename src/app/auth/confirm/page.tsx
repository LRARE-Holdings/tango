"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { safeInternalPath } from "@/lib/safe-redirect";

type VerifyOtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";

function hardRedirect(path: string) {
  window.location.replace(path);
}

async function persistFirstName(firstName: string) {
  const clean = firstName.trim();
  if (!clean) return;
  await fetch("/api/app/account", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ display_name: clean }),
  }).catch(() => null);
}

function afterConfirmPath(redirectTo: string, inviteFlow: boolean) {
  if (!inviteFlow) return redirectTo;
  return `/auth/invite-password?next=${encodeURIComponent(redirectTo)}`;
}

export default function AuthConfirmPage() {
  const supabase = supabaseBrowser();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        const url = new URL(window.location.href);

        const next = url.searchParams.get("next") || url.searchParams.get("redirect_to");
        const firstName = (url.searchParams.get("first_name") || "").trim();
        const redirectTo = safeInternalPath(next, "/app");
        const authError = url.searchParams.get("error_description") || url.searchParams.get("error");

        if (authError) {
          hardRedirect(`/auth?next=${encodeURIComponent(redirectTo)}&error=${encodeURIComponent(authError)}`);
          return;
        }

        // 1) New-style links often use token_hash + type (magiclink / recovery / invite)
        const token_hash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        const inviteFromQuery = type === "invite";

        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({
            type: type as VerifyOtpType,
            token_hash,
          });

          if (error) throw error;
          if (firstName) await persistFirstName(firstName);
          hardRedirect(afterConfirmPath(redirectTo, inviteFromQuery));
          return;
        }

        // 2) PKCE flow: /auth/confirm?code=...
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (firstName) await persistFirstName(firstName);
          hardRedirect(redirectTo);
          return;
        }

        // 3) Implicit flow: /auth/confirm#access_token=...&refresh_token=...
        const hash = window.location.hash?.replace(/^#/, "") ?? "";
        const hashParams = new URLSearchParams(hash);
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");
        const inviteFromHash = hashParams.get("type") === "invite";

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;
          if (firstName) await persistFirstName(firstName);
          hardRedirect(afterConfirmPath(redirectTo, inviteFromHash));
          return;
        }

        // 4) Fallback: if already signed in, continue
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data?.session) {
          if (firstName) await persistFirstName(firstName);
          hardRedirect(redirectTo);
          return;
        }

        // Otherwise back to login
        hardRedirect(`/auth?next=${encodeURIComponent(redirectTo)}&error=${encodeURIComponent("Verification link is invalid or expired.")}`);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Could not complete sign-in";
        setError(message);
      }
    }

    run();
  }, [supabase]);

  return (
    <main className="app-entry-shell min-h-screen flex items-center justify-center px-6 py-10">
      <div
        className="relative w-full max-w-md space-y-3 border p-6 text-center md:p-7"
        style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 18 }}
      >
        <Link
          href="/"
          aria-label="Exit authentication"
          className="focus-ring absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border text-lg leading-none transition hover:opacity-85"
          style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--card2)" }}
        >
          ×
        </Link>
        <div className="marketing-serif text-3xl tracking-tight">Signing you in…</div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          This should only take a moment.
        </div>
        {error && (
          <div className="text-sm" style={{ color: "#ff3b30" }}>
            {error}
          </div>
        )}
      </div>
    </main>
  );
}

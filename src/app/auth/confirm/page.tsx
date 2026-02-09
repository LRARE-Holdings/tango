"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type VerifyOtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";

function hardRedirect(path: string) {
  window.location.replace(path);
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
        const redirectTo = next && next.startsWith("/") ? next : "/app";

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

          hardRedirect(afterConfirmPath(redirectTo, inviteFromQuery));
          return;
        }

        // 2) PKCE flow: /auth/confirm?code=...
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
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
          hardRedirect(afterConfirmPath(redirectTo, inviteFromHash));
          return;
        }

        // 4) Fallback: if already signed in, continue
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data?.session) {
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
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-3 text-center">
        <div className="text-sm font-semibold">Signing you in…</div>
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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AuthConfirmPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        const url = new URL(window.location.href);

        // 1) New-style links often use token_hash + type (magiclink / recovery / invite)
        const token_hash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");

        if (token_hash && type && typeof (supabase.auth as any).verifyOtp === "function") {
          const { error } = await (supabase.auth as any).verifyOtp({
            type,
            token_hash,
          });

          if (error) throw error;

          router.replace("/app");
          return;
        }

        // 2) PKCE flow: /auth/confirm?code=...
        const code = url.searchParams.get("code");
        if (code && typeof (supabase.auth as any).exchangeCodeForSession === "function") {
          const { error } = await (supabase.auth as any).exchangeCodeForSession(code);
          if (error) throw error;
          router.replace("/app");
          return;
        }

        // 3) Implicit flow: /auth/confirm#access_token=...&refresh_token=...
        const hash = window.location.hash?.replace(/^#/, "") ?? "";
        const hashParams = new URLSearchParams(hash);
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");

        if (access_token && refresh_token && typeof (supabase.auth as any).setSession === "function") {
          const { error } = await (supabase.auth as any).setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;
          router.replace("/app");
          return;
        }

        // 4) Fallback: if already signed in, continue
        if (typeof (supabase.auth as any).getSession === "function") {
          const { data, error } = await (supabase.auth as any).getSession();
          if (error) throw error;
          if (data?.session) {
            router.replace("/app");
            return;
          }
        }

        // Otherwise back to login
        router.replace("/auth");
      } catch (e: any) {
        setError(e?.message ?? "Could not complete sign-in");
      }
    }

    run();
  }, [router, supabase]);

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
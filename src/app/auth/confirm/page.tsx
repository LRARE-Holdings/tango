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
        // Handles implicit links like /auth/confirm#access_token=...
        // AND code links like /auth/confirm?code=...
        const { data, error } = await supabase.auth.getSessionFromUrl({
          storeSession: true,
        });

        if (error) throw error;

        // If a session exists now, go to /app
        if (data?.session) {
          router.replace("/app");
          return;
        }

        // If no session, send them back to login
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
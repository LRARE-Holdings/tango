"use client";

import { useEffect } from "react";

export function AuthFragmentRedirect() {
  useEffect(() => {
    const hash = window.location.hash?.replace(/^#/, "") ?? "";
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");

    // Supabase default invite/recovery/magic links can arrive on "/#...".
    // Move the browser to /auth/confirm and preserve the fragment for token exchange.
    if (accessToken && refreshToken) {
      const next = type === "invite" ? "/app" : null;
      const qs = new URLSearchParams(window.location.search);
      if (next && !qs.get("next")) qs.set("next", next);
      const query = qs.toString();
      window.location.replace(`/auth/confirm${query ? `?${query}` : ""}#${hash}`);
    }
  }, []);

  return null;
}


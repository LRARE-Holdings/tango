"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { safeInternalPath } from "@/lib/safe-redirect";

type MeResponse = {
  display_name?: string | null;
  email?: string | null;
  has_profile_photo?: boolean;
  profile_photo_updated_at?: string | null;
  profile_photo_prompt_completed?: boolean | null;
  active_workspace_photo_policy?: "allow" | "disabled" | "company" | "none";
};

function initialsFromName(name: string | null | undefined, email: string | null | undefined) {
  const clean = String(name ?? "").trim();
  if (clean) {
    const tokens = clean.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
    return `${tokens[0][0] ?? ""}${tokens[1][0] ?? ""}`.toUpperCase();
  }

  const local = String(email ?? "").split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase() || "ME";
}

function nextPathFromHref(href: string) {
  try {
    const url = new URL(href);
    return safeInternalPath(url.searchParams.get("next"), "/app");
  } catch {
    return "/app";
  }
}

export default function OnboardingProfilePhotoPage() {
  const router = useRouter();

  const [nextPath, setNextPath] = useState("/app");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    setNextPath(nextPathFromHref(window.location.href));
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/app/me", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as MeResponse | { error?: string } | null;
        if (!res.ok) throw new Error((json as { error?: string } | null)?.error ?? "Could not load your account");
        if (!active) return;

        const profile = json as MeResponse;
        setMe(profile);
        if (profile.profile_photo_prompt_completed === true) {
          router.replace(nextPath);
        }
      } catch (e: unknown) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Could not load your account");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [nextPath, router]);

  const avatarSrc = useMemo(() => {
    if (!me?.has_profile_photo) return null;
    const version = me.profile_photo_updated_at ? `?v=${encodeURIComponent(me.profile_photo_updated_at)}` : "";
    return `/api/app/account/profile-photo/view${version}`;
  }, [me?.has_profile_photo, me?.profile_photo_updated_at]);

  const policy = me?.active_workspace_photo_policy ?? "none";
  const uploadsAllowed = policy === "allow" || policy === "none";

  async function completePrompt() {
    await fetch("/api/app/account/profile-photo/prompt", { method: "PATCH" }).catch(() => null);
  }

  async function onSkip() {
    setSaving(true);
    setError(null);
    try {
      await completePrompt();
      router.replace(nextPath);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not continue");
      setSaving(false);
    }
  }

  async function onUpload() {
    if (!file) {
      await onSkip();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/app/account/profile-photo", {
        method: "POST",
        body: form,
      });

      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Could not upload profile photo.");

      await completePrompt();
      router.replace(nextPath);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not upload profile photo.");
      setSaving(false);
    }
  }

  return (
    <main className="app-entry-shell min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg space-y-6 border p-6 md:p-7" style={{ borderColor: "var(--border)", borderRadius: 18, background: "var(--card)" }}>
        <div>
          <div className="text-xs tracking-widest" style={{ color: "var(--muted2)" }}>
            PROFILE SETUP
          </div>
          <h1 className="marketing-serif mt-2 text-4xl tracking-tight">Add a profile photo</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Optional, but recommended so teammates can identify you quickly.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div
            className="h-18 w-18 overflow-hidden border flex items-center justify-center text-xs font-semibold"
            style={{ borderColor: "var(--border)", borderRadius: 999, background: "var(--card2)" }}
          >
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              initialsFromName(me?.display_name ?? null, me?.email ?? null)
            )}
          </div>

          <div className="text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
            Upload JPG, PNG, or WebP (max 2MB). We auto-crop to a square for consistency.
          </div>
        </div>

        {!uploadsAllowed ? (
          <div className="border px-4 py-3 text-sm" style={{ borderColor: "var(--border)", borderRadius: 12, color: "var(--muted)" }}>
            {policy === "company"
              ? "Your active workspace enforces a company profile photo for members."
              : "Your active workspace has disabled personal profile photo uploads."}
          </div>
        ) : (
          <div className="space-y-3">
            <label
              className="focus-ring inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium hover:opacity-90"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              Choose photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <div className="text-xs" style={{ color: "var(--muted2)" }}>
              {file ? file.name : "No file selected"}
            </div>
          </div>
        )}

        {error ? (
          <div className="text-sm" style={{ color: "#ff3b30" }}>{error}</div>
        ) : null}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => void onUpload()}
            disabled={saving || (uploadsAllowed && !file)}
            className="focus-ring rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--fg)", color: "var(--bg)" }}
          >
            {saving ? "Saving…" : uploadsAllowed ? "Save and continue" : "Continue"}
          </button>

          <button
            type="button"
            onClick={() => void onSkip()}
            disabled={saving}
            className="focus-ring rounded-full border px-5 py-2.5 text-sm font-medium disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            Skip for now
          </button>

          <Link href="/auth" className="text-xs underline underline-offset-4 hover:opacity-80" style={{ color: "var(--muted2)" }}>
            Sign out
          </Link>
        </div>

        {loading ? (
          <div className="text-xs" style={{ color: "var(--muted2)" }}>Loading account…</div>
        ) : null}
      </div>
    </main>
  );
}

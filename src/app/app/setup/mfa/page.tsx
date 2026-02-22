"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/toast";
import { safeInternalPath } from "@/lib/safe-redirect";
import { supabaseBrowser } from "@/lib/supabase/browser";

type MeResponse = {
  mfa_enabled?: boolean | null;
  mfa_verified_factor_count?: number | null;
  mfa_required?: boolean | null;
};

type MfaFactor = {
  id: string;
  factor_type: string;
  status: string;
  friendly_name: string | null;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function normalizeMfaFactor(input: unknown): MfaFactor | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const id = String(row.id ?? "").trim();
  if (!id) return null;

  return {
    id,
    factor_type: String(row.factor_type ?? "").trim().toLowerCase(),
    status: String(row.status ?? "").trim().toLowerCase(),
    friendly_name: row.friendly_name ? String(row.friendly_name).trim() : null,
  };
}

function mfaFactorLabel(factor: MfaFactor) {
  if (factor.friendly_name) return factor.friendly_name;
  if (factor.factor_type === "totp") return "Authenticator app";
  if (factor.factor_type === "phone") return "Phone";
  if (factor.factor_type === "webauthn") return "Passkey";
  return factor.factor_type || "MFA factor";
}

export default function MfaSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);

  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaEnrollLoading, setMfaEnrollLoading] = useState(false);
  const [mfaVerifyLoading, setMfaVerifyLoading] = useState(false);
  const [mfaRemoveFactorId, setMfaRemoveFactorId] = useState<string | null>(null);
  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([]);
  const [pendingMfaFactorId, setPendingMfaFactorId] = useState<string | null>(null);
  const [pendingTotpQrCode, setPendingTotpQrCode] = useState<string | null>(null);
  const [pendingTotpSecret, setPendingTotpSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const nextPath = useMemo(() => {
    const nextCandidate = safeInternalPath(searchParams.get("next"), "/app");
    if (nextCandidate.startsWith("/app/setup/mfa")) return "/app";
    return nextCandidate;
  }, [searchParams]);

  const mfaScope = String(searchParams.get("mfa_scope") ?? "").trim().toLowerCase();
  const mfaPromptRequired = searchParams.get("mfa") === "required";

  const verifiedMfaFactors = useMemo(
    () => mfaFactors.filter((factor) => factor.status === "verified"),
    [mfaFactors]
  );
  const mfaEnabled = (me?.mfa_enabled === true) || verifiedMfaFactors.length > 0;
  const mfaVerifiedCount = Math.max(Number(me?.mfa_verified_factor_count ?? 0), verifiedMfaFactors.length);
  const mfaRequired = me?.mfa_required === true || mfaPromptRequired;
  const canRemoveVerifiedFactor = !mfaRequired || mfaVerifiedCount > 1;

  const mfaPromptMessage = useMemo(() => {
    if (mfaScope === "multiple_workspaces") {
      return "MFA is required by multiple workspace policies before access can be restored.";
    }
    if (mfaScope === "primary_workspace") {
      return "Your active workspace requires MFA before you can continue.";
    }
    if (mfaScope === "workspace") {
      return "This workspace requires MFA before you can continue.";
    }
    return "MFA is required before you can continue in the app.";
  }, [mfaScope]);

  async function loadMe() {
    setMeLoading(true);
    setMeError(null);
    try {
      const res = await fetch("/api/app/me", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as (MeResponse & { error?: string }) | null;
      if (!res.ok) {
        throw new Error(json?.error ?? "Could not load account status.");
      }
      if (!mountedRef.current) return;
      setMe(json ?? {});
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      setMeError(errorMessage(error, "Could not load MFA status."));
    } finally {
      if (!mountedRef.current) return;
      setMeLoading(false);
    }
  }

  async function loadMfaFactors() {
    setMfaLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      if (!mountedRef.current) return;
      const allFactors = Array.isArray(data?.all) ? (data.all as unknown[]) : [];
      setMfaFactors(
        allFactors.map((factor) => normalizeMfaFactor(factor)).filter((factor): factor is MfaFactor => Boolean(factor))
      );
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      toast.error("MFA", errorMessage(error, "Could not load MFA factors."));
    } finally {
      if (!mountedRef.current) return;
      setMfaLoading(false);
    }
  }

  useEffect(() => {
    void loadMe();
    void loadMfaFactors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startTotpEnrollment() {
    if (pendingMfaFactorId) return;

    setMfaEnrollLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Receipt Authenticator",
      });
      if (error) throw error;
      if (!data || data.type !== "totp") {
        throw new Error("Could not start authenticator enrollment.");
      }
      if (!mountedRef.current) return;

      setPendingMfaFactorId(data.id);
      setPendingTotpQrCode(data.totp.qr_code ?? null);
      setPendingTotpSecret(data.totp.secret ?? null);
      setTotpCode("");
      toast.success("MFA", "Scan the QR code and enter a 6-digit code to finish setup.");
      await loadMfaFactors();
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      toast.error("MFA", errorMessage(error, "Could not start MFA setup."));
    } finally {
      if (!mountedRef.current) return;
      setMfaEnrollLoading(false);
    }
  }

  async function cancelPendingEnrollment() {
    const factorId = pendingMfaFactorId;
    if (!factorId) {
      setPendingTotpQrCode(null);
      setPendingTotpSecret(null);
      setTotpCode("");
      return;
    }

    setMfaRemoveFactorId(factorId);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      if (!mountedRef.current) return;

      setPendingMfaFactorId(null);
      setPendingTotpQrCode(null);
      setPendingTotpSecret(null);
      setTotpCode("");
      await loadMfaFactors();
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      toast.error("MFA", errorMessage(error, "Could not cancel pending MFA setup."));
    } finally {
      if (!mountedRef.current) return;
      setMfaRemoveFactorId(null);
    }
  }

  async function verifyTotpEnrollment() {
    const factorId = pendingMfaFactorId;
    if (!factorId) {
      toast.error("MFA", "Start MFA setup first.");
      return;
    }

    const code = totpCode.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(code)) {
      toast.error("MFA", "Enter a valid 6-digit code.");
      return;
    }

    setMfaVerifyLoading(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) throw error;
      if (!mountedRef.current) return;

      setPendingMfaFactorId(null);
      setPendingTotpQrCode(null);
      setPendingTotpSecret(null);
      setTotpCode("");
      await Promise.all([loadMfaFactors(), loadMe()]);
      toast.success("MFA enabled", "Multi-factor authentication is now active.");
      router.replace(nextPath);
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      toast.error("MFA", errorMessage(error, "Could not verify MFA code."));
    } finally {
      if (!mountedRef.current) return;
      setMfaVerifyLoading(false);
    }
  }

  async function removeMfaFactor(factorId: string) {
    const factor = mfaFactors.find((row) => row.id === factorId) ?? null;
    if (factor && factor.status === "verified" && !canRemoveVerifiedFactor) {
      toast.error("MFA", "A verified factor is required before you can continue.");
      return;
    }

    setMfaRemoveFactorId(factorId);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      if (!mountedRef.current) return;

      if (pendingMfaFactorId === factorId) {
        setPendingMfaFactorId(null);
        setPendingTotpQrCode(null);
        setPendingTotpSecret(null);
        setTotpCode("");
      }

      toast.success("MFA", "Factor removed.");
      await Promise.all([loadMfaFactors(), loadMe()]);
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      toast.error("MFA", errorMessage(error, "Could not remove MFA factor."));
    } finally {
      if (!mountedRef.current) return;
      setMfaRemoveFactorId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
          SECURITY SETUP
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Set up MFA</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Complete multi-factor authentication to continue into your workspace.
        </p>
      </div>

      {mfaRequired && !mfaEnabled ? (
        <div
          className="border p-4"
          style={{
            borderColor: "color-mix(in srgb, #ff3b30 38%, var(--border))",
            borderRadius: 14,
            background: "color-mix(in srgb, var(--bg) 90%, rgba(255,59,48,0.10))",
          }}
        >
          <div className="text-sm font-semibold">MFA required</div>
          <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {mfaPromptMessage}
          </div>
        </div>
      ) : null}

      {meError ? (
        <div className="border p-4" style={{ borderColor: "var(--border)", borderRadius: 14 }}>
          <div className="text-sm font-semibold">Couldn&apos;t load status</div>
          <div className="mt-2 text-sm" style={{ color: "#ff3b30" }}>
            {meError}
          </div>
        </div>
      ) : null}

      <section className="border p-6 space-y-5" style={{ borderColor: "var(--border)", borderRadius: 16 }}>
        <div className="flex items-start justify-between gap-3 flex-col md:flex-row">
          <div>
            <div className="text-sm font-semibold">Authenticator app</div>
            <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              {mfaEnabled
                ? `${mfaVerifiedCount} verified factor${mfaVerifiedCount === 1 ? "" : "s"} configured.`
                : "Add and verify an authenticator app to activate MFA."}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadMfaFactors()}
              disabled={mfaLoading}
              className="focus-ring px-4 py-2 text-sm border disabled:opacity-50 hover:opacity-90"
              style={{ borderColor: "var(--border)", borderRadius: 10 }}
            >
              {mfaLoading ? "Refreshing…" : "Refresh factors"}
            </button>
            <button
              type="button"
              onClick={() => void startTotpEnrollment()}
              disabled={mfaEnrollLoading || mfaVerifyLoading || Boolean(pendingMfaFactorId)}
              className="focus-ring px-4 py-2 text-sm font-semibold disabled:opacity-50 hover:opacity-90"
              style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
            >
              {mfaEnrollLoading ? "Starting…" : "Add authenticator app"}
            </button>
          </div>
        </div>

        {pendingTotpQrCode ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px,1fr]">
            <div
              className="border p-3 flex items-center justify-center"
              style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--bg)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingTotpQrCode} alt="Authenticator QR code" style={{ width: 180, height: 180, maxWidth: "100%" }} />
            </div>

            <div className="space-y-3">
              <div className="text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
                Scan this QR code with your authenticator app, then enter a current 6-digit code to verify.
              </div>
              {pendingTotpSecret ? (
                <div className="text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
                  Manual setup key: <span style={{ color: "var(--fg)" }}>{pendingTotpSecret}</span>
                </div>
              ) : null}
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                placeholder="123456"
                className="focus-ring w-full border px-4 py-3 text-sm bg-transparent"
                style={{ borderColor: "var(--border)", borderRadius: 10 }}
              />
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => void verifyTotpEnrollment()}
                  disabled={mfaVerifyLoading}
                  className="focus-ring px-4 py-2 text-sm font-semibold disabled:opacity-50 hover:opacity-90"
                  style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
                >
                  {mfaVerifyLoading ? "Verifying…" : "Verify and enable MFA"}
                </button>
                <button
                  type="button"
                  onClick={() => void cancelPendingEnrollment()}
                  disabled={mfaRemoveFactorId === pendingMfaFactorId}
                  className="focus-ring px-4 py-2 text-sm border disabled:opacity-50 hover:opacity-90"
                  style={{ borderColor: "var(--border)", borderRadius: 10 }}
                >
                  {mfaRemoveFactorId === pendingMfaFactorId ? "Cancelling…" : "Cancel setup"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          {mfaFactors.length === 0 ? (
            <div className="text-xs" style={{ color: "var(--muted2)" }}>
              No factors enrolled yet.
            </div>
          ) : (
            mfaFactors.map((factor) => (
              <div
                key={factor.id}
                className="border px-3 py-2 flex items-center justify-between gap-3"
                style={{ borderColor: "var(--border)", borderRadius: 10, background: "var(--bg)" }}
              >
                <div>
                  <div className="text-sm font-medium">{mfaFactorLabel(factor)}</div>
                  <div className="text-xs" style={{ color: "var(--muted2)" }}>
                    {factor.status === "verified" ? "Verified" : "Not verified"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void removeMfaFactor(factor.id)}
                  disabled={mfaRemoveFactorId === factor.id || (factor.status === "verified" && !canRemoveVerifiedFactor)}
                  className="focus-ring px-3 py-1.5 text-xs border disabled:opacity-50 hover:opacity-90"
                  style={{ borderColor: "var(--border)", borderRadius: 8 }}
                >
                  {factor.status === "verified" && !canRemoveVerifiedFactor
                    ? "Required factor"
                    : mfaRemoveFactorId === factor.id
                      ? "Removing…"
                      : "Remove"}
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 flex-col md:flex-row">
        <div className="text-xs" style={{ color: "var(--muted2)" }}>
          Account settings MFA remains available as a backup management screen.
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/account"
            className="focus-ring inline-flex items-center px-4 py-2 text-sm border hover:opacity-90"
            style={{ borderColor: "var(--border)", borderRadius: 10 }}
          >
            Account settings (backup)
          </Link>
          <button
            type="button"
            onClick={() => router.replace(nextPath)}
            disabled={meLoading || !mfaEnabled}
            className="focus-ring px-4 py-2 text-sm font-semibold disabled:opacity-50 hover:opacity-90"
            style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
          >
            {meLoading ? "Loading…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

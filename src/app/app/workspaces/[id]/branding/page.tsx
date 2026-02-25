"use client";

import { useParams } from "next/navigation";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Workspace = {
  id: string;
  name: string;
  slug?: string | null;
  brand_logo_updated_at?: string | null;
  brand_logo_width_px?: number | null;
  member_profile_photo_mode?: "allow" | "disabled" | "company";
  member_profile_photo_path?: string | null;
  member_profile_photo_updated_at?: string | null;
};

type Licensing = {
  plan?: string;
};

function normalizePhotoMode(input: unknown): "allow" | "disabled" | "company" {
  const normalized = String(input ?? "allow").trim().toLowerCase();
  if (normalized === "disabled" || normalized === "company") return normalized;
  return "allow";
}

export default function WorkspaceBrandingPage() {
  const params = useParams<{ id?: string }>();
  const workspaceId = typeof params?.id === "string" ? params.id : "";
  const workspaceIdentifier = useMemo(() => workspaceId.trim(), [workspaceId]);

  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [licensing, setLicensing] = useState<Licensing | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [logoWidthPx, setLogoWidthPx] = useState<number>(104);
  const [savingSize, setSavingSize] = useState(false);
  const [sizeMsg, setSizeMsg] = useState<string | null>(null);

  const [policyMode, setPolicyMode] = useState<"allow" | "disabled" | "company">("allow");
  const [policySaving, setPolicySaving] = useState(false);
  const [policyMsg, setPolicyMsg] = useState<string | null>(null);
  const [companyPhotoFile, setCompanyPhotoFile] = useState<File | null>(null);
  const [companyPhotoSaving, setCompanyPhotoSaving] = useState(false);
  const [companyPhotoMsg, setCompanyPhotoMsg] = useState<string | null>(null);

  const policyEligible = useMemo(() => {
    const plan = String(licensing?.plan ?? "").toLowerCase();
    return plan === "team" || plan === "enterprise";
  }, [licensing?.plan]);

  useEffect(() => {
    let alive = true;

    if (!workspaceIdentifier) {
      setWorkspace(null);
      setLoading(false);
      setError(workspaceId ? "Invalid workspace." : null);
      return () => {
        alive = false;
      };
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load");
        if (!alive) return;

        const nextWorkspace = (json?.workspace ?? null) as Workspace | null;
        setWorkspace(nextWorkspace);
        setLicensing((json?.licensing ?? null) as Licensing | null);
        setPolicyMode(normalizePhotoMode(nextWorkspace?.member_profile_photo_mode));

        const width = Number(nextWorkspace?.brand_logo_width_px ?? 104);
        setLogoWidthPx(Number.isFinite(width) ? Math.max(48, Math.min(320, Math.floor(width))) : 104);
      } catch (e: unknown) {
        if (alive) setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [workspaceIdentifier, workspaceId]);

  const logoSrc = useMemo(() => {
    if (!workspace?.id) return null;
    return `/api/app/workspaces/${workspace.id}/branding/logo/view${
      workspace.brand_logo_updated_at ? `?v=${encodeURIComponent(workspace.brand_logo_updated_at)}` : ""
    }`;
  }, [workspace?.id, workspace?.brand_logo_updated_at]);

  const companyPhotoSrc = useMemo(() => {
    if (!workspace?.id || !workspace.member_profile_photo_path) return null;
    return `/api/app/workspaces/${workspace.id}/branding/profile-photo/view${
      workspace.member_profile_photo_updated_at
        ? `?v=${encodeURIComponent(workspace.member_profile_photo_updated_at)}`
        : ""
    }`;
  }, [workspace?.id, workspace?.member_profile_photo_path, workspace?.member_profile_photo_updated_at]);

  async function reloadWorkspace() {
    if (!workspaceIdentifier) return;
    const wsRes = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}`, { cache: "no-store" });
    const wsJson = await wsRes.json().catch(() => null);
    if (!wsRes.ok) throw new Error(wsJson?.error ?? "Failed to reload workspace");

    const nextWorkspace = (wsJson?.workspace ?? null) as Workspace | null;
    setWorkspace(nextWorkspace);
    setLicensing((wsJson?.licensing ?? null) as Licensing | null);
    setPolicyMode(normalizePhotoMode(nextWorkspace?.member_profile_photo_mode));
  }

  async function upload() {
    if (!file || !workspaceIdentifier) return;

    setUploading(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/branding/logo`, {
        method: "POST",
        body: form,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Upload failed");

      setMsg("Logo updated.");
      setFile(null);
      await reloadWorkspace();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveLogoSize(nextWidth: number) {
    if (!workspaceIdentifier) return;
    setSavingSize(true);
    setSizeMsg(null);
    try {
      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/branding/logo`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brand_logo_width_px: nextWidth }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to save logo size.");
      setSizeMsg("Logo size saved.");
      setWorkspace((prev) => (prev ? { ...prev, brand_logo_width_px: nextWidth } : prev));
    } catch (e: unknown) {
      setSizeMsg(e instanceof Error ? e.message : "Failed to save logo size.");
    } finally {
      setSavingSize(false);
    }
  }

  async function savePolicyMode() {
    if (!workspaceIdentifier || !policyEligible) return;
    setPolicySaving(true);
    setPolicyMsg(null);
    try {
      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ member_profile_photo_mode: policyMode }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to save profile photo policy.");
      setPolicyMsg("Profile photo policy saved.");
      setWorkspace((prev) => (prev ? { ...prev, member_profile_photo_mode: policyMode } : prev));
    } catch (e: unknown) {
      setPolicyMsg(e instanceof Error ? e.message : "Failed to save profile photo policy.");
    } finally {
      setPolicySaving(false);
    }
  }

  async function uploadCompanyPhoto() {
    if (!companyPhotoFile || !workspaceIdentifier || !policyEligible) return;

    setCompanyPhotoSaving(true);
    setCompanyPhotoMsg(null);
    try {
      const form = new FormData();
      form.append("file", companyPhotoFile);

      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/branding/profile-photo`, {
        method: "POST",
        body: form,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to upload company profile photo.");

      setCompanyPhotoFile(null);
      setCompanyPhotoMsg("Company profile photo updated.");
      await reloadWorkspace();
    } catch (e: unknown) {
      setCompanyPhotoMsg(e instanceof Error ? e.message : "Failed to upload company profile photo.");
    } finally {
      setCompanyPhotoSaving(false);
    }
  }

  async function removeCompanyPhoto() {
    if (!workspaceIdentifier || !policyEligible) return;

    setCompanyPhotoSaving(true);
    setCompanyPhotoMsg(null);
    try {
      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/branding/profile-photo`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to remove company profile photo.");

      setCompanyPhotoFile(null);
      setCompanyPhotoMsg("Company profile photo removed.");
      await reloadWorkspace();
    } catch (e: unknown) {
      setCompanyPhotoMsg(e instanceof Error ? e.message : "Failed to remove company profile photo.");
    } finally {
      setCompanyPhotoSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight truncate">
            {loading ? "Loading…" : workspace?.name ?? "Branding"}
          </h1>
        </div>

        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted2)" }}>
          Branding
        </div>
      </div>

      {error && (
        <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}>
          <div className="text-sm font-semibold">Couldn’t load branding</div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {error}
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          <div className="border p-6" style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm font-semibold">Current logo</div>
                <div className="mt-3 border p-4" style={{ borderColor: "var(--border2)", background: "var(--bg)", borderRadius: 12 }}>
                  {logoSrc ? (
                    <Image
                      src={logoSrc}
                      alt="Workspace logo"
                      width={logoWidthPx}
                      height={Math.max(20, Math.round(logoWidthPx / 4))}
                      unoptimized
                      className="w-auto"
                      style={{ objectFit: "contain", width: `${logoWidthPx}px`, height: "auto", maxWidth: "100%" }}
                    />
                  ) : (
                    <div className="text-sm" style={{ color: "var(--muted)" }}>
                      No logo uploaded yet.
                    </div>
                  )}
                </div>
                <div className="mt-3 text-xs" style={{ color: "var(--muted2)" }}>
                  PNG only. Recommended: transparent background, 512×512.
                </div>
                <div className="mt-4 rounded-xl border p-4" style={{ borderColor: "var(--border2)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">Header logo size</div>
                    <div className="text-xs" style={{ color: "var(--muted2)" }}>{logoWidthPx}px</div>
                  </div>
                  <input
                    type="range"
                    min={48}
                    max={320}
                    step={1}
                    value={logoWidthPx}
                    onChange={(e) => setLogoWidthPx(Math.max(48, Math.min(320, Math.floor(Number(e.target.value) || 104))))}
                    className="mt-3 w-full"
                  />
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void saveLogoSize(logoWidthPx)}
                      disabled={savingSize}
                      className="focus-ring px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                      style={{ borderRadius: 999, border: "1px solid var(--border)" }}
                    >
                      {savingSize ? "Saving…" : "Save size"}
                    </button>
                    {sizeMsg ? (
                      <div className="text-xs" style={{ color: sizeMsg === "Logo size saved." ? "var(--muted)" : "#ff3b30" }}>
                        {sizeMsg}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold">Upload a new logo</div>

                <div className="mt-3 flex items-center justify-between gap-3 border px-4 py-3"
                  style={{ borderColor: "var(--border2)", borderRadius: 12 }}>
                  <div className="min-w-0">
                    <div className="text-sm truncate">{file ? file.name : "Choose a PNG"}</div>
                    <div className="text-xs" style={{ color: "var(--muted2)" }}>
                      Max 1MB
                    </div>
                  </div>
                  <label
                    className="focus-ring px-3 py-2 text-sm font-medium hover:opacity-80"
                    style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
                  >
                    Browse
                    <input
                      type="file"
                      accept="image/png"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void upload()}
                    disabled={!file || uploading}
                    className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                    style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
                  >
                    {uploading ? "Uploading…" : "Upload logo"}
                  </button>

                  {msg ? (
                    <div className="text-sm" style={{ color: msg === "Logo updated." ? "var(--muted)" : "#ff3b30" }}>
                      {msg}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
                  Branding currently supports logo updates only (no colour or typography changes).
                </div>
              </div>
            </div>
          </div>

          <div className="border p-6" style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}>
            <div className="text-sm font-semibold">Member profile photo policy</div>
            <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              Control whether members can upload personal profile photos, or enforce a company-wide profile photo.
            </div>

            {!policyEligible ? (
              <div className="mt-4 text-sm border px-4 py-3" style={{ borderColor: "var(--border)", borderRadius: 10, color: "var(--muted)" }}>
                This policy is available on Team and Enterprise workspaces only.
              </div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                      POLICY MODE
                    </label>
                    <select
                      value={policyMode}
                      onChange={(e) => setPolicyMode(normalizePhotoMode(e.target.value))}
                      className="mt-2 w-full border px-4 py-3 text-sm bg-transparent focus-ring"
                      style={{ borderColor: "var(--border)", borderRadius: 10 }}
                    >
                      <option value="allow">Allow personal photos</option>
                      <option value="disabled">Disable personal uploads</option>
                      <option value="company">Force company profile photo</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void savePolicyMode()}
                    disabled={policySaving}
                    className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                    style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
                  >
                    {policySaving ? "Saving…" : "Save policy"}
                  </button>
                  {policyMsg ? (
                    <div className="text-sm" style={{ color: policyMsg === "Profile photo policy saved." ? "var(--muted)" : "#ff3b30" }}>
                      {policyMsg}
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 rounded-xl border p-4" style={{ borderColor: "var(--border2)" }}>
                  <div className="text-sm font-semibold">Company profile photo</div>
                  <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                    Used when policy mode is set to <strong>Force company profile photo</strong>.
                  </div>

                  <div className="mt-4 border p-4" style={{ borderColor: "var(--border2)", background: "var(--bg)", borderRadius: 12 }}>
                    {companyPhotoSrc ? (
                      <Image
                        src={companyPhotoSrc}
                        alt="Company profile photo"
                        width={72}
                        height={72}
                        unoptimized
                        style={{ width: 72, height: 72, borderRadius: 999, objectFit: "cover" }}
                      />
                    ) : (
                      <div className="text-xs" style={{ color: "var(--muted2)" }}>
                        No company profile photo uploaded yet. Members will see workspace initials as fallback.
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border px-4 py-3" style={{ borderColor: "var(--border2)", borderRadius: 12 }}>
                    <div className="min-w-0">
                      <div className="text-sm truncate">{companyPhotoFile ? companyPhotoFile.name : "Choose JPG, PNG, or WebP"}</div>
                      <div className="text-xs" style={{ color: "var(--muted2)" }}>Max 2MB • Auto-cropped square</div>
                    </div>
                    <label
                      className="focus-ring px-3 py-2 text-sm font-medium hover:opacity-80"
                      style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
                    >
                      Browse
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => setCompanyPhotoFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => void uploadCompanyPhoto()}
                      disabled={!companyPhotoFile || companyPhotoSaving}
                      className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                      style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
                    >
                      {companyPhotoSaving ? "Saving…" : "Upload company photo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeCompanyPhoto()}
                      disabled={companyPhotoSaving || !workspace?.member_profile_photo_path}
                      className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                      style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
                    >
                      Remove
                    </button>
                    {companyPhotoMsg ? (
                      <div className="text-sm" style={{ color: companyPhotoMsg.includes("updated") || companyPhotoMsg.includes("removed") ? "var(--muted)" : "#ff3b30" }}>
                        {companyPhotoMsg}
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

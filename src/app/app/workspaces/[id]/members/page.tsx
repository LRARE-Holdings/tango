"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Member = {
  user_id: string;
  email: string | null;
  role: "owner" | "admin" | "member";
  joined_at: string;
  license_active?: boolean;
  license_assigned_at?: string | null;
  license_revoked_at?: string | null;
};

type Workspace = {
  id: string;
  name: string;
  slug?: string | null;
};

type Viewer = {
  user_id: string;
  role: "owner" | "admin" | "member";
};

type LicensingSummary = {
  seat_limit: number;
  used_seats: number;
  available_seats: number;
  billing_owner_user_id: string;
};

export default function WorkspaceMembersPage() {
  const params = useParams<{ id?: string }>();
  const workspaceId = typeof params?.id === "string" ? params.id : "";
  const workspaceIdentifier = useMemo(() => workspaceId.trim(), [workspaceId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [licensing, setLicensing] = useState<LicensingSummary | null>(null);
  const [licenseSavingUserId, setLicenseSavingUserId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    if (!workspaceIdentifier) {
      setWorkspace(null);
      setMembers([]);
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
        setWorkspace(json?.workspace ?? null);
        setMembers(json?.members ?? []);
        setViewer((json?.viewer ?? null) as Viewer | null);
        setLicensing((json?.licensing ?? null) as LicensingSummary | null);
      } catch (e: unknown) {
        if (alive) setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [workspaceIdentifier, workspaceId]);

  const owners = useMemo(() => members.filter((m) => m.role === "owner").length, [members]);
  const canManageMembers = viewer?.role === "owner" || viewer?.role === "admin";

  async function refresh() {
    if (!workspaceIdentifier) return;
    const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error ?? "Failed to load");
    setWorkspace(json?.workspace ?? null);
    setMembers(json?.members ?? []);
    setViewer((json?.viewer ?? null) as Viewer | null);
    setLicensing((json?.licensing ?? null) as LicensingSummary | null);
  }

  async function invite() {
    if (!workspaceIdentifier) return;

    setInviteMsg(null);
    setInviting(true);
    try {
      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/invite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Invite failed");

      setInviteMsg("Invite sent.");
      setEmail("");
      await refresh();
    } catch (e: unknown) {
      setInviteMsg(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  }

  async function updateMemberRole(userId: string, nextRole: "admin" | "member") {
    if (!workspaceIdentifier) return;
    setInviteMsg(null);
    try {
      const res = await fetch(
        `/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/members/${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ role: nextRole }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Could not update role.");
      await refresh();
      setInviteMsg("Member role updated.");
    } catch (e: unknown) {
      setInviteMsg(e instanceof Error ? e.message : "Could not update role.");
    }
  }

  async function removeMember(userId: string) {
    if (!workspaceIdentifier) return;
    setInviteMsg(null);
    try {
      const res = await fetch(
        `/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/members/${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Could not remove member.");
      await refresh();
      setInviteMsg("Member removed.");
    } catch (e: unknown) {
      setInviteMsg(e instanceof Error ? e.message : "Could not remove member.");
    }
  }

  async function setMemberLicense(userId: string, licenseActive: boolean) {
    if (!workspaceIdentifier) return;
    setInviteMsg(null);
    setLicenseSavingUserId(userId);
    try {
      const res = await fetch(
        `/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/licenses/members/${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ license_active: licenseActive }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Could not update license.");
      await refresh();
      setInviteMsg(licenseActive ? "License assigned." : "License revoked.");
    } catch (e: unknown) {
      setInviteMsg(e instanceof Error ? e.message : "Could not update license.");
    } finally {
      setLicenseSavingUserId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight truncate">
            {loading ? "Loading…" : workspace?.name ?? "Members"}
          </h1>
        </div>

        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted2)" }}>
          Team Management
        </div>
      </div>

      {error && (
        <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}>
          <div className="text-sm font-semibold">Couldn’t load members</div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {error}
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Invite */}
          {canManageMembers ? (
          <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}>
            <div className="text-sm font-semibold">Invite someone</div>
            <div className="mt-2 text-xs" style={{ color: "var(--muted2)" }}>
              New members are auto-assigned a license on acceptance. If seats are full, activation is blocked.
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                  EMAIL
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="mt-2 w-full border px-4 py-3 text-sm bg-transparent focus-ring"
                  style={{ borderColor: "var(--border)", borderRadius: 10 }}
                />
              </div>

              <div>
                <label className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                  ROLE
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "member" | "admin")}
                  className="mt-2 w-full border px-4 py-3 text-sm bg-transparent focus-ring"
                  style={{ borderColor: "var(--border)", borderRadius: 10 }}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <div className="mt-2 text-xs" style={{ color: "var(--muted2)" }}>
                  Owners can’t be invited (create internally).
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void invite()}
                disabled={inviting || !email.trim()}
                className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
              >
                {inviting ? "Sending…" : "Send invite"}
              </button>

              {inviteMsg ? (
                <div className="text-sm" style={{ color: inviteMsg === "Invite sent." ? "var(--muted)" : "#ff3b30" }}>
                  {inviteMsg}
                </div>
              ) : null}
            </div>
          </div>
          ) : null}

          {licensing ? (
            <div className="border p-4" style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}>
              <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                LICENSES
              </div>
              <div className="mt-2 text-sm">
                {licensing.used_seats} / {licensing.seat_limit} seats used • {licensing.available_seats} available
              </div>
              {licensing.available_seats <= 0 ? (
                <div className="mt-2 text-xs" style={{ color: "#ff3b30" }}>
                  No available seats. Increase seats in billing or revoke a current license.
                </div>
              ) : null}
              {canManageMembers ? (
                <div className="mt-3">
                  <a
                    href="/app/account"
                    className="focus-ring inline-flex px-3 py-2 text-xs font-medium hover:opacity-80"
                    style={{ border: "1px solid var(--border)", borderRadius: 8, color: "var(--muted)" }}
                  >
                    Manage billing
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Member list */}
          <div className="border" style={{ borderColor: "var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div className="px-5 py-3 text-xs" style={{ color: "var(--muted2)", background: "var(--card2)" }}>
              MEMBERS • {members.length} total • {owners} owner{owners === 1 ? "" : "s"}
            </div>

            <div>
              {members.map((m) => {
                const isSelf = viewer?.user_id === m.user_id;
                const canChangeRole =
                  canManageMembers &&
                  !isSelf &&
                  m.role !== "owner" &&
                  !(viewer?.role === "admin" && m.role !== "member");
                const canRemove =
                  canManageMembers &&
                  !isSelf &&
                  m.role !== "owner" &&
                  !(viewer?.role === "admin" && m.role !== "member");
                const canManageLicense =
                  canManageMembers &&
                  !(viewer?.role === "admin" && m.role === "owner");
                const licenseActive = Boolean(m.license_active ?? true);
                const canEnableLicense = licenseActive || (licensing?.available_seats ?? 0) > 0;
                return (
                <div
                  key={m.user_id}
                  className="px-5 py-4 flex items-center justify-between"
                  style={{ borderTop: "1px solid var(--border2)" }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{m.email ?? "Unknown email"}</div>
                    <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                      Role: {m.role}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: licenseActive ? "var(--muted2)" : "#ff3b30" }}>
                      License: {licenseActive ? "Active" : "Inactive"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canManageLicense ? (
                      <label className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
                        <input
                          type="checkbox"
                          checked={licenseActive}
                          onChange={(e) => void setMemberLicense(m.user_id, e.currentTarget.checked)}
                          disabled={
                            licenseSavingUserId === m.user_id ||
                            (!licenseActive && !canEnableLicense)
                          }
                        />
                        License
                      </label>
                    ) : null}
                    {canChangeRole ? (
                      <select
                        value={m.role}
                        onChange={(e) => void updateMemberRole(m.user_id, e.target.value as "admin" | "member")}
                        className="focus-ring border px-3 py-2 text-xs bg-transparent"
                        style={{ borderColor: "var(--border)", borderRadius: 8 }}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : null}
                    {canRemove ? (
                      <button
                        type="button"
                        onClick={() => void removeMember(m.user_id)}
                        className="focus-ring px-3 py-2 text-xs font-medium hover:opacity-80"
                        style={{ border: "1px solid var(--border)", borderRadius: 8, color: "#ff3b30" }}
                      >
                        Remove
                      </button>
                    ) : null}
                    {!canChangeRole && !canRemove ? (
                      <div className="text-xs" style={{ color: "var(--muted)" }}>
                        {isSelf ? "You" : m.role === "owner" ? "Owner" : "Member"}
                      </div>
                    ) : null}
                  </div>
                </div>
              )})}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

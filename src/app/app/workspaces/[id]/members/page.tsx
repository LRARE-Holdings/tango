"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Member = {
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
};

type Workspace = {
  id: string;
  name: string;
};

export default function WorkspaceMembersPage({ params }: { params: { id: string } }) {
  const workspaceId = params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/app/workspaces/${workspaceId}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load");
        if (!alive) return;
        setWorkspace(json?.workspace ?? null);
        setMembers(json?.members ?? []);
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Something went wrong");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  const owners = useMemo(() => members.filter((m) => m.role === "owner").length, [members]);

  async function invite() {
    setInviteMsg(null);
    setInviting(true);
    try {
      const res = await fetch(`/api/app/workspaces/${workspaceId}/invite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Invite failed");

      setInviteMsg("Invite sent.");
      setEmail("");
    } catch (e: any) {
      setInviteMsg(e?.message ?? "Invite failed");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight truncate">
            {loading ? "Loading…" : workspace?.name ?? "Members"}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Invite teammates. They’ll receive an email invite via your Supabase template.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/app/workspaces/${workspaceId}`}
            className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
          >
            Back
          </Link>
          <Link
            href={`/app/workspaces/${workspaceId}/branding`}
            className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
          >
            Branding
          </Link>
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
          <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}>
            <div className="text-sm font-semibold">Invite someone</div>
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
                  onChange={(e) => setRole(e.target.value as any)}
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

          {/* Member list */}
          <div className="border" style={{ borderColor: "var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div className="px-5 py-3 text-xs" style={{ color: "var(--muted2)", background: "var(--card2)" }}>
              MEMBERS • {members.length} total • {owners} owner{owners === 1 ? "" : "s"}
            </div>

            <div>
              {members.map((m) => (
                <div
                  key={m.user_id}
                  className="px-5 py-4 flex items-center justify-between"
                  style={{ borderTop: "1px solid var(--border2)" }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{m.user_id}</div>
                    <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                      Role: {m.role}
                    </div>
                  </div>

                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    Joined
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
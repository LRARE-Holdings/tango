"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AppHero, AppPage, AppPanel } from "@/components/app/page-layout";

type Workspace = {
  id: string;
  name: string;
  slug?: string | null;
  created_at: string;
  brand_logo_updated_at?: string | null;
  my_role?: "owner" | "admin" | "member";
};

export default function WorkspacesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/app/workspaces", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load workspaces");
        if (!alive) return;
        setWorkspaces(json?.workspaces ?? []);
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
  }, []);

  const hasAny = workspaces.length > 0;

  const cards = useMemo(() => {
    return workspaces.map((w) => {
      const identifier = w.slug ?? w.id;
      const logoSrc = `/api/app/workspaces/${w.id}/branding/logo/view${
        w.brand_logo_updated_at ? `?v=${encodeURIComponent(w.brand_logo_updated_at)}` : ""
      }`;
      const canManageWorkspace = w.my_role === "owner" || w.my_role === "admin";

      return (
        <div key={w.id} className="app-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{w.name}</div>
              <div className="app-subtle-2 mt-1 truncate text-xs">
                {w.id}
              </div>
            </div>
            <Image
              src={logoSrc}
              alt=""
              width={32}
              height={32}
              unoptimized
              className="h-8 w-8"
              style={{ objectFit: "contain" }}
            />
          </div>

          <div className="mt-4 flex gap-2">
            <Link href={`/app/workspaces/${identifier}/dashboard`} className="focus-ring app-btn-primary">
              Open
            </Link>

            {canManageWorkspace ? (
              <>
                <Link href={`/app/workspaces/${identifier}/members`} className="focus-ring app-btn-secondary">
                  Members
                </Link>

                <Link href={`/app/workspaces/${identifier}/branding`} className="focus-ring app-btn-secondary">
                  Branding
                </Link>
              </>
            ) : null}

            {canManageWorkspace ? (
              <Link href={`/app/workspaces/${identifier}/settings`} className="focus-ring app-btn-secondary">
                Settings
              </Link>
            ) : null}
          </div>
        </div>
      );
    });
  }, [workspaces]);

  return (
    <AppPage>
      <AppHero
        kicker="WORKSPACES"
        title="Workspace"
        description="Members, invites, and branding for Team/Enterprise."
        actions={
          <Link href="/app/workspaces/new" className="focus-ring app-btn-primary">
            Create workspace
          </Link>
        }
      />

      {loading && (
        <div className="app-subtle text-sm">
          Loading…
        </div>
      )}

      {error && (
        <div className="app-card p-5">
          <div className="text-sm font-semibold">Couldn’t load workspaces</div>
          <div className="app-subtle mt-2 text-sm">
            {error}
          </div>
        </div>
      )}

      {!loading && !error && !hasAny && (
        <AppPanel title="No workspace yet">
          <div className="app-subtle text-sm">
            Workspaces are available on Team/Enterprise. Create one to invite members and add a logo.
          </div>
          <div className="mt-4">
            <Link href="/pricing" className="focus-ring app-btn-secondary">
              View plans
            </Link>
          </div>
        </AppPanel>
      )}

      {!loading && !error && hasAny && <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{cards}</div>}
    </AppPage>
  );
}

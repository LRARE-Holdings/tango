import Link from "next/link";

export default async function WorkspaceSettingsIndex({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = (await params) as { id: string };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="app-content-card p-6">
        <div className="app-section-kicker">INDIVIDUAL</div>
        <h2 className="app-hero-title mt-2 text-3xl">My settings</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Personal defaults, notifications, and profile preferences.
        </p>
        <div className="mt-4">
          <Link
            href="/app/account"
            className="focus-ring inline-flex px-4 py-2 text-sm font-semibold"
            style={{ borderRadius: 999, border: "1px solid var(--border)", color: "var(--muted)" }}
          >
            Open my settings
          </Link>
        </div>
      </section>

      <section className="app-content-card p-6">
        <div className="app-section-kicker">WORKSPACE ADMIN</div>
        <h2 className="app-hero-title mt-2 text-3xl">Workspace controls</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Manage members, policies, documents, domains, and workspace-level defaults.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/app/workspaces/${id}/settings/members`}
            className="focus-ring inline-flex px-4 py-2 text-sm font-semibold"
            style={{ borderRadius: 999, border: "1px solid var(--border)", color: "var(--muted)" }}
          >
            Manage users
          </Link>
          <Link
            href={`/app/workspaces/${id}/settings/general`}
            className="focus-ring inline-flex px-4 py-2 text-sm font-semibold"
            style={{ borderRadius: 999, border: "1px solid var(--border)", color: "var(--muted)" }}
          >
            General settings
          </Link>
        </div>
      </section>
    </div>
  );
}

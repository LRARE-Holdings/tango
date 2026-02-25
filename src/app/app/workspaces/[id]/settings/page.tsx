import Link from "next/link";

export default async function WorkspaceSettingsIndex({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = (await params) as { id: string };
  return (
    <div className="space-y-4">
      <section className="app-content-card p-6">
        <h2 className="text-xl font-semibold">Admin controls</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Centralized owner/admin configuration for workspace identity, members, policy, branding, documents, and usage.
        </p>
        <div
          className="mt-4 text-sm border px-4 py-3"
          style={{ borderColor: "var(--border)", borderRadius: 12, color: "var(--muted)" }}
        >
          Only owners and admins can access workspace settings.
        </div>
      </section>

      <section className="app-content-card p-6">
        <div className="text-sm font-semibold">Quick actions</div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href={`/app/workspaces/${id}/settings/general`}
            className="focus-ring app-list-item px-4 py-3 text-sm font-semibold"
          >
            General
          </Link>
          <Link
            href={`/app/workspaces/${id}/settings/branding`}
            className="focus-ring app-list-item px-4 py-3 text-sm font-semibold"
          >
            Branding
          </Link>
          <Link
            href={`/app/workspaces/${id}/settings/members`}
            className="focus-ring app-list-item px-4 py-3 text-sm font-semibold"
          >
            Members
          </Link>
          <Link
            href={`/app/workspaces/${id}/settings/documents`}
            className="focus-ring app-list-item px-4 py-3 text-sm font-semibold"
          >
            Documents
          </Link>
          <Link
            href={`/app/workspaces/${id}/settings/policy`}
            className="focus-ring app-list-item px-4 py-3 text-sm font-semibold"
          >
            Policy & MFA
          </Link>
          <Link
            href={`/app/workspaces/${id}/settings/usage`}
            className="focus-ring app-list-item px-4 py-3 text-sm font-semibold"
          >
            Usage
          </Link>
        </div>
      </section>
    </div>
  );
}

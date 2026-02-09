import Link from "next/link";

export default async function WorkspaceSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = (await params) as { id: string };

  const items = [
    { href: `/app/workspaces/${id}/settings/general`, label: "General" },
    { href: `/app/workspaces/${id}/settings/branding`, label: "Branding" },
    { href: `/app/workspaces/${id}/settings/members`, label: "Members" },
    { href: `/app/workspaces/${id}/settings/domains`, label: "Domains" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>
            WORKSPACE SETTINGS
          </div>
          <div className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Core configuration for this workspace.
          </div>
        </div>
        <Link
          href={`/app/workspaces/${id}/dashboard`}
          className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
          style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
        >
          Back to dashboard
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {items.map((x) => (
          <Link
            key={x.href}
            href={x.href}
            className="focus-ring px-3 py-2 text-sm font-medium hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
          >
            {x.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}


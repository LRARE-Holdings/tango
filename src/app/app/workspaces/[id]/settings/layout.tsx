import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";

export default async function WorkspaceSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = (await params) as { id: string };
  const resolved = await resolveWorkspaceIdentifier(id);
  if (!resolved) {
    redirect("/app/workspaces");
  }

  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect(`/auth?next=${encodeURIComponent(`/app/workspaces/${id}/settings`)}`);
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", resolved.id)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    redirect(`/app/workspaces/${id}/dashboard`);
  }

  const navItems = [
    { href: `/app/workspaces/${id}/settings`, label: "Overview" },
    { href: `/app/workspaces/${id}/settings/general`, label: "General" },
    { href: `/app/workspaces/${id}/settings/members`, label: "Members" },
    { href: `/app/workspaces/${id}/settings/documents`, label: "Documents" },
    { href: `/app/workspaces/${id}/settings/policy`, label: "Policy mode" },
    { href: `/app/workspaces/${id}/settings/usage`, label: "Usage" },
    { href: `/app/workspaces/${id}/settings/domains`, label: "Domains" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="app-hero-title mt-1 text-3xl md:text-4xl">Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/account"
            className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 999 }}
          >
            My settings
          </Link>
          <Link
            href={`/app/workspaces/${id}/dashboard`}
            className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 999 }}
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      <details
        className="rounded-xl border p-3"
        style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--card) 88%, transparent)" }}
      >
        <summary
          className="focus-ring cursor-pointer list-none select-none text-sm font-medium"
          style={{ color: "var(--muted)" }}
        >
          Workspace sections
        </summary>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring px-3 py-1.5 text-xs font-medium hover:opacity-90"
              style={{
                border: "1px solid var(--border)",
                borderRadius: 999,
                color: "var(--muted)",
                background: "color-mix(in srgb, var(--bg) 86%, var(--card2))",
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </details>

      {children}
    </div>
  );
}

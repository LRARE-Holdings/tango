import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHero, AppPage } from "@/components/app/page-layout";
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

  const settingsRoot = `/app/workspaces/${id}/settings`;
  const navItems = [
    { href: settingsRoot, label: "Overview" },
    { href: `${settingsRoot}/general`, label: "General" },
    { href: `${settingsRoot}/branding`, label: "Branding" },
    { href: `${settingsRoot}/members`, label: "Members" },
    { href: `${settingsRoot}/documents`, label: "Documents" },
    { href: `${settingsRoot}/policy`, label: "Policy & MFA" },
    { href: `${settingsRoot}/usage`, label: "Usage" },
  ];

  return (
    <AppPage>
      <AppHero
        kicker="WORKSPACE SETTINGS"
        title="Workspace settings"
        description="Owner/admin controls for workspace identity, branding, members, policy, documents, and usage."
      />

      <section className="app-content-card p-3 md:p-4">
        <nav className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-7">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring app-list-item px-3 py-2 text-sm font-semibold text-center"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </section>

      <div className="space-y-4">{children}</div>
    </AppPage>
  );
}

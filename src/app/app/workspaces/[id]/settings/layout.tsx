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

  const navItems = [
    { href: `/app/workspaces/${id}/settings`, label: "Overview" },
    { href: `/app/workspaces/${id}/settings/general`, label: "General" },
    { href: `/app/workspaces/${id}/settings/branding`, label: "Branding" },
    { href: `/app/workspaces/${id}/settings/members`, label: "Members" },
    { href: `/app/workspaces/${id}/settings/documents`, label: "Documents" },
    { href: `/app/workspaces/${id}/settings/policy`, label: "Policy & MFA" },
    { href: `/app/workspaces/${id}/settings/usage`, label: "Usage" },
  ];
}

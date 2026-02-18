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

      <div className="flex items-center gap-2 flex-wrap">
        {[
          { href: `/app/workspaces/${id}/settings/general`, label: "General" },
          { href: `/app/workspaces/${id}/settings/documents`, label: "Documents" },
          { href: `/app/workspaces/${id}/settings/policy`, label: "Policy mode" },
          { href: `/app/workspaces/${id}/settings/usage`, label: "Usage" },
          { href: `/app/workspaces/${id}/settings/domains`, label: "Domains" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="focus-ring px-3 py-1.5 text-xs font-medium hover:opacity-80"
            style={{
              border: "1px solid var(--border)",
              borderRadius: 999,
              color: "var(--muted)",
              background: "var(--card)",
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}

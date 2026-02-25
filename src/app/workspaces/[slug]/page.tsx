import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string | null;
};

export default async function WorkspaceSlugPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = (await params) as { slug: string };
  const normalized = String(slug ?? "").trim().toLowerCase();
  if (!normalized) notFound();

  const supabase = await supabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    redirect(`/auth?next=${encodeURIComponent(`/workspaces/${normalized}`)}`);
  }

  const admin = supabaseAdmin();
  const withSlug = await admin
    .from("workspaces")
    .select("id,name,slug")
    .eq("slug", normalized)
    .maybeSingle();

  if (withSlug.error) {
    if (withSlug.error.code === "42703") {
      return (
        <main className="min-h-screen px-6 py-12">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight">Workspace URLs not configured</h1>
            <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
              Run the workspace slug migration to enable public workspace URLs.
            </p>
          </div>
        </main>
      );
    }
    throw new Error(withSlug.error.message);
  }

  const workspace = withSlug.data as WorkspaceRow | null;
  if (!workspace) notFound();

  const memberRes = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (memberRes.error) throw new Error(memberRes.error.message);
  if (!memberRes.data?.role) notFound();

  const workspaceIdentifier = workspace.slug ?? workspace.id;

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="text-xs font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>
          WORKSPACE
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{workspace.name}</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          You are signed in and have workspace access.
        </p>
        <Link
          href={`/app/workspaces/${encodeURIComponent(workspaceIdentifier)}`}
          className="focus-ring inline-flex rounded-full border px-4 py-2 text-sm hover:opacity-80"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          Open workspace
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="text-xs font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>
          WORKSPACE
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{workspace.name}</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Public workspace URL is active. Custom domain support is available via workspace settings and DNS verification.
        </p>
        <Link
          href="/auth"
          className="focus-ring inline-flex rounded-full border px-4 py-2 text-sm hover:opacity-80"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}


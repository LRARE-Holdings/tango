import { supabaseAdmin } from "@/lib/supabase/admin";

type WorkspaceRef = {
  id: string;
  slug: string | null;
};

export function isWorkspaceUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function isMissingSlugColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes("slug");
}

export async function resolveWorkspaceIdentifier(identifier: string): Promise<WorkspaceRef | null> {
  const value = String(identifier ?? "").trim();
  if (!value) return null;

  const admin = supabaseAdmin();

  if (isWorkspaceUuid(value)) {
    const withSlug = await admin
      .from("workspaces")
      .select("id,slug")
      .eq("id", value)
      .maybeSingle();

    if (withSlug.error && isMissingSlugColumnError(withSlug.error)) {
      const fallback = await admin
        .from("workspaces")
        .select("id")
        .eq("id", value)
        .maybeSingle();
      if (fallback.error) throw new Error(fallback.error.message);
      if (!fallback.data) return null;
      return { id: String((fallback.data as { id: string }).id), slug: null };
    }

    if (withSlug.error) throw new Error(withSlug.error.message);
    if (!withSlug.data) return null;
    return { id: String(withSlug.data.id), slug: (withSlug.data as { slug?: string | null }).slug ?? null };
  }

  const bySlug = await admin
    .from("workspaces")
    .select("id,slug")
    .eq("slug", value.toLowerCase())
    .maybeSingle();

  if (bySlug.error && isMissingSlugColumnError(bySlug.error)) {
    throw new Error("Workspace slug support is not configured. Run the workspace slug migration first.");
  }
  if (bySlug.error) throw new Error(bySlug.error.message);
  if (!bySlug.data) return null;
  return { id: String(bySlug.data.id), slug: (bySlug.data as { slug?: string | null }).slug ?? null };
}


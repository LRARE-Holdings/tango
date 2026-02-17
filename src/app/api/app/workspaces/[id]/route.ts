import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";
import { getWorkspaceLicensing } from "@/lib/workspace-licensing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, column: string) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes(column.toLowerCase());
}

type DocumentTagField = {
  key: string;
  label: string;
  placeholder?: string;
};

function normalizeSlug(v: string) {
  return v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isValidSlug(v: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length >= 3 && v.length <= 63;
}

function normalizeTagKey(v: string) {
  return v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseDocumentTagFields(input: unknown): DocumentTagField[] {
  if (!Array.isArray(input)) return [];
  const out: DocumentTagField[] = [];
  const seen = new Set<string>();

  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const rawLabel = String((item as { label?: unknown }).label ?? "").trim();
    if (!rawLabel) continue;
    const rawKey = String((item as { key?: unknown }).key ?? "").trim();
    const key = normalizeTagKey(rawKey || rawLabel);
    if (!key || seen.has(key)) continue;
    const placeholderRaw = String((item as { placeholder?: unknown }).placeholder ?? "").trim();
    out.push({
      key,
      label: rawLabel.slice(0, 64),
      ...(placeholderRaw ? { placeholder: placeholderRaw.slice(0, 120) } : {}),
    });
    seen.add(key);
    if (out.length >= 12) break;
  }
  return out;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceIdentifier } = (await ctx.params) as { id: string };
    if (!workspaceIdentifier) {
      return NextResponse.json({ error: "Invalid workspace identifier" }, { status: 400 });
    }

    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolved = await resolveWorkspaceIdentifier(workspaceIdentifier);
    if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: member, error: memberErr } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", resolved.id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (memberErr) throw new Error(memberErr.message);
    if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const withSlug = await supabase
      .from("workspaces")
      .select(
        "id,name,slug,created_by,created_at,updated_at,brand_logo_path,brand_logo_updated_at,document_tag_fields,billing_owner_user_id"
      )
      .eq("id", resolved.id)
      .maybeSingle();

    let workspace = withSlug.data as Record<string, unknown> | null;
    let wsErr = withSlug.error;

    if (
      wsErr &&
      (isMissingColumnError(wsErr, "slug") || isMissingColumnError(wsErr, "billing_owner_user_id"))
    ) {
      const fallback = await supabase
        .from("workspaces")
        .select("id,name,created_by,created_at,updated_at,brand_logo_path,brand_logo_updated_at")
        .eq("id", resolved.id)
        .maybeSingle();
      workspace = fallback.data as Record<string, unknown> | null;
      wsErr = fallback.error;
      if (workspace) {
        workspace.slug = null;
        workspace.document_tag_fields = [];
        workspace.billing_owner_user_id = workspace.created_by;
      }
    }

    if (wsErr) throw new Error(wsErr.message);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { summary: licensing, members: memberList } = await getWorkspaceLicensing(admin, resolved.id);
    const userIds = Array.from(new Set(memberList.map((m) => m.user_id).filter(Boolean)));
    const emailsByUserId = new Map<string, string | null>();

    await Promise.all(
      userIds.map(async (userId) => {
        const { data, error } = await admin.auth.admin.getUserById(userId);
        if (error) {
          emailsByUserId.set(userId, null);
          return;
        }
        emailsByUserId.set(userId, data.user?.email ?? null);
      })
    );

    const membersWithEmails = memberList.map((m) => ({
      ...m,
      email: emailsByUserId.get(m.user_id) ?? null,
    }));

    return NextResponse.json({
      workspace: {
        ...workspace,
        document_tag_fields: parseDocumentTagFields((workspace as { document_tag_fields?: unknown }).document_tag_fields),
      },
      licensing,
      members: membersWithEmails,
      viewer: {
        user_id: userData.user.id,
        role: member.role,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceIdentifier } = (await ctx.params) as { id: string };
    if (!workspaceIdentifier) {
      return NextResponse.json({ error: "Invalid workspace identifier" }, { status: 400 });
    }

    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolved = await resolveWorkspaceIdentifier(workspaceIdentifier);
    if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: member, error: memberErr } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", resolved.id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (memberErr) throw new Error(memberErr.message);
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as {
      name?: string;
      slug?: string | null;
      document_tag_fields?: unknown;
    } | null;
    const nextName = typeof body?.name === "string" ? body.name.trim() : undefined;
    const slugRaw = typeof body?.slug === "string" ? body.slug : undefined;

    if (nextName !== undefined && nextName.length === 0) {
      return NextResponse.json({ error: "Workspace name is required." }, { status: 400 });
    }

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (nextName !== undefined) payload.name = nextName;
    if (body && "document_tag_fields" in body) {
      payload.document_tag_fields = parseDocumentTagFields(body.document_tag_fields);
    }

    const { data: existingWorkspace, error: existingErr } = await admin
      .from("workspaces")
      .select("name,slug")
      .eq("id", resolved.id)
      .maybeSingle();
    if (existingErr && !isMissingColumnError(existingErr, "slug")) throw new Error(existingErr.message);

    const existingSlug =
      existingErr && isMissingColumnError(existingErr, "slug")
        ? null
        : ((existingWorkspace as { slug?: string | null } | null)?.slug ?? null);
    const existingName = ((existingWorkspace as { name?: string } | null)?.name ?? "") as string;

    if (slugRaw !== undefined) {
      const slug = normalizeSlug(slugRaw);
      if (!isValidSlug(slug)) {
        return NextResponse.json(
          { error: "Slug must be 3-63 chars using lowercase letters, numbers, and hyphens only." },
          { status: 400 }
        );
      }
      payload.slug = slug;
    } else if (existingSlug === null) {
      const autoSlug = normalizeSlug(nextName ?? existingName);
      if (!isValidSlug(autoSlug)) {
        return NextResponse.json(
          { error: "Workspace slug is required. Set a valid slug (3-63 lowercase chars/numbers/hyphens)." },
          { status: 400 }
        );
      }
      payload.slug = autoSlug;
    }

    if (Object.keys(payload).length === 1) {
      return NextResponse.json({ error: "No updates provided." }, { status: 400 });
    }

    const result = await admin
      .from("workspaces")
      .update(payload)
      .eq("id", resolved.id)
      .select("id,name,slug,created_by,created_at,updated_at,brand_logo_path,brand_logo_updated_at,document_tag_fields")
      .single();

    if (
      result.error &&
      (isMissingColumnError(result.error, "slug") || isMissingColumnError(result.error, "document_tag_fields"))
    ) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.document_tag_fields;

      if (slugRaw !== undefined) {
        return NextResponse.json(
          { error: "Slug support is not configured yet. Run the workspace slug migration first." },
          { status: 500 }
        );
      }

      const fallback = await admin
        .from("workspaces")
        .update(fallbackPayload)
        .eq("id", resolved.id)
        .select("id,name,created_by,created_at,updated_at,brand_logo_path,brand_logo_updated_at")
        .single();

      if (fallback.error) throw new Error(fallback.error.message);
      return NextResponse.json({ workspace: { ...(fallback.data ?? {}), slug: null, document_tag_fields: [] } });
    }

    if (result.error) {
      if (result.error.code === "23505") {
        return NextResponse.json({ error: "That slug is already taken." }, { status: 409 });
      }
      throw new Error(result.error.message);
    }

    return NextResponse.json({
      workspace: {
        ...(result.data ?? {}),
        document_tag_fields: parseDocumentTagFields(
          (result.data as { document_tag_fields?: unknown } | null)?.document_tag_fields
        ),
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

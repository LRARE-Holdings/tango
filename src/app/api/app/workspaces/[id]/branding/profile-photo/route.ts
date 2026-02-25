import { NextResponse } from "next/server";
import { AVATAR_MAX_BYTES, isAcceptedAvatarMimeType, normalizeAvatarImage } from "@/lib/avatar-image";
import { isUnauthorizedAuthError } from "@/lib/api/auth";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "workspace-branding";

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, column: string) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes(column.toLowerCase());
}

async function requireWorkspaceAdmin(workspaceIdentifier: string) {
  const resolved = await resolveWorkspaceIdentifier(workspaceIdentifier);
  if (!resolved) return { ok: false as const, status: 404, error: "Not found" };

  const supabase = await supabaseServer();
  const admin = supabaseAdmin();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) {
    return {
      ok: false as const,
      status: isUnauthorizedAuthError(userErr) ? 401 : 500,
      error: isUnauthorizedAuthError(userErr) ? "Unauthorized" : "Authentication failed.",
    };
  }
  if (!userData.user) return { ok: false as const, status: 401, error: "Unauthorized" };

  const memberRes = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", resolved.id)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (memberRes.error) return { ok: false as const, status: 500, error: memberRes.error.message };
  if (!memberRes.data || (memberRes.data.role !== "owner" && memberRes.data.role !== "admin")) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  const entitlements = await getWorkspaceEntitlementsForUser(admin, resolved.id, userData.user.id);
  if (!entitlements || !entitlements.license_active || !entitlements.workspace_plus) {
    return {
      ok: false as const,
      status: 403,
      error: "Workspace member profile photo policy is available on Team/Enterprise plans.",
    };
  }

  return { ok: true as const, supabase, admin, workspaceId: resolved.id };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = (await ctx.params) as { id: string };
  if (!id) return NextResponse.json({ error: "Invalid workspace identifier" }, { status: 400 });

  const access = await requireWorkspaceAdmin(id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return NextResponse.json({ error: "Company profile photo is too large (max 2MB)." }, { status: 400 });
  }

  if (!isAcceptedAvatarMimeType(file.type)) {
    return NextResponse.json({ error: "Company profile photo must be JPG, PNG, or WebP." }, { status: 400 });
  }

  const normalized = await normalizeAvatarImage(new Uint8Array(await file.arrayBuffer()));
  const path = `workspaces/${access.workspaceId}/profile-photo.webp`;

  const uploadRes = await access.admin.storage.from(BUCKET).upload(path, normalized, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "3600",
  });

  if (uploadRes.error) {
    return NextResponse.json({ error: uploadRes.error.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const updateRes = await access.admin
    .from("workspaces")
    .update({
      member_profile_photo_path: path,
      member_profile_photo_updated_at: now,
      updated_at: now,
    })
    .eq("id", access.workspaceId);

  if (updateRes.error) {
    if (
      isMissingColumnError(updateRes.error, "member_profile_photo_path") ||
      isMissingColumnError(updateRes.error, "member_profile_photo_updated_at")
    ) {
      return NextResponse.json(
        { error: "Workspace member profile photo fields are not configured yet. Run the latest SQL migrations first." },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: updateRes.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, member_profile_photo_updated_at: now });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = (await ctx.params) as { id: string };
  if (!id) return NextResponse.json({ error: "Invalid workspace identifier" }, { status: 400 });

  const access = await requireWorkspaceAdmin(id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const workspaceRes = await access.supabase
    .from("workspaces")
    .select("member_profile_photo_path")
    .eq("id", access.workspaceId)
    .maybeSingle();

  if (workspaceRes.error) {
    if (isMissingColumnError(workspaceRes.error, "member_profile_photo_path")) {
      return NextResponse.json(
        { error: "Workspace member profile photo fields are not configured yet. Run the latest SQL migrations first." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: workspaceRes.error.message }, { status: 500 });
  }

  const existingPath = String(
    (workspaceRes.data as { member_profile_photo_path?: string | null } | null)?.member_profile_photo_path ?? ""
  ).trim();

  if (existingPath) {
    await access.admin.storage.from(BUCKET).remove([existingPath]);
  }

  const now = new Date().toISOString();
  const updateRes = await access.admin
    .from("workspaces")
    .update({
      member_profile_photo_path: null,
      member_profile_photo_updated_at: null,
      updated_at: now,
    })
    .eq("id", access.workspaceId);

  if (updateRes.error) {
    if (
      isMissingColumnError(updateRes.error, "member_profile_photo_path") ||
      isMissingColumnError(updateRes.error, "member_profile_photo_updated_at")
    ) {
      return NextResponse.json(
        { error: "Workspace member profile photo fields are not configured yet. Run the latest SQL migrations first." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: updateRes.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

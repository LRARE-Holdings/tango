import { NextResponse } from "next/server";
import { AVATAR_MAX_BYTES, isAcceptedAvatarMimeType, normalizeAvatarImage } from "@/lib/avatar-image";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";
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

function normalizeProfilePhotoMode(value: unknown): "allow" | "disabled" | "company" {
  const normalized = String(value ?? "allow").trim().toLowerCase();
  if (normalized === "disabled" || normalized === "company") return normalized;
  return "allow";
}

async function getActiveWorkspacePolicy(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string,
  workspaceIdentifier: string | null
): Promise<"none" | "allow" | "disabled" | "company"> {
  let workspaceId: string | null = null;

  if (workspaceIdentifier) {
    try {
      const resolved = await resolveWorkspaceIdentifier(workspaceIdentifier);
      workspaceId = resolved?.id ?? null;
    } catch {
      workspaceId = null;
    }
  }

  if (!workspaceId) {
    const profileRes = await supabase
      .from("profiles")
      .select("primary_workspace_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileRes.error && !isMissingColumnError(profileRes.error, "primary_workspace_id")) {
      return "none";
    }

    workspaceId = String((profileRes.data as { primary_workspace_id?: string | null } | null)?.primary_workspace_id ?? "").trim() || null;
  }

  if (!workspaceId) return "none";

  const memberRes = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberRes.error || !memberRes.data) return "none";

  const workspaceRes = await supabase
    .from("workspaces")
    .select("member_profile_photo_mode")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceRes.error) {
    if (isMissingColumnError(workspaceRes.error, "member_profile_photo_mode")) {
      return "none";
    }
    return "none";
  }

  return normalizeProfilePhotoMode((workspaceRes.data as { member_profile_photo_mode?: unknown } | null)?.member_profile_photo_mode);
}

async function requireUser() {
  const supabase = await supabaseServer();
  const { data: userData, error: userErr } = await supabase.auth.getUser();

  if (userErr) return { ok: false as const, status: 500, error: userErr.message };
  if (!userData.user) return { ok: false as const, status: 401, error: "Unauthorized" };

  return { ok: true as const, supabase, userId: userData.user.id };
}

export async function POST(req: Request) {
  const userRes = await requireUser();
  if (!userRes.ok) return NextResponse.json({ error: userRes.error }, { status: userRes.status });

  const { supabase, userId } = userRes;
  const admin = supabaseAdmin();

  const url = new URL(req.url);
  const workspaceIdentifier = String(url.searchParams.get("workspace_id") ?? "").trim() || null;
  const activePolicy = await getActiveWorkspacePolicy(supabase, userId, workspaceIdentifier);

  if (activePolicy === "disabled") {
    return NextResponse.json(
      { error: "Profile photo uploads are disabled by your active workspace policy." },
      { status: 403 }
    );
  }

  if (activePolicy === "company") {
    return NextResponse.json(
      { error: "Your active workspace enforces a company profile photo for members." },
      { status: 403 }
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return NextResponse.json({ error: "Profile photo is too large (max 2MB)." }, { status: 400 });
  }

  if (!isAcceptedAvatarMimeType(file.type)) {
    return NextResponse.json({ error: "Profile photo must be JPG, PNG, or WebP." }, { status: 400 });
  }

  const normalized = await normalizeAvatarImage(new Uint8Array(await file.arrayBuffer()));
  const path = `users/${userId}/profile-photo.webp`;

  const uploadRes = await admin.storage.from(BUCKET).upload(path, normalized, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "3600",
  });

  if (uploadRes.error) {
    return NextResponse.json({ error: uploadRes.error.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const updateRes = await supabase
    .from("profiles")
    .update({
      profile_photo_path: path,
      profile_photo_updated_at: now,
      profile_photo_prompt_completed_at: now,
      updated_at: now,
    })
    .eq("id", userId);

  if (updateRes.error) {
    if (
      isMissingColumnError(updateRes.error, "profile_photo_path") ||
      isMissingColumnError(updateRes.error, "profile_photo_updated_at") ||
      isMissingColumnError(updateRes.error, "profile_photo_prompt_completed_at")
    ) {
      return NextResponse.json(
        { error: "Profile photo fields are not configured yet. Run the latest SQL migrations first." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: updateRes.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile_photo_updated_at: now });
}

export async function DELETE(req: Request) {
  const userRes = await requireUser();
  if (!userRes.ok) return NextResponse.json({ error: userRes.error }, { status: userRes.status });

  const { supabase, userId } = userRes;
  const admin = supabaseAdmin();

  const url = new URL(req.url);
  const workspaceIdentifier = String(url.searchParams.get("workspace_id") ?? "").trim() || null;
  const activePolicy = await getActiveWorkspacePolicy(supabase, userId, workspaceIdentifier);

  if (activePolicy === "disabled" || activePolicy === "company") {
    return NextResponse.json(
      { error: "Profile photo changes are disabled by your active workspace policy." },
      { status: 403 }
    );
  }

  const profileRes = await supabase
    .from("profiles")
    .select("profile_photo_path")
    .eq("id", userId)
    .maybeSingle();

  if (profileRes.error) {
    if (isMissingColumnError(profileRes.error, "profile_photo_path")) {
      return NextResponse.json(
        { error: "Profile photo fields are not configured yet. Run the latest SQL migrations first." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
  }

  const existingPath = String((profileRes.data as { profile_photo_path?: string | null } | null)?.profile_photo_path ?? "").trim();
  if (existingPath) {
    await admin.storage.from(BUCKET).remove([existingPath]);
  }

  const now = new Date().toISOString();
  const updateRes = await supabase
    .from("profiles")
    .update({
      profile_photo_path: null,
      profile_photo_updated_at: null,
      profile_photo_prompt_completed_at: now,
      updated_at: now,
    })
    .eq("id", userId);

  if (updateRes.error) {
    if (
      isMissingColumnError(updateRes.error, "profile_photo_path") ||
      isMissingColumnError(updateRes.error, "profile_photo_updated_at") ||
      isMissingColumnError(updateRes.error, "profile_photo_prompt_completed_at")
    ) {
      return NextResponse.json(
        { error: "Profile photo fields are not configured yet. Run the latest SQL migrations first." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: updateRes.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

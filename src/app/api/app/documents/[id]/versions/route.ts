import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api/auth";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type SourceType = "upload";
const MAX_MB = 20;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type DocumentAccessRow = {
  id: string;
  title: string;
  owner_id: string;
  workspace_id: string | null;
  file_path: string | null;
  current_version_id: string | null;
  version_count: number | null;
};

function isMissingTableError(error: { code?: string; message?: string } | null | undefined, table: string) {
  if (!error) return false;
  if (error.code === "42P01") return true;
  return String(error.message ?? "").toLowerCase().includes(table.toLowerCase());
}

function isValidVersionLabel(value: string) {
  const v = value.trim();
  // Supports: 1, 1.2, 1.2.3
  return /^\d+(?:\.\d+)*$/.test(v);
}

function isMissingVersioningSchema(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "42703" || error.code === "PGRST204") return true;
  const msg = String(error.message ?? "").toLowerCase();
  return (
    msg.includes("document_versions") ||
    msg.includes("current_version_id") ||
    msg.includes("version_label") ||
    msg.includes("schema cache")
  );
}

function isStorageAlreadyExistsError(error: { message?: string } | null | undefined) {
  const msg = String(error?.message ?? "").toLowerCase();
  return msg.includes("already exists") || msg.includes("resource already exists");
}

async function resolveDocumentForUser(documentId: string, userId: string) {
  const supabase = await supabaseServer();

  const { data: docData, error: docErr } = await supabase
    .from("documents")
    .select("id,title,owner_id,workspace_id,file_path,current_version_id,version_count")
    .eq("id", documentId)
    .maybeSingle();

  if (docErr) throw new Error(docErr.message);
  if (!docData) return { allowed: false as const, reason: "Not found" };

  const doc = docData as DocumentAccessRow;

  // Personal documents: owner only
  if (!doc.workspace_id) {
    if (doc.owner_id !== userId) return { allowed: false as const, reason: "Forbidden" };
    return { allowed: true as const, doc };
  }

  // Workspace docs: licensed owner/admin OR licensed responsible users can version
  const { data: member, error: memErr } = await supabase
    .from("workspace_members")
    .select("role,license_active")
    .eq("workspace_id", doc.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (memErr) throw new Error(memErr.message);
  if (!member) return { allowed: false as const, reason: "Forbidden" };

  const role = String((member as { role?: string }).role ?? "");
  const licenseActive = Boolean((member as { license_active?: boolean }).license_active ?? true);
  if (!licenseActive) return { allowed: false as const, reason: "Forbidden" };

  if (role === "owner" || role === "admin") {
    return { allowed: true as const, doc };
  }

  if (doc.owner_id === userId) {
    return { allowed: true as const, doc };
  }

  const { data: responsibility, error: respErr } = await supabase
    .from("document_responsibilities")
    .select("user_id")
    .eq("document_id", documentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (respErr && !isMissingTableError(respErr, "document_responsibilities")) {
    throw new Error(respErr.message);
  }
  if (!respErr && responsibility) {
    return { allowed: true as const, doc };
  }

  return { allowed: false as const, reason: "Forbidden" };
}

function resolveUploadMeta(file: File) {
  const name = (file.name || "").trim() || "upload";
  const lowerName = name.toLowerCase();
  const type = String(file.type ?? "").toLowerCase();

  const isPdf = type === "application/pdf" || lowerName.endsWith(".pdf");
  const isDocx = type === DOCX_MIME || lowerName.endsWith(".docx");
  if (!isPdf && !isDocx) {
    throw new Error("Only PDF or DOCX files are supported.");
  }

  const ext = isDocx ? "docx" : "pdf";
  const contentType = isDocx ? DOCX_MIME : "application/pdf";
  return { ext, contentType };
}

async function loadVersionBuffer(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Missing file");
  if (file.size > MAX_MB * 1024 * 1024) throw new Error(`Max file size is ${MAX_MB}MB`);
  const meta = resolveUploadMeta(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  return { ...meta, buffer, sourceFileId: "", sourceRevisionId: "", sourceUrl: "" };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = (await ctx.params) as { id: string };
    const supabase = await supabaseServer();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return authErrorResponse(userErr);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const access = await resolveDocumentForUser(id, userData.user.id);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: access.reason === "Not found" ? 404 : 403 });
    }

    const admin = supabaseAdmin();
    const versionsRes = await admin
      .from("document_versions")
      .select("id,document_id,version_number,version_label,source_type,source_file_id,source_revision_id,file_path,sha256,created_at,superseded_at")
      .eq("document_id", id)
      .order("version_number", { ascending: false });

    if (versionsRes.error) {
      if (!isMissingVersioningSchema(versionsRes.error)) {
        return NextResponse.json({ error: versionsRes.error.message }, { status: 500 });
      }

      const withoutLabel = await admin
        .from("document_versions")
        .select("id,document_id,version_number,source_type,source_file_id,source_revision_id,file_path,sha256,created_at,superseded_at")
        .eq("document_id", id)
        .order("version_number", { ascending: false });

      if (!withoutLabel.error) {
        const rows = ((withoutLabel.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
          ...r,
          version_label: String(r.version_number ?? ""),
        }));
        return NextResponse.json({
          document_id: access.doc.id,
          current_version_id: access.doc.current_version_id,
          version_count: access.doc.version_count ?? rows.length,
          versions: rows,
        });
      }

      const fallback = [
        {
          id: access.doc.current_version_id ?? `${access.doc.id}-v1`,
          document_id: access.doc.id,
          version_number: access.doc.version_count ?? 1,
          version_label: String(access.doc.version_count ?? 1),
          source_type: "upload",
          source_file_id: null,
          source_revision_id: null,
          file_path: access.doc.file_path,
          sha256: null,
          created_at: null,
          superseded_at: null,
        },
      ];
      return NextResponse.json({
        document_id: access.doc.id,
        current_version_id: access.doc.current_version_id,
        version_count: access.doc.version_count ?? 1,
        versions: fallback,
      });
    }

    return NextResponse.json({
      document_id: access.doc.id,
      current_version_id: access.doc.current_version_id,
      version_count: access.doc.version_count ?? (versionsRes.data?.length ?? 0),
      versions: versionsRes.data ?? [],
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = (await ctx.params) as { id: string };
    const supabase = await supabaseServer();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return authErrorResponse(userErr);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const access = await resolveDocumentForUser(id, userData.user.id);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: access.reason === "Not found" ? 404 : 403 });
    }

    const form = await req.formData();
    const sourceType: SourceType = "upload";
    const requestedVersionLabelRaw = String(form.get("version_number") ?? "").trim();
    const requestedVersionLabel = requestedVersionLabelRaw.length > 0 ? requestedVersionLabelRaw : null;
    if (requestedVersionLabel && !isValidVersionLabel(requestedVersionLabel)) {
      return NextResponse.json(
        { error: "Version must be numeric and may include dots (e.g. 1.2)." },
        { status: 400 }
      );
    }
    const source = await loadVersionBuffer(form);
    const sha256 = crypto.createHash("sha256").update(source.buffer).digest("hex");

    const admin = supabaseAdmin();

    const maxVersionRes = await admin
      .from("document_versions")
      .select("version_number")
      .eq("document_id", id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxVersionRes.error && isMissingVersioningSchema(maxVersionRes.error)) {
      return NextResponse.json(
        { error: "Versioning schema is not available. Run the versioning migration first." },
        { status: 500 }
      );
    }
    if (maxVersionRes.error) {
      return NextResponse.json({ error: maxVersionRes.error.message }, { status: 500 });
    }

    const nextAutoVersion = Number((maxVersionRes.data as { version_number?: number } | null)?.version_number ?? 0) + 1;
    const nextVersion = nextAutoVersion;
    const versionLabel = requestedVersionLabel ?? String(nextAutoVersion);

    if (requestedVersionLabel) {
      const existingRequested = await admin
        .from("document_versions")
        .select("id,version_label,version_number")
        .eq("document_id", id)
        .eq("version_label", requestedVersionLabel)
        .maybeSingle();
      if (existingRequested.error && !isMissingVersioningSchema(existingRequested.error)) {
        return NextResponse.json({ error: existingRequested.error.message }, { status: 500 });
      }
      if (existingRequested.data) {
        return NextResponse.json({ error: `Version v${requestedVersionLabel} already exists for this document.` }, { status: 409 });
      }
    }

    const baseFilePath = `public/${id}_v${nextVersion}.${source.ext}`;
    let filePath = baseFilePath;

    let uploadRes = await admin.storage.from("docs").upload(filePath, source.buffer, {
      contentType: source.contentType,
      upsert: false,
    });
    if (uploadRes.error && isStorageAlreadyExistsError(uploadRes.error)) {
      filePath = `public/${id}_v${nextVersion}_${Date.now()}.${source.ext}`;
      uploadRes = await admin.storage.from("docs").upload(filePath, source.buffer, {
        contentType: source.contentType,
        upsert: false,
      });
    }
    if (uploadRes.error) {
      return NextResponse.json({ error: uploadRes.error.message }, { status: 500 });
    }

    let insertVersion = await admin
      .from("document_versions")
      .insert({
        document_id: id,
        version_number: nextVersion,
        version_label: versionLabel,
        source_type: sourceType,
        source_file_id: source.sourceFileId || null,
        source_revision_id: source.sourceRevisionId || null,
        file_path: filePath,
        sha256,
        created_by: userData.user.id,
      })
      .select("id,version_number,created_at")
      .single();

    if (insertVersion.error || !insertVersion.data) {
      if (isMissingVersioningSchema(insertVersion.error)) {
        insertVersion = await admin
          .from("document_versions")
          .insert({
            document_id: id,
            version_number: nextVersion,
            source_type: sourceType,
            source_file_id: source.sourceFileId || null,
            source_revision_id: source.sourceRevisionId || null,
            file_path: filePath,
            sha256,
            created_by: userData.user.id,
          })
          .select("id,version_number,created_at")
          .single();
        if (insertVersion.error || !insertVersion.data) {
          return NextResponse.json(
            { error: insertVersion.error?.message ?? "Failed to create version" },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json({ error: insertVersion.error?.message ?? "Failed to create version" }, { status: 500 });
      }
    }

    const updateDocRes = await admin
      .from("documents")
      .update({
        current_version_id: (insertVersion.data as { id: string }).id,
        version_count: nextVersion,
        source_type: sourceType,
        sync_mode: "manual",
        source_file_id: source.sourceFileId || null,
        source_revision_id: source.sourceRevisionId || null,
        source_url: source.sourceUrl || null,
      })
      .eq("id", id);

    if (updateDocRes.error && updateDocRes.error.code !== "42703") {
      return NextResponse.json({ error: updateDocRes.error.message }, { status: 500 });
    }
    if (updateDocRes.error?.code === "42703") {
      return NextResponse.json(
        { error: "Versioning columns are not available. Run the versioning migration first." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      document_id: id,
      current_version_id: (insertVersion.data as { id: string }).id,
      version_number: nextVersion,
      version_label: versionLabel,
      source_type: sourceType,
      created_at: (insertVersion.data as { created_at: string }).created_at,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = /missing file|pdf|docx|max file size|version number/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

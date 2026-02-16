import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { accessCookieName, accessTokenFor, readCookie } from "@/lib/public-access";

type DocRow = {
  id: string;
  title: string;
  file_path: string;
  created_at: string;
  public_id: string;
  current_version_id?: string | null;
  password_enabled?: boolean | null;
  password_hash?: string | null;
  require_recipient_identity?: boolean | null;
  max_acknowledgers_enabled?: boolean | null;
  max_acknowledgers?: number | null;
  closed_at?: string | null;
};

function isMissingPasswordColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes("password_");
}

function isMissingRecipientRequirementColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes("require_recipient_identity");
}

function isMissingAcknowledgerLimitColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  const msg = String(error.message ?? "").toLowerCase();
  return msg.includes("max_acknowledgers") || msg.includes("closed_at");
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ publicId: string }> | { publicId: string } }
) {
  const { publicId } = (await ctx.params) as { publicId: string };

  const admin = supabaseAdmin();

  const withPasswordCols = await admin
    .from("documents")
    .select(
      "id,title,file_path,created_at,public_id,current_version_id,password_enabled,password_hash,require_recipient_identity,max_acknowledgers_enabled,max_acknowledgers,closed_at"
    )
    .eq("public_id", publicId)
    .maybeSingle();

  let doc = withPasswordCols.data as DocRow | null;
  let error = withPasswordCols.error;

  if (
    error &&
    (isMissingPasswordColumnError(error) ||
      isMissingRecipientRequirementColumnError(error) ||
      isMissingAcknowledgerLimitColumnError(error))
  ) {
    const fallback = await admin
      .from("documents")
      .select("id,title,file_path,created_at,public_id,current_version_id,password_enabled,password_hash,require_recipient_identity")
      .eq("public_id", publicId)
      .maybeSingle();
    doc = fallback.data as DocRow | null;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json(
      { error: "Supabase query failed", message: error.message },
      { status: 500 }
    );
  }

  if (!doc) {
    return NextResponse.json(
      { error: "No matching document", publicId },
      { status: 404 }
    );
  }

  let effectiveFilePath = doc.file_path;
  let versionNumber: number | null = null;
  let versionId: string | null = null;
  let versionSha256: string | null = null;
  if (doc.current_version_id) {
    const { data: vRow, error: vErr } = await admin
      .from("document_versions")
      .select("id,version_number,file_path,sha256")
      .eq("id", doc.current_version_id)
      .maybeSingle();
    if (!vErr && vRow) {
      effectiveFilePath = String((vRow as { file_path?: string | null }).file_path ?? effectiveFilePath);
      versionNumber = Number((vRow as { version_number?: number | null }).version_number ?? 0) || null;
      versionId = String((vRow as { id?: string }).id ?? "");
      versionSha256 = String((vRow as { sha256?: string | null }).sha256 ?? "");
    }
  }

  if (!effectiveFilePath || effectiveFilePath === "pending") {
    return NextResponse.json(
      { error: "Document has no uploaded file yet", doc },
      { status: 500 }
    );
  }

  const maxAcknowledgersEnabled = Boolean(doc.max_acknowledgers_enabled && (doc.max_acknowledgers ?? 0) > 0);
  const maxAcknowledgers = maxAcknowledgersEnabled ? Number(doc.max_acknowledgers) : null;
  const isExplicitlyClosed = Boolean(doc.closed_at);
  let isAckLimitClosed = false;

  if (maxAcknowledgersEnabled && maxAcknowledgers) {
    const { count, error: countErr } = await admin
      .from("completions")
      .select("id", { head: true, count: "exact" })
      .eq("document_id", doc.id)
      .eq("acknowledged", true);

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }
    isAckLimitClosed = (count ?? 0) >= maxAcknowledgers;
  }

  if (isExplicitlyClosed || isAckLimitClosed) {
    return NextResponse.json(
      { error: "This link is closed. It is no longer accepting acknowledgements.", closed: true },
      { status: 410 }
    );
  }

  const passwordEnabled = Boolean(doc.password_enabled && doc.password_hash);
  if (passwordEnabled) {
    const cookieName = accessCookieName(publicId);
    const cookieValue = readCookie(req.headers.get("cookie"), cookieName);
    const expected = accessTokenFor(publicId, String(doc.password_hash));
    if (!cookieValue || cookieValue !== expected) {
      return NextResponse.json({ error: "Password required", requires_password: true }, { status: 403 });
    }
  }

  const { data: signed, error: signErr } = await admin.storage
    .from("docs")
    .createSignedUrl(effectiveFilePath, 60 * 10);

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: "Could not sign URL", message: signErr?.message ?? "unknown" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    document: {
      id: doc.id,
      title: doc.title,
      created_at: doc.created_at,
      require_recipient_identity: Boolean(doc.require_recipient_identity),
      max_acknowledgers_enabled: maxAcknowledgersEnabled,
      max_acknowledgers: maxAcknowledgers,
      version_id: versionId,
      version_number: versionNumber,
      sha256: versionSha256,
    },
    signedUrl: signed.signedUrl,
  });
}

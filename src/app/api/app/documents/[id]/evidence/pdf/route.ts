import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";
import { buildDocumentEvidencePdf } from "@/lib/reports/document-evidence-report";

export const runtime = "nodejs";

type RecipientRow = {
  id: string;
  name: string | null;
  email: string | null;
};

type CompletionRow = {
  id: string;
  acknowledged: boolean | null;
  max_scroll_percent: number | null;
  time_on_page_seconds: number | null;
  active_seconds: number | null;
  submitted_at: string | null;
  ip: string | null;
  user_agent: string | null;
  recipients: RecipientRow | RecipientRow[] | null;
};

type DocumentRow = {
  id: string;
  title: string | null;
  public_id: string;
  created_at: string;
  sha256: string | null;
  workspace_id: string | null;
};

function safeFilename(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function pickOrigin(req: Request) {
  const proto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (proto && host) return `${proto}://${host}`;
  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}

async function readReceiptLogoPngBytes() {
  try {
    const receiptLogoPath = path.join(process.cwd(), "public", "receipt-logo.png");
    const file = await fs.readFile(receiptLogoPath);
    return new Uint8Array(file);
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = (await ctx.params) as { id: string };

  const supabase = await supabaseServer();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();

  const { data: docRaw, error: docErr } = await supabase
    .from("documents")
    .select("id,title,public_id,created_at,sha256,workspace_id")
    .eq("id", id)
    .maybeSingle();
  if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });
  if (!docRaw) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const doc = docRaw as DocumentRow;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

  let effectivePlan = String(profile?.plan ?? "free").toLowerCase();
  if (doc.workspace_id) {
    const workspaceEntitlements = await getWorkspaceEntitlementsForUser(
      admin,
      doc.workspace_id,
      userData.user.id
    );
    if (workspaceEntitlements && workspaceEntitlements.license_active) {
      effectivePlan = workspaceEntitlements.plan;
    } else {
      effectivePlan = "free";
    }
  }

  const watermarkEnabled = effectivePlan === "free";
  const teamBrandingEnabled = effectivePlan === "team" || effectivePlan === "enterprise";

  const { data: completionsRaw, error: compErr } = await admin
    .from("completions")
    .select(
      "id,acknowledged,max_scroll_percent,time_on_page_seconds,active_seconds,submitted_at,ip,user_agent,recipients(id,name,email)"
    )
    .eq("document_id", id)
    .order("submitted_at", { ascending: false });
  if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 });

  const completions = ((completionsRaw ?? []) as CompletionRow[]).map((row) => {
    const recipient = Array.isArray(row.recipients) ? row.recipients[0] ?? null : row.recipients ?? null;
    return {
      acknowledged: row.acknowledged === true,
      submitted_at: row.submitted_at ?? null,
      max_scroll_percent: row.max_scroll_percent ?? null,
      time_on_page_seconds: row.time_on_page_seconds ?? null,
      active_seconds: row.active_seconds ?? null,
      ip: row.ip ?? null,
      user_agent: row.user_agent ?? null,
      recipient_name: recipient?.name ?? null,
      recipient_email: recipient?.email ?? null,
    };
  });

  const origin = pickOrigin(req);
  const publicUrl = origin ? `${origin}/d/${doc.public_id}` : `/d/${doc.public_id}`;

  let workspaceName = "Receipt";
  let brandName = "Receipt";
  let brandLogoPngBytes: Uint8Array | null = null;
  let brandLogoWidthPx: number | null = null;
  if (teamBrandingEnabled && doc.workspace_id) {
    const workspaceRes = await supabase
      .from("workspaces")
      .select("name,brand_logo_path,brand_logo_width_px")
      .eq("id", doc.workspace_id)
      .maybeSingle();

    if (workspaceRes.error) {
      return NextResponse.json({ error: workspaceRes.error.message }, { status: 500 });
    }
    if (workspaceRes.data) {
      const workspace = workspaceRes.data as {
        name?: string | null;
        brand_logo_path?: string | null;
        brand_logo_width_px?: number | null;
      };
      if (typeof workspace.name === "string" && workspace.name.trim()) {
        workspaceName = workspace.name.trim();
        brandName = workspace.name.trim();
      }
      if (typeof workspace.brand_logo_width_px === "number" && Number.isFinite(workspace.brand_logo_width_px)) {
        brandLogoWidthPx = Math.max(48, Math.min(320, Math.floor(workspace.brand_logo_width_px)));
      }
      if (typeof workspace.brand_logo_path === "string" && workspace.brand_logo_path.trim()) {
        const logoDownload = await admin.storage
          .from("workspace-branding")
          .download(workspace.brand_logo_path);
        if (!logoDownload.error && logoDownload.data) {
          try {
            brandLogoPngBytes = new Uint8Array(await logoDownload.data.arrayBuffer());
          } catch {
            brandLogoPngBytes = null;
          }
        }
      }
    }
  } else if (doc.workspace_id) {
    const workspaceRes = await supabase.from("workspaces").select("name").eq("id", doc.workspace_id).maybeSingle();
    if (!workspaceRes.error) {
      const name = String((workspaceRes.data as { name?: string } | null)?.name ?? "").trim();
      if (name) workspaceName = name;
    }
  }

  try {
    const receiptLogoPngBytes = await readReceiptLogoPngBytes();
    const bytes = await buildDocumentEvidencePdf({
      reportStyleVersion: "v2",
      generatedAtIso: new Date().toISOString(),
      watermarkEnabled,
      workspaceName,
      brandName,
      brandLogoPngBytes,
      brandLogoWidthPx,
      receiptLogoPngBytes,
      document: {
        id: doc.id,
        title: doc.title?.trim() || "Untitled document",
        publicId: doc.public_id,
        createdAt: doc.created_at,
        sha256: doc.sha256 ?? null,
        publicUrl,
      },
      completions,
    });

    const filename = `receipt-record-${safeFilename(doc.title || "document")}-${doc.id}.pdf`;
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: "PDF generation failed",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}

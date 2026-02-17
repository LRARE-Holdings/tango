import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";
import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";

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
  recipients: RecipientRow | null;
};

type CompletionQueryRow = Omit<CompletionRow, "recipients"> & {
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

function formatUtc(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "-";
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : ["-"];
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
    const workspaceEntitlements = await getWorkspaceEntitlementsForUser(admin, doc.workspace_id, userData.user.id);
    if (workspaceEntitlements && workspaceEntitlements.license_active) {
      effectivePlan = workspaceEntitlements.plan;
    } else {
      effectivePlan = "free";
    }
  }

  const watermarkEnabled = effectivePlan === "free";
  const teamBrandingEnabled = effectivePlan === "team" || effectivePlan === "enterprise";

  const { data: comps, error: compErr } = await admin
    .from("completions")
    .select(
      "id,acknowledged,max_scroll_percent,time_on_page_seconds,active_seconds,submitted_at,ip,user_agent,recipients(id,name,email)"
    )
    .eq("document_id", id)
    .order("submitted_at", { ascending: false });

  if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 });

  const completions = ((comps ?? []) as CompletionQueryRow[]).map((c) => ({
    ...c,
    recipients: Array.isArray(c.recipients) ? (c.recipients[0] ?? null) : (c.recipients ?? null),
  }));
  const acknowledgements = completions.filter((c) => c.acknowledged).length;
  const latestAck = completions.find((c) => c.acknowledged && c.submitted_at)?.submitted_at ?? null;

  const origin = pickOrigin(req);
  const publicUrl = origin ? `${origin}/d/${doc.public_id}` : `/d/${doc.public_id}`;

  try {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const M = 44;
    const TOP = 48;
    const BOTTOM = 46;

    const C_TEXT = rgb(0.08, 0.1, 0.14);
    const C_MUTED = rgb(0.35, 0.39, 0.46);
    const C_LINE = rgb(0.87, 0.89, 0.92);
    const C_PANEL = rgb(0.965, 0.972, 0.985);
    const C_ACCENT = rgb(0.09, 0.25, 0.49);

    const S_TITLE = 21;
    const S_H = 10;
    const S_BODY = 10.5;
    const S_SMALL = 8.7;

    let receiptLogo: PDFImage | null = null;
    let brandLogo: PDFImage | null = null;
    let brandName = "Receipt";

    try {
      const receiptLogoPath = path.join(process.cwd(), "public", "receipt-logo.png");
      const receiptBytes = await fs.readFile(receiptLogoPath);
      receiptLogo = await pdf.embedPng(receiptBytes);
    } catch (e) {
      console.error("[receipt-pdf] receipt logo embed failed:", e);
      receiptLogo = null;
    }

    brandLogo = receiptLogo;

    if (teamBrandingEnabled && doc.workspace_id) {
      const { data: ws, error: wsErr } = await supabase
        .from("workspaces")
        .select("name,brand_logo_path")
        .eq("id", doc.workspace_id)
        .maybeSingle();

      if (!wsErr && ws) {
        if (typeof ws.name === "string" && ws.name.trim()) {
          brandName = ws.name.trim();
        }

        if (typeof ws.brand_logo_path === "string" && ws.brand_logo_path.trim()) {
          const { data: logoData, error: logoErr } = await admin.storage
            .from("workspace-branding")
            .download(ws.brand_logo_path);

          if (!logoErr && logoData) {
            try {
              const wsBytes = Buffer.from(await logoData.arrayBuffer());
              brandLogo = await pdf.embedPng(wsBytes);
            } catch (e) {
              console.error("[receipt-pdf] workspace logo embed failed:", e);
            }
          }
        }
      }
    }

    let page: PDFPage;
    let y = 0;

    function drawWatermark() {
      if (!watermarkEnabled) return;

      const angle = degrees(31);
      const text = "Generated by";
      const size = 34;
      const baseX = PAGE_W * 0.24;
      const baseY = PAGE_H * 0.36;

      page.drawText(text, {
        x: baseX,
        y: baseY,
        size,
        font: fontBold,
        color: rgb(0.62, 0.65, 0.7),
        opacity: 0.1,
        rotate: angle,
      });

      if (receiptLogo) {
        const h = 24;
        const scale = h / receiptLogo.height;
        const w = receiptLogo.width * scale;
        page.drawImage(receiptLogo, {
          x: baseX + fontBold.widthOfTextAtSize(text, size) + 12,
          y: baseY + 8,
          width: w,
          height: h,
          opacity: 0.14,
          rotate: angle,
        });
      } else {
        page.drawText("Receipt", {
          x: baseX + fontBold.widthOfTextAtSize(text, size) + 12,
          y: baseY,
          size,
          font: fontBold,
          color: rgb(0.62, 0.65, 0.7),
          opacity: 0.1,
          rotate: angle,
        });
      }
    }

    function drawHeader() {
      page.drawRectangle({
        x: 0,
        y: PAGE_H - 78,
        width: PAGE_W,
        height: 78,
        color: C_PANEL,
      });

      const logoX = M;
      const logoTopY = PAGE_H - 22;

      if (brandLogo) {
        const targetH = 20;
        const scale = targetH / brandLogo.height;
        const targetW = brandLogo.width * scale;
        page.drawImage(brandLogo, {
          x: logoX,
          y: logoTopY - targetH,
          width: targetW,
          height: targetH,
        });
      } else {
        page.drawText(brandName, {
          x: logoX,
          y: logoTopY - 13,
          size: 13,
          font: fontBold,
          color: C_TEXT,
        });
      }

      const generatedAt = `Generated ${formatUtc(new Date().toISOString())}`;
      const genW = font.widthOfTextAtSize(generatedAt, S_SMALL);
      page.drawText(generatedAt, {
        x: PAGE_W - M - genW,
        y: PAGE_H - 47,
        size: S_SMALL,
        font,
        color: C_MUTED,
      });

      page.drawText("Evidence Record", {
        x: M,
        y: PAGE_H - 60,
        size: 9,
        font: fontBold,
        color: C_ACCENT,
      });

      page.drawLine({
        start: { x: M, y: PAGE_H - 79 },
        end: { x: PAGE_W - M, y: PAGE_H - 79 },
        thickness: 1,
        color: C_LINE,
      });

      y = PAGE_H - TOP - 48;
    }

    function addPage() {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      drawWatermark();
      drawHeader();
    }

    function ensure(h: number) {
      if (y - h < BOTTOM) addPage();
    }

    function text(str: string, x: number, yPos: number, opts?: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> }) {
      page.drawText(str, {
        x,
        y: yPos,
        font: opts?.bold ? fontBold : font,
        size: opts?.size ?? S_BODY,
        color: opts?.color ?? C_TEXT,
      });
    }

    function section(label: string, subtitle?: string) {
      ensure(34);
      text(label.toUpperCase(), M, y, { bold: true, size: S_H, color: C_ACCENT });
      y -= 14;
      if (subtitle) {
        text(subtitle, M, y, { size: S_SMALL, color: C_MUTED });
        y -= 14;
      }
      page.drawLine({
        start: { x: M, y: y + 3 },
        end: { x: PAGE_W - M, y: y + 3 },
        thickness: 1,
        color: C_LINE,
      });
      y -= 11;
    }

    function kv(label: string, value: string) {
      ensure(18);
      const leftW = 140;
      text(label, M, y, { bold: true, size: S_BODY });
      const lines = wrapText(value, PAGE_W - M * 2 - leftW, font, S_BODY);
      for (const line of lines) {
        text(line, M + leftW, y, { size: S_BODY });
        y -= 13.5;
      }
      y -= 3;
    }

    function metricCard(x: number, yTop: number, w: number, h: number, label: string, value: string) {
      page.drawRectangle({
        x,
        y: yTop - h,
        width: w,
        height: h,
        color: rgb(1, 1, 1),
        borderColor: C_LINE,
        borderWidth: 1,
      });
      text(label, x + 10, yTop - 14, { size: 8.5, bold: true, color: C_MUTED });
      text(value, x + 10, yTop - 33, { size: 12, bold: true, color: C_TEXT });
    }

    function completionCard(c: CompletionRow) {
      const h = 126;
      ensure(h + 8);

      page.drawRectangle({
        x: M,
        y: y - h,
        width: PAGE_W - M * 2,
        height: h,
        color: rgb(1, 1, 1),
        borderColor: C_LINE,
        borderWidth: 1,
      });

      const who = c.recipients?.name?.trim() || c.recipients?.email?.trim() || "Recipient";
      const whoSecondary = c.recipients?.name && c.recipients?.email ? c.recipients.email : null;

      text(who, M + 12, y - 19, { bold: true, size: 11.4 });
      if (whoSecondary) {
        text(whoSecondary, M + 12, y - 33, { size: 9.4, color: C_MUTED });
      }

      const ackText = c.acknowledged ? "Acknowledged" : "Not acknowledged";
      const ackW = fontBold.widthOfTextAtSize(ackText, 9.5);
      text(ackText, PAGE_W - M - 12 - ackW, y - 20, { bold: true, size: 9.5, color: C_ACCENT });

      text(`Submitted: ${formatUtc(c.submitted_at)}`, M + 12, y - 46, { size: 8.8, color: C_MUTED });

      const col1 = M + 12;
      const col2 = M + 12 + (PAGE_W - M * 2 - 24) / 2;
      const r1 = y - 66;
      const r2 = y - 89;
      const r3 = y - 111;

      text("Scroll depth", col1, r1, { size: 8.6, color: C_MUTED });
      text(c.max_scroll_percent == null ? "-" : `${c.max_scroll_percent}%`, col1, r1 - 12, { bold: true, size: 9.8 });

      text("Time on page", col2, r1, { size: 8.6, color: C_MUTED });
      text(formatDuration(c.time_on_page_seconds), col2, r1 - 12, { bold: true, size: 9.8 });

      text("Active time", col1, r2, { size: 8.6, color: C_MUTED });
      text(formatDuration(c.active_seconds), col1, r2 - 12, { bold: true, size: 9.8 });

      text("IP address", col2, r2, { size: 8.6, color: C_MUTED });
      text(c.ip ?? "-", col2, r2 - 12, { bold: true, size: 9.8 });

      const uaLine = wrapText(c.user_agent ?? "-", PAGE_W - M * 2 - 24, font, 8.8)[0] ?? "-";
      text("User agent (truncated)", col1, r3, { size: 8.2, color: C_MUTED });
      text(uaLine, col1, r3 - 11.5, { size: 8.8, color: C_TEXT });

      y -= h + 10;
    }

    addPage();

    ensure(92);
    text(doc.title?.trim() || "Untitled document", M, y, { bold: true, size: S_TITLE });
    y -= 20;
    text("Neutral evidence of delivery, review activity, and acknowledgement.", M, y, {
      size: 9.2,
      color: C_MUTED,
    });
    y -= 20;

    const cardY = y;
    const gap = 10;
    const w = (PAGE_W - M * 2 - gap * 2) / 3;
    const h = 46;

    metricCard(M, cardY, w, h, "STATUS", acknowledgements > 0 ? "Acknowledged" : "Pending");
    metricCard(M + w + gap, cardY, w, h, "ACKNOWLEDGEMENTS", String(acknowledgements));
    metricCard(M + (w + gap) * 2, cardY, w, h, "LATEST ACK", formatUtc(latestAck));
    y -= h + 14;

    section("Document", "Reference and integrity fields");
    kv("Public link", publicUrl);
    kv("Record ID", doc.id);
    kv("Created", formatUtc(doc.created_at));
    kv("Document hash (SHA-256)", doc.sha256 ?? "-");

    section("Completions", `${completions.length} total submission${completions.length === 1 ? "" : "s"}`);

    if (completions.length === 0) {
      ensure(20);
      text("No completions recorded yet.", M, y, { size: S_BODY, color: C_MUTED });
      y -= 16;
    } else {
      for (const c of completions) completionCard(c);
    }

    const pdfPages = pdf.getPages();
    for (let i = 0; i < pdfPages.length; i += 1) {
      const p = pdfPages[i];
      const label = `Page ${i + 1} of ${pdfPages.length}`;
      const labelW = font.widthOfTextAtSize(label, 8.8);

      p.drawLine({
        start: { x: M, y: 34 },
        end: { x: PAGE_W - M, y: 34 },
        thickness: 1,
        color: C_LINE,
      });

      p.drawText("Receipt Evidence Document", {
        x: M,
        y: 21,
        size: 8.6,
        font,
        color: C_MUTED,
      });

      p.drawText(label, {
        x: PAGE_W - M - labelW,
        y: 21,
        size: 8.8,
        font,
        color: C_MUTED,
      });
    }

    pdf.setTitle("Receipt Evidence Record");
    pdf.setProducer("Receipt");
    pdf.setCreator("Receipt");

    const bytes = await pdf.save();
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
    console.error("[receipt-pdf] generation failed:", e);
    return NextResponse.json(
      {
        error: "PDF generation failed",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}

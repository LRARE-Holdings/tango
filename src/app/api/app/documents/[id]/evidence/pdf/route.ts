import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { PDFDocument, StandardFonts } from "pdf-lib";

function safeFilename(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function formatUtc(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

function wrapText(text: string, maxWidth: number, font: any, fontSize: number) {
  const words = text.split(/\s+/);
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
  return lines;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = (await ctx.params) as { id: string };

  const supabase = await supabaseServer();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id,title,public_id,file_path,created_at,sha256")
    .eq("id", id)
    .maybeSingle();

  if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: comps, error: compErr } = await admin
    .from("completions")
    .select(
      "id,acknowledged,max_scroll_percent,time_on_page_seconds,submitted_at,ip,user_agent,recipients(id,name,email)"
    )
    .eq("document_id", id)
    .order("submitted_at", { ascending: false });

  if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 });

  const completions = (comps ?? []) as any[];

  const acknowledgements = completions.filter((c) => c.acknowledged).length;
  const latest = completions.find((c) => c.acknowledged && c.submitted_at)?.submitted_at ?? null;

  // -------- Build PDF --------
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  const lineGap = 14;

  let page = pdf.addPage();
  let { width, height } = page.getSize();
  let y = height - margin;

  const draw = (text: string, opts?: { bold?: boolean; size?: number }) => {
    const size = opts?.size ?? 11;
    const usedFont = opts?.bold ? fontBold : font;

    // page break
    if (y < margin + 40) {
      page = pdf.addPage();
      ({ width, height } = page.getSize());
      y = height - margin;
    }

    page.drawText(text, {
      x: margin,
      y,
      size,
      font: usedFont,
    });
    y -= lineGap;
  };

  const drawDivider = () => {
    y -= 6;
    if (y < margin + 20) {
      page = pdf.addPage();
      ({ width, height } = page.getSize());
      y = height - margin;
    }
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
    });
    y -= 12;
  };

  draw("receipt", { bold: true, size: 16 });
  draw("Receipt Record", { bold: true, size: 22 });
  draw(`Generated: ${formatUtc(new Date().toISOString())}`);
  drawDivider();

  // Document section
  draw("DOCUMENT", { bold: true });
  draw(`Title: ${doc.title ?? "Untitled"}`);
  draw(`Document ID: ${doc.id}`);
  draw(`Public link: /d/${doc.public_id}`);
  draw(`Created: ${formatUtc(doc.created_at)}`);
  draw(`Status: ${acknowledgements > 0 ? "Acknowledged" : "Pending"}`);
  draw(`Acknowledgements: ${acknowledgements}`);
  draw(`Latest acknowledgement: ${formatUtc(latest)}`);
  draw(`Storage path: ${doc.file_path ?? "—"}`);
  draw(`SHA256: ${doc.sha256 ?? "—"}`);
  drawDivider();

  // Completions section
  draw("COMPLETIONS", { bold: true });
  draw(`Total: ${completions.length}`);
  y -= 6;

  if (completions.length === 0) {
    draw("No acknowledgements recorded.");
  } else {
    for (const c of completions) {
      const who =
        c.recipients?.name?.trim() ||
        c.recipients?.email?.trim() ||
        "Recipient";

      drawDivider();
      draw(`${who}`, { bold: true });
      if (c.recipients?.email && c.recipients?.name) draw(`Email: ${c.recipients.email}`);
      draw(`Submitted: ${formatUtc(c.submitted_at ?? null)}`);
      draw(`Acknowledged: ${c.acknowledged ? "Yes" : "No"}`);
      draw(`Scroll depth: ${c.max_scroll_percent == null ? "—" : `${c.max_scroll_percent}%`}`);
      draw(`Time on page: ${formatDuration(c.time_on_page_seconds ?? null)}`);
      draw(`IP: ${c.ip ?? "—"}`);

      const ua = (c.user_agent ?? "—").toString();
      const lines = wrapText(`User agent: ${ua}`, width - margin * 2, font, 10);
      for (const ln of lines) {
        draw(ln, { size: 10 });
      }
    }
    drawDivider();
  }

  // Footer / disclaimer
  draw("DISCLAIMER", { bold: true });
  draw(
    "Receipt records access, review activity, and acknowledgement. It does not assess understanding and is not an e-signature product."
  );

  const bytes = await pdf.save();

  const filename = `receipt-record-${safeFilename(doc.title || "document")}-${doc.id}.pdf`;

  const pages = pdf.getPages();
  const footerSize = 9;

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const { width } = p.getSize();
    const label = `Page ${i + 1} of ${pages.length}`;
    const w = font.widthOfTextAtSize(label, footerSize);

    p.drawText(label, {
      x: width - 50 - w,
      y: 30,
      size: footerSize,
      font,
    });
  }

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
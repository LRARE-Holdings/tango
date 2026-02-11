import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const OUTPUT = path.join(process.cwd(), "Receipt-Product-Overview.pdf");
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN_X = 48;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 44;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const colors = {
  bgSoft: rgb(0.965, 0.968, 0.975),
  ink: rgb(0.08, 0.1, 0.14),
  muted: rgb(0.35, 0.39, 0.45),
  lightLine: rgb(0.86, 0.88, 0.91),
  accent: rgb(0.11, 0.24, 0.46),
  white: rgb(1, 1, 1),
};

const pages = [];

function wrap(font, size, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let line = "";
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      line = trial;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawParagraph(page, font, size, text, x, y, width, color = colors.ink, leading = 1.35) {
  const lines = wrap(font, size, text, width);
  const lineH = size * leading;
  let cursor = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cursor, size, font, color });
    cursor -= lineH;
  }
  return cursor;
}

function drawBullets(page, bodyFont, textSize, items, x, y, width) {
  let cursor = y;
  for (const item of items) {
    page.drawCircle({ x: x + 2.2, y: cursor + 4.8, size: 1.75, color: colors.accent });
    cursor = drawParagraph(page, bodyFont, textSize, item, x + 10, cursor, width - 10);
    cursor -= 7;
  }
  return cursor;
}

function footer(page, bodyFont, pageNum) {
  page.drawLine({
    start: { x: MARGIN_X, y: MARGIN_BOTTOM - 8 },
    end: { x: PAGE_W - MARGIN_X, y: MARGIN_BOTTOM - 8 },
    color: colors.lightLine,
    thickness: 1,
  });
  page.drawText(`Receipt Product Overview`, {
    x: MARGIN_X,
    y: MARGIN_BOTTOM - 24,
    size: 8.5,
    font: bodyFont,
    color: colors.muted,
  });
  page.drawText(`Page ${pageNum} of 5`, {
    x: PAGE_W - MARGIN_X - 52,
    y: MARGIN_BOTTOM - 24,
    size: 8.5,
    font: bodyFont,
    color: colors.muted,
  });
}

async function main() {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let logo = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "receipt-logo.png");
    const bytes = await fs.readFile(logoPath);
    logo = await pdf.embedPng(bytes);
  } catch {
    logo = null;
  }

  // PAGE 1: Cover + Executive Summary
  {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    pages.push(page);

    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: colors.bgSoft });
    page.drawRectangle({
      x: 0,
      y: PAGE_H - 240,
      width: PAGE_W,
      height: 240,
      color: colors.white,
    });

    if (logo) {
      const h = 32;
      const scale = h / logo.height;
      page.drawImage(logo, {
        x: MARGIN_X,
        y: PAGE_H - 74,
        width: logo.width * scale,
        height: h,
      });
    } else {
      page.drawText("Receipt", {
        x: MARGIN_X,
        y: PAGE_H - 64,
        size: 24,
        font: bold,
        color: colors.ink,
      });
    }

    page.drawText("Product Overview", {
      x: MARGIN_X,
      y: PAGE_H - 138,
      size: 36,
      font: bold,
      color: colors.ink,
    });
    page.drawText("Commercial briefing for enterprise and regulated teams", {
      x: MARGIN_X,
      y: PAGE_H - 167,
      size: 12.5,
      font: regular,
      color: colors.muted,
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    page.drawText(`Generated ${dateStr}`, {
      x: MARGIN_X,
      y: PAGE_H - 190,
      size: 10,
      font: regular,
      color: colors.muted,
    });

    let y = PAGE_H - 286;
    page.drawText("What Receipt does", {
      x: MARGIN_X,
      y,
      size: 15,
      font: bold,
      color: colors.accent,
    });
    y -= 24;

    y = drawParagraph(
      page,
      regular,
      11,
      "Receipt creates a neutral, file-ready record showing document delivery, access activity, review behavior, and acknowledgement for shared PDFs.",
      MARGIN_X,
      y,
      CONTENT_W
    );
    y -= 14;

    page.drawText("Why commercial buyers choose it", {
      x: MARGIN_X,
      y,
      size: 15,
      font: bold,
      color: colors.accent,
    });
    y -= 22;

    y = drawBullets(page, regular, 10.5, [
      "Recipient experience is frictionless: one link, no account required.",
      "Outputs are consistent and export-ready (JSON and PDF evidence packs).",
      "Platform claims are deliberately restrained for regulated and risk-sensitive workflows.",
      "Security controls include optional IP capture, password-protected links, and document hashing.",
      "Scales from individual professionals to multi-workspace teams with role-based controls.",
    ], MARGIN_X, y, CONTENT_W);

    footer(page, regular, 1);
  }

  // PAGE 2: Core Product and Workflow
  {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    let y = PAGE_H - MARGIN_TOP;

    page.drawText("Core Product Workflow", {
      x: MARGIN_X,
      y,
      size: 22,
      font: bold,
      color: colors.ink,
    });
    y -= 30;
    y = drawParagraph(
      page,
      regular,
      11,
      "Receipt follows a simple operational model: Share -> Review -> Acknowledge. Each step contributes observable evidence to a neutral activity record.",
      MARGIN_X,
      y,
      CONTENT_W,
      colors.muted
    );
    y -= 20;

    const cardW = (CONTENT_W - 16) / 3;
    const top = y;
    const cardH = 188;
    const cards = [
      {
        title: "1. Share",
        lines: [
          "Upload PDF document",
          "Generate public link",
          "Optional email delivery",
          "Optional password gate",
          "Optional recipient identity requirement",
        ],
      },
      {
        title: "2. Review",
        lines: [
          "Tracks first/open activity",
          "Captures max scroll percent",
          "Captures time on page",
          "Captures active seconds",
          "Optionally stores IP and user agent",
        ],
      },
      {
        title: "3. Acknowledge",
        lines: [
          "Recipient submits acknowledgement",
          "Submission timestamp logged",
          "Recipient metadata attached",
          "Record status updates (Pending/Acknowledged)",
          "Evidence export available immediately",
        ],
      },
    ];

    for (let i = 0; i < cards.length; i += 1) {
      const x = MARGIN_X + i * (cardW + 8);
      page.drawRectangle({
        x,
        y: top - cardH,
        width: cardW,
        height: cardH,
        borderColor: colors.lightLine,
        borderWidth: 1,
        color: colors.white,
      });
      page.drawText(cards[i].title, {
        x: x + 10,
        y: top - 24,
        size: 12.5,
        font: bold,
        color: colors.accent,
      });
      drawBullets(page, regular, 9.5, cards[i].lines, x + 8, top - 44, cardW - 14);
    }

    y = top - cardH - 26;
    page.drawText("Evidence fields captured per completion", {
      x: MARGIN_X,
      y,
      size: 14,
      font: bold,
      color: colors.ink,
    });
    y -= 20;
    y = drawBullets(
      page,
      regular,
      10.5,
      [
        "submitted_at, acknowledged, recipient name/email (when required)",
        "max_scroll_percent, time_on_page_seconds, active_seconds",
        "ip and user_agent (optional capture based on policy)",
        "document linkage, public ID, and SHA-256 document hash",
      ],
      MARGIN_X,
      y,
      CONTENT_W
    );

    footer(page, regular, 2);
  }

  // PAGE 3: Team Operations and Administration
  {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    let y = PAGE_H - MARGIN_TOP;

    page.drawText("Team Operations and Governance", {
      x: MARGIN_X,
      y,
      size: 22,
      font: bold,
      color: colors.ink,
    });
    y -= 30;

    const leftW = 250;
    const rightX = MARGIN_X + leftW + 16;
    const rightW = CONTENT_W - leftW - 16;

    page.drawRectangle({
      x: MARGIN_X,
      y: y - 330,
      width: leftW,
      height: 330,
      color: colors.white,
      borderColor: colors.lightLine,
      borderWidth: 1,
    });
    page.drawText("Workspace Controls", {
      x: MARGIN_X + 12,
      y: y - 22,
      size: 13.5,
      font: bold,
      color: colors.accent,
    });
    drawBullets(
      page,
      regular,
      10,
      [
        "Workspace-level document catalogue with search by title or public ID",
        "Role model: owner, admin, member",
        "Invite workflow via email templates",
        "Role-change and removal safeguards (including owner-protection rules)",
        "Workspace slug and branded logo controls",
        "Custom domain onboarding with DNS TXT verification",
      ],
      MARGIN_X + 12,
      y - 42,
      leftW - 24
    );

    page.drawRectangle({
      x: rightX,
      y: y - 160,
      width: rightW,
      height: 160,
      color: colors.white,
      borderColor: colors.lightLine,
      borderWidth: 1,
    });
    page.drawText("Dashboard Signals", {
      x: rightX + 12,
      y: y - 22,
      size: 13.5,
      font: bold,
      color: colors.accent,
    });
    drawBullets(
      page,
      regular,
      10,
      [
        "Counts: documents, pending items, acknowledgements, completions",
        "Average engagement metrics across recent completions",
        "Pending queue and recent activity feed for operational follow-up",
      ],
      rightX + 12,
      y - 42,
      rightW - 24
    );

    page.drawRectangle({
      x: rightX,
      y: y - 330,
      width: rightW,
      height: 150,
      color: colors.white,
      borderColor: colors.lightLine,
      borderWidth: 1,
    });
    page.drawText("Output and Export", {
      x: rightX + 12,
      y: y - 182,
      size: 13.5,
      font: bold,
      color: colors.accent,
    });
    drawBullets(
      page,
      regular,
      10,
      [
        "Per-document record view with timeline of recipient completions",
        "One-click JSON export using schema receipt.evidence.v1",
        "One-click PDF evidence pack for filing or distribution",
        "Signed URL retrieval for secure PDF rendering",
      ],
      rightX + 12,
      y - 202,
      rightW - 24
    );

    footer(page, regular, 3);
  }

  // PAGE 4: Security Posture and Product Boundaries
  {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    let y = PAGE_H - MARGIN_TOP;

    page.drawText("Security, Privacy, and Risk Boundaries", {
      x: MARGIN_X,
      y,
      size: 22,
      font: bold,
      color: colors.ink,
    });
    y -= 28;
    y = drawParagraph(
      page,
      regular,
      11,
      "Receipt is designed as a focused evidence utility. Its commercial strength is clarity: record observable events accurately and avoid overstated claims.",
      MARGIN_X,
      y,
      CONTENT_W,
      colors.muted
    );
    y -= 22;

    page.drawText("Positive controls", {
      x: MARGIN_X,
      y,
      size: 14,
      font: bold,
      color: colors.accent,
    });
    y -= 20;
    y = drawBullets(
      page,
      regular,
      10.5,
      [
        "Password-protected public links supported on paid plans",
        "Rate limiting on password attempts (windowed lockout behavior)",
        "HMAC-based access token cookie model for protected links",
        "Optional IP and user-agent capture to meet evidence policy needs",
        "Document integrity captured via SHA-256 hash",
        "Role-gated administrative actions for workspace settings and membership",
      ],
      MARGIN_X,
      y,
      CONTENT_W
    );
    y -= 8;

    page.drawText("Explicit product boundaries", {
      x: MARGIN_X,
      y,
      size: 14,
      font: bold,
      color: colors.accent,
    });
    y -= 20;
    y = drawBullets(
      page,
      regular,
      10.5,
      [
        "Not an e-signature platform",
        "Does not verify identity by default",
        "Does not infer intent, understanding, or legal consent",
        "No AI interpretation layer in the evidence model",
        "Designed to sit alongside specialist tools when identity/signature workflows are required",
      ],
      MARGIN_X,
      y,
      CONTENT_W
    );

    page.drawRectangle({
      x: MARGIN_X,
      y: 140,
      width: CONTENT_W,
      height: 86,
      color: colors.bgSoft,
      borderColor: colors.lightLine,
      borderWidth: 1,
    });
    page.drawText("Commercial implication", {
      x: MARGIN_X + 14,
      y: 206,
      size: 12.5,
      font: bold,
      color: colors.ink,
    });
    drawParagraph(
      page,
      regular,
      10.5,
      "For regulated buyers, this boundary-first approach reduces procurement friction and legal ambiguity. Receipt evidences process execution without making unverifiable claims.",
      MARGIN_X + 14,
      188,
      CONTENT_W - 28,
      colors.ink
    );

    footer(page, regular, 4);
  }

  // PAGE 5: Packaging and Client Fit
  {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    let y = PAGE_H - MARGIN_TOP;

    page.drawText("Commercial Packaging and Fit", {
      x: MARGIN_X,
      y,
      size: 22,
      font: bold,
      color: colors.ink,
    });
    y -= 30;

    page.drawText("Plan structure (current product configuration)", {
      x: MARGIN_X,
      y,
      size: 13.5,
      font: bold,
      color: colors.accent,
    });
    y -= 22;

    const tableX = MARGIN_X;
    const rowH = 31;
    const colW = [120, 120, 255];
    const rows = [
      ["Free", "10 documents total", "Core link sharing, delivery/access tracking, basic exports"],
      ["Personal", "100 documents / month", "Adds password protection and email sending"],
      ["Pro", "500 documents / month", "Adds saved recipients, templates/defaults, priority support"],
      ["Team", "1000 + 200/seat / month", "Workspace admin roles, shared defaults, governance controls"],
      ["Enterprise", "Custom", "Procurement, invoicing, tailored governance and support scope"],
    ];

    page.drawRectangle({
      x: tableX,
      y: y - rowH,
      width: colW[0] + colW[1] + colW[2],
      height: rowH,
      color: colors.bgSoft,
      borderColor: colors.lightLine,
      borderWidth: 1,
    });
    const headers = ["Plan", "Volume", "Commercial value"];
    let hx = tableX + 10;
    for (let i = 0; i < headers.length; i += 1) {
      page.drawText(headers[i], { x: hx, y: y - 20, size: 10.5, font: bold, color: colors.ink });
      hx += colW[i];
    }

    let ty = y - rowH;
    for (const row of rows) {
      ty -= rowH;
      page.drawRectangle({
        x: tableX,
        y: ty,
        width: colW[0] + colW[1] + colW[2],
        height: rowH,
        borderColor: colors.lightLine,
        borderWidth: 1,
        color: colors.white,
      });
      page.drawText(row[0], { x: tableX + 10, y: ty + 10, size: 10, font: bold, color: colors.ink });
      page.drawText(row[1], { x: tableX + colW[0] + 10, y: ty + 10, size: 9.8, font: regular, color: colors.ink });
      drawParagraph(
        page,
        regular,
        9.8,
        row[2],
        tableX + colW[0] + colW[1] + 10,
        ty + 14,
        colW[2] - 16
      );
    }

    y = ty - 26;
    page.drawText("Best-fit use cases", {
      x: MARGIN_X,
      y,
      size: 13.5,
      font: bold,
      color: colors.accent,
    });
    y -= 20;
    y = drawBullets(
      page,
      regular,
      10.5,
      [
        "Client care letters and policy updates where evidence of review is needed",
        "Terms or notice rollouts requiring clean audit trails",
        "Internal communications where acknowledgement status drives follow-up",
        "Teams that need practical evidence records without signature-system complexity",
      ],
      MARGIN_X,
      y,
      CONTENT_W
    );
    y -= 8;

    page.drawText("Next commercial step", {
      x: MARGIN_X,
      y,
      size: 13.5,
      font: bold,
      color: colors.accent,
    });
    y -= 18;
    drawParagraph(
      page,
      regular,
      10.5,
      "For enterprise prospects, scope plan, seat model, governance controls, and data handling requirements against your procurement checklist, then run a controlled pilot using one target document workflow.",
      MARGIN_X,
      y,
      CONTENT_W
    );

    footer(page, regular, 5);
  }

  const bytes = await pdf.save();
  await fs.writeFile(OUTPUT, bytes);
  console.log(`Wrote ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

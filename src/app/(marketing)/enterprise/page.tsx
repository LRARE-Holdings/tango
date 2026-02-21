import type { Metadata } from "next";
import { buildMarketingMetadata } from "@/lib/seo";
import { redirect } from "next/navigation";
import { sendWithResend } from "@/lib/email/resend";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Enterprise",
  description:
    "Enterprise Receipt plans for organisations that need governance controls, procurement-ready terms and audit-friendly workflows.",
  path: "/enterprise",
  keywords: [
    "enterprise compliance software",
    "policy acknowledgement platform",
    "governance controls",
  ],
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function submitEnterpriseEnquiry(formData: FormData) {
  "use server";
  const payload = {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    company: String(formData.get("company") ?? "").trim(),
    seats: String(formData.get("seats") ?? "").trim(),
    message: String(formData.get("message") ?? "").trim(),
    source: String(formData.get("source") ?? "enterprise").trim(),
    createdAt: new Date().toISOString(),
  };

  if (!payload.name || !payload.email || !payload.company || !payload.message) {
    redirect("/enterprise?enquiry=invalid");
  }

  const inquiryDestination = String(
    process.env.RECEIPT_ENTERPRISE_INBOX || process.env.RECEIPT_FROM_EMAIL || ""
  ).trim();
  if (!inquiryDestination) {
    redirect("/enterprise?enquiry=error");
  }

  const subject = `Enterprise enquiry: ${payload.company}`;
  const text = `New enterprise enquiry

Name: ${payload.name}
Email: ${payload.email}
Company: ${payload.company}
Seats: ${payload.seats || "Not specified"}
Source: ${payload.source}
Created at: ${payload.createdAt}

Message:
${payload.message}
`;

  const safe = {
    name: escapeHtml(payload.name),
    email: escapeHtml(payload.email),
    company: escapeHtml(payload.company),
    seats: escapeHtml(payload.seats || "Not specified"),
    source: escapeHtml(payload.source),
    createdAt: escapeHtml(payload.createdAt),
    message: escapeHtml(payload.message),
  };

  const html = `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#111;">
    <h2 style="margin:0 0 12px;">New enterprise enquiry</h2>
    <p><strong>Name:</strong> ${safe.name}</p>
    <p><strong>Email:</strong> ${safe.email}</p>
    <p><strong>Company:</strong> ${safe.company}</p>
    <p><strong>Seats:</strong> ${safe.seats}</p>
    <p><strong>Source:</strong> ${safe.source}</p>
    <p><strong>Created at:</strong> ${safe.createdAt}</p>
    <p><strong>Message:</strong></p>
    <pre style="white-space:pre-wrap;background:#f7f7f8;padding:12px;border-radius:8px;">${safe.message}</pre>
  </div>`;

  const sent = await sendWithResend({
    to: inquiryDestination,
    subject,
    html,
    text,
  });

  redirect(sent.ok ? "/enterprise?enquiry=sent" : "/enterprise?enquiry=error");
}
export default async function EnterprisePage({
  searchParams,
}: {
  searchParams?: Promise<{ enquiry?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const enquiryParam = Array.isArray(params.enquiry) ? params.enquiry[0] : params.enquiry;
  const enquiryState = typeof enquiryParam === "string" ? enquiryParam : "";

  return (
    <main className="min-h-screen bg-[var(--mk-bg)] text-[var(--mk-fg)]">
      {/* background texture */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 marketing-glow" />
        <div className="absolute inset-0 " />
      </div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
            ENTERPRISE
          </div>
          <h1 className="marketing-hero mt-2 text-4xl sm:text-5xl">
            For organisations that need clarity, control, and custom terms.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[var(--mk-muted)]">
            Enterprise plans are designed for firms with procurement
            requirements, bespoke workflows, or enhanced governance needs. We
            scope these properly, no generic bundles, no vague promises.
          </p>
        </div>
      </section>
      {/* Who it's for */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              t: "Larger teams",
              b: "Multiple departments or practice groups with shared governance and oversight.",
            },
            {
              t: "Procurement-led buyers",
              b: "Organisations that require contracts, security review, and predictable billing.",
            },
            {
              t: "Regulated environments",
              b: "Firms that need clear boundaries, audit-friendly records, and restrained claims.",
            },
          ].map((x) => (
            <div
              key={x.t}
              className="rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-5 shadow-sm "
            >
              <div className="text-sm font-semibold">{x.t}</div>
              <div className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
                {x.b}
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* What you get */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="rounded-3xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-6 shadow-sm md:p-8">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight">
              What Enterprise typically includes
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
              Final scope depends on your requirements, but Enterprise plans
              often include:
            </p>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              "Custom seat counts and pricing structure",
              "Contractual terms and invoicing (no card-only billing)",
              "Advanced governance and admin controls",
              "Organisation-wide defaults and branding",
              "Security and data handling documentation",
              "Priority support and escalation path",
            ].map((b) => (
              <div
                key={b}
                className="flex gap-3 rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface-soft)] p-4 text-sm text-[var(--mk-muted)] "
              >
                <span className="mt-1.75 inline-block h-1.5 w-1.5 rounded-full bg-[var(--mk-muted-2)]" />
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* What it is not */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="rounded-3xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-semibold tracking-tight">
            What Enterprise is not
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--mk-muted)]">
            We’re explicit about this to avoid mismatched expectations.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              "Not an e-signature or consent platform",
              "Not a system that infers intent or understanding",
              "Not a generic AI-powered analysis tool",
            ].map((b) => (
              <div
                key={b}
                className="rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface-soft)] p-4 text-sm text-[var(--mk-muted)] "
              >
                {b}
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Contact */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-3xl border border-[var(--mk-border)] bg-linear-to-b bg-[var(--mk-surface-alt)] p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight">
                Talk to us about Enterprise
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--mk-muted)]">
                Tell us a little about your organisation and what you need.
                We’ll respond with clarity, not a hard sell.
              </p>
            </div>
            <div className="w-full md:max-w-md">
              <form className="space-y-3" action={submitEnterpriseEnquiry}>
                <input type="hidden" name="source" value="enterprise" />
                {enquiryState === "sent" ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    Thanks. Your enquiry has been sent and we will respond shortly.
                  </div>
                ) : null}
                {enquiryState === "invalid" ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Please complete all required fields before sending your enquiry.
                  </div>
                ) : null}
                {enquiryState === "error" ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    We could not send your enquiry right now. Please email legal@lrare.co.uk.
                  </div>
                ) : null}
                <input
                  className="w-full rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] px-4 py-3 text-sm text-[var(--mk-fg)] outline-none placeholder:text-[var(--mk-muted-2)] focus:ring-2 focus:ring-[var(--mk-fg)]/20"
                  placeholder="Name"
                  name="name"
                  required
                />
                <input
                  type="email"
                  className="w-full rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] px-4 py-3 text-sm text-[var(--mk-fg)] outline-none placeholder:text-[var(--mk-muted-2)] focus:ring-2 focus:ring-[var(--mk-fg)]/20"
                  placeholder="Work email"
                  name="email"
                  required
                />
                <input
                  className="w-full rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] px-4 py-3 text-sm text-[var(--mk-fg)] outline-none placeholder:text-[var(--mk-muted-2)] focus:ring-2 focus:ring-[var(--mk-fg)]/20"
                  placeholder="Organisation"
                  name="company"
                  required
                />
                <input
                  className="w-full rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] px-4 py-3 text-sm text-[var(--mk-fg)] outline-none placeholder:text-[var(--mk-muted-2)] focus:ring-2 focus:ring-[var(--mk-fg)]/20"
                  placeholder="Approx. number of users"
                  name="seats"
                />
                <textarea
                  className="min-h-30 w-full rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] px-4 py-3 text-sm text-[var(--mk-fg)] outline-none placeholder:text-[var(--mk-muted-2)] focus:ring-2 focus:ring-[var(--mk-fg)]/20"
                  placeholder="What do you need Receipt to do?"
                  name="message"
                  required
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-full marketing-cta-primary px-5 py-3 text-sm font-semibold shadow-sm "
                >
                  Send enquiry
                </button>
                <div className="text-[12px] leading-relaxed text-[var(--mk-muted)]">
                  We’ll only use your details to respond to this enquiry.
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

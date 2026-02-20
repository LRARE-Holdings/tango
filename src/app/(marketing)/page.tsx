import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthFragmentRedirect } from "@/components/auth-fragment-redirect";
import { HeroDeliveredWord } from "@/components/marketing/HeroDeliveredWord";
import { absoluteUrl, buildMarketingMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Receipt | Proof of document acknowledgement",
  description:
    "Receipt gives teams clear proof of delivery, review activity and acknowledgement for policies, procedures and client documents.",
  path: "/",
  keywords: [
    "document acknowledgement software",
    "policy acknowledgement",
    "proof of delivery",
    "compliance audit trail",
  ],
});

function firstValue(v: string | string[] | undefined) {
  return typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? null) : null;
}

const FLOW_STEPS = [
  {
    label: "Upload",
    desc: "Upload your PDF once",
    icon: "↑",
  },
  {
    label: "Distribute",
    desc: "Send one share link",
    icon: "→",
  },
  {
    label: "Acknowledge",
    desc: "Recipient reviews + confirms",
    icon: "✓",
  },
  {
    label: "Audit trail",
    desc: "Export a clean record",
    icon: "◉",
  },
] as const;

const FEATURES = [
  {
    title: "Proof of acknowledgement",
    body: "Know exactly who opened, reviewed and acknowledged each document without over-claiming what that means.",
  },
  {
    title: "Lightweight and focused",
    body: "No bulky e-signature workflow. Just a clean acknowledgement trail for the documents that need one.",
  },
  {
    title: "Compliance ready",
    body: "Built for regulated environments where simply making a policy available is not enough.",
  },
  {
    title: "Works with your intranet",
    body: "Receipt adds an accountability layer and sits alongside your existing internal systems.",
  },
] as const;

const PRIMARY_CTA_CLASS =
  "focus-ring inline-flex h-11 items-center justify-center rounded-full marketing-cta-primary marketing-cta-primary-sans px-8 text-sm font-semibold shadow-sm";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const code = firstValue(params.code);
  const tokenHash = firstValue(params.token_hash);
  const type = firstValue(params.type);
  const next = firstValue(params.next);
  const redirectTo = firstValue(params.redirect_to);

  if (code || (tokenHash && type)) {
    const qs = new URLSearchParams();
    if (code) qs.set("code", code);
    if (tokenHash) qs.set("token_hash", tokenHash);
    if (type) qs.set("type", type);
    if (next) qs.set("next", next);
    if (redirectTo) qs.set("redirect_to", redirectTo);
    redirect(`/auth/confirm?${qs.toString()}`);
  }

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Receipt",
    url: absoluteUrl("/"),
    logo: absoluteUrl("/receipt-logo.png"),
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Receipt",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Proof of document delivery, review activity and acknowledgement for business teams.",
    offers: {
      "@type": "Offer",
      url: absoluteUrl("/pricing"),
      priceCurrency: "GBP",
      price: "0",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <main className="min-h-screen bg-[var(--mk-bg)] text-[var(--mk-fg)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([organizationSchema, softwareSchema]),
        }}
      />
      <AuthFragmentRedirect />
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 marketing-glow" />
      </div>

      <section className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl items-center px-6 py-20 text-center">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-10 sm:gap-12">
          <div className="inline-flex items-center gap-2 rounded-full marketing-badge px-4 py-2 text-xs font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--mk-accent)]" />
            Launching Monday, February 23, 2026
          </div>
          <h1 className="marketing-hero max-w-4xl text-5xl sm:text-6xl lg:text-7xl">
            Certainty,{" "}
            <HeroDeliveredWord />
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-[var(--mk-muted)] sm:text-lg">
            Clear proof of delivery, review activity and acknowledgement for
            policies, procedures and client documents, without e-signature
            overhead.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/get-started" className={PRIMARY_CTA_CLASS}>
              Get started
            </Link>
            <a
              href="/product"
              className="inline-flex h-11 items-center justify-center rounded-full marketing-cta-secondary px-8 text-sm font-semibold shadow-sm"
            >
              See product
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {FLOW_STEPS.map((step, index) => (
            <div
              key={step.label}
              className="group rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--mk-surface-soft)] text-sm font-semibold text-[var(--mk-fg)] transition-colors group-hover:bg-[var(--mk-accent-soft)] group-hover:text-[var(--mk-accent)]">
                  {step.icon}
                </div>
                <div className="text-[11px] font-semibold tracking-wide text-[var(--mk-muted)] transition-colors group-hover:text-[var(--mk-accent)]">
                  0{index + 1}
                </div>
              </div>
              <div className="mt-4 text-sm font-semibold text-[var(--mk-fg)] transition-colors group-hover:text-[var(--mk-accent)]">
                {step.label}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-[var(--mk-muted)] transition-colors group-hover:text-[var(--mk-accent)]">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 pb-14 lg:grid-cols-2 lg:items-center">
        <div>
          <div className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
            THE PROBLEM
          </div>
          <h2 className="marketing-serif mt-3 text-4xl sm:text-5xl">
            &quot;I sent it&quot;
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--mk-muted)] sm:text-base">
            Sending the email is only step one. When regulators or stakeholders
            ask whether a document was actually acknowledged, proof of sending
            alone is not proof of review. Receipt bridges that gap with a
            neutral, verifiable record.
          </p>
        </div>

        <div className="rounded-3xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-6 shadow-sm">
          <div className="rounded-xl bg-[var(--mk-surface-soft)] px-4 py-3 text-xs text-[var(--mk-muted)]">
            Inbox • compliance@company.com
          </div>
          <div className="mt-3 space-y-3">
            {[
              "AML Policy v4.2",
              "Employee Handbook",
              "FCA Regulation Update",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] px-4 py-3"
              >
                <div className="text-sm font-medium text-[var(--mk-fg)]">
                  {item}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#fef4c7] px-2.5 py-1 text-[11px] font-semibold text-[#b4540a]">
                    Sent
                  </span>
                  <span className="text-sm text-[var(--mk-muted)]">?</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-[#fffbeb] px-4 py-3 text-center text-xs font-semibold text-[#b4540a]">
            Sent ≠ Seen
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
          WHY RECEIPT
        </div>
        <h2 className="marketing-serif mt-3 max-w-2xl text-4xl sm:text-5xl">
          The accountability layer your <br></br>
          documents deserve
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-6 shadow-sm"
            >
              <div className="text-base font-semibold text-[var(--mk-fg)]">
                {feature.title}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <h2 className="marketing-serif text-5xl sm:text-6xl">
          Stop guessing.
          <br />
          <span className="text-[var(--mk-accent)]">Start knowing.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[var(--mk-muted)]">
          Move beyond &quot;I sent it&quot; to verifiable proof of
          document acknowledgement.
        </p>
        <Link
          href="/get-started"
          className={`mt-8 ${PRIMARY_CTA_CLASS}`}
        >
          Get started
        </Link>
      </section>
    </main>
  );
}

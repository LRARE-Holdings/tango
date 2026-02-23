import type { Metadata } from "next";
import Link from "next/link";
import { buildMarketingMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Data Retention Policy",
  description:
    "Read Receipt's Data Retention Policy for Individual, Team, and Enterprise accounts, including default retention periods and sender-controlled retention rules.",
  path: "/data-retention",
  keywords: ["data retention", "retention policy", "gdpr retention", "audit cycle"],
});

export default function DataRetentionPage() {
  return (
    <main className="min-h-screen bg-[var(--mk-bg)] text-[var(--mk-fg)]">
      <section className="mx-auto max-w-3xl px-6 pt-14 pb-20">
        <div className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
          DATA RETENTION POLICY
        </div>
        <h1 className="marketing-hero mt-2 text-4xl">Data retention</h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--mk-muted)]">
          Receipt stores data only for as long as it is needed for legitimate
          business and compliance purposes. Our retention model is designed to
          support auditable workflows without retaining data indefinitely by
          default.
        </p>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            1. Core retention principle
          </h2>
          <p className="text-sm leading-relaxed text-[var(--mk-muted)]">
            Customer data is held for as long as the customer requires it to be
            held, based on the customer&apos;s legal, regulatory, and operational
            needs.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            2. Team and Enterprise accounts
          </h2>
          <p className="text-sm leading-relaxed text-[var(--mk-muted)]">
            For Team and Enterprise accounts, retention is set by the sending
            organisation and may vary by business context. In many cases this is
            one audit cycle, but it may be longer where required by the
            organisation&apos;s obligations.
          </p>
          <p className="text-sm leading-relaxed text-[var(--mk-muted)]">
            If you are a recipient, check with the relevant sender for the exact
            retention period that applies to your document records.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            3. Individual accounts
          </h2>
          <p className="text-sm leading-relaxed text-[var(--mk-muted)]">
            For Individual accounts, the standard retention period is{" "}
            <strong>one year from the date of acknowledgement</strong> for
            acknowledgement records and associated evidence fields.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            4. Deletion and legal exceptions
          </h2>
          <p className="text-sm leading-relaxed text-[var(--mk-muted)]">
            After the applicable retention period, data is deleted or
            irreversibly anonymised, unless a longer period is required to
            comply with law, resolve disputes, or enforce agreements.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            5. Related policies
          </h2>
          <p className="text-sm leading-relaxed text-[var(--mk-muted)]">
            This policy should be read alongside our{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:opacity-80">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/dpa" className="underline underline-offset-4 hover:opacity-80">
              DPA
            </Link>
            .
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">6. Contact</h2>
          <p className="text-sm leading-relaxed text-[var(--mk-muted)]">
            For retention-related enquiries, contact:
          </p>
          <p className="text-sm font-medium">privacy@lrare.co.uk</p>
        </section>

        <div className="mt-14 text-xs text-[var(--mk-muted)]">
          Last updated: {new Date().toISOString().slice(0, 10)}
        </div>
      </section>
    </main>
  );
}

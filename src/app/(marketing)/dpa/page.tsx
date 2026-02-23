import type { Metadata } from "next";
import Link from "next/link";
import { buildMarketingMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Data Processing Addendum (DPA)",
  description:
    "Read Receipt's Data Processing Addendum covering GDPR processing terms, security controls, sub-processors, and transfer safeguards.",
  path: "/dpa",
  keywords: ["dpa", "gdpr", "data processing addendum", "sub-processors"],
});

export default function DpaPage() {
  return (
    <main className="min-h-screen bg-[var(--mk-bg)] text-[var(--mk-fg)]">
      <section className="mx-auto max-w-3xl px-6 pt-14 pb-20">
        <div className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
          DATA PROCESSING ADDENDUM
        </div>
        <h1 className="marketing-hero mt-2 text-4xl">DPA</h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--mk-muted)]">
          This Data Processing Addendum (&quot;DPA&quot;) forms part of the
          Terms of Service between LRARE Holdings Ltd (Receipt) and the
          customer using Receipt (&quot;Customer&quot;) where Receipt processes
          personal data on the Customer&apos;s behalf under UK GDPR and EU GDPR.
        </p>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            1. Scope and roles
          </h2>
          <p className="text-sm leading-relaxed text-[var(--mk-muted)]">
            For customer content and recipient activity data, Customer acts as
            controller (or processor, where applicable) and Receipt acts as
            processor.
          </p>
          <p className="text-sm leading-relaxed text-[var(--mk-muted)]">
            Receipt processes personal data only on documented instructions from
            Customer, except where required by applicable law.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            2. Processing details
          </h2>
          <div className="space-y-2 text-sm leading-relaxed text-[var(--mk-muted)]">
            <p>
              <strong>Subject matter:</strong> provision of document delivery,
              review, and acknowledgement workflows.
            </p>
            <p>
              <strong>Duration:</strong> for the term of service use and until
              deletion/return under this DPA.
            </p>
            <p>
              <strong>Nature and purpose:</strong> hosting, storage, access
              logging, delivery, and acknowledgement evidence generation.
            </p>
            <p>
              <strong>Data subjects:</strong> customer users, recipients, and
              related contacts included by customer.
            </p>
            <p>
              <strong>Data types:</strong> identifiers (name, email), document
              metadata, IP/user-agent, timestamps, and activity telemetry needed
              for evidence records.
            </p>
          </div>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            3. Security measures
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--mk-muted)]">
            <li>Encryption in transit and at rest across core infrastructure</li>
            <li>Logical access controls and authentication controls</li>
            <li>Event logging relevant to access and acknowledgement flows</li>
            <li>Availability and recovery controls appropriate to the service</li>
          </ul>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            4. Sub-processors
          </h2>
          <p className="text-sm leading-relaxed text-[var(--mk-muted)]">
            Receipt maintains a sub-processor chain required to operate the
            service. Current key providers are:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--mk-muted)]">
            <li>
              <strong>Supabase</strong> (AWS, London region) for database,
              authentication, and storage
            </li>
            <li>
              <strong>Cloudflare Turnstile</strong> for CAPTCHA abuse
              prevention only, limited to relevant security activity
            </li>
            <li>
              <strong>Vercel</strong> for application hosting and runtime
              infrastructure
            </li>
            <li>
              <strong>Stripe</strong> for billing and payment operations
            </li>
          </ul>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            5. International transfers
          </h2>
          <p className="text-sm leading-relaxed text-[var(--mk-muted)]">
            Where personal data is transferred outside the UK or EEA, Receipt
            uses appropriate safeguards including standard contractual clauses
            (or equivalent lawful transfer mechanisms).
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            6. Data subject rights and assistance
          </h2>
          <p className="text-sm leading-relaxed text-[var(--mk-muted)]">
            Receipt provides reasonable assistance to help Customer respond to
            data subject rights requests and regulator enquiries, taking into
            account the nature of processing and available information.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            7. Incidents
          </h2>
          <p className="text-sm leading-relaxed text-[var(--mk-muted)]">
            Receipt will notify Customer without undue delay after becoming
            aware of a personal data breach affecting Customer personal data and
            provide relevant information as available.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            8. Deletion and return
          </h2>
          <p className="text-sm leading-relaxed text-[var(--mk-muted)]">
            On termination or documented request, Receipt will delete or return
            Customer personal data, unless retention is required by law.
          </p>
          <p className="text-sm leading-relaxed text-[var(--mk-muted)]">
            Retention timelines are set out in our{" "}
            <Link href="/data-retention" className="underline underline-offset-4 hover:opacity-80">
              Data Retention Policy
            </Link>
            .
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">9. Contact</h2>
          <p className="text-sm leading-relaxed text-[var(--mk-muted)]">
            For DPA and data processing enquiries, contact:
          </p>
          <p className="text-sm font-medium">legal@lrare.co.uk</p>
        </section>

        <div className="mt-14 text-xs text-[var(--mk-muted)]">
          Last updated: {new Date().toISOString().slice(0, 10)}
        </div>
      </section>
    </main>
  );
}

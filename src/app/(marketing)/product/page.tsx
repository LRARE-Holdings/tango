import type { Metadata } from "next";
import { ReceiptPreview } from "@/components/marketing/ReceiptPreview";
import { buildMarketingMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Product",
  description:
    "See how Receipt captures delivery, review activity and acknowledgement into a clean, audit-ready record.",
  path: "/product",
  keywords: [
    "document tracking",
    "acknowledgement workflow",
    "audit-ready records",
    "policy distribution software",
  ],
});

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--mk-border)] bg-[var(--mk-surface)] px-3 py-1 text-xs font-medium text-[var(--mk-muted)] shadow-sm">
      {children}
    </span>
  );
}

function Card({
  title,
  children,
  subtle,
}: {
  title?: string;
  children: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-3xl border border-[var(--mk-border)] p-6 shadow-sm md:p-8",
        subtle ? "bg-[var(--mk-surface-soft)]" : "bg-[var(--mk-surface)]",
      ].join(" ")}
    >
      {title ? (
        <div className="text-sm font-semibold text-[var(--mk-fg)]">{title}</div>
      ) : null}
      <div className={title ? "mt-2" : ""}>{children}</div>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-6 shadow-sm">
      <div className="text-sm font-semibold text-[var(--mk-fg)]">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
        {body}
      </div>
    </div>
  );
}

export default function ProductPage() {
  return (
    <main className="min-h-screen bg-[var(--mk-bg)] text-[var(--mk-fg)]">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 marketing-glow" />
      </div>

      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge>No recipient account</Badge>
              <Badge>No AI analysis</Badge>
              <Badge>Export-ready</Badge>
            </div>

            <div className="mt-6 text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
              PRODUCT
            </div>

            <h1 className="marketing-hero mt-2 text-4xl sm:text-5xl">
              A neutral record for PDFs.
              <span className="text-[var(--mk-accent)]">
                {" "}
                Built for real work.
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--mk-muted)]">
              Receipt captures what is observable, delivery, access, review
              activity, and acknowledgement, then turns it into a clean record
              you can keep on file.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/get-started"
                className="inline-flex items-center justify-center rounded-full marketing-cta-primary px-6 py-3 text-sm font-semibold shadow-sm"
              >
                Get started
              </a>
              <a
                href="/pricing"
                className="inline-flex items-center justify-center rounded-full marketing-cta-secondary px-6 py-3 text-sm font-semibold shadow-sm"
              >
                View pricing
              </a>
            </div>

            <div className="mt-8 max-w-xl rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface-soft)] p-4 text-[12px] leading-relaxed text-[var(--mk-muted)]">
              Receipt is <span className="font-medium">not</span> an e-signature
              tool and does
              <span className="font-medium"> not</span> verify identity by
              default.
            </div>
          </div>

          <div className="lg:pt-2">
            <ReceiptPreview />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
            WHY IT EXISTS
          </div>
          <h2 className="marketing-serif mt-2 text-2xl text-[var(--mk-fg)] sm:text-3xl">
            Because &quot;we sent it&quot; is not evidence.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--mk-muted)]">
            Receipt is for moments where you need a clean record, not a debate.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Feature
            title="Neutral by design"
            body="Records what happened, when it happened, and what was viewed, without assumptions or interpretation."
          />
          <Feature
            title="Frictionless for recipients"
            body="One link. Open the PDF in-browser. Review it. Acknowledge it if required."
          />
          <Feature
            title="Clean output for the file"
            body="Exports a tidy record with timestamps and activity fields, consistent and audit-friendly."
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="What it records" subtle>
            <div className="text-sm leading-relaxed text-[var(--mk-muted)]">
              Receipt stays neutral: timestamps, activity, and acknowledgement.
            </div>
            <div className="mt-4 rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-4 text-xs leading-relaxed text-[var(--mk-muted)]">
              <div className="font-semibold text-[var(--mk-fg)]">Fields</div>
              <div className="mt-2 space-y-1">
                <div>• delivered_at / first_opened_at</div>
                <div>• max_scroll_percent</div>
                <div>• time_on_page_seconds</div>
                <div>• acknowledgement + submitted_at</div>
                <div>• (optional) ip + user_agent</div>
                <div>• document hash / version</div>
              </div>
            </div>
          </Card>

          <Card title="Where teams use it">
            <div className="text-sm leading-relaxed text-[var(--mk-muted)]">
              Practical use cases that need evidence, not opinion.
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3">
              {[
                "Client care letters",
                "Policy updates",
                "Terms notices",
                "Internal rollouts",
                "Supplier governance",
              ].map((x) => (
                <div
                  key={x}
                  className="rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface-soft)] px-4 py-3 text-sm text-[var(--mk-muted)]"
                >
                  {x}
                </div>
              ))}
            </div>
          </Card>

          <Card title="What it is not">
            <div className="grid grid-cols-1 gap-3">
              {[
                {
                  t: "Not e-signature",
                  b: "Receipt does not replace signing workflows.",
                },
                {
                  t: "Not consent capture",
                  b: "It does not claim intent, agreement, or comprehension.",
                },
                {
                  t: "Not analysis",
                  b: "No AI interpretation. No sentiment. No conclusions.",
                },
              ].map((x) => (
                <div
                  key={x.t}
                  className="rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-4 shadow-sm"
                >
                  <div className="text-sm font-semibold text-[var(--mk-fg)]">
                    {x.t}
                  </div>
                  <div className="mt-1 text-sm leading-relaxed text-[var(--mk-muted)]">
                    {x.b}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

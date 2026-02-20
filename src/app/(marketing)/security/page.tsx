// src/app/(marketing)/security/page.tsx
import type { Metadata } from "next";
import { buildMarketingMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Security",
  description:
    "Learn how Receipt protects data with encryption, clear access controls and an explicit, neutral evidence model.",
  path: "/security",
  keywords: ["security", "data protection", "gdpr", "compliance evidence"],
});

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
        subtle
          ? "bg-[var(--mk-surface-soft)]"
          : "bg-[var(--mk-surface)]",
      ].join(" ")}
    >
      {title ? (
        <div className="text-sm font-semibold text-[var(--mk-fg)]">{title}</div>
      ) : null}
      <div className={title ? "mt-2" : ""}>{children}</div>
    </div>
  );
}

function IconCircle({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--mk-surface-soft)] text-[var(--mk-accent)]">
      {children}
    </div>
  );
}

function DotRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-2 inline-block h-1.5 w-1.5 flex-none rounded-full bg-[var(--mk-muted-2)]" />
      <div>
        <div className="text-sm font-semibold text-[var(--mk-fg)]">{title}</div>
        <div className="mt-1 text-sm leading-relaxed text-[var(--mk-muted)]">
          {body}
        </div>
      </div>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[var(--mk-bg)] text-[var(--mk-fg)]">
      {/* subtle background texture */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 marketing-glow" />
        <div className="absolute inset-0 " />
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">
          <div>

            <div className="mt-6 text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
              SECURITY
            </div>

            <h1 className="marketing-hero mt-2 text-4xl sm:text-5xl">
              Security you can <span className="text-[var(--mk-accent)]">trust.</span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--mk-muted)]">
              Your data is protected with GDPR-compliant infrastructure
              providers, with encryption in transit and at rest. Receipt
              records document access, review activity, and acknowledgement in a
              focused, file-ready format without over-claiming what that means.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/privacy"
                className="inline-flex items-center justify-center rounded-full marketing-cta-primary marketing-cta-primary-sans px-6 py-3 text-sm font-semibold shadow-sm"
              >
                Read privacy
              </a>
              <a
                href="#details"
                className="inline-flex items-center justify-center rounded-full marketing-cta-secondary px-6 py-3 text-sm font-semibold shadow-sm"
              >
                What we record
              </a>
            </div>

            <div className="mt-8 max-w-xl rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface-soft)] p-4 text-[12px] leading-relaxed text-[var(--mk-muted)]  ">
              Receipt is <span className="font-medium">not</span> an e-signature
              tool. It does <span className="font-medium">not</span> verify
              identity by default, and it does
              <span className="font-medium">not</span> assess understanding,
              consent, or intent.
            </div>
          </div>

          {/* Right-side: principles panel */}
          <div className="relative">
            <div className="pointer-events-none absolute -inset-6 rounded-[28px] bg-linear-to-br from-black/10 via-transparent to-black/10 blur-2xl dark:from-white/10 dark:to-white/8" />
            <div className="relative rounded-[28px] border border-[var(--mk-border)] bg-[var(--mk-surface)] p-6 shadow-xl  md:p-8">
              <div className="text-sm font-semibold text-[var(--mk-fg)]">
                Security posture
              </div>
              <div className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
                Receipt is designed to protect data by default while keeping a
                clear, auditable record model for operational use.
              </div>

              <div className="mt-6 space-y-4">
                <DotRow
                  title="Protect data end to end"
                  body="Data is encrypted in transit and encrypted at rest across our core infrastructure."
                />
                <DotRow
                  title="Use GDPR-compliant providers"
                  body="Our infrastructure stack is built on providers aligned with GDPR requirements."
                />
                <DotRow
                  title="Minimise data"
                  body="Record only what’s needed to evidence access and acknowledgement."
                />
                <DotRow
                  title="Make it exportable"
                  body="A consistent record your team can store with the matter."
                />
              </div>

              <div className="mt-6 rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface-soft)] p-4 text-xs leading-relaxed text-[var(--mk-muted)]  ">
                If you need identity verification, signing, or advanced
                compliance workflows, Receipt should sit alongside those tools,
                not pretend to replace them.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core cards */}
      <section className="mx-auto max-w-6xl px-6 pb-16" id="details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <div className="flex items-start gap-4">
              <IconCircle>
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path
                    d="M7 10V8a5 5 0 0110 0v2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M6 10h12v10H6V10z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </IconCircle>
              <div>
                <div className="text-sm font-semibold text-[var(--mk-fg)]">
                  Encrypted end to end
                </div>
                <div className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
                  Data is encrypted in transit and at rest across GDPR-compliant
                  infrastructure providers. Protection is applied by default,
                  not as an optional setting.
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-4">
              <IconCircle>
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path
                    d="M12 3v18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M3 12h18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M7 7l10 10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M17 7L7 17"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </IconCircle>
              <div>
                <div className="text-sm font-semibold text-[var(--mk-fg)]">
                  Mandatory network audit trail
                </div>
                <div className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
                  IP address and user-agent are recorded for every access and
                  acknowledgement event, giving your team a consistent forensic
                  trail for investigations and compliance review.
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-4">
              <IconCircle>
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path
                    d="M7 8h10M7 12h10M7 16h6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M6 3h12l3 3v15a3 3 0 01-3 3H6a3 3 0 01-3-3V6a3 3 0 013-3z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </IconCircle>
              <div>
                <div className="text-sm font-semibold text-[var(--mk-fg)]">
                  Version-locked evidence
                </div>
                <div className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
                  Every event is tied to a document hash and version, so you can
                  prove exactly what was delivered, reviewed, and acknowledged.
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* What we record / what we don't */}
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="What Receipt records" subtle>
            <div className="text-sm leading-relaxed text-[var(--mk-muted)]">
              Receipt is built around a small set of facts. Typical fields
              include:
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-4 text-xs leading-relaxed text-[var(--mk-muted)]  ">
              <div className="font-semibold text-[var(--mk-fg)]">Fields</div>
              <div className="mt-2 space-y-1">
                <div>• Delivery time</div>
                <div>• First open time</div>
                <div>• Maximum scroll depth</div>
                <div>• Time spent on page</div>
                <div>• Acknowledgement status</div>
                <div>• Acknowledgement submission time</div>
                <div>• IP address and user agent</div>
                <div>• Document hash and version</div>
              </div>
            </div>

            <div className="mt-4 text-[12px] leading-relaxed text-[var(--mk-muted)]">
              You control what you store and how long you keep it, align this
              with your internal policies and your Privacy notice.
            </div>
          </Card>

          <Card title="What Receipt doesn’t do">
            <div className="grid grid-cols-1 gap-3">
              {[
                {
                  t: "No e-signatures",
                  b: "Receipt doesn’t replace signing workflows or identity verification tools.",
                },
                {
                  t: "No identity verification by default",
                  b: "It records access behaviour, not who someone “really is”.",
                },
                {
                  t: "No ‘understanding’ claims",
                  b: "Receipt never asserts comprehension, intent, consent, or agreement.",
                },
                {
                  t: "No analysis",
                  b: "No AI interpretation. No sentiment. No conclusions.",
                },
              ].map((x) => (
                <div
                  key={x.t}
                  className="rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-4 shadow-sm "
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

        {/* Data handling CTA */}
        <div className="mt-10 rounded-3xl border border-[var(--mk-border)] bg-linear-to-b bg-[var(--mk-surface-alt)] p-6 shadow-sm  md:p-8">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <div className="text-lg font-semibold tracking-tight">
                Data handling & retention
              </div>
              <div className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
                What you store (and for how long) should match your internal
                policies. Our Privacy page covers personal data and retention at
                a high level.
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <a
                href="/privacy"
                className="inline-flex items-center justify-center rounded-full marketing-cta-primary marketing-cta-primary-sans px-6 py-3 text-sm font-semibold shadow-sm"
              >
                Read privacy
              </a>
              <a
                href="/terms"
                className="inline-flex items-center justify-center rounded-full marketing-cta-secondary px-6 py-3 text-sm font-semibold shadow-sm"
              >
                Read terms
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

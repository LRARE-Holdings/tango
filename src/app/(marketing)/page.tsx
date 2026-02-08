import { redirect } from "next/navigation";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
      {children}
    </span>
  );
}

function FeatureCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </div>
      <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {children}
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="text-[11px] font-medium tracking-wide text-zinc-500 dark:text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function ReceiptPreview() {
  return (
    <div className="relative">
      {/* soft glow */}
      <div className="pointer-events-none absolute -inset-6 rounded-[28px] bg-linear-to-br from-zinc-200/60 via-transparent to-zinc-200/60 blur-2xl dark:from-zinc-800/40 dark:to-zinc-800/40" />
      <div className="relative overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-baseline gap-3">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Receipt Record
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-500">example</div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-1">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-500">
              Document
            </div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Client Care Letter - Residential Conveyancing
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-500">
              Version hash: 9f2c…a81d
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-500">
                Recipient
              </div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Alex Smith
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-500">
                alex@client.com
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-500">
                Acknowledged
              </div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Yes
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-500">
                12 Feb 2026, 09:22
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatPill label="First opened" value="09:17" />
            <StatPill label="Scroll depth" value="100%" />
            <StatPill label="Time on page" value="4m 32s" />
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-[12px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            Receipt records observable events (delivery, access, review activity, acknowledgement).
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? (
        <div className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-500">
          {eyebrow}
        </div>
      ) : null}
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export default function Home({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const code = typeof searchParams?.code === "string" ? searchParams.code : null;
  const next = typeof searchParams?.next === "string" ? searchParams.next : null;

  if (code) {
    const qs = new URLSearchParams({ code });
    if (next) qs.set("next", next);
    redirect(`/auth/confirm?${qs.toString()}`);
  }
  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* subtle background texture */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(0,0,0,0.06),transparent_55%)] dark:bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_90%_0%,rgba(0,0,0,0.04),transparent_55%)] dark:bg-[radial-gradient(900px_circle_at_90%_0%,rgba(255,255,255,0.06),transparent_55%)]" />
      </div>


      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-start">
          <div>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
              Proof a document was opened and reviewed,
              <span className="text-zinc-500 dark:text-zinc-400">
                {" "}
                without over‑claiming what it meant.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              Receipt gives you a clean, timestamped record of delivery, access, review activity and acknowledgement — designed to drop straight into the file.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/app"
                className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-white dark:text-zinc-950"
              >
                Open Receipt
              </a>
              <a
                href="#how"
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900/50"
              >
                See what it records
              </a>
              <a
                href="/login"
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900 sm:hidden"
              >
                Login
              </a>
            </div>

            <div className="mt-8 max-w-xl rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-[12px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
              Receipt is not an e‑signature tool. It doesn’t give legal advice or assess understanding — it simply records what happened.
            </div>
          </div>

          <div className="lg:pt-2">
            <ReceiptPreview />
          </div>
        </div>
      </section>

      {/* Product */}
      <section id="product" className="mx-auto max-w-6xl px-6 py-14">
        <SectionTitle
          eyebrow="FOR TEAMS"
          title="Built for the moments where “we sent it” isn’t enough."
          subtitle="When things matter, you need a neutral record — not opinions or guesswork. Receipt captures the facts: delivery, access, review activity, and acknowledgement."
        />

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <FeatureCard title="Neutral by design">
            Records what happened, when it happened, and who did it. No sentiment, no assumptions, no overreach.
          </FeatureCard>
          <FeatureCard title="Frictionless for recipients">
            One link. Open the document. Review it. Acknowledge it. No accounts, portals, or unnecessary friction.
          </FeatureCard>
          <FeatureCard title="Clean output for the file">
            A clean record your team can export and keep alongside the matter — consistent, readable, and audit‑friendly.
          </FeatureCard>
        </div>
      </section>

      {/* How */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-14">
        <SectionTitle
          eyebrow="HOW IT WORKS"
          title="Three steps. No drama."
          subtitle="Receipt stays in its lane: it logs observable activity and acknowledgement, then produces a tidy record."
        />

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <FeatureCard title="1) Share">
            Upload a PDF and send a single link. You stay in control the whole time.
          </FeatureCard>
          <FeatureCard title="2) Review">
            Receipt records access and on‑page review activity — time spent and scroll depth — while the PDF is viewed.
          </FeatureCard>
          <FeatureCard title="3) Acknowledge">
            The recipient confirms they’ve reviewed the document. Receipt timestamps it and attaches it to the record.
          </FeatureCard>
        </div>

        <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold tracking-tight">
                What gets recorded (and what doesn’t)
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Receipt records timestamps, activity, and acknowledgement — nothing more.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">Fields</div>
              <div className="mt-2 space-y-1">
                <div>• delivered_at / first_opened_at</div>
                <div>• max_scroll_percent</div>
                <div>• time_on_page_seconds</div>
                <div>• acknowledgement + submitted_at</div>
                <div>• (optional) ip + user_agent</div>
                <div>• document hash / version</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="mx-auto max-w-6xl px-6 py-14">
        <SectionTitle
          eyebrow="SECURITY"
          title="Designed for professional use."
          subtitle="Receipt is intentionally narrow — a focused utility with clear boundaries and clean records."
        />
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <FeatureCard title="Minimal claims">
            No “signature”. No “consent”. No “understanding”. Just a neutral record you can keep with the matter.
          </FeatureCard>
          <FeatureCard title="Optional IP logging">
            If enabled, Receipt can store IP and user agent data for access events. Leave it off when it’s not appropriate.
          </FeatureCard>
          <FeatureCard title="Document integrity">
            Versioning via document hash helps you evidence what was actually sent and reviewed.
          </FeatureCard>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-6 py-14">
        <SectionTitle
          eyebrow="FAQ"
          title="Common questions"
        />

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-sm font-semibold">Is this an e-signature product?</div>
            <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              No. Receipt records access, review activity and acknowledgement. It doesn’t provide e‑signatures or verify identity by default.
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-sm font-semibold">Does Receipt prove understanding?</div>
            <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              No — and it doesn’t try to. Receipt records observable behaviour (open, scroll, time) plus a direct acknowledgement.
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-sm font-semibold">Do recipients need an account?</div>
            <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              No. Recipients open a link, view the PDF, and (optionally) acknowledge, without
              requiring sign up.
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-sm font-semibold">Can we brand it?</div>
            <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Yes! Everything from your dashboard to the emails you send can be branded with your logo, text and colours.
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 rounded-3xl border border-zinc-200 bg-linear-to-b from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/30 md:p-8">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <div className="text-lg font-semibold tracking-tight">
                Ready to generate a record in seconds?
              </div>
              <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Upload a PDF, send the link, and keep a clean record with the matter file.
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <a
                href="/app"
                className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-white dark:text-zinc-950"
              >
                Get started
              </a>
              <a
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900/50"
              >
                Login
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
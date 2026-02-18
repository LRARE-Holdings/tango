// src/app/(marketing)/product/page.tsx

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
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
        "rounded-3xl border p-6 shadow-sm md:p-8",
        subtle
          ? "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
      ].join(" ")}
    >
      {title ? (
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </div>
      ) : null}
      <div className={title ? "mt-2" : ""}>{children}</div>
    </div>
  );
}

function Feature({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </div>
      <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {body}
      </div>
    </div>
  );
}

function MiniPreview() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 rounded-[28px] bg-linear-to-br from-zinc-200/60 via-transparent to-zinc-200/60 blur-2xl dark:from-zinc-800/40 dark:to-zinc-800/40" />
      <div className="relative overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-baseline gap-3">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Receipt Record
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-500">sample</div>
          </div>

          <span className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            neutral
          </span>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-1">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-500">
              Document
            </div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Terms Update, Client Portal
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-500">
              Version hash: 1a7c…0d2e
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { k: "First opened", v: "09:17" },
              { k: "Scroll depth", v: "92%" },
              { k: "Time on page", v: "3m 08s" },
            ].map((x) => (
              <div
                key={x.k}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40"
              >
                <div className="text-[11px] font-medium tracking-wide text-zinc-500 dark:text-zinc-500">
                  {x.k}
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {x.v}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-[12px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            A neutral record: delivery, access, review activity, acknowledgement.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(0,0,0,0.06),transparent_55%)] dark:bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_90%_0%,rgba(0,0,0,0.04),transparent_55%)] dark:bg-[radial-gradient(900px_circle_at_90%_0%,rgba(255,255,255,0.06),transparent_55%)]" />
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge>No recipient account</Badge>
              <Badge>No AI analysis</Badge>
              <Badge>Export-ready</Badge>
            </div>

            <div className="mt-6 text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-500">
              PRODUCT
            </div>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              A neutral record for PDFs.
              <span className="text-zinc-500 dark:text-zinc-400">
                {" "}
                Built for real work.
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              Receipt captures what’s observable, delivery, access, review activity, acknowledgement,
              and turns it into a clean record you can keep on file. No interpretation. No over-claiming.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/get-started"
                className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-white dark:text-zinc-950"
              >
                Get started
              </a>
              <a
                href="/pricing"
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900/50"
              >
                View pricing
              </a>
            </div>

            <div className="mt-8 max-w-xl rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-[12px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
              Receipt is <span className="font-medium">not</span> an e-signature tool and does{" "}
              <span className="font-medium">not</span> verify identity by default. It records activity
              and acknowledgement, nothing more.
            </div>
          </div>

          <div className="lg:pt-2">
            <MiniPreview />
          </div>
        </div>
      </section>

      {/* What it's good at */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-500">
            WHY IT EXISTS
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
            Because “we sent it” isn’t evidence.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Receipt is for the moments where you need a clean record, not a debate. It keeps the
            output consistent, readable, and easy to file.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Feature
            title="Neutral by design"
            body="Records what happened, when it happened, and what was viewed, without assumptions, interpretation, or “understanding” claims."
          />
          <Feature
            title="Frictionless for recipients"
            body="One link. Open the PDF in the browser. Review it. Acknowledge it (if required). No portals, no accounts."
          />
          <Feature
            title="Clean output for the file"
            body="Exports a tidy record with timestamps and activity fields, consistent, readable, and audit-friendly."
          />
        </div>

        {/* Records + fields */}
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="What it records" subtle>
            <div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              Receipt stays neutral: it records timestamps, activity, and acknowledgement, not consent,
              intent, or comprehension.
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
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

            <div className="mt-4 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              You choose whether optional fields (like IP logging) are enabled.
            </div>
          </Card>

          <Card title="Where teams use it">
            <div className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Common use cases are boring, which is the point. It’s the practical stuff that needs
              evidence.
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              {[
                "Client care letters",
                "Policy or handbook updates",
                "Terms changes and notices",
                "Internal rollouts",
                "Anything you need to file cleanly",
              ].map((x) => (
                <div
                  key={x}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300"
                >
                  {x}
                </div>
              ))}
            </div>
          </Card>

          <Card title="What it’s not">
            <div className="grid grid-cols-1 gap-3">
              {[
                {
                  t: "Not e-signature",
                  b: "Receipt doesn’t replace signing workflows or identity verification tooling.",
                },
                {
                  t: "Not consent capture",
                  b: "It doesn’t claim intent, agreement, or comprehension, just observable events.",
                },
                {
                  t: "Not analysis",
                  b: "No AI interpretation. No sentiment. No conclusions.",
                },
              ].map((x) => (
                <div
                  key={x.t}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {x.t}
                  </div>
                  <div className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {x.b}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 rounded-3xl border border-zinc-200 bg-linear-to-b from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/30 md:p-8">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <div className="text-lg font-semibold tracking-tight">
                Want a clean record in under a minute?
              </div>
              <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Upload the PDF, share the link, and export the record when you need it.
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <a
                href="/get-started"
                className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-white dark:text-zinc-950"
              >
                Get started
              </a>
              <a
                href="/how-it-works"
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900/50"
              >
                How it works
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

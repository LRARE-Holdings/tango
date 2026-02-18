// src/app/(marketing)/how-it-works/page.tsx

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

function StepNumber({ n }: { n: string }) {
  return (
    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
      {n}
    </div>
  );
}

function MiniRecordPreview() {
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
            neutral record
          </span>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-1">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-500">
              Document
            </div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Client Care Letter, Residential Conveyancing
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
            {[
              { k: "First opened", v: "09:17" },
              { k: "Scroll depth", v: "100%" },
              { k: "Time on page", v: "4m 32s" },
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
            Receipt records observable events (delivery, access, review activity, acknowledgement).
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HowItWorksPage() {
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
            <div className="flex flex-wrap gap-2">
              <Badge>No recipient account</Badge>
              <Badge>No AI analysis</Badge>
              <Badge>Neutral record</Badge>
            </div>

            <div className="mt-6 text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-500">
              HOW IT WORKS
            </div>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              Three steps.
              <span className="text-zinc-500 dark:text-zinc-400"> Clean output.</span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              Receipt gives you a timestamped record of delivery, access, review activity and
              acknowledgement, designed to drop straight into the file.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/get-started"
                className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-white dark:text-zinc-950"
              >
                Get started
              </a>
              <a
                href="#steps"
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900/50"
              >
                See the flow
              </a>
            </div>

            <div className="mt-8 max-w-xl rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-[12px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
              Receipt is <span className="font-medium">not</span> an e-signature tool. It doesn’t
              give legal advice or assess understanding, it simply records what happened.
            </div>
          </div>

          <div className="lg:pt-2">
            <MiniRecordPreview />
          </div>
        </div>
      </section>

      {/* Steps */}
      <section id="steps" className="mx-auto max-w-6xl px-6 pb-16">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-500">
            THE FLOW
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
            Share → review → acknowledge
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            The recipient experience is deliberately simple. Your output is deliberately tidy.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <div className="flex items-start gap-4">
              <StepNumber n="1" />
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Share
                </div>
                <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Upload a PDF and send a single link. Recipients don’t need an account, they just
                  open and view.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge>Link sharing</Badge>
                  <Badge>Version hash</Badge>
                  <Badge>Optional IP logging</Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-4">
              <StepNumber n="2" />
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Review
                </div>
                <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Receipt logs access and on-page review activity, time spent and scroll depth,
                  while the PDF is viewed.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge>First opened</Badge>
                  <Badge>Time on page</Badge>
                  <Badge>Scroll depth</Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-4">
              <StepNumber n="3" />
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Acknowledge
                </div>
                <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  The recipient confirms they’ve reviewed the document. Receipt timestamps it and
                  attaches it to the record for export.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge>Acknowledgement</Badge>
                  <Badge>Timestamped</Badge>
                  <Badge>Export-ready</Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* What gets recorded */}
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="What gets recorded" subtle>
            <div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              Receipt records timestamps, activity, and acknowledgement, nothing more.
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
          </Card>

          <Card title="What it’s for">
            <div className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Perfect for moments where “we sent it” isn’t enough, client care letters, policy
              updates, terms changes, internal rollouts, and anything you need to evidence cleanly.
            </div>
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-[12px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
              It’s a file-ready record, not a signature product.
            </div>
          </Card>

          <Card title="What it’s not">
            <div className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Receipt does not provide legal advice. It does not verify identity by default and it
              does not attempt to assess understanding, consent, or intent.
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3">
              {[
                "No e-signatures",
                "No identity verification (by default)",
                "No “understanding” claims",
                "No interpretation",
              ].map((x) => (
                <div
                  key={x}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                >
                  {x}
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
                Ready to generate a record in seconds?
              </div>
              <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Upload a PDF, send the link, and keep a clean record with the matter file.
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
                href="/pricing"
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900/50"
              >
                View pricing
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

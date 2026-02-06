export default function ProductPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(0,0,0,0.06),transparent_55%)] dark:bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_90%_0%,rgba(0,0,0,0.04),transparent_55%)] dark:bg-[radial-gradient(900px_circle_at_90%_0%,rgba(255,255,255,0.06),transparent_55%)]" />
      </div>

      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-500">
            PRODUCT
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Receipt is a neutral record for PDF delivery and review.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            It records what happened (delivery, access, review activity, acknowledgement) and
            produces a clean output you can keep on file — without pretending to interpret intent
            or understanding.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="/app"
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
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              t: "Neutral by design",
              b: "Receipt records observable events. No “understanding” claims. No e-signature positioning.",
            },
            {
              t: "Frictionless for recipients",
              b: "Recipients open a link and view the PDF in the browser. No account required.",
            },
            {
              t: "Clean output for the file",
              b: "A tidy record with timestamps and activity fields — consistent and audit-friendly.",
            },
          ].map((x) => (
            <div
              key={x.t}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="text-sm font-semibold">{x.t}</div>
              <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {x.b}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-xl font-semibold tracking-tight">What it records</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Receipt stays neutral: it records timestamps, activity, and acknowledgement — not
                consent, intent, or comprehension.
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
    </main>
  );
}
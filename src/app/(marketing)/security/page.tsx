export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(0,0,0,0.06),transparent_55%)] dark:bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_90%_0%,rgba(0,0,0,0.04),transparent_55%)] dark:bg-[radial-gradient(900px_circle_at_90%_0%,rgba(255,255,255,0.06),transparent_55%)]" />
      </div>

      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-500">
            SECURITY
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Boring security. Clear boundaries.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Receipt is intentionally narrow. It records document access and acknowledgement and
            produces a neutral record. No “AI analysis”. No magical claims.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              t: "Minimal claims",
              b: "Receipt records observable events. It does not assert understanding, intent, or consent.",
            },
            {
              t: "Optional IP logging",
              b: "Where enabled, Receipt can store IP and user-agent for access events. Keep it off where not appropriate.",
            },
            {
              t: "Document integrity",
              b: "Document versioning via hash helps evidence what was sent and reviewed.",
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

        <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:p-8">
          <h2 className="text-xl font-semibold tracking-tight">Data handling</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            What you store (and for how long) should match your internal policies. See our Privacy
            page for specifics on personal data and retention.
          </p>
          <div className="mt-5">
            <a
              href="/privacy"
              className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900/50"
            >
              Read Privacy
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
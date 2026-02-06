export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(0,0,0,0.06),transparent_55%)] dark:bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_90%_0%,rgba(0,0,0,0.04),transparent_55%)] dark:bg-[radial-gradient(900px_circle_at_90%_0%,rgba(255,255,255,0.06),transparent_55%)]" />
      </div>

      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-500">
            HOW IT WORKS
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Three steps. No drama.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Upload a PDF, share a link, and keep a timestamped record. Receipt records observable
            events — not opinions.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              t: "1) Share",
              b: "Upload a PDF and share a single link with the recipient. No recipient account required.",
            },
            {
              t: "2) Review",
              b: "Receipt logs access and review activity (time and scroll depth) as the PDF is viewed.",
            },
            {
              t: "3) Acknowledge",
              b: "The recipient confirms review. Receipt timestamps the acknowledgement and attaches it to the record.",
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
          <h2 className="text-xl font-semibold tracking-tight">What Receipt does not do</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Receipt is not an e-signature tool and does not provide legal advice. It does not
            verify identity by default, and it does not attempt to assess understanding.
          </p>
        </div>
      </section>
    </main>
  );
}
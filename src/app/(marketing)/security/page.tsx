// src/app/(marketing)/security/page.tsx

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

function IconCircle({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
      {children}
    </div>
  );
}

function DotRow({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-2 inline-block h-1.5 w-1.5 flex-none rounded-full bg-zinc-400 dark:bg-zinc-600" />
      <div>
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </div>
        <div className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {body}
        </div>
      </div>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* subtle background texture */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(0,0,0,0.06),transparent_55%)] dark:bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_90%_0%,rgba(0,0,0,0.04),transparent_55%)] dark:bg-[radial-gradient(900px_circle_at_90%_0%,rgba(255,255,255,0.06),transparent_55%)]" />
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge>Neutral by design</Badge>
              <Badge>Optional IP logging</Badge>
              <Badge>Version hashing</Badge>
            </div>

            <div className="mt-6 text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-500">
              SECURITY
            </div>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              Calm security.
              <span className="text-zinc-500 dark:text-zinc-400"> Clear boundaries.</span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              Receipt is built to be a focused utility: it records document access, review activity,
              and acknowledgement, then produces a file-ready record. No analysis. No inference.
              No magical claims.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/privacy"
                className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-white dark:text-zinc-950"
              >
                Read privacy
              </a>
              <a
                href="#details"
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900/50"
              >
                What we record
              </a>
            </div>

            <div className="mt-8 max-w-xl rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-[12px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
              Receipt is <span className="font-medium">not</span> an e-signature tool. It does{" "}
              <span className="font-medium">not</span> verify identity by default, and it does{" "}
              <span className="font-medium">not</span> assess understanding, consent, or intent.
            </div>
          </div>

          {/* Right-side: principles panel */}
          <div className="relative">
            <div className="pointer-events-none absolute -inset-6 rounded-[28px] bg-linear-to-br from-zinc-200/60 via-transparent to-zinc-200/60 blur-2xl dark:from-zinc-800/40 dark:to-zinc-800/40" />
            <div className="relative rounded-[28px] border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 md:p-8">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Security posture
              </div>
              <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Receipt is designed around a simple idea: do less, but do it cleanly, and make the
                output useful.
              </div>

              <div className="mt-6 space-y-4">
                <DotRow
                  title="Minimise data"
                  body="Record only what’s needed to evidence access and acknowledgement."
                />
                <DotRow
                  title="Stay neutral"
                  body="No “read and understood”, no “consented”, no guesswork."
                />
                <DotRow
                  title="Make it exportable"
                  body="A consistent record your team can store with the matter."
                />
              </div>

              <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
                If you need identity verification, signing, or advanced compliance workflows, Receipt
                should sit alongside those tools, not pretend to replace them.
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
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Minimal claims
                </div>
                <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Receipt records observable events. It doesn’t assert understanding, intent, or
                  consent, because those aren’t observable.
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
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Optional IP logging
                </div>
                <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Where enabled, Receipt can store IP and user-agent data for access events. Leave it
                  off when it’s not appropriate for your context.
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
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Document integrity
                </div>
                <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Document hashing helps you evidence what was actually sent and reviewed, useful
                  when versions change.
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* What we record / what we don't */}
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="What Receipt records" subtle>
            <div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              Receipt is built around a small set of facts. Typical fields include:
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
              You control what you store and how long you keep it, align this with your internal
              policies and your Privacy notice.
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

        {/* Data handling CTA */}
        <div className="mt-10 rounded-3xl border border-zinc-200 bg-linear-to-b from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/30 md:p-8">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <div className="text-lg font-semibold tracking-tight">
                Data handling & retention
              </div>
              <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                What you store (and for how long) should match your internal policies. Our Privacy
                page covers personal data and retention at a high level.
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <a
                href="/privacy"
                className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-white dark:text-zinc-950"
              >
                Read privacy
              </a>
              <a
                href="/terms"
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900/50"
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
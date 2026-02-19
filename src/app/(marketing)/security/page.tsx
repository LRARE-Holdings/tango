// src/app/(marketing)/security/page.tsx

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--mk-border)] bg-[var(--mk-surface)] px-3 py-1 text-xs font-medium text-[var(--mk-muted)] shadow-sm  ">
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
          ? "bg-[var(--mk-border)] bg-[var(--mk-surface-soft)] "
          : "bg-[var(--mk-border)] bg-[var(--mk-surface)] ",
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
    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] text-[var(--mk-fg)] shadow-sm  ">
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
            <div className="flex flex-wrap gap-2">
              <Badge>Neutral by design</Badge>
              <Badge>Optional IP logging</Badge>
              <Badge>Version hashing</Badge>
            </div>

            <div className="mt-6 text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
              SECURITY
            </div>

            <h1 className="marketing-hero mt-2 text-4xl sm:text-5xl">
              Calm security.
              <span className="text-[var(--mk-accent)]">{" "}Clear boundaries.</span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--mk-muted)]">
              Receipt is built to be a focused utility: it records document
              access, review activity, and acknowledgement, then produces a
              file-ready record. No analysis. No inference. No magical claims.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/privacy"
                className="inline-flex items-center justify-center rounded-full marketing-cta-primary px-6 py-3 text-sm font-semibold shadow-sm"
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
                Receipt is designed around a simple idea: do less, but do it
                cleanly, and make the output useful.
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
                  Minimal claims
                </div>
                <div className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
                  Receipt records observable events. It doesn’t assert
                  understanding, intent, or consent, because those aren’t
                  observable.
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
                  Optional IP logging
                </div>
                <div className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
                  Where enabled, Receipt can store IP and user-agent data for
                  access events. Leave it off when it’s not appropriate for your
                  context.
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
                  Document integrity
                </div>
                <div className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
                  Document hashing helps you evidence what was actually sent and
                  reviewed, useful when versions change.
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
                <div>• delivered_at / first_opened_at</div>
                <div>• max_scroll_percent</div>
                <div>• time_on_page_seconds</div>
                <div>• acknowledgement + submitted_at</div>
                <div>• (optional) ip + user_agent</div>
                <div>• document hash / version</div>
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
                className="inline-flex items-center justify-center rounded-full marketing-cta-primary px-6 py-3 text-sm font-semibold shadow-sm"
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

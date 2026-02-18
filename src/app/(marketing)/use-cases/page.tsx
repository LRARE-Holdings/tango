import Link from "next/link";

type UseCase = {
  id: string;
  title: string;
  team: string;
  summary: string;
  moments: string[];
  record: string[];
  outcome: string;
};

const useCases: UseCase[] = [
  {
    id: "legal-client-care",
    title: "Client Care Letters",
    team: "Legal teams",
    summary:
      "Send client care letters with a clean trail showing delivery, access, review activity, and acknowledgement.",
    moments: [
      "At instruction start for new matters",
      "When updating scope or fee assumptions",
      "When you need a clean file note for compliance review",
    ],
    record: [
      "Delivery and first-open timestamps",
      "On-page review activity (scroll depth, time on page)",
      "Acknowledgement timestamp with optional identity fields",
    ],
    outcome:
      "A practical record that can be exported and stored with the matter file without over-claiming intent.",
  },
  {
    id: "hr-onboarding",
    title: "Onboarding Packs",
    team: "HR and People Ops",
    summary:
      "Share employee handbooks and policy packs through one link, then keep a consistent onboarding record.",
    moments: [
      "Pre-start onboarding packs",
      "Annual policy refresh cycles",
      "Role change or internal transfer updates",
    ],
    record: [
      "Who opened and when",
      "How far the document was reviewed",
      "Acknowledgement trail for each recipient",
    ],
    outcome:
      "A repeatable process for onboarding documentation that reduces chasing and improves audit readiness.",
  },
  {
    id: "compliance-updates",
    title: "Policy & Compliance Updates",
    team: "Compliance teams",
    summary:
      "Roll out policy updates to internal teams and retain a neutral record of review and acknowledgement.",
    moments: [
      "Handbook or policy amendments",
      "Risk and control updates",
      "Regulated process reminders",
    ],
    record: [
      "Access and activity timestamps",
      "Acknowledgement and submission time",
      "Version-linked evidence tied to the exact document",
    ],
    outcome:
      "Cleaner audit conversations with consistent evidence of what was sent, viewed, and acknowledged.",
  },
  {
    id: "client-terms-notices",
    title: "Terms & Notice Updates",
    team: "Commercial and operations teams",
    summary:
      "Distribute terms updates, service notices, and key client communications with straightforward proof of review.",
    moments: [
      "Terms of business revisions",
      "Service-level or process change notices",
      "Client communications requiring acknowledgement",
    ],
    record: [
      "Delivery and first-open events",
      "Review activity before acknowledgement",
      "Exportable receipt record for account history",
    ],
    outcome:
      "A simple, consistent way to evidence client communications across accounts and renewals.",
  },
  {
    id: "supplier-governance",
    title: "Supplier Governance",
    team: "Procurement and vendor management",
    summary:
      "Send standards, code-of-conduct documents, and process requirements to suppliers with a clear audit trail.",
    moments: [
      "New supplier onboarding",
      "Annual governance attestations",
      "Operational process updates for active suppliers",
    ],
    record: [
      "When suppliers opened and reviewed documents",
      "Acknowledgement completion timestamps",
      "Consistent record format across all vendors",
    ],
    outcome:
      "Reduced ambiguity in supplier oversight and easier evidence gathering during governance reviews.",
  },
  {
    id: "internal-rollouts",
    title: "Internal Rollouts",
    team: "Operations and leadership teams",
    summary:
      "Roll out internal notices and procedural changes across departments while keeping one clear record format.",
    moments: [
      "New operating procedures",
      "Cross-team process standardization",
      "Leadership communications requiring confirmation",
    ],
    record: [
      "Per-user access and review signals",
      "Acknowledgement capture when required",
      "Export-ready record for internal governance files",
    ],
    outcome:
      "Faster rollout follow-through with less manual chasing and cleaner internal accountability.",
  },
];

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="max-w-3xl">
      {eyebrow ? (
        <div className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-500">
          {eyebrow}
        </div>
      ) : null}
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      {subtitle ? (
        <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export default function UseCasesPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(0,0,0,0.06),transparent_55%)] dark:bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_90%_0%,rgba(0,0,0,0.04),transparent_55%)] dark:bg-[radial-gradient(900px_circle_at_90%_0%,rgba(255,255,255,0.06),transparent_55%)]" />
      </div>

      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <SectionHeading
          eyebrow="USE CASES"
          title="Where Receipt fits best"
          subtitle="Explore focused playbooks by team. Each section maps specific moments, what gets recorded, and the practical result."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="sticky top-[64px] z-20 -mx-2 mb-8 overflow-x-auto px-2 pb-2 md:hidden">
          <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white/95 p-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
            {useCases.map((item, index) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-zinc-900 text-[11px] font-semibold text-white dark:bg-white dark:text-zinc-900">
                  {index + 1}
                </span>
                {item.title}
              </a>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-3xl border border-zinc-200 bg-white/95 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
              <div className="text-[11px] font-semibold tracking-widest text-zinc-500 dark:text-zinc-500">
                CASE NAVIGATOR
              </div>
              <div className="mt-4 space-y-2">
                {useCases.map((item, index) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="group flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/40 dark:hover:bg-zinc-900"
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-[11px] font-semibold text-white dark:bg-white dark:text-zinc-900">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-zinc-500 dark:text-zinc-500">
                        {item.team}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            {useCases.map((item, index) => (
              <section
                key={item.id}
                id={item.id}
                className="scroll-mt-28 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:p-8"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
                        {index + 1}
                      </span>
                      {item.team}
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight">{item.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {item.summary}
                    </p>
                  </div>
                  <Link
                    href="/get-started"
                    className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-100 dark:hover:bg-zinc-900"
                  >
                    Try this flow
                  </Link>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <div className="text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-500">
                      Best Moments
                    </div>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {item.moments.map((row) => (
                        <li key={row}>• {row}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <div className="text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-500">
                      What Gets Recorded
                    </div>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {item.record.map((row) => (
                        <li key={row}>• {row}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <div className="text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-500">
                      Practical Result
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {item.outcome}
                    </p>
                  </div>
                </div>
              </section>
            ))}

            <section className="rounded-3xl border border-zinc-200 bg-linear-to-b from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/30 md:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="max-w-2xl">
                  <h3 className="text-xl font-semibold tracking-tight">
                    Don’t see your workflow?
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Receipt is intentionally narrow. If you send PDFs and need a neutral, exportable record,
                    this pattern usually fits.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                  <Link
                    href="/get-started"
                className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-white dark:text-zinc-950"
              >
                Get started
                  </Link>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900/50"
                  >
                    View pricing
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

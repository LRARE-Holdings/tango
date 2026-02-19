"use client";

import Link from "next/link";
import { useMemo, useState, type KeyboardEvent } from "react";

type CategoryId =
  | "legal"
  | "people-ops"
  | "compliance"
  | "commercial"
  | "operations";

type UseCase = {
  id: string;
  title: string;
  category: CategoryId;
  summary: string;
  triggers: string[];
  observedSignals: string[];
  outcome: string;
  evidencePoints: string[];
};

type CategoryMeta = {
  id: CategoryId;
  label: string;
  valueProp: string;
};

const categories: CategoryMeta[] = [
  {
    id: "legal",
    label: "Legal",
    valueProp: "Evidence-backed client communication without file-note guesswork.",
  },
  {
    id: "people-ops",
    label: "People Ops",
    valueProp: "Consistent onboarding accountability across every policy cycle.",
  },
  {
    id: "compliance",
    label: "Compliance",
    valueProp: "Neutral rollout evidence that stands up in governance reviews.",
  },
  {
    id: "commercial",
    label: "Commercial",
    valueProp: "Client notice delivery with clear review and acknowledgement trails.",
  },
  {
    id: "operations",
    label: "Operations",
    valueProp: "Operational consistency across vendors and internal teams.",
  },
];

const useCases: UseCase[] = [
  {
    id: "client-care-letters",
    title: "Client Care Letters",
    category: "legal",
    summary:
      "Keep legal communication audit-ready by capturing document delivery, review activity, and acknowledgement in one record.",
    triggers: [
      "Matter opening documents and engagement terms.",
      "Scope and fee assumption updates during active files.",
      "Internal compliance sampling or partner review windows.",
    ],
    observedSignals: [
      "Delivery and first-open timestamps per recipient.",
      "Document review activity such as dwell time and depth.",
      "Acknowledgement submission time with optional identity fields.",
    ],
    outcome:
      "A defensible communication trail attached to the matter file without over-claiming legal intent.",
    evidencePoints: [
      "Version-linked timeline",
      "Recipient-level activity",
      "Exportable acknowledgement record",
    ],
  },
  {
    id: "onboarding-packs",
    title: "Onboarding Packs",
    category: "people-ops",
    summary:
      "Run onboarding and annual refreshes with one evidence format that reduces manual follow-up.",
    triggers: [
      "Pre-start policy pack distribution.",
      "Annual handbook and policy refresh cycles.",
      "Role changes introducing updated obligations.",
    ],
    observedSignals: [
      "Access timestamps for each team member.",
      "Review activity before acknowledgement.",
      "Completion timestamps for every acknowledgement.",
    ],
    outcome:
      "Higher onboarding consistency with a clean audit trail for policy communications.",
    evidencePoints: [
      "Team-wide completion view",
      "Per-recipient review markers",
      "Export-ready records",
    ],
  },
  {
    id: "policy-compliance-updates",
    title: "Policy & Compliance Updates",
    category: "compliance",
    summary:
      "Roll out policy changes with objective evidence of who reviewed and acknowledged each release.",
    triggers: [
      "Control framework or policy amendments.",
      "Regulatory guidance updates requiring rollout proof.",
      "Periodic internal attestations.",
    ],
    observedSignals: [
      "Delivery and open events tied to document versions.",
      "Review activity captured before acknowledgement.",
      "Submission timestamps linked to each release.",
    ],
    outcome:
      "Cleaner audit conversations built on observable activity rather than inbox assumptions.",
    evidencePoints: [
      "Version-specific evidence",
      "Observable activity logs",
      "Acknowledgement timestamps",
    ],
  },
  {
    id: "terms-notice-updates",
    title: "Terms & Notice Updates",
    category: "commercial",
    summary:
      "Standardize client notice communications with evidence that extends beyond sent-mail confirmation.",
    triggers: [
      "Terms of business revisions.",
      "Service process and SLA updates.",
      "Client notices requiring acknowledgement.",
    ],
    observedSignals: [
      "Per-client delivery and open timestamps.",
      "Review activity before confirmation.",
      "Exportable account-level communication history.",
    ],
    outcome:
      "A consistent client communication standard across account teams and renewal cycles.",
    evidencePoints: [
      "Account-level audit trail",
      "Review + acknowledgement linkage",
      "Clean export format",
    ],
  },
  {
    id: "supplier-governance",
    title: "Supplier Governance",
    category: "operations",
    summary:
      "Apply one governance communication pattern across suppliers, standards, and control updates.",
    triggers: [
      "New supplier onboarding.",
      "Annual conduct and standards attestations.",
      "Mid-contract governance requirement updates.",
    ],
    observedSignals: [
      "Supplier access and first-open events.",
      "Review activity tied to each document release.",
      "Acknowledgement completion events in a common format.",
    ],
    outcome:
      "Lower operational risk through standardized vendor communication evidence.",
    evidencePoints: [
      "Vendor rollout tracking",
      "Consistent evidence model",
      "Governance-ready exports",
    ],
  },
  {
    id: "internal-rollouts",
    title: "Internal Rollouts",
    category: "operations",
    summary:
      "Coordinate process updates across departments with a single accountability model.",
    triggers: [
      "New operating procedure launches.",
      "Cross-functional process standardization initiatives.",
      "Leadership communications needing confirmation.",
    ],
    observedSignals: [
      "Department-level delivery and open activity.",
      "Review and acknowledgement completion status.",
      "Export-ready records for governance files.",
    ],
    outcome:
      "Faster rollout follow-through with less chasing and better internal clarity.",
    evidencePoints: [
      "Department rollout view",
      "Completion timeline",
      "Governance-ready evidence",
    ],
  },
];

function UseCasesHero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
      <div className="max-w-4xl">
        <div className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
          USE CASES
        </div>
        <h1 className="marketing-hero mt-2 text-4xl sm:text-5xl lg:text-6xl">
          Clarity for <span className="text-[var(--mk-accent)]">high-stakes</span>
          <br></br> document workflows.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-[var(--mk-muted)] sm:text-lg">
          Receipt gives teams one neutral evidence standard: delivery, review
          activity, and acknowledgement in a format built for operational trust.
        </p>
      </div>
    </section>
  );
}

function UseCasesTabs({
  categories,
  active,
  onSelect,
}: {
  categories: CategoryMeta[];
  active: CategoryId;
  onSelect: (id: CategoryId) => void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = categories.findIndex((item) => item.id === active);
    if (index < 0) return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      onSelect(categories[(index + 1) % categories.length].id);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onSelect(categories[(index - 1 + categories.length) % categories.length].id);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      onSelect(categories[0].id);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      onSelect(categories[categories.length - 1].id);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(active);
    }
  };

  return (
    <div className="usecases-tablist-wrap">
      <div
        className="usecases-tablist"
        role="tablist"
        aria-label="Use case categories"
      >
        {categories.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              id={`tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(item.id)}
              onKeyDown={onKeyDown}
              className={`usecases-tab ${selected ? "usecases-tab-active" : ""}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UseCasesSpotlight({
  category,
  spotlight,
  secondary,
}: {
  category: CategoryMeta;
  spotlight: UseCase;
  secondary: UseCase[];
}) {
  return (
    <section
      id={`panel-${category.id}`}
      role="tabpanel"
      aria-labelledby={`tab-${category.id}`}
      className="usecases-spotlight"
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <article className="rounded-3xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-6 shadow-sm md:p-8">
          <div className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
            {category.label.toUpperCase()}
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {spotlight.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)] sm:text-base">
            {category.valueProp}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--mk-muted)] sm:text-base">
            {spotlight.summary}
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface-soft)] p-4">
              <h3 className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
                Trigger Moments
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--mk-muted)]">
                {spotlight.triggers.map((row) => (
                  <li key={row}>• {row}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface-soft)] p-4">
              <h3 className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
                Observed Signals
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--mk-muted)]">
                {spotlight.observedSignals.map((row) => (
                  <li key={row}>• {row}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface-soft)] p-4">
            <h3 className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
              Operational Outcome
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
              {spotlight.outcome}
            </p>
          </div>
        </article>

        <aside className="usecases-evidence-panel rounded-3xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-5 shadow-sm md:p-6">
          <div className="text-[11px] font-semibold tracking-widest text-[var(--mk-muted)]">
            EVIDENCE PREVIEW
          </div>
          <div className="mt-3 text-base font-semibold text-[var(--mk-fg)]">
            What gets captured
          </div>
          <div className="mt-4 space-y-2">
            {spotlight.evidencePoints.map((point) => (
              <div
                key={point}
                className="rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface-soft)] px-3 py-2 text-sm text-[var(--mk-muted)]"
              >
                {point}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface-soft)] px-3 py-3 text-xs leading-relaxed text-[var(--mk-muted)]">
            Receipt records observable events only. It does not infer intent or
            comprehension.
          </div>
        </aside>
      </div>

      {secondary.length ? (
        <div className="usecases-secondary-grid mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {secondary.map((item) => (
            <article
              key={item.id}
              className="rounded-3xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-5 shadow-sm"
            >
              <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
                {item.summary}
              </p>
              <div className="mt-3 text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
                Outcome
              </div>
              <p className="mt-1 text-sm leading-relaxed text-[var(--mk-muted)]">
                {item.outcome}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function UseCasesStandards() {
  return (
    <section className="usecases-standard-band rounded-3xl border border-[var(--mk-border)] p-6 shadow-sm md:p-8">
      <div className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
        CROSS-WORKFLOW STANDARDS
      </div>
      <h2 className="marketing-serif mt-2 text-3xl sm:text-4xl">
        One evidence model across every team
      </h2>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-4">
          <h3 className="text-sm font-semibold">What Receipt records</h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
            Delivery events, access timestamps, review activity, and
            acknowledgement completion tied to specific document versions.
          </p>
        </article>
        <article className="rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-4">
          <h3 className="text-sm font-semibold">What Receipt does not claim</h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
            Receipt does not claim identity verification, legal intent, or
            comprehension beyond observed activity.
          </p>
        </article>
        <article className="rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-4">
          <h3 className="text-sm font-semibold">Why teams use it</h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
            A consistent, exportable evidence format simplifies governance,
            internal reporting, and external audit preparation.
          </p>
        </article>
      </div>
    </section>
  );
}

function UseCasesCta() {
  return (
    <section className="rounded-3xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Move from sent messages to verifiable trails.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)] sm:text-base">
            Start with one workflow and scale a premium evidence standard across
            legal, people, compliance, commercial, and operations.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/get-started"
            className="inline-flex items-center justify-center rounded-full marketing-cta-primary marketing-cta-primary-sans px-6 py-3 text-sm font-semibold shadow-sm"
          >
            Get started
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-full marketing-cta-secondary px-6 py-3 text-sm font-semibold text-[var(--mk-fg)] shadow-sm"
          >
            View pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function UseCasesPage() {
  const [active, setActive] = useState<CategoryId>("legal");

  const category = useMemo(
    () => categories.find((item) => item.id === active) ?? categories[0],
    [active]
  );

  const casesInCategory = useMemo(
    () => useCases.filter((item) => item.category === category.id),
    [category.id]
  );

  const spotlight = casesInCategory[0];
  const secondary = casesInCategory.slice(1);

  return (
    <main className="usecases-shell min-h-screen bg-[var(--mk-bg)] text-[var(--mk-fg)]">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 marketing-glow" />
      </div>

      <UseCasesHero />

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <UseCasesTabs categories={categories} active={active} onSelect={setActive} />
        {spotlight ? (
          <UseCasesSpotlight
            key={category.id}
            category={category}
            spotlight={spotlight}
            secondary={secondary}
          />
        ) : null}
        <div className="mt-6 space-y-6">
          <UseCasesStandards />
          <UseCasesCta />
        </div>
      </section>
    </main>
  );
}

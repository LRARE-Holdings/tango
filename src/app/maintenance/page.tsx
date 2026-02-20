export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-[var(--mk-bg)] px-6 py-16 text-[var(--mk-fg)]">
      <section className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center justify-center">
        <div className="w-full rounded-3xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-8 text-center shadow-sm sm:p-10">
          <div className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
            SCHEDULED MAINTENANCE
          </div>
          <h1 className="marketing-hero mt-3 text-4xl sm:text-5xl">
            We&apos;re down for maintenance.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[var(--mk-muted)] sm:text-base">
            Receipt is temporarily unavailable while we complete scheduled
            updates. Maintenance window: 12:00am to 2:00am (GMT).
          </p>
          <a
            href="https://status.getreceipt.co"
            className="mt-8 inline-flex items-center justify-center rounded-full marketing-cta-primary marketing-cta-primary-sans px-6 py-3 text-sm font-semibold shadow-sm"
          >
            View status page
          </a>
        </div>
      </section>
    </main>
  );
}

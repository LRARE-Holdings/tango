async function submitEnterpriseEnquiry(formData: FormData) {
  "use server";
  const payload = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    company: String(formData.get("company") ?? ""),
    seats: String(formData.get("seats") ?? ""),
    message: String(formData.get("message") ?? ""),
    source: String(formData.get("source") ?? "enterprise"),
    createdAt: new Date().toISOString(),
  }; // Enquiry handling can be wired to CRM/email without changing this page copy. void payload;
}
export default function EnterprisePage() {
  return (
    <main className="min-h-screen bg-[var(--mk-bg)] text-[var(--mk-fg)]">
      {/* background texture */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 marketing-glow" />
        <div className="absolute inset-0 " />
      </div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
            ENTERPRISE
          </div>
          <h1 className="marketing-hero mt-2 text-4xl sm:text-5xl">
            For organisations that need clarity, control, and custom terms.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[var(--mk-muted)]">
            Enterprise plans are designed for firms with procurement
            requirements, bespoke workflows, or enhanced governance needs. We
            scope these properly, no generic bundles, no vague promises.
          </p>
        </div>
      </section>
      {/* Who it's for */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              t: "Larger teams",
              b: "Multiple departments or practice groups with shared governance and oversight.",
            },
            {
              t: "Procurement-led buyers",
              b: "Organisations that require contracts, security review, and predictable billing.",
            },
            {
              t: "Regulated environments",
              b: "Firms that need clear boundaries, audit-friendly records, and restrained claims.",
            },
          ].map((x) => (
            <div
              key={x.t}
              className="rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-5 shadow-sm "
            >
              <div className="text-sm font-semibold">{x.t}</div>
              <div className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
                {x.b}
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* What you get */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="rounded-3xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-6 shadow-sm md:p-8">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight">
              What Enterprise typically includes
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
              Final scope depends on your requirements, but Enterprise plans
              often include:
            </p>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              "Custom seat counts and pricing structure",
              "Contractual terms and invoicing (no card-only billing)",
              "Advanced governance and admin controls",
              "Organisation-wide defaults and branding",
              "Security and data handling documentation",
              "Priority support and escalation path",
            ].map((b) => (
              <div
                key={b}
                className="flex gap-3 rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface-soft)] p-4 text-sm text-[var(--mk-muted)] "
              >
                <span className="mt-1.75 inline-block h-1.5 w-1.5 rounded-full bg-[var(--mk-muted-2)]" />
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* What it is not */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="rounded-3xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-semibold tracking-tight">
            What Enterprise is not
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--mk-muted)]">
            We’re explicit about this to avoid mismatched expectations.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              "Not an e-signature or consent platform",
              "Not a system that infers intent or understanding",
              "Not a generic AI-powered analysis tool",
            ].map((b) => (
              <div
                key={b}
                className="rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface-soft)] p-4 text-sm text-[var(--mk-muted)] "
              >
                {b}
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Contact */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-3xl border border-[var(--mk-border)] bg-linear-to-b bg-[var(--mk-surface-alt)] p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight">
                Talk to us about Enterprise
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--mk-muted)]">
                Tell us a little about your organisation and what you need.
                We’ll respond with clarity, not a hard sell.
              </p>
            </div>
            <div className="w-full md:max-w-md">
              <form className="space-y-3" action={submitEnterpriseEnquiry}>
                <input type="hidden" name="source" value="enterprise" />
                <input
                  className="w-full rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] px-4 py-3 text-sm text-[var(--mk-fg)] outline-none placeholder:text-[var(--mk-muted-2)] focus:ring-2 focus:ring-[var(--mk-fg)]/20"
                  placeholder="Name"
                  name="name"
                />
                <input
                  type="email"
                  className="w-full rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] px-4 py-3 text-sm text-[var(--mk-fg)] outline-none placeholder:text-[var(--mk-muted-2)] focus:ring-2 focus:ring-[var(--mk-fg)]/20"
                  placeholder="Work email"
                  name="email"
                />
                <input
                  className="w-full rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] px-4 py-3 text-sm text-[var(--mk-fg)] outline-none placeholder:text-[var(--mk-muted-2)] focus:ring-2 focus:ring-[var(--mk-fg)]/20"
                  placeholder="Organisation"
                  name="company"
                />
                <input
                  className="w-full rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] px-4 py-3 text-sm text-[var(--mk-fg)] outline-none placeholder:text-[var(--mk-muted-2)] focus:ring-2 focus:ring-[var(--mk-fg)]/20"
                  placeholder="Approx. number of users"
                  name="seats"
                />
                <textarea
                  className="min-h-30 w-full rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] px-4 py-3 text-sm text-[var(--mk-fg)] outline-none placeholder:text-[var(--mk-muted-2)] focus:ring-2 focus:ring-[var(--mk-fg)]/20"
                  placeholder="What do you need Receipt to do?"
                  name="message"
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-full marketing-cta-primary px-5 py-3 text-sm font-semibold shadow-sm "
                >
                  Send enquiry
                </button>
                <div className="text-[12px] leading-relaxed text-[var(--mk-muted)]">
                  We’ll only use your details to respond to this enquiry.
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

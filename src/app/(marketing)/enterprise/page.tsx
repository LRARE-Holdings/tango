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
  };

  // TODO: Wire this to your email/CRM.
  // eslint-disable-next-line no-console
  console.log("Enterprise enquiry", payload);
}

export default function EnterprisePage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* background texture */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(0,0,0,0.06),transparent_55%)] dark:bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_90%_0%,rgba(0,0,0,0.04),transparent_55%)] dark:bg-[radial-gradient(900px_circle_at_90%_0%,rgba(255,255,255,0.06),transparent_55%)]" />
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-500">
            ENTERPRISE
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            For organisations that need clarity, control, and custom terms.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Enterprise plans are designed for firms with procurement requirements,
            bespoke workflows, or enhanced governance needs. We scope these properly ,
            no generic bundles, no vague promises.
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
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="text-sm font-semibold">{x.t}</div>
              <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {x.b}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What you get */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:p-8">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight">
              What Enterprise typically includes
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Final scope depends on your requirements, but Enterprise plans often include:
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
                className="flex gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300"
              >
                <span className="mt-1.75 inline-block h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What it is not */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:p-8">
          <h2 className="text-xl font-semibold tracking-tight">
            What Enterprise is not
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
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
                className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300"
              >
                {b}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-3xl border border-zinc-200 bg-linear-to-b from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/30 md:p-8">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight">
                Talk to us about Enterprise
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Tell us a little about your organisation and what you need.
                We’ll respond with clarity , not a hard sell.
              </p>
            </div>

            <div className="w-full md:max-w-md">
              <form className="space-y-3" action={submitEnterpriseEnquiry}>
                <input type="hidden" name="source" value="enterprise" />
                <input
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:ring-white/20"
                  placeholder="Name"
                  name="name"
                />
                <input
                  type="email"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:ring-white/20"
                  placeholder="Work email"
                  name="email"
                />
                <input
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:ring-white/20"
                  placeholder="Organisation"
                  name="company"
                />
                <input
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:ring-white/20"
                  placeholder="Approx. number of users"
                  name="seats"
                />
                <textarea
                  className="min-h-30 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:ring-white/20"
                  placeholder="What do you need Receipt to do?"
                  name="message"
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-white dark:text-zinc-950"
                >
                  Send enquiry
                </button>

                <div className="text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-500">
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
export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="mx-auto max-w-3xl px-6 pt-14 pb-16">
        <div className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-500">
          TERMS
        </div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Terms of service</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          This page will set out the terms governing your use of Receipt, including acceptable use,
          limitations, subscription/payment terms, and the product’s intended scope (neutral record,
          not e-signature).
        </p>

        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Placeholder: Add your full terms here (subscriptions, overage billing, liability limits,
          warranties, support, governing law, etc.).
        </div>
      </section>
    </main>
  );
}
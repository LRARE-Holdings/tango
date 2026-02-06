export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="mx-auto max-w-3xl px-6 pt-14 pb-16">
        <div className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-500">
          PRIVACY POLICY
        </div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Privacy</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          This page will set out how Receipt (a utility by LRARE) processes personal data, including
          event logs (delivery, access, activity and acknowledgement) and optional IP/user-agent
          fields where enabled.
        </p>

        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Placeholder: Add your full policy text here (controller/processor roles, lawful basis,
          retention, sub-processors, data subject rights, contact details, etc.).
        </div>
      </section>
    </main>
  );
}
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="mx-auto max-w-3xl px-6 pt-14 pb-20">
        <div className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-500">
          PRIVACY POLICY
        </div>

        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Privacy</h1>

        <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          This Privacy Policy explains how Receipt (“Receipt”, “we”, “us”) collects, uses and
          protects personal data. Receipt is a product operated by LRARE Holdings Ltd (Company No.
          16807366).
        </p>

        {/* 1. Who we are */}
        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">1. Who we are</h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Receipt provides a neutral record of PDF delivery, access, review activity and
            acknowledgement. We do not provide legal advice, identity verification or e-signature
            services.
          </p>
        </section>

        {/* 2. Roles */}
        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            2. Data protection roles
          </h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            For account holders (“users”), Receipt acts as a <strong>data controller</strong> in
            respect of account, billing and service usage data.
          </p>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            For individuals who receive and review documents (“recipients”), Receipt generally acts
            as a <strong>data processor</strong> on behalf of the user who shared the document, unless
            stated otherwise.
          </p>
        </section>

        {/* 3. Data we collect */}
        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">
            3. Personal data we collect
          </h2>

          <div className="space-y-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            <p>
              <strong>Account holders (users)</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Email address</li>
              <li>Authentication data (including Google sign-in where used)</li>
              <li>Subscription and billing status</li>
              <li>Workspace and configuration settings</li>
            </ul>

            <p className="pt-2">
              <strong>Recipients of documents</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Email address (where provided by the user or used for delivery)</li>
              <li>IP address</li>
              <li>Device and browser information (user agent)</li>
              <li>Document access timestamps</li>
              <li>Review activity (e.g. time on page, scroll depth)</li>
              <li>Acknowledgement status and timestamp</li>
            </ul>

            <p className="pt-2">
              Receipt does <strong>not</strong> attempt to infer intent, understanding, consent or
              identity.
            </p>
          </div>
        </section>

        {/* 4. How we use data */}
        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            4. How we use personal data
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            <li>To provide and operate the Receipt service</li>
            <li>To generate document access and acknowledgement records</li>
            <li>To manage accounts, subscriptions and billing</li>
            <li>To prevent fraud, misuse and unlawful activity</li>
            <li>
              To analyse anonymised or aggregated usage data for product improvement and statistical
              purposes
            </li>
          </ul>
        </section>

        {/* 5. Lawful basis */}
        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            5. Lawful basis for processing
          </h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            We process personal data on the basis of:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            <li>Performance of a contract</li>
            <li>Legitimate interests (service integrity, security and fraud prevention)</li>
            <li>Compliance with legal obligations</li>
            <li>Consent, where required</li>
          </ul>
        </section>

        {/* 6. Sub-processors */}
        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            6. Sub-processors and third parties
          </h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            We rely on trusted third-party providers to operate Receipt:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            <li>
              <strong>Vercel</strong> , application hosting and infrastructure
            </li>
            <li>
              <strong>Supabase</strong> , database, authentication and file storage
            </li>
            <li>
              <strong>Google</strong> , optional authentication via Google sign-in
            </li>
            <li>
              <strong>Stripe</strong> , payment processing and billing
            </li>
          </ul>
        </section>

        {/* 7. International transfers */}
        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            7. International data transfers
          </h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Some of our service providers operate outside the UK or EEA. Where this occurs, we rely
            on appropriate safeguards such as standard contractual clauses or equivalent protections.
          </p>
        </section>

        {/* 8. Retention */}
        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            8. Data retention
          </h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Personal data is retained only for as long as necessary to provide the service, comply
            with legal obligations, or as determined by the user’s configuration and internal
            policies.
          </p>
        </section>

        {/* 9. Rights */}
        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            9. Your rights
          </h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Depending on your location, you may have rights to access, correct, delete or restrict
            processing of your personal data, or to object to certain uses.
          </p>
        </section>

        {/* 10. Contact */}
        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            10. Contact
          </h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            For privacy-related enquiries, contact:
          </p>
          <p className="text-sm font-medium">
            privacy@lrare.co.uk
          </p>
        </section>

        <div className="mt-14 text-xs text-zinc-500 dark:text-zinc-500">
          Last updated: {new Date().toISOString().slice(0, 10)}
        </div>
      </section>
    </main>
  );
}
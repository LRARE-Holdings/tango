import type { Metadata } from "next";
import { buildMarketingMetadata } from "@/lib/seo";
import { TermsOfServiceContent } from "@/components/legal/terms-of-service-content";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Terms of Service",
  description:
    "Read the Receipt Terms of Service governing account use, subscriptions, service boundaries and legal responsibilities.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--mk-bg)] text-[var(--mk-fg)]">
      <section className="mx-auto max-w-3xl px-6 pt-14 pb-20">
        <TermsOfServiceContent />
      </section>
    </main>
  );
}

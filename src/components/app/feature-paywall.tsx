import Link from "next/link";

type FeaturePaywallProps = {
  featureName: string;
  detail?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export function FeaturePaywall({
  featureName,
  detail = "This feature is available on Pro, Team, and Enterprise workspaces.",
  ctaHref = "/pricing",
  ctaLabel = "Upgrade to Pro",
}: FeaturePaywallProps) {
  return (
    <section
      className="app-content-card p-6 md:p-7"
      style={{
        background:
          "radial-gradient(circle at 20% 0%, color-mix(in srgb, var(--card2) 70%, transparent), transparent 50%), var(--card)",
      }}
    >
      <div className="app-section-kicker">UPGRADE REQUIRED</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{featureName} is available on Pro+</h2>
      <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
        {detail}
      </p>
      <div className="mt-5 flex items-center gap-2">
        <Link href={ctaHref} className="focus-ring app-btn-primary">
          {ctaLabel}
        </Link>
        <Link href="/app/workspaces" className="focus-ring app-btn-secondary">
          Workspace settings
        </Link>
      </div>
    </section>
  );
}

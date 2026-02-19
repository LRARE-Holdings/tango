import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="marketing-shell min-h-screen bg-[var(--mk-bg)] text-[var(--mk-fg)]">
      <MarketingHeader />
      <div>{children}</div>
      <MarketingFooter />
    </div>
  );
}

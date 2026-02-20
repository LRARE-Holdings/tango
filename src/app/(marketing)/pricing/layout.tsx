import type { Metadata } from "next";
import { buildMarketingMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Pricing",
  description:
    "Compare Receipt plans for Personal, Pro, Team and Enterprise, with clear document limits and billing options.",
  path: "/pricing",
  keywords: ["pricing", "document acknowledgement pricing", "team compliance software pricing"],
});

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

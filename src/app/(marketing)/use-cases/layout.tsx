import type { Metadata } from "next";
import { buildMarketingMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Use Cases",
  description:
    "Explore how legal, compliance, people operations and commercial teams use Receipt for policy and document acknowledgement.",
  path: "/use-cases",
  keywords: ["use cases", "legal compliance tools", "policy acknowledgement examples"],
});

export default function UseCasesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started",
  description: "Create your Receipt account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function GetStartedLayout({ children }: { children: React.ReactNode }) {
  return children;
}

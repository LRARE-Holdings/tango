import "./globals.css";
import { Inter, Instrument_Serif } from "next/font/google";
import type { Metadata } from "next";
import { CookieConsent } from "@/components/cookie-consent";
import { getSiteUrl } from "@/lib/seo";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Receipt | Proof of document acknowledgement",
    template: "%s | Receipt",
  },
  description:
    "Receipt provides clear proof of document delivery, review activity and acknowledgement for teams operating in regulated and high-accountability environments.",
  applicationName: "Receipt",
  keywords: [
    "document acknowledgement",
    "proof of delivery",
    "policy acknowledgement",
    "compliance records",
    "audit trail",
    "document tracking",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "Receipt",
    url: "/",
    title: "Receipt | Proof of document acknowledgement",
    description:
      "Clear proof of delivery, review activity and acknowledgement for policies, procedures and client documents.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Receipt",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Receipt | Proof of document acknowledgement",
    description:
      "Clear proof of delivery, review activity and acknowledgement for policies, procedures and client documents.",
    images: ["/twitter-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`h-full ${inter.variable} ${instrumentSerif.variable}`}
    >
      <body className="min-h-full">
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}

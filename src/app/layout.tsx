import "./globals.css";
import { Inter, Instrument_Serif } from "next/font/google";
import type { Metadata } from "next";
import { CookieConsent } from "@/components/cookie-consent";
import { getSiteUrl } from "@/lib/seo";
import { ThemeScript } from "@/app/theme-script";

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
  const gtmId = (process.env.NEXT_PUBLIC_GTM_ID || "GTM-T77S35PK").trim();

  return (
    <html
      lang="en"
      className={`h-full ${inter.variable} ${instrumentSerif.variable}`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full">
        {gtmId ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtmId)}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="gtm"
            />
          </noscript>
        ) : null}
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}

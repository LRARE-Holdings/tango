import type { Metadata } from "next";

const FALLBACK_SITE_URL = "https://www.getreceipt.co";

function normalizeBaseUrl(raw: string | undefined) {
  const input = String(raw ?? "").trim();
  if (!input) return FALLBACK_SITE_URL;
  return input.endsWith("/") ? input.slice(0, -1) : input;
}

export function getSiteUrl() {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL);
}

export function absoluteUrl(path: string) {
  const base = getSiteUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function buildMarketingMetadata({
  title,
  description,
  path,
  keywords,
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}): Metadata {
  const url = path.startsWith("/") ? path : `/${path}`;
  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: "Receipt",
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
      title,
      description,
      images: ["/twitter-image"],
    },
  };
}

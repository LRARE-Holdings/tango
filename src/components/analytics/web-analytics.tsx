"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type WebAnalyticsProps = {
  consentAccepted: boolean;
};

function ensureScript(id: string, src: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  const firstScript = document.getElementsByTagName("script")[0];
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
    return;
  }
  document.head.appendChild(script);
}

function ensureDataLayer() {
  window.dataLayer = window.dataLayer || [];
}

function ensureGtag() {
  ensureDataLayer();
  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer.push(args);
    };
  }
}

export function WebAnalytics({ consentAccepted }: WebAnalyticsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const gaId = useMemo(
    () => String(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-TDT3P14Q7M").trim(),
    []
  );
  const gtmId = useMemo(
    () => String(process.env.NEXT_PUBLIC_GTM_ID || "GTM-T77S35PK").trim(),
    []
  );

  const gaBootstrapped = useRef(false);
  const gtmBootstrapped = useRef(false);

  const pagePath = `${pathname || "/"}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;

  useEffect(() => {
    if (!consentAccepted) return;

    if (gtmId) {
      ensureDataLayer();
      if (!gtmBootstrapped.current) {
        window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
        ensureScript("gtm-loader", `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`);
        gtmBootstrapped.current = true;
      }
      window.dataLayer.push({
        event: "pageview",
        page_path: pagePath,
        page_title: document.title || undefined,
      });
      return;
    }

    if (!gaId) return;
    ensureGtag();
    ensureScript("ga-loader", `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`);

    if (!gaBootstrapped.current) {
      window.gtag?.("js", new Date());
      window.gtag?.("config", gaId, { anonymize_ip: true });
      gaBootstrapped.current = true;
      return;
    }

    window.gtag?.("config", gaId, { page_path: pagePath });
  }, [consentAccepted, gaId, gtmId, pagePath]);

  return null;
}

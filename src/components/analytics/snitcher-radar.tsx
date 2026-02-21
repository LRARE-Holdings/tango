"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { isPublicTrackingPath } from "@/lib/analytics/snitcher-scope";

type SnitcherRadarProps = {
  consentAccepted: boolean;
};

function buildBootstrapSource(settingsJson: string) {
  return `
!function(e){"use strict";var t=e&&e.namespace;if(t&&e.profileId&&e.cdn){var i=window[t];if(i&&Array.isArray(i)||(i=window[t]=[]),!i.initialized&&!i._loaded)if(i._loaded)console&&console.warn("[Radar] Duplicate initialization attempted");else{i._loaded=!0;["track","page","identify","group","alias","ready","debug","on","off","once","trackClick","trackSubmit","trackLink","trackForm","pageview","screen","reset","register","setAnonymousId","addSourceMiddleware","addIntegrationMiddleware","addDestinationMiddleware","giveCookieConsent"].forEach((function(e){var a;i[e]=(a=e,function(){var e=window[t];if(e.initialized)return e[a].apply(e,arguments);var i=[].slice.call(arguments);return i.unshift(a),e.push(i),e})})),-1===e.apiEndpoint.indexOf("http")&&(e.apiEndpoint="https://"+e.apiEndpoint),i.bootstrap=function(){var t,i=document.createElement("script");i.async=!0,i.type="text/javascript",i.id="__radar__",i.setAttribute("data-settings",JSON.stringify(e)),i.src=[-1!==(t=e.cdn).indexOf("http")?"":"https://",t,"/releases/latest/radar.min.js"].join("");var a=document.scripts[0];a.parentNode.insertBefore(i,a)},i.bootstrap()}}else"undefined"!=typeof console&&console.error("[Radar] Configuration incomplete")}(${settingsJson});
`;
}

export function SnitcherRadar({ consentAccepted }: SnitcherRadarProps) {
  const pathname = usePathname();
  const inScope = isPublicTrackingPath(pathname || "/");
  const enabled = process.env.NEXT_PUBLIC_SNITCHER_ENABLED !== "false";
  const shouldLoad = consentAccepted && inScope && enabled;
  const hasGrantedConsentRef = useRef(false);

  const settingsJson = useMemo(
    () =>
      JSON.stringify({
        apiEndpoint: process.env.NEXT_PUBLIC_SNITCHER_API_ENDPOINT || "radar.snitcher.com",
        cdn: process.env.NEXT_PUBLIC_SNITCHER_CDN || "cdn.snitcher.com",
        namespace: "Snitcher",
        profileId: process.env.NEXT_PUBLIC_SNITCHER_PROFILE_ID || "srOWIXW42o",
      }),
    []
  );
  const bootstrapSource = useMemo(() => buildBootstrapSource(settingsJson), [settingsJson]);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    let attempts = 0;

    const invoke = () => {
      if (cancelled) return;
      const snitcher = window.Snitcher;
      if (!snitcher) {
        if (attempts < 20) {
          attempts += 1;
          window.setTimeout(invoke, 100);
        }
        return;
      }

      if (!hasGrantedConsentRef.current) {
        snitcher.giveCookieConsent?.();
        hasGrantedConsentRef.current = true;
      }
      snitcher.page?.();
    };

    invoke();
    return () => {
      cancelled = true;
    };
  }, [shouldLoad, pathname]);

  if (!shouldLoad) return null;

  return (
    <Script id="snitcher-radar-bootstrap" strategy="afterInteractive">
      {bootstrapSource}
    </Script>
  );
}

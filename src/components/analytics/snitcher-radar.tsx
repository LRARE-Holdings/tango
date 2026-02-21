"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { isPublicTrackingPath } from "@/lib/analytics/snitcher-scope";

type SnitcherRadarProps = {
  consentAccepted: boolean;
};

const RADAR_METHODS = [
  "track",
  "page",
  "identify",
  "group",
  "alias",
  "ready",
  "debug",
  "on",
  "off",
  "once",
  "trackClick",
  "trackSubmit",
  "trackLink",
  "trackForm",
  "pageview",
  "screen",
  "reset",
  "register",
  "setAnonymousId",
  "addSourceMiddleware",
  "addIntegrationMiddleware",
  "addDestinationMiddleware",
  "giveCookieConsent",
] as const;

type RadarSettings = {
  apiEndpoint: string;
  cdn: string;
  namespace: "Snitcher";
  profileId: string;
};

type SnitcherQueue = NonNullable<Window["Snitcher"]>;

function toAbsoluteUrl(base: string) {
  if (base.includes("http://") || base.includes("https://")) return base;
  return `https://${base}`;
}

function getSnitcher(namespace: string) {
  return (window as unknown as Record<string, SnitcherQueue | undefined>)[namespace];
}

function setSnitcher(namespace: string, value: SnitcherQueue) {
  (window as unknown as Record<string, SnitcherQueue | undefined>)[namespace] = value;
}

function ensureSnitcherLoaded(rawSettings: RadarSettings) {
  if (!rawSettings.profileId || !rawSettings.cdn || !rawSettings.namespace) return null;
  const settings = { ...rawSettings, apiEndpoint: toAbsoluteUrl(rawSettings.apiEndpoint) };
  const namespace = settings.namespace;
  const existing = getSnitcher(namespace);
  const queue = (existing && Array.isArray(existing) ? existing : []) as SnitcherQueue;

  if (queue.initialized || queue._loaded) {
    return queue;
  }

  queue._loaded = true;
  RADAR_METHODS.forEach((methodName) => {
    queue[methodName] = (...args: unknown[]) => {
      const live = getSnitcher(namespace);
      if (live?.initialized && typeof live[methodName] === "function") {
        return live[methodName](...args);
      }
      queue.push([methodName, ...args]);
      return queue;
    };
  });

  queue.bootstrap = () => {
    if (document.getElementById("__radar__")) return;
    const script = document.createElement("script");
    script.async = true;
    script.type = "text/javascript";
    script.id = "__radar__";
    script.setAttribute("data-settings", JSON.stringify(settings));
    script.src = `${toAbsoluteUrl(settings.cdn)}/releases/latest/radar.min.js`;
    const firstScript = document.scripts[0];
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
      return;
    }
    document.head.appendChild(script);
  };

  setSnitcher(namespace, queue);
  queue.bootstrap();
  return queue;
}

export function SnitcherRadar({ consentAccepted }: SnitcherRadarProps) {
  const pathname = usePathname();
  const inScope = isPublicTrackingPath(pathname || "/");
  const enabled = process.env.NEXT_PUBLIC_SNITCHER_ENABLED !== "false";
  const shouldLoad = consentAccepted && inScope && enabled;
  const hasGrantedConsentRef = useRef(false);

  const settings = useMemo(
    () =>
      ({
        apiEndpoint: process.env.NEXT_PUBLIC_SNITCHER_API_ENDPOINT || "radar.snitcher.com",
        cdn: process.env.NEXT_PUBLIC_SNITCHER_CDN || "cdn.snitcher.com",
        namespace: "Snitcher",
        profileId: process.env.NEXT_PUBLIC_SNITCHER_PROFILE_ID || "srOWIXW42o",
      }) satisfies RadarSettings,
    []
  );

  useEffect(() => {
    if (!shouldLoad) return;
    const queue = ensureSnitcherLoaded(settings);
    if (!queue) return;

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
  }, [pathname, settings, shouldLoad]);

  return null;
}

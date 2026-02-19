"use client";

import { useState } from "react";
import Script from "next/script";

const GA_MEASUREMENT_ID = "G-TDT3P14Q7M";
const CONSENT_COOKIE = "receipt_cookie_consent";
const CONSENT_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

type ConsentState = "unknown" | "accepted" | "rejected";

function readConsentCookie(): ConsentState {
  if (typeof document === "undefined") return "unknown";
  const entries = document.cookie.split(";").map((entry) => entry.trim());
  const row = entries.find((entry) => entry.startsWith(`${CONSENT_COOKIE}=`));
  if (!row) return "unknown";
  const value = row.split("=")[1];
  if (value === "accepted" || value === "rejected") return value;
  return "unknown";
}

function writeConsentCookie(value: Exclude<ConsentState, "unknown">) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

export function CookieConsent() {
  const [consent, setConsent] = useState<ConsentState>(() =>
    readConsentCookie()
  );

  const accept = () => {
    writeConsentCookie("accepted");
    setConsent("accepted");
  };

  const reject = () => {
    writeConsentCookie("rejected");
    setConsent("rejected");
  };

  const showBanner = consent === "unknown";
  const enableAnalytics = consent === "accepted";

  return (
    <>
      {enableAnalytics ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');
            `}
          </Script>
        </>
      ) : null}

      {showBanner ? (
        <div className="fixed inset-x-0 bottom-0 z-[100] border-t border-[var(--mk-border)] bg-[var(--mk-surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--mk-surface)]/85">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-3xl text-xs leading-relaxed text-[var(--mk-muted)] sm:text-sm">
              We use essential cookies to keep Receipt secure and working.
              Analytics cookies are optional and only enabled if you press
              Okay.
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={reject}
                className="focus-ring inline-flex items-center justify-center rounded-full border border-[var(--mk-border)] px-4 py-2 text-xs font-medium text-[var(--mk-muted)] hover:border-[var(--mk-border-strong)] hover:text-[var(--mk-fg)] sm:text-sm"
              >
                No thanks
              </button>
              <button
                type="button"
                onClick={accept}
                className="focus-ring inline-flex items-center justify-center rounded-full marketing-cta-primary marketing-cta-primary-sans px-4 py-2 text-xs font-semibold shadow-sm sm:text-sm"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

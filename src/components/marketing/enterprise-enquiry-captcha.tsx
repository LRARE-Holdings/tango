"use client";

import { useMemo, useState } from "react";
import { TurnstileWidget } from "@/components/security/turnstile-widget";

export function EnterpriseEnquiryCaptcha() {
  const [token, setToken] = useState<string | null>(null);
  const captchaEnabled = useMemo(() => Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY), []);

  return (
    <>
      <TurnstileWidget onTokenChange={setToken} action="enterprise_enquiry" className="pt-1" />
      <input type="hidden" name="captchaToken" value={token ?? ""} />
      <input type="hidden" name="turnstileToken" value={token ?? ""} />
      <input type="hidden" name="cf_turnstile_response" value={token ?? ""} />
      {captchaEnabled ? (
        <p className="text-[12px] leading-relaxed text-[var(--mk-muted)]">
          Complete the security check before sending.
        </p>
      ) : null}
    </>
  );
}

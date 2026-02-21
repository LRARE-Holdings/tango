type TurnstileVerificationResult =
  | {
      ok: true;
      skipped?: boolean;
    }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
    };

type TurnstileResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function normalizeHost(value: string | null | undefined) {
  const host = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!host) return "";
  return host.split(":")[0] ?? "";
}

function hostFromRequest(req: Request) {
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const first = forwardedHost.split(",")[0]?.trim();
    if (first) return normalizeHost(first);
  }
  return normalizeHost(req.headers.get("host"));
}

function extractClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || req.headers.get("cf-connecting-ip")?.trim() || null;
}

function expectedHostsFromEnv() {
  const configured = String(process.env.TURNSTILE_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((value) => normalizeHost(value))
    .filter(Boolean);

  if (configured.length > 0) return configured;

  if (process.env.NODE_ENV !== "production") return [];

  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (appUrl) {
    try {
      const host = normalizeHost(new URL(appUrl).host);
      if (host) return [host];
    } catch {
      // Ignore malformed URL and fall back to request host.
    }
  }

  return [];
}

function hostMatches(expected: string, actual: string) {
  if (!expected || !actual) return false;
  return actual === expected || actual.endsWith(`.${expected}`);
}

function parseBoolean(value: string | undefined | null) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function shouldBypassTurnstile() {
  if (process.env.NODE_ENV === "production") return false;
  return parseBoolean(process.env.DISABLE_SERVER_TURNSTILE);
}

function turnstileSecret() {
  const value = String(process.env.TURNSTILE_SECRET_KEY ?? "").trim();
  if (!value && process.env.NODE_ENV === "production") {
    return {
      ok: false as const,
      message: "TURNSTILE_SECRET_KEY is not configured.",
    };
  }
  return {
    ok: true as const,
    value,
  };
}

export function extractTurnstileToken(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const tokenCandidates = [
    record.captchaToken,
    record.turnstileToken,
    record.cf_turnstile_response,
    record["cf-turnstile-response"],
  ];

  for (const candidate of tokenCandidates) {
    if (typeof candidate !== "string") continue;
    const token = candidate.trim();
    if (token.length > 0) return token;
  }

  return null;
}

export async function verifyTurnstileToken({
  req,
  token,
  expectedAction,
}: {
  req: Request;
  token: string | null | undefined;
  expectedAction?: string;
}): Promise<TurnstileVerificationResult> {
  if (shouldBypassTurnstile()) {
    return { ok: true, skipped: true };
  }

  const secret = turnstileSecret();
  if (!secret.ok) {
    return {
      ok: false,
      status: 500,
      code: "SECURITY_MISCONFIGURED",
      message: "Security verification is not configured.",
    };
  }

  // In development, allow missing secret with explicit bypass toggle only.
  if (!secret.value) {
    return { ok: true, skipped: true };
  }

  if (!token) {
    return {
      ok: false,
      status: 400,
      code: "CAPTCHA_REQUIRED",
      message: "Security check is required.",
    };
  }

  const payload = new URLSearchParams();
  payload.set("secret", secret.value);
  payload.set("response", token);
  const ip = extractClientIp(req);
  if (ip) payload.set("remoteip", ip);

  let verification: TurnstileResponse | null = null;
  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload.toString(),
      cache: "no-store",
    });

    verification = (await response.json().catch(() => null)) as TurnstileResponse | null;
  } catch {
    return {
      ok: false,
      status: 503,
      code: "CAPTCHA_UNAVAILABLE",
      message: "Security verification is currently unavailable.",
    };
  }

  if (!verification?.success) {
    return {
      ok: false,
      status: 403,
      code: "CAPTCHA_INVALID",
      message: "Security check failed.",
    };
  }

  if (expectedAction) {
    if (!verification.action || verification.action !== expectedAction) {
      return {
        ok: false,
        status: 403,
        code: "CAPTCHA_ACTION_INVALID",
        message: "Security check failed.",
      };
    }
  }

  const receivedHost = normalizeHost(verification.hostname);
  if (!receivedHost) {
    return {
      ok: false,
      status: 403,
      code: "CAPTCHA_HOST_INVALID",
      message: "Security check failed.",
    };
  }

  const requestedHost = hostFromRequest(req);
  const configuredExpectedHosts = expectedHostsFromEnv();

  if (configuredExpectedHosts.length > 0) {
    const hostAllowed = configuredExpectedHosts.some((expected) => hostMatches(expected, receivedHost));
    if (!hostAllowed) {
      return {
        ok: false,
        status: 403,
        code: "CAPTCHA_HOST_INVALID",
        message: "Security check failed.",
      };
    }
  } else if (requestedHost && !hostMatches(requestedHost, receivedHost)) {
    return {
      ok: false,
      status: 403,
      code: "CAPTCHA_HOST_INVALID",
      message: "Security check failed.",
    };
  }

  return { ok: true };
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function appBaseUrl(req: Request) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

function renderMessageHtml(payload: Record<string, string | null>) {
  const body = JSON.stringify(payload);
  return `<!doctype html><html><body><script>
    (function(){
      var payload = ${body};
      if (window.opener) {
        window.opener.postMessage({
          type: 'receipt-cloud-picker-auth',
          provider: 'google_drive',
          accessToken: payload.accessToken || undefined,
          error: payload.error || undefined
        }, payload.origin || window.location.origin);
      }
      window.close();
    })();
  </script></body></html>`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const stateRaw = url.searchParams.get("state") || "";

  let origin = appBaseUrl(req);
  let nonce = "";
  try {
    const parsed = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8")) as { n?: string; o?: string };
    nonce = String(parsed.n ?? "");
    if (parsed.o) {
      try {
        origin = new URL(parsed.o).origin;
      } catch {
        origin = appBaseUrl(req);
      }
    }
  } catch {
    // ignore
  }

  const cookieStore = await cookies();
  const expectedNonce = cookieStore.get("receipt_google_oauth_nonce")?.value ?? "";
  cookieStore.delete("receipt_google_oauth_nonce");

  if (!code || !nonce || !expectedNonce || nonce !== expectedNonce) {
    return new NextResponse(renderMessageHtml({ origin, accessToken: null, error: "Google authentication failed." }), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  if (!clientId || !clientSecret) {
    return new NextResponse(
      renderMessageHtml({ origin, accessToken: null, error: "Google Drive OAuth is not configured." }),
      { status: 500, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  const redirectUri = `${appBaseUrl(req)}/api/app/cloud/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenJson = (await tokenRes.json().catch(() => null)) as { access_token?: string; error_description?: string } | null;
  const accessToken = tokenJson?.access_token ?? "";
  if (!tokenRes.ok || !accessToken) {
    const message = tokenJson?.error_description || "Google token exchange failed.";
    return new NextResponse(renderMessageHtml({ origin, accessToken: null, error: message }), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  return new NextResponse(renderMessageHtml({ origin, accessToken, error: null }), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

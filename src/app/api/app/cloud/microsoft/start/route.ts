import crypto from "crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

function appBaseUrl(req: Request) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

function normalizeOrigin(v: string | null, req: Request) {
  if (!v) return appBaseUrl(req);
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return appBaseUrl(req);
    return u.origin;
  } catch {
    return appBaseUrl(req);
  }
}

function popupErrorHtml(origin: string, message: string) {
  const payload = JSON.stringify({ origin, message });
  return `<!doctype html><html><body><script>
    (function(){
      var payload = ${payload};
      if (window.opener) {
        window.opener.postMessage({ type: 'receipt-cloud-picker-auth', provider: 'microsoft_graph', error: payload.message }, payload.origin || window.location.origin);
      }
      window.close();
    })();
  </script></body></html>`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = normalizeOrigin(url.searchParams.get("origin"), req);
  const supabase = await supabaseServer();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) {
    return new NextResponse(popupErrorHtml(origin, userErr.message), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  if (!userData.user) {
    return new NextResponse(popupErrorHtml(origin, "You are not signed in."), {
      status: 401,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim() || "";
  if (!clientId || !clientSecret) {
    return new NextResponse(
      popupErrorHtml(origin, "Microsoft OAuth is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET."),
      { status: 500, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }
  const nonce = crypto.randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ n: nonce, o: origin })).toString("base64url");

  const tenant = process.env.MICROSOFT_TENANT_ID?.trim() || "common";
  const redirectUri = `${appBaseUrl(req)}/api/app/cloud/microsoft/callback`;
  const authUrl = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", "openid profile offline_access Files.Read");
  authUrl.searchParams.set("prompt", "select_account");
  authUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("receipt_ms_oauth_nonce", nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}

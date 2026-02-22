import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  sessionId?: string;
  session_id?: string;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function parseSessionId(body: Body) {
  const raw = typeof body.sessionId === "string" ? body.sessionId : body.session_id;
  const clean = String(raw ?? "").trim();
  if (!clean) return "";
  return clean;
}

function sessionUserId(session: Stripe.Checkout.Session) {
  return (
    (typeof session.client_reference_id === "string" ? session.client_reference_id : null) ??
    (typeof session.metadata?.supabase_user_id === "string" ? session.metadata.supabase_user_id : null)
  );
}

function priceToPlan(priceId: string | null) {
  switch (priceId) {
    case process.env.STRIPE_PRICE_PERSONAL_MONTHLY:
    case process.env.STRIPE_PRICE_PERSONAL_ANNUAL:
      return "personal";
    case process.env.STRIPE_PRICE_PRO_MONTHLY:
    case process.env.STRIPE_PRICE_PRO_ANNUAL:
      return "pro";
    case process.env.STRIPE_PRICE_TEAM_MONTHLY:
    case process.env.STRIPE_PRICE_TEAM_ANNUAL:
      return "team";
    default:
      return "free";
  }
}

function numField(sub: Stripe.Subscription, key: "current_period_end" | "trial_end") {
  const value = (sub as unknown as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const sessionId = parseSessionId(body);
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.mode !== "subscription") {
      return NextResponse.json({ error: "Session is not a subscription checkout session" }, { status: 409 });
    }

    const mappedUserId = sessionUserId(session);
    if (!mappedUserId || mappedUserId !== auth.user.id) {
      return NextResponse.json({ error: "Session does not belong to the authenticated user" }, { status: 403 });
    }

    if (session.status !== "complete") {
      return NextResponse.json({ error: "Checkout session is not complete yet" }, { status: 409 });
    }

    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (!subscriptionId) {
      return NextResponse.json({ error: "Checkout session has no subscription id" }, { status: 409 });
    }

    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

    const priceId = sub.items.data[0]?.price?.id ?? null;
    const plan = priceToPlan(priceId);
    const currentPeriodEnd = numField(sub, "current_period_end");
    const trialEnd = numField(sub, "trial_end");
    const hasTrial = !!trialEnd && trialEnd > 0;

    const payload = {
      id: auth.user.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      plan,
      subscription_status: sub.status,
      billing_interval: sub.items.data[0]?.price?.recurring?.interval ?? null,
      seats: sub.items.data[0]?.quantity ?? 1,
      current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      has_had_trial: hasTrial ? true : undefined,
      trial_end: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await admin
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        sessionId: session.id,
        subscriptionId: sub.id,
        plan,
        subscriptionStatus: sub.status,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("❌ Billing session sync failed:", error);
    return NextResponse.json(
      { error: "Could not sync billing session", detail: errorMessage(error, "Unknown error") },
      { status: 500 }
    );
  }
}

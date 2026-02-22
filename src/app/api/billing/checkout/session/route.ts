import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  assertBilling,
  assertCheckoutPlan,
  checkoutMode,
  checkoutSuccessReturnUrl,
  normalizeSeats,
  priceEnvKey,
  requireEnv,
  siteBaseUrl,
} from "@/lib/stripe/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function normalizeSource(value: unknown) {
  const source = String(value ?? "").trim().toLowerCase();
  if (!source) return null;
  return source.slice(0, 64);
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (checkoutMode() !== "custom") {
      return NextResponse.json(
        {
          error: "Custom checkout is disabled for this environment.",
        },
        { status: 409 }
      );
    }

    const body = await req.json();
    const plan = body.plan;
    const billing = body.billing;
    const seatsRaw = body.seats;
    const source = normalizeSource(body.source);

    assertCheckoutPlan(plan);
    assertBilling(billing);

    const publishableKey = requireEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
    const seats = normalizeSeats(plan, seatsRaw);
    const priceId = requireEnv(priceEnvKey(plan, billing));

    const userId = auth.user.id;
    const email = auth.user.email ?? undefined;

    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("id, stripe_customer_id, has_had_trial")
      .eq("id", userId)
      .maybeSingle();
    if (profErr) throw profErr;

    let customerId = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      });

      customerId = customer.id;

      const { error: upErr } = await admin
        .from("profiles")
        .upsert(
          {
            id: userId,
            email: email ?? null,
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      if (upErr) throw upErr;
    }

    const desiredTrialDays = billing === "annual" ? 14 : 7;

    const existingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 1,
    });

    const hasEverSubscribed = existingSubs.data.length > 0;
    const hasHadTrial = Boolean(profile?.has_had_trial);
    const trialPeriodDays = hasEverSubscribed || hasHadTrial ? undefined : desiredTrialDays;

    const siteUrl = siteBaseUrl();
    const returnUrl = checkoutSuccessReturnUrl(siteUrl);

    const metadata: Record<string, string> = {
      supabase_user_id: userId,
      plan,
      billing,
    };
    if (source) metadata.source = source;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "custom",
      return_url: returnUrl,
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: seats }],
      allow_promotion_codes: true,
      subscription_data: {
        ...(trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}),
        metadata,
      },
      metadata,
    });

    if (!session.client_secret) {
      throw new Error("Stripe did not return a checkout client secret");
    }

    return NextResponse.json(
      {
        checkoutSessionId: session.id,
        clientSecret: session.client_secret,
        returnUrl,
        publishableKey,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("❌ Custom checkout session error:", error);
    return NextResponse.json({ error: errorMessage(error, "Checkout session failed") }, { status: 500 });
  }
}

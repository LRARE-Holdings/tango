import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  assertBilling,
  assertCheckoutPlan,
  checkoutCancelUrl,
  checkoutMode,
  checkoutPaymentMethodTypes,
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

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (checkoutMode() !== "hosted") {
      return NextResponse.json(
        {
          error: "Hosted checkout is disabled. Use /checkout.",
        },
        { status: 409 }
      );
    }

    const userId = auth.user.id;
    const email = auth.user.email ?? undefined;

    const body = await req.json();
    const plan = body.plan;
    const billing = body.billing;
    const seatsRaw = body.seats;

    assertCheckoutPlan(plan);
    assertBilling(billing);

    const seats = normalizeSeats(plan, seatsRaw);

    const priceId = requireEnv(priceEnvKey(plan, billing));
    const price = await stripe.prices.retrieve(priceId);
    const paymentMethodTypes = checkoutPaymentMethodTypes(price.currency);

    // Load profile (your schema uses `id`)
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

      // Use admin to avoid any RLS footguns
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

    // Trial policy
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
    const successUrl = checkoutSuccessReturnUrl(siteUrl);
    const cancelUrl = checkoutCancelUrl(siteUrl);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,

      // ✅ makes webhook mapping reliable
      client_reference_id: userId,

      line_items: [{ price: priceId, quantity: seats }],
      payment_method_types: paymentMethodTypes,
      allow_promotion_codes: true,

      success_url: successUrl,
      cancel_url: cancelUrl,

      subscription_data: {
        ...(trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}),
        metadata: {
          supabase_user_id: userId,
          plan,
          billing,
        },
      },

      metadata: {
        supabase_user_id: userId,
        plan,
        billing,
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error: unknown) {
    console.error("❌ Checkout error:", error);
    return NextResponse.json({ error: errorMessage(error, "Checkout failed") }, { status: 500 });
  }
}

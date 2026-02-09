import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Billing = "monthly" | "annual";
type Plan = "personal" | "pro" | "team";

/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function priceEnvKey(plan: Plan, billing: Billing) {
  return `STRIPE_PRICE_${plan.toUpperCase()}_${billing.toUpperCase()}`;
}

function getPriceId(plan: Plan, billing: Billing) {
  return requireEnv(priceEnvKey(plan, billing));
}

function assertPlan(x: unknown): asserts x is Plan {
  if (x !== "personal" && x !== "pro" && x !== "team") throw new Error("Invalid plan");
}

function assertBilling(x: unknown): asserts x is Billing {
  if (x !== "monthly" && x !== "annual") throw new Error("Invalid billing");
}

/* -------------------------------------------------------------------------- */
/* Route                                                                      */
/* -------------------------------------------------------------------------- */

export async function POST(req: Request) {
  try {
    // Auth
    const supabase = await supabaseServer();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = auth.user.id;
    const email = auth.user.email ?? undefined;

    // Input
    const body = await req.json();
    const plan = body.plan;
    const billing = body.billing;
    const seatsRaw = body.seats;

    assertPlan(plan);
    assertBilling(billing);

    const seats =
      plan === "team"
        ? Math.max(2, Math.min(500, Number(seatsRaw) || 2))
        : 1;

    const priceId = getPriceId(plan, billing);

    // Admin client (bypass RLS for profile writes)
    const admin = supabaseAdmin();

    // Load profile by id (NOT user_id)
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id, stripe_customer_id, has_had_trial")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) throw new Error(profileErr.message);

    // Ensure Stripe customer exists
    let customerId = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      });

      customerId = customer.id;

      // Upsert profile row (works whether it exists or not)
      const { error: upsertErr } = await admin
        .from("profiles")
        .upsert(
          {
            id: userId,
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (upsertErr) throw new Error(upsertErr.message);
    }

    // Trial policy (abuse-safe)
    const desiredTrialDays = billing === "annual" ? 14 : 7;

    const existingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 1,
    });

    const hasEverSubscribed = existingSubs.data.length > 0;
    const hasHadTrial = Boolean(profile?.has_had_trial);

    const trialPeriodDays = hasEverSubscribed || hasHadTrial ? undefined : desiredTrialDays;

    // URLs
    const siteUrl = requireEnv("NEXT_PUBLIC_APP_URL");
    const successUrl = `${siteUrl}/app/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl}/pricing`;

    // Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: seats }],
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
  } catch (err: any) {
    console.error("❌ Checkout error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Checkout failed" },
      { status: 500 }
    );
  }
}
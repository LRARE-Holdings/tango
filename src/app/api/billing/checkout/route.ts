import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { supabaseServer } from "@/lib/supabase/server";

type Billing = "monthly" | "annual";
type Plan = "personal" | "pro" | "team";

export const runtime = "nodejs";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function priceEnvKey(plan: Plan, billing: Billing) {
  // Expect env vars like:
  // STRIPE_PRICE_PERSONAL_MONTHLY, STRIPE_PRICE_PERSONAL_ANNUAL
  // STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_ANNUAL
  // STRIPE_PRICE_TEAM_MONTHLY, STRIPE_PRICE_TEAM_ANNUAL
  return `STRIPE_PRICE_${plan.toUpperCase()}_${billing.toUpperCase()}`;
}

function getPriceId(plan: Plan, billing: Billing) {
  return getEnv(priceEnvKey(plan, billing));
}

function assertPlan(x: any): asserts x is Plan {
  if (x !== "personal" && x !== "pro" && x !== "team") throw new Error("Invalid plan");
}
function assertBilling(x: any): asserts x is Billing {
  if (x !== "monthly" && x !== "annual") throw new Error("Invalid billing");
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error } = await supabase.auth.getUser();
    if (error) return NextResponse.json({ error: error.message }, { status: 401 });
    if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const plan = body.plan;
    const billing = body.billing;
    const seatsRaw = body.seats;

    assertPlan(plan);
    assertBilling(billing);

    const seatsNum = Number(seatsRaw);
    const seats = plan === "team"
      ? Math.max(2, Math.min(500, Number.isFinite(seatsNum) ? seatsNum : 2))
      : 1;

    const priceId = getPriceId(plan, billing);

    // Trial policy:
    // - Monthly: 7 days
    // - Annual: 14 days
    // Only apply a trial if this customer has never had a Stripe subscription before.
    const desiredTrialDays = billing === "annual" ? 14 : 7;

    // We’ll compute this after we have a customerId.
    let trialPeriodDays: number | undefined;

    // Minimal customer strategy:
    // 1) Look up stripe_customer_id in your profiles/users table
    // 2) Create one if missing, then store it
    //
    // Replace this with your real table/column.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, stripe_customer_id, email, has_had_trial")
      .eq("id", userRes.user.id)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id as string | null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userRes.user.email ?? undefined,
        metadata: { user_id: userRes.user.id },
      });
      customerId = customer.id;

      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userRes.user.id);
    }

    // Prevent trial abuse: only allow a trial for customers with no prior subscriptions.
    // If you later add a `has_had_trial` boolean to your Supabase profiles table,
    // you can also enforce it here.
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 1,
    });

    const hasEverSubscribed = (subs.data?.length ?? 0) > 0;
    trialPeriodDays = hasEverSubscribed ? undefined : desiredTrialDays;

    const hasHadTrial = Boolean((profile as any)?.has_had_trial);
    trialPeriodDays = (hasEverSubscribed || hasHadTrial) ? undefined : desiredTrialDays;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const successUrl = `${baseUrl}/app/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/pricing`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: seats }],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        ...(trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}),
        metadata: {
          user_id: userRes.user.id,
          plan,
          billing,
        },
      },
      metadata: {
        user_id: userRes.user.id,
        plan,
        billing,
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Checkout failed" }, { status: 500 });
  }
}
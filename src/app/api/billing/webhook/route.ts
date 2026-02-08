import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Keep this to a valid Stripe API version string for typings + stability.
  apiVersion: "2026-01-28.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

/**
 * Map Stripe Price IDs → internal plan keys
 */
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

function subscriptionCurrentPeriodEnd(sub: Stripe.Subscription): number | null {
  // Some stripe-node typings/versions may not surface this field even though
  // it exists in the Stripe API payload. Use a safe lookup.
  const v = (sub as unknown as { current_period_end?: number | null }).current_period_end;
  return typeof v === "number" ? v : null;
}

function subscriptionTrialEnd(sub: Stripe.Subscription): number | null {
  const v = (sub as unknown as { trial_end?: number | null }).trial_end;
  return typeof v === "number" ? v : null;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("❌ Stripe signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  try {
    switch (event.type) {
      /**
       * Checkout completed (first time)
       */
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (!session.customer || !session.subscription) break;

        const retrieved = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        // stripe-node typings may return `Stripe.Response<T>` depending on version.
        // Unwrap if needed so downstream fields type-check.
        const subscription = ((retrieved as unknown as { data?: Stripe.Subscription }).data ??
          (retrieved as unknown as Stripe.Subscription));

        const priceId = subscription.items.data[0]?.price.id ?? null;
        const plan = priceToPlan(priceId);

        

        await admin
          .from("profiles")
          .upsert({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription.id,

            plan,
            subscription_status: subscription.status,
            billing_interval: subscription.items.data[0]?.price.recurring?.interval ?? null,

            seats: subscription.items.data[0]?.quantity ?? 1,
            current_period_end: subscriptionCurrentPeriodEnd(subscription)
              ? new Date(subscriptionCurrentPeriodEnd(subscription)! * 1000).toISOString()
              : null,
            cancel_at_period_end: subscription.cancel_at_period_end,
            has_had_trial: true,
            trial_end: subscriptionTrialEnd(subscription)
            ? new Date(subscriptionTrialEnd(subscription)! * 1000).toISOString()
            : null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "stripe_customer_id" });

        break;
      }

      /**
       * Subscription updated (upgrade, downgrade, cancel, renew)
       */
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const priceId = subscription.items.data[0]?.price.id ?? null;
        const plan = priceToPlan(priceId);

        await admin
          .from("profiles")
          .update({
            plan,
            subscription_status: subscription.status,
            billing_interval: subscription.items.data[0]?.price.recurring?.interval ?? null,
            seats: subscription.items.data[0]?.quantity ?? 1,
            current_period_end: subscriptionCurrentPeriodEnd(subscription)
              ? new Date(subscriptionCurrentPeriodEnd(subscription)! * 1000).toISOString()
              : null,
            cancel_at_period_end: subscription.cancel_at_period_end,

                // NEW
              has_had_trial: true,
              trial_end: subscriptionTrialEnd(subscription)
              ? new Date(subscriptionTrialEnd(subscription)! * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        break;
      }

      default:
        // Ignore unneeded events
        break;
    }
  } catch (err) {
    console.error("🔥 Webhook processing error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
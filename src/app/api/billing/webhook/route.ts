import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
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
  const v = (sub as unknown as { current_period_end?: number | null }).current_period_end;
  return typeof v === "number" ? v : null;
}

function subscriptionTrialEnd(sub: Stripe.Subscription): number | null {
  const v = (sub as unknown as { trial_end?: number | null }).trial_end;
  return typeof v === "number" ? v : null;
}

async function resolveProfileIdFromCustomer(admin: ReturnType<typeof supabaseAdmin>, customerId: string) {
  // If your profiles key column is user_id instead of id, change select accordingly.
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
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
    console.error("❌ Stripe signature verification failed:", err?.message ?? err);
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

        const customerId = typeof session.customer === "string" ? session.customer : null;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

        if (!customerId || !subscriptionId) break;

        // ✅ The critical fix: resolve the Supabase user id from the session
        // Prefer client_reference_id (set in checkout), fallback to metadata.
        const userId =
          (typeof session.client_reference_id === "string" ? session.client_reference_id : null) ??
          (typeof session.metadata?.supabase_user_id === "string" ? session.metadata.supabase_user_id : null);

        if (!userId) {
          console.error("⚠️ Missing user id on checkout session. Add client_reference_id + metadata in checkout.", {
            id: session.id,
            customerId,
            subscriptionId,
          });
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        const priceId = subscription.items.data[0]?.price?.id ?? null;
        const plan = priceToPlan(priceId);

        const cpe = subscriptionCurrentPeriodEnd(subscription);
        const te = subscriptionTrialEnd(subscription);
        const hasTrial = typeof te === "number" && te > 0;

        const update = {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,

          plan,
          subscription_status: subscription.status,
          billing_interval: subscription.items.data[0]?.price.recurring?.interval ?? null,

          seats: subscription.items.data[0]?.quantity ?? 1,
          current_period_end: cpe ? new Date(cpe * 1000).toISOString() : null,
          cancel_at_period_end: subscription.cancel_at_period_end,

          ...(hasTrial ? { has_had_trial: true } : {}),
          trial_end: te ? new Date(te * 1000).toISOString() : null,

          updated_at: new Date().toISOString(),
        };

        // ✅ Update the *real* profile row (keyed by auth user id)
        const { error } = await admin
          .from("profiles")
          .update(update)
          .eq("id", userId);

        if (error) throw error;

        break;
      }

      /**
       * Subscription updated (upgrade, downgrade, cancel, renew)
       */
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
        if (!customerId) break;

        // ✅ Find which Supabase user owns this customer
        const profileId = await resolveProfileIdFromCustomer(admin, customerId);

        if (!profileId) {
          console.error("⚠️ No profile found for stripe_customer_id", customerId);
          break;
        }

        const priceId = subscription.items.data[0]?.price?.id ?? null;
        const plan = priceToPlan(priceId);

        const cpe = subscriptionCurrentPeriodEnd(subscription);
        const te = subscriptionTrialEnd(subscription);
        const hasTrial = typeof te === "number" && te > 0;

        const { error } = await admin
          .from("profiles")
          .update({
            stripe_subscription_id: subscription.id,

            plan,
            subscription_status: subscription.status,
            billing_interval: subscription.items.data[0]?.price.recurring?.interval ?? null,
            seats: subscription.items.data[0]?.quantity ?? 1,
            current_period_end: cpe ? new Date(cpe * 1000).toISOString() : null,
            cancel_at_period_end: subscription.cancel_at_period_end,

            ...(hasTrial ? { has_had_trial: true } : {}),
            trial_end: te ? new Date(te * 1000).toISOString() : null,

            updated_at: new Date().toISOString(),
          })
          .eq("id", profileId);

        if (error) throw error;

        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("🔥 Webhook processing error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
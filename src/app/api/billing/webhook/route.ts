import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Use a valid Stripe API version string you’re pinned to
  apiVersion: "2026-01-28.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

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

function subCurrentPeriodEnd(sub: Stripe.Subscription): number | null {
  const v = (sub as unknown as { current_period_end?: number | null }).current_period_end;
  return typeof v === "number" ? v : null;
}

function subTrialEnd(sub: Stripe.Subscription): number | null {
  const v = (sub as unknown as { trial_end?: number | null }).trial_end;
  return typeof v === "number" ? v : null;
}

async function resolveProfileIdFromCustomer(
  admin: ReturnType<typeof supabaseAdmin>,
  customerId: string
) {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function POST(request: Request) {
  // Stripe requires raw body for signature verification
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
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
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const customerId = typeof session.customer === "string" ? session.customer : null;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

        if (!customerId || !subscriptionId) {
          console.warn("⚠️ Missing customer/subscription on checkout.session.completed", {
            sessionId: session.id,
            customerId,
            subscriptionId,
          });
          break;
        }

        // ✅ Identify Supabase profiles.id
        const userId =
          (typeof session.client_reference_id === "string" ? session.client_reference_id : null) ??
          (typeof session.metadata?.supabase_user_id === "string"
            ? session.metadata.supabase_user_id
            : null);

        if (!userId) {
          console.error("❌ Missing supabase user id on session (client_reference_id/metadata).", {
            sessionId: session.id,
            customerId,
            subscriptionId,
            meta: session.metadata,
          });
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        const priceId = subscription.items.data[0]?.price?.id ?? null;
        const plan = priceToPlan(priceId);

        const cpe = subCurrentPeriodEnd(subscription);
        const te = subTrialEnd(subscription);
        const hasTrial = typeof te === "number" && te > 0;

        const payload = {
          id: userId, // <-- profiles.id (auth uuid)
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

        // ✅ Use UPSERT so it works even if the profile row didn’t exist yet
        const { error } = await admin.from("profiles").upsert(payload, { onConflict: "id" });

        if (error) {
          console.error("🔥 Supabase upsert failed (checkout.session.completed):", error);
          throw error;
        }

        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
        if (!customerId) break;

        const profileId = await resolveProfileIdFromCustomer(admin, customerId);

        if (!profileId) {
          console.warn("⚠️ No profile found for stripe_customer_id", customerId);
          break;
        }

        const priceId = subscription.items.data[0]?.price?.id ?? null;
        const plan = priceToPlan(priceId);

        const cpe = subCurrentPeriodEnd(subscription);
        const te = subTrialEnd(subscription);
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

        if (error) {
          console.error("🔥 Supabase update failed (subscription.*):", error);
          throw error;
        }

        break;
      }

      default:
        // ignore
        break;
    }
  } catch (err: any) {
    console.error("🔥 Webhook processing error:", err?.message ?? err, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
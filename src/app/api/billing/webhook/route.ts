import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
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

function subFieldNumber(sub: Stripe.Subscription, key: "current_period_end" | "trial_end") {
  const v = (sub as unknown as Record<string, unknown>)[key];
  return typeof v === "number" ? v : null;
}

function resolveUserIdFromSession(session: Stripe.Checkout.Session) {
  const a = typeof session.client_reference_id === "string" ? session.client_reference_id : null;
  const b =
    typeof session.metadata?.supabase_user_id === "string" ? session.metadata.supabase_user_id : null;
  return a ?? b;
}

function resolveUserIdFromSubscription(sub: Stripe.Subscription) {
  const v = (sub.metadata as any)?.supabase_user_id;
  return typeof v === "string" ? v : null;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

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

        if (!customerId || !subscriptionId) break;

        const userId = resolveUserIdFromSession(session);
        if (!userId) {
          console.error("⚠️ Missing supabase user id on checkout session", {
            sessionId: session.id,
            customerId,
            subscriptionId,
          });
          break;
        }

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = sub.items.data[0]?.price?.id ?? null;
        const plan = priceToPlan(priceId);

        const cpe = subFieldNumber(sub, "current_period_end");
        const te = subFieldNumber(sub, "trial_end");
        const hasTrial = typeof te === "number" && te > 0;

        const { error } = await admin
          .from("profiles")
          .upsert(
            {
              id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: sub.id,
              plan,
              subscription_status: sub.status,
              billing_interval: sub.items.data[0]?.price.recurring?.interval ?? null,
              seats: sub.items.data[0]?.quantity ?? 1,
              current_period_end: cpe ? new Date(cpe * 1000).toISOString() : null,
              cancel_at_period_end: sub.cancel_at_period_end,
              has_had_trial: hasTrial ? true : undefined,
              trial_end: te ? new Date(te * 1000).toISOString() : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );

        if (error) {
          console.error("🔥 Supabase upsert error (checkout.session.completed):", error);
          throw error;
        }

        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        const userId = resolveUserIdFromSubscription(sub);
        if (!userId) {
          // If metadata got stripped somehow, you can fallback to customer lookup,
          // but metadata should be present because we set it in checkout.
          console.error("⚠️ Missing supabase_user_id in subscription metadata", {
            subId: sub.id,
            customer: sub.customer,
          });
          break;
        }

        const priceId = sub.items.data[0]?.price?.id ?? null;
        const plan = priceToPlan(priceId);

        const cpe = subFieldNumber(sub, "current_period_end");
        const te = subFieldNumber(sub, "trial_end");
        const hasTrial = typeof te === "number" && te > 0;

        const { error } = await admin
          .from("profiles")
          .update({
            stripe_subscription_id: sub.id,
            plan,
            subscription_status: sub.status,
            billing_interval: sub.items.data[0]?.price.recurring?.interval ?? null,
            seats: sub.items.data[0]?.quantity ?? 1,
            current_period_end: cpe ? new Date(cpe * 1000).toISOString() : null,
            cancel_at_period_end: sub.cancel_at_period_end,
            has_had_trial: hasTrial ? true : undefined,
            trial_end: te ? new Date(te * 1000).toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (error) {
          console.error("🔥 Supabase update error (subscription.*):", error);
          throw error;
        }

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
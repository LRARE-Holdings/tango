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

function numField(sub: Stripe.Subscription, key: "current_period_end" | "trial_end") {
  const v = (sub as any)?.[key];
  return typeof v === "number" ? v : null;
}

function sessionUserId(session: Stripe.Checkout.Session) {
  return (
    (typeof session.client_reference_id === "string" ? session.client_reference_id : null) ??
    (typeof session.metadata?.supabase_user_id === "string" ? session.metadata.supabase_user_id : null)
  );
}

function subscriptionUserId(sub: Stripe.Subscription) {
  const v = (sub.metadata as any)?.supabase_user_id;
  return typeof v === "string" ? v : null;
}

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err?.message ?? err);
    return NextResponse.json(
      { error: "Invalid signature", detail: err?.message ?? String(err) },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

      if (!customerId || !subscriptionId) {
        console.warn("⚠️ Missing customer/subscription on session", session.id);
        return NextResponse.json({ received: true });
      }

      const userId = sessionUserId(session);
      if (!userId) {
        console.error("⚠️ Missing supabase_user_id mapping on checkout session", {
          sessionId: session.id,
          customerId,
          subscriptionId,
          metadata: session.metadata,
        });
        return NextResponse.json({ received: true });
      }

      const sub = await stripe.subscriptions.retrieve(subscriptionId);

      const priceId = sub.items.data[0]?.price?.id ?? null;
      const plan = priceToPlan(priceId);

      const cpe = numField(sub, "current_period_end");
      const te = numField(sub, "trial_end");
      const hasTrial = !!te && te > 0;

      const payload = {
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        plan,
        subscription_status: sub.status,
        billing_interval: sub.items.data[0]?.price?.recurring?.interval ?? null,
        seats: sub.items.data[0]?.quantity ?? 1,
        current_period_end: cpe ? new Date(cpe * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
        has_had_trial: hasTrial ? true : undefined,
        trial_end: te ? new Date(te * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      const { error, data } = await admin
        .from("profiles")
        .update(payload)
        .eq("id", userId)
        .select("id, plan, subscription_status, stripe_customer_id, stripe_subscription_id")
        .maybeSingle();

      if (error) {
        console.error("🔥 Supabase update failed (checkout.session.completed):", error);
        return NextResponse.json(
          { error: "Supabase update failed", detail: error.message, hint: (error as any).hint },
          { status: 500 }
        );
      }

      if (!data) {
        console.error("🔥 No profile row matched id for userId:", userId);
        return NextResponse.json(
          { error: "No profile row found for user", userId },
          { status: 500 }
        );
      }

      return NextResponse.json({ received: true });
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;

      const userId = subscriptionUserId(sub);
      const customerId = typeof sub.customer === "string" ? sub.customer : null;

      if (!userId) {
        console.error("⚠️ Subscription missing metadata.supabase_user_id", {
          subId: sub.id,
          customerId,
          metadata: sub.metadata,
        });
        return NextResponse.json({ received: true });
      }

      const priceId = sub.items.data[0]?.price?.id ?? null;
      const plan = priceToPlan(priceId);

      const cpe = numField(sub, "current_period_end");
      const te = numField(sub, "trial_end");
      const hasTrial = !!te && te > 0;

      const payload = {
        stripe_customer_id: customerId ?? undefined,
        stripe_subscription_id: sub.id,
        plan,
        subscription_status: sub.status,
        billing_interval: sub.items.data[0]?.price?.recurring?.interval ?? null,
        seats: sub.items.data[0]?.quantity ?? 1,
        current_period_end: cpe ? new Date(cpe * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
        has_had_trial: hasTrial ? true : undefined,
        trial_end: te ? new Date(te * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      const { error, data } = await admin
        .from("profiles")
        .update(payload)
        .eq("id", userId)
        .select("id, plan, subscription_status, stripe_customer_id, stripe_subscription_id")
        .maybeSingle();

      if (error) {
        console.error("🔥 Supabase update failed (subscription.*):", error);
        return NextResponse.json(
          { error: "Supabase update failed", detail: error.message, hint: (error as any).hint },
          { status: 500 }
        );
      }

      if (!data) {
        console.error("🔥 No profile row matched id for userId:", userId);
        return NextResponse.json(
          { error: "No profile row found for user", userId },
          { status: 500 }
        );
      }

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("🔥 Webhook handler crash:", err);
    return NextResponse.json(
      { error: "Webhook handler failed", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
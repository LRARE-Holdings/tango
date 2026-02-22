import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { parseBillingPortalFlow } from "@/lib/stripe/billing";

function getSiteUrl(req: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function isUnauthorizedAuthError(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "PGRST301") return true;
  const msg = String(error.message ?? "").toLowerCase();
  return msg.includes("auth session missing") || msg.includes("invalid jwt") || msg.includes("jwt");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { flow?: unknown } | null;
    const flow = parseBillingPortalFlow(body?.flow);
    if (
      body &&
      Object.prototype.hasOwnProperty.call(body, "flow") &&
      flow === "default" &&
      String(body.flow ?? "")
        .trim()
        .toLowerCase() !== "default"
    ) {
      return NextResponse.json(
        {
          error: "Invalid flow. Use one of: default, payment_method_update, subscription_cancel, subscription_update.",
        },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      return NextResponse.json(
        { error: isUnauthorizedAuthError(userErr) ? "Unauthorized" : userErr.message },
        { status: isUnauthorizedAuthError(userErr) ? 401 : 500 }
      );
    }
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = userData.user;
    const admin = supabaseAdmin();

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id,stripe_customer_id,stripe_subscription_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

    let customerId = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });

      customerId = customer.id;

      // Upsert to profiles (or change to your table)
      const { error: upErr } = await admin
        .from("profiles")
        .upsert({ id: user.id, stripe_customer_id: customerId }, { onConflict: "id" });

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const returnUrl = `${getSiteUrl(req)}/app/account`;

    const stripeSubscriptionId = profile?.stripe_subscription_id ?? null;
    const needsSubscription = flow === "subscription_cancel" || flow === "subscription_update";
    if (needsSubscription && !stripeSubscriptionId) {
      return NextResponse.json(
        { error: "No active Stripe subscription found. Open default billing portal and select a subscription first." },
        { status: 409 }
      );
    }

    const params: Stripe.BillingPortal.SessionCreateParams = {
      customer: customerId,
      return_url: returnUrl,
    };

    if (flow !== "default") {
      params.flow_data = {
        type: flow,
        after_completion: {
          type: "redirect",
          redirect: { return_url: returnUrl },
        },
        ...(flow === "payment_method_update"
          ? {}
          : flow === "subscription_cancel"
            ? { subscription_cancel: { subscription: stripeSubscriptionId! } }
            : { subscription_update: { subscription: stripeSubscriptionId! } }),
      };
    }

    const session = await stripe.billingPortal.sessions.create(params);

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create billing portal session" }, { status: 500 });
  }
}

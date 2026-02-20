import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendWithResend } from "@/lib/email/resend";

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

function formatMoney(unitAmount: number | null, currency: string | null, quantity: number) {
  if (unitAmount == null || !currency) return "—";
  const totalMinor = unitAmount * Math.max(1, quantity);
  const total = totalMinor / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(total);
  } catch {
    return `${currency.toUpperCase()} ${total.toFixed(2)}`;
  }
}

function prettyPlan(v: string | null | undefined) {
  const p = String(v ?? "").trim().toLowerCase();
  if (p === "personal") return "Personal";
  if (p === "pro") return "Pro";
  if (p === "team") return "Team";
  return "Plan";
}

function prettyBilling(v: string | null | undefined) {
  const b = String(v ?? "").trim().toLowerCase();
  if (b === "annual" || b === "year") return "Annual";
  return "Monthly";
}

function appBaseUrl() {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (!raw) return "https://www.getreceipt.co";
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "https://www.getreceipt.co";
  }
}

function trialEnrollmentEmail({
  plan,
  billing,
  trialEndIso,
  billAmount,
  manageUrl,
}: {
  plan: string;
  billing: string;
  trialEndIso: string;
  billAmount: string;
  manageUrl: string;
}) {
  const trialEnd = new Date(trialEndIso);
  const trialEndDisplay = Number.isNaN(trialEnd.getTime())
    ? trialEndIso
    : trialEnd.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });

  const subject = `Your ${plan} trial is active`;
  const html = `
  <div style="margin:0;padding:24px;background:#f7f7f8;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;">
    <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:14px;padding:24px;">
      <div style="font-size:11px;letter-spacing:.08em;color:#666;font-weight:700;">RECEIPT</div>
      <h1 style="margin:10px 0 0;font-size:22px;line-height:1.3;">Free trial started</h1>
      <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#333;">Your trial is active. Here are the key details:</p>
      <table style="width:100%;margin-top:14px;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;font-size:13px;">Chosen plan</td><td style="padding:8px 0;text-align:right;font-size:13px;font-weight:600;">${plan}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:13px;">Pay schedule</td><td style="padding:8px 0;text-align:right;font-size:13px;font-weight:600;">${billing}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:13px;">Trial expiry</td><td style="padding:8px 0;text-align:right;font-size:13px;font-weight:600;">${trialEndDisplay}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:13px;">Billable at trial end</td><td style="padding:8px 0;text-align:right;font-size:13px;font-weight:600;">${billAmount}</td></tr>
      </table>
      <div style="margin-top:18px;">
        <a href="${manageUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:11px 16px;border-radius:999px;font-size:14px;font-weight:600;">Manage billing</a>
      </div>
      <p style="margin:14px 0 0;color:#5f6368;font-size:12px;line-height:1.5;">You can review or cancel before the trial ends from billing settings.</p>
    </div>
  </div>`;

  const text = `Your free trial is active.

Chosen plan: ${plan}
Pay schedule: ${billing}
Trial expiry: ${trialEndDisplay}
Billable at trial end: ${billAmount}

Manage billing: ${manageUrl}
`;

  return { subject, html, text };
}

async function maybeSendTrialEnrollmentEmail(params: {
  sub: Stripe.Subscription;
  userId: string;
  customerId: string | null;
  plan: string;
  billing: string;
}) {
  const { sub, userId, customerId, plan, billing } = params;
  const te = numField(sub, "trial_end");
  if (!te || te <= 0) return;
  const alreadySent = String(sub.metadata?.trial_enrollment_email_sent ?? "").toLowerCase() === "true";
  if (alreadySent) return;

  const admin = supabaseAdmin();
  const userRes = await admin.auth.admin.getUserById(userId);
  const recipientEmail = userRes.data.user?.email ?? null;
  if (!recipientEmail) return;

  const siteUrl = appBaseUrl();
  let manageUrl = `${siteUrl}/app/account`;
  if (customerId) {
    try {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${siteUrl}/app/account`,
      });
      if (portal.url) manageUrl = portal.url;
    } catch {
      // Fallback to account page if portal session creation fails.
    }
  }

  const price = sub.items.data[0]?.price;
  const billAmount = formatMoney(price?.unit_amount ?? null, price?.currency ?? null, sub.items.data[0]?.quantity ?? 1);
  const trialEndIso = new Date(te * 1000).toISOString();
  const message = trialEnrollmentEmail({
    plan: prettyPlan(plan),
    billing: prettyBilling(billing),
    trialEndIso,
    billAmount,
    manageUrl,
  });

  const sent = await sendWithResend({
    to: recipientEmail,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  if (!sent.ok) {
    console.error("⚠️ Trial enrollment email failed:", sent.error);
    return;
  }

  try {
    await stripe.subscriptions.update(sub.id, {
      metadata: {
        ...sub.metadata,
        trial_enrollment_email_sent: "true",
        trial_enrollment_email_sent_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("⚠️ Failed to mark trial enrollment email metadata:", e);
  }
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
      const billing =
        String(session.metadata?.billing ?? sub.items.data[0]?.price?.recurring?.interval ?? "month").toLowerCase() ===
        "annual"
          ? "annual"
          : String(session.metadata?.billing ?? sub.items.data[0]?.price?.recurring?.interval ?? "month")
              .toLowerCase() === "year"
            ? "annual"
            : "monthly";

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

      await maybeSendTrialEnrollmentEmail({
        sub,
        userId,
        customerId,
        plan,
        billing,
      });

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
      const billing = sub.items.data[0]?.price?.recurring?.interval === "year" ? "annual" : "monthly";

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

      await maybeSendTrialEnrollmentEmail({
        sub,
        userId,
        customerId,
        plan,
        billing,
      });

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

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature") ?? "";
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  const rawBody = await req.text(); // IMPORTANT: raw body for signature verification  [oai_citation:2‡Stripe Docs](https://docs.stripe.com/webhooks?utm_source=chatgpt.com)

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature failed: ${err.message}` }, { status: 400 });
  }

  const admin = supabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;

        // subscription checkout: session.subscription is set
        const userId = session?.metadata?.user_id;
        const customerId = session?.customer;

        if (userId) {
          // store customer/subscription linkage + mark active
          await admin.from("profiles").update({
            stripe_customer_id: customerId ?? null,
            billing_status: "active",
          }).eq("id", userId);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        const userId = sub?.metadata?.user_id;
        const status = sub?.status ?? "unknown";

        if (userId) {
          await admin.from("profiles").update({
            billing_status: status,
          }).eq("id", userId);
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Webhook handler failed" }, { status: 500 });
  }
}
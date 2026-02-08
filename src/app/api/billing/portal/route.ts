import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getSiteUrl(req: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" as any });

    const user = userData.user;
    const admin = supabaseAdmin();

    // You need somewhere to store stripe_customer_id.
    // This assumes: profiles(id uuid pk, stripe_customer_id text null)
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id,stripe_customer_id")
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

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to create billing portal session" },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profile_entitlements")
    .select(
      "plan, subscription_status, billing_interval, seats, current_period_end, cancel_at_period_end, is_paid"
    )
    .eq("id", data.user.id)
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({
    id: data.user.id,
    email: data.user.email ?? null,

    plan: profile.plan,
    subscription_status: profile.subscription_status,
    billing_interval: profile.billing_interval,
    seats: profile.seats,
    current_period_end: profile.current_period_end,
    cancel_at_period_end: profile.cancel_at_period_end,
    is_paid: profile.is_paid,
  });
}
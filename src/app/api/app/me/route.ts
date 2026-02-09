import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await supabaseServer();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = userRes.user.id;

  // 1) Entitlements view (safe computed fields)
  const { data: ent, error: entErr } = await supabase
    .from("profile_entitlements")
    .select(
      "plan, subscription_status, billing_interval, seats, current_period_end, cancel_at_period_end, is_paid"
    )
    .eq("id", userId)
    .maybeSingle();

  if (entErr) {
    return NextResponse.json({ error: entErr.message }, { status: 500 });
  }

  // 2) Real profile row (raw fields & app state)
  // NOTE: If your generated Supabase types are out of date, selecting new columns
  // will type-error (e.g. `GenericStringError`). Cast this query to `any` to
  // keep builds unblocked; regenerate types when convenient.
  const { data: prof, error: profErr } = await (supabase as any)
    .from("profiles")
    .select(
      [
        "stripe_customer_id",
        "stripe_subscription_id",
        "onboarding_completed",
        "onboarding_completed_at",
        "onboarding_answers",
        "recommended_plan",
        "primary_workspace_id",
        "created_at",
        "updated_at",
        // Optional prefs (only if columns exist)
        "display_name",
        "marketing_opt_in",
        "default_ack_limit",
        "default_password_enabled",
      ].join(",")
    )
    .eq("id", userId)
    .maybeSingle();

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  // Fallbacks so UI doesn't explode if the view is missing a row yet.
  const plan = ent?.plan ?? "free";
  const subscription_status = ent?.subscription_status ?? null;
  const billing_interval = ent?.billing_interval ?? null;
  const seats = ent?.seats ?? 1;

  return NextResponse.json({
    id: userId,
    email: userRes.user.email ?? null,

    // entitlements
    plan,
    subscription_status,
    billing_interval,
    seats,
    current_period_end: ent?.current_period_end ?? null,
    cancel_at_period_end: ent?.cancel_at_period_end ?? false,
    is_paid: ent?.is_paid ?? false,

    // profile fields
    stripe_customer_id: (prof as any)?.stripe_customer_id ?? null,
    stripe_subscription_id: (prof as any)?.stripe_subscription_id ?? null,

    onboarding_completed: (prof as any)?.onboarding_completed ?? false,
    onboarding_completed_at: (prof as any)?.onboarding_completed_at ?? null,
    onboarding_answers: (prof as any)?.onboarding_answers ?? null,
    recommended_plan: (prof as any)?.recommended_plan ?? null,

    primary_workspace_id: (prof as any)?.primary_workspace_id ?? null,

    created_at: (prof as any)?.created_at ?? null,
    updated_at: (prof as any)?.updated_at ?? null,

    // optional prefs (only if columns exist)
    display_name: (prof as any)?.display_name ?? null,
    marketing_opt_in: (prof as any)?.marketing_opt_in ?? false,
    default_ack_limit: (prof as any)?.default_ack_limit ?? 1,
    default_password_enabled: (prof as any)?.default_password_enabled ?? false,
  });
}
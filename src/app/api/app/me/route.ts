import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type EntitlementsRow = {
  plan: string | null;
  subscription_status: string | null;
  billing_interval: string | null;
  seats: number | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  is_paid: boolean | null;
};

type ProfileCoreRow = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  onboarding_completed: boolean | null;
  onboarding_completed_at: string | null;
  onboarding_answers: unknown;
  recommended_plan: string | null;
  primary_workspace_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type OptionalPrefs = {
  display_name: string | null;
  marketing_opt_in: boolean;
  default_ack_limit: number;
  default_password_enabled: boolean;
};

function isMissingColumnError(message: string, column: string) {
  const m = message.toLowerCase();
  return m.includes("does not exist") && m.includes(`profiles.${column}`.toLowerCase());
}

async function readOptionalPrefs(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string
): Promise<{ prefs: OptionalPrefs; error: string | null }> {
  const prefs: OptionalPrefs = {
    display_name: null,
    marketing_opt_in: false,
    default_ack_limit: 1,
    default_password_enabled: false,
  };

  const columns = [
    "display_name",
    "marketing_opt_in",
    "default_ack_limit",
    "default_password_enabled",
  ] as const;

  for (const col of columns) {
    const { data, error } = await supabase.from("profiles").select(col).eq("id", userId).maybeSingle();
    if (error) {
      if (isMissingColumnError(error.message, col)) continue;
      return { prefs, error: error.message };
    }

    const row = (data ?? {}) as Record<string, unknown>;
    if (col === "display_name") prefs.display_name = (row.display_name as string | null) ?? null;
    if (col === "marketing_opt_in") prefs.marketing_opt_in = Boolean(row.marketing_opt_in ?? false);
    if (col === "default_ack_limit") prefs.default_ack_limit = Number(row.default_ack_limit ?? 1);
    if (col === "default_password_enabled") {
      prefs.default_password_enabled = Boolean(row.default_password_enabled ?? false);
    }
  }

  return { prefs, error: null };
}

export async function GET() {
  const supabase = await supabaseServer();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = userRes.user.id;

  const { data: ent, error: entErr } = await supabase
    .from("profile_entitlements")
    .select(
      "plan, subscription_status, billing_interval, seats, current_period_end, cancel_at_period_end, is_paid"
    )
    .eq("id", userId)
    .maybeSingle();
  if (entErr) return NextResponse.json({ error: entErr.message }, { status: 500 });

  // Core profile columns only (stable across environments)
  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select(
      "stripe_customer_id,stripe_subscription_id,onboarding_completed,onboarding_completed_at,onboarding_answers,recommended_plan,primary_workspace_id,created_at,updated_at"
    )
    .eq("id", userId)
    .maybeSingle();
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

  const { prefs, error: prefsErr } = await readOptionalPrefs(supabase, userId);
  if (prefsErr) return NextResponse.json({ error: prefsErr }, { status: 500 });

  const entRow = (ent ?? null) as EntitlementsRow | null;
  const profRow = (prof ?? null) as ProfileCoreRow | null;

  return NextResponse.json({
    id: userId,
    email: userRes.user.email ?? null,

    plan: entRow?.plan ?? "free",
    subscription_status: entRow?.subscription_status ?? null,
    billing_interval: entRow?.billing_interval ?? null,
    seats: entRow?.seats ?? 1,
    current_period_end: entRow?.current_period_end ?? null,
    cancel_at_period_end: entRow?.cancel_at_period_end ?? false,
    is_paid: entRow?.is_paid ?? false,

    stripe_customer_id: profRow?.stripe_customer_id ?? null,
    stripe_subscription_id: profRow?.stripe_subscription_id ?? null,
    onboarding_completed: profRow?.onboarding_completed ?? false,
    onboarding_completed_at: profRow?.onboarding_completed_at ?? null,
    onboarding_answers: profRow?.onboarding_answers ?? null,
    recommended_plan: profRow?.recommended_plan ?? null,
    primary_workspace_id: profRow?.primary_workspace_id ?? null,
    created_at: profRow?.created_at ?? null,
    updated_at: profRow?.updated_at ?? null,

    display_name: prefs.display_name,
    marketing_opt_in: prefs.marketing_opt_in,
    default_ack_limit: prefs.default_ack_limit,
    default_password_enabled: prefs.default_password_enabled,
  });
}

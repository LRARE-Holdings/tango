import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api/auth";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: userData, error: userErr } = await supabase.auth.getUser();

  if (userErr) return authErrorResponse(userErr);
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.answers || !body?.recommended_plan) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_completed: true,
      onboarding_answers: body.answers,
      recommended_plan: body.recommended_plan,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userData.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
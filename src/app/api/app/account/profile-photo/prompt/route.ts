import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, column: string) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes(column.toLowerCase());
}

export async function PATCH() {
  const supabase = await supabaseServer();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date().toISOString();
  const updateRes = await supabase
    .from("profiles")
    .update({ profile_photo_prompt_completed_at: now, updated_at: now })
    .eq("id", userData.user.id);

  if (updateRes.error) {
    if (isMissingColumnError(updateRes.error, "profile_photo_prompt_completed_at")) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: updateRes.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile_photo_prompt_completed_at: now });
}

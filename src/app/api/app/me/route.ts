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

  return NextResponse.json({
    id: data.user.id,
    email: data.user.email ?? null,
  });
}
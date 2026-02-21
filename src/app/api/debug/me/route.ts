import { NextResponse } from "next/server";
import { areDebugEndpointsEnabled } from "@/lib/security/debug-flags";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  if (!areDebugEndpointsEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data.user });
}

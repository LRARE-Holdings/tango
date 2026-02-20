import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await supabaseServer();

  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  // Where the user lands after clicking the reset email
  // (must be allowed in Supabase Auth redirect URLs)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.getreceipt.co";
  const redirectTo = `${baseUrl}/auth/reset`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Don't reveal whether the email exists
  return NextResponse.json({ ok: true });
}
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ stackPublicId: string }> | { stackPublicId: string } }
) {
  try {
    const { stackPublicId } = (await ctx.params) as { stackPublicId: string };
    const admin = supabaseAdmin();
    const res = await admin.from("stack_deliveries").select("id,status").eq("public_id", stackPublicId).maybeSingle();
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
    if (!res.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, requires_password: false });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}

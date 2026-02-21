import { NextResponse } from "next/server";
import { limitPublicRead } from "@/lib/rate-limit";
import { publicErrorResponse, publicRateLimitResponse } from "@/lib/security/public-errors";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ stackPublicId: string }> | { stackPublicId: string } }
) {
  try {
    const { stackPublicId } = (await ctx.params) as { stackPublicId: string };
    const readRate = await limitPublicRead(_req, `stack-access:${stackPublicId}`);
    if (!readRate.success) {
      if (readRate.misconfigured) {
        return publicErrorResponse({
          status: 503,
          code: "SECURITY_MISCONFIGURED",
          message: "Service temporarily unavailable.",
        });
      }
      return publicRateLimitResponse(readRate);
    }
    const admin = supabaseAdmin();
    const res = await admin.from("stack_deliveries").select("id,status").eq("public_id", stackPublicId).maybeSingle();
    if (res.error) {
      return publicErrorResponse({
        status: 500,
        code: "STACK_LOOKUP_FAILED",
        message: "Could not load access status.",
      });
    }
    if (!res.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, requires_password: false });
  } catch {
    return publicErrorResponse({
      status: 500,
      code: "STACK_LOOKUP_FAILED",
      message: "Could not load access status.",
    });
  }
}

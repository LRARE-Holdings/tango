import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  display_name?: string | null;
  marketing_opt_in?: boolean;
  default_ack_limit?: number; // e.g. 1..50
  default_password_enabled?: boolean;
};

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, column: string) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes(column.toLowerCase());
}

export async function PATCH(req: Request) {
  const supabase = await supabaseServer();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("display_name" in body) {
    const v = (body.display_name ?? "").trim();
    update.display_name = v.length ? v.slice(0, 80) : null;
  }

  if ("marketing_opt_in" in body) {
    update.marketing_opt_in = Boolean(body.marketing_opt_in);
  }

  if ("default_password_enabled" in body) {
    update.default_password_enabled = Boolean(body.default_password_enabled);
  }

  if ("default_ack_limit" in body) {
    const raw = Number(body.default_ack_limit);
    update.default_ack_limit = Number.isFinite(raw) ? clampInt(raw, 1, 50) : 1;
  }

  // If nothing to update:
  if (Object.keys(update).length <= 1) {
    return NextResponse.json({ ok: true });
  }

  const firstAttempt = await supabase
    .from("profiles")
    .update(update)
    .eq("id", userRes.user.id);
  let upErr = firstAttempt.error;
  if (upErr && (
    isMissingColumnError(upErr, "display_name") ||
    isMissingColumnError(upErr, "marketing_opt_in") ||
    isMissingColumnError(upErr, "default_ack_limit") ||
    isMissingColumnError(upErr, "default_password_enabled")
  )) {
    const safeUpdate = { ...update };
    delete safeUpdate.display_name;
    delete safeUpdate.marketing_opt_in;
    delete safeUpdate.default_ack_limit;
    delete safeUpdate.default_password_enabled;
    const fallback = await supabase.from("profiles").update(safeUpdate).eq("id", userRes.user.id);
    upErr = fallback.error;
  }

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

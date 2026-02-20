import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function isMissingTableError(error: { code?: string; message?: string } | null | undefined, table: string) {
  if (!error) return false;
  if (error.code === "42P01") return true;
  return String(error.message ?? "").toLowerCase().includes(table.toLowerCase());
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = (await ctx.params) as { id: string };
    const supabase = await supabaseServer();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id,workspace_id")
      .eq("id", id)
      .maybeSingle();
    if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const nowIso = new Date().toISOString();
    const activityRes = await supabase
      .from("document_user_activity")
      .upsert(
        {
          user_id: userData.user.id,
          workspace_id: (doc as { workspace_id?: string | null }).workspace_id ?? null,
          document_id: id,
          last_action: "opened",
          last_opened_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "user_id,document_id" }
      );

    if (activityRes.error && !isMissingTableError(activityRes.error, "document_user_activity")) {
      return NextResponse.json({ error: activityRes.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}


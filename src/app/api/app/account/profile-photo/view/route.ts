import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "workspace-branding";

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, column: string) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes(column.toLowerCase());
}

export async function GET() {
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileRes = await supabase
    .from("profiles")
    .select("profile_photo_path")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileRes.error) {
    if (isMissingColumnError(profileRes.error, "profile_photo_path")) {
      return NextResponse.json({ error: "No profile photo" }, { status: 404 });
    }
    return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
  }

  const path = String((profileRes.data as { profile_photo_path?: string | null } | null)?.profile_photo_path ?? "").trim();
  if (!path) return NextResponse.json({ error: "No profile photo" }, { status: 404 });

  const downloadRes = await admin.storage.from(BUCKET).download(path);
  if (downloadRes.error) return NextResponse.json({ error: downloadRes.error.message }, { status: 500 });

  const arrayBuffer = await downloadRes.data.arrayBuffer();
  return new NextResponse(Buffer.from(arrayBuffer), {
    status: 200,
    headers: {
      "content-type": "image/webp",
      "cache-control": "private, max-age=300",
    },
  });
}

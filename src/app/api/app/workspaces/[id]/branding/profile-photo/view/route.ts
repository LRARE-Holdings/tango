import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api/auth";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";
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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = (await ctx.params) as { id: string };
  if (!id) return NextResponse.json({ error: "Invalid workspace identifier" }, { status: 400 });

  const resolved = await resolveWorkspaceIdentifier(id);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await supabaseServer();
  const admin = supabaseAdmin();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) return authErrorResponse(userErr);
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberRes = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", resolved.id)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (memberRes.error) return NextResponse.json({ error: memberRes.error.message }, { status: 500 });
  if (!memberRes.data) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const workspaceRes = await supabase
    .from("workspaces")
    .select("member_profile_photo_path")
    .eq("id", resolved.id)
    .maybeSingle();

  if (workspaceRes.error) {
    if (isMissingColumnError(workspaceRes.error, "member_profile_photo_path")) {
      return NextResponse.json({ error: "No company profile photo" }, { status: 404 });
    }
    return NextResponse.json({ error: workspaceRes.error.message }, { status: 500 });
  }

  const path = String(
    (workspaceRes.data as { member_profile_photo_path?: string | null } | null)?.member_profile_photo_path ?? ""
  ).trim();

  if (!path) return NextResponse.json({ error: "No company profile photo" }, { status: 404 });

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

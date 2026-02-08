import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "workspace-branding";
const MAX_BYTES = 1_000_000; // 1MB

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceId } = (await ctx.params) as { id: string };
    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Must be admin of workspace
    const { data: myMember, error: memErr } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (memErr) throw new Error(memErr.message);
    if (!myMember || (myMember.role !== "owner" && myMember.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Enforce plan is Team/Enterprise (branding is Team-tier feature)
    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("plan")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profErr) throw new Error(profErr.message);
    const plan = (prof?.plan ?? "free") as string;
    if (plan !== "team" && plan !== "enterprise") {
      return NextResponse.json({ error: "Branding is available on Team plans." }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Logo is too large (max 1MB)." }, { status: 400 });
    }

    // Start with PNG only for v1 to keep rendering consistent everywhere
    if (file.type !== "image/png") {
      return NextResponse.json({ error: "Logo must be a PNG (v1)." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `workspaces/${workspaceId}/logo.png`;

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: "image/png",
        upsert: true,
        cacheControl: "3600",
      });

    if (upErr) throw new Error(upErr.message);

    const now = new Date().toISOString();

    const { error: wsErr } = await admin
      .from("workspaces")
      .update({ brand_logo_path: path, brand_logo_updated_at: now })
      .eq("id", workspaceId);

    if (wsErr) throw new Error(wsErr.message);

    return NextResponse.json({ ok: true, path });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
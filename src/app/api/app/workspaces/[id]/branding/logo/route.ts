import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "workspace-branding";
const MAX_BYTES = 1_000_000; // 1MB
const LOGO_WIDTH_MIN = 48;
const LOGO_WIDTH_MAX = 320;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceIdentifier } = (await ctx.params) as { id: string };
    if (!workspaceIdentifier) {
      return NextResponse.json({ error: "Invalid workspace identifier" }, { status: 400 });
    }
    const resolved = await resolveWorkspaceIdentifier(workspaceIdentifier);
    if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const workspaceId = resolved.id;

    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return authErrorResponse(userErr);
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

    const entitlements = await getWorkspaceEntitlementsForUser(admin, workspaceId, userData.user.id);
    if (!entitlements || !entitlements.license_active || !entitlements.workspace_plus) {
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
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceIdentifier } = (await ctx.params) as { id: string };
    if (!workspaceIdentifier) {
      return NextResponse.json({ error: "Invalid workspace identifier" }, { status: 400 });
    }
    const resolved = await resolveWorkspaceIdentifier(workspaceIdentifier);
    if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const workspaceId = resolved.id;

    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return authErrorResponse(userErr);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    const entitlements = await getWorkspaceEntitlementsForUser(admin, workspaceId, userData.user.id);
    if (!entitlements || !entitlements.license_active || !entitlements.workspace_plus) {
      return NextResponse.json({ error: "Branding is available on Team plans." }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { brand_logo_width_px?: unknown } | null;
    const widthRaw = Number(body?.brand_logo_width_px);
    if (!Number.isFinite(widthRaw)) {
      return NextResponse.json({ error: "brand_logo_width_px must be a number." }, { status: 400 });
    }
    const width = Math.max(LOGO_WIDTH_MIN, Math.min(LOGO_WIDTH_MAX, Math.floor(widthRaw)));

    const { error: wsErr } = await admin
      .from("workspaces")
      .update({ brand_logo_width_px: width, updated_at: new Date().toISOString() })
      .eq("id", workspaceId);
    if (wsErr) throw new Error(wsErr.message);

    return NextResponse.json({ ok: true, brand_logo_width_px: width });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Plan = "free" | "personal" | "pro" | "team" | "enterprise";

async function requireUser() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Unauthorized");
  return { supabase, user: data.user };
}

async function getMyPlan(userId: string): Promise<Plan> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return ((data?.plan ?? "free") as Plan);
}

export async function GET() {
  try {
    const { supabase, user } = await requireUser();

    // RLS should restrict to member workspaces
    const { data, error } = await supabase
      .from("workspaces")
      .select("id,name,created_by,created_at,updated_at,brand_logo_path,brand_logo_updated_at")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ workspaces: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = (await req.json().catch(() => null)) as { name?: string } | null;

    const name = (body?.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    }

    const plan = await getMyPlan(user.id);
    if (plan !== "team" && plan !== "enterprise") {
      return NextResponse.json(
        { error: "Workspace creation is available on Team (and Enterprise) plans." },
        { status: 403 }
      );
    }

    // Create workspace (RLS allows insert when created_by = auth.uid())
    const { data: ws, error: wsErr } = await supabase
      .from("workspaces")
      .insert({ name, created_by: user.id })
      .select("id,name,created_at")
      .single();

    if (wsErr) throw new Error(wsErr.message);

    // Add membership as owner
    const { error: memErr } = await supabase
      .from("workspace_members")
      .insert({ workspace_id: ws.id, user_id: user.id, role: "owner" });

    if (memErr) throw new Error(memErr.message);

    // Set primary workspace (admin to avoid any RLS mismatch)
    const admin = supabaseAdmin();
    await admin
      .from("profiles")
      .update({ primary_workspace_id: ws.id, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    return NextResponse.json({ workspace: ws });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
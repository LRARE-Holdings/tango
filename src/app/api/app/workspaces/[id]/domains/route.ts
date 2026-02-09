import crypto from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function normalizeDomain(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

function isValidDomain(domain: string) {
  return /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain);
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "42P01" || String(error.message ?? "").toLowerCase().includes("workspace_domains");
}

async function requireWorkspaceMember(workspaceId: string) {
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  if (!userData.user) return { supabase, admin, userId: null, role: null as string | null };

  const { data: member, error: memberErr } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (memberErr) throw new Error(memberErr.message);

  return {
    supabase,
    admin,
    userId: userData.user.id,
    role: member?.role ?? null,
  };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceId } = (await ctx.params) as { id: string };
    if (!workspaceId || !isUuid(workspaceId)) {
      return NextResponse.json({ error: "Invalid workspace id" }, { status: 400 });
    }

    const { admin, userId, role } = await requireWorkspaceMember(workspaceId);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await admin
      .from("workspace_domains")
      .select(
        "id,domain,status,verification_method,verification_record_name,verification_record_type,verification_record_value,verified_at,created_at"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json(
          { error: "Workspace domains are not configured yet. Run the workspace domains migration first." },
          { status: 500 }
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ domains: data ?? [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceId } = (await ctx.params) as { id: string };
    if (!workspaceId || !isUuid(workspaceId)) {
      return NextResponse.json({ error: "Invalid workspace id" }, { status: 400 });
    }

    const { admin, userId, role } = await requireWorkspaceMember(workspaceId);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (role !== "owner" && role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json().catch(() => null)) as { domain?: string } | null;
    const domain = normalizeDomain(String(body?.domain ?? ""));
    if (!isValidDomain(domain)) {
      return NextResponse.json({ error: "Enter a valid domain (e.g. receipt.example.com)." }, { status: 400 });
    }

    const token = crypto.randomBytes(16).toString("hex");
    const verification_record_name = `_receipt-verification.${domain}`;
    const verification_record_type = "TXT";
    const verification_record_value = `receipt-domain-verify=${token}`;

    const { data, error } = await admin
      .from("workspace_domains")
      .insert({
        workspace_id: workspaceId,
        domain,
        status: "pending",
        verification_method: "dns_txt",
        verification_record_name,
        verification_record_type,
        verification_record_value,
        created_by: userId,
      })
      .select(
        "id,domain,status,verification_method,verification_record_name,verification_record_type,verification_record_value,verified_at,created_at"
      )
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json(
          { error: "Workspace domains are not configured yet. Run the workspace domains migration first." },
          { status: 500 }
        );
      }
      if (error.code === "23505") {
        return NextResponse.json({ error: "That domain is already in use." }, { status: 409 });
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ domain: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

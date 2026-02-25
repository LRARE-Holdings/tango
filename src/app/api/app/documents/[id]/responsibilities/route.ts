import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type WorkspaceMemberRow = {
  user_id: string;
  role: "owner" | "admin" | "member";
};

type CoOwnerSearchRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: "owner" | "admin" | "member";
  license_active: boolean | null;
  hint: string | null;
};

type WorkspaceSelectedUserRow = {
  user_id: string;
  role: "owner" | "admin" | "member";
  license_active: boolean | null;
};

function normalizeLimit(input: string | null, fallback = 10) {
  const value = Number(input ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(20, Math.floor(value)));
}

function normalizeOffset(input: string | null) {
  const value = Number(input ?? 0);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined, table: string) {
  if (!error) return false;
  if (error.code === "42P01") return true;
  return String(error.message ?? "").toLowerCase().includes(table.toLowerCase());
}

async function getDocumentAccess(documentId: string, userId: string) {
  const supabase = await supabaseServer();
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id,title,workspace_id,owner_id")
    .eq("id", documentId)
    .maybeSingle();
  if (docErr) throw new Error(docErr.message);
  if (!doc) return { allowed: false as const, reason: "Not found" };

  const workspaceId = String((doc as { workspace_id?: string | null }).workspace_id ?? "");
  if (!workspaceId) {
    if (String((doc as { owner_id?: string }).owner_id ?? "") !== userId) {
      return { allowed: false as const, reason: "Forbidden" };
    }
    return { allowed: true as const, doc, role: "owner" as const };
  }

  const { data: member, error: memberErr } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (memberErr) throw new Error(memberErr.message);
  if (!member) return { allowed: false as const, reason: "Forbidden" };

  return {
    allowed: true as const,
    doc,
    role: String((member as { role?: string }).role ?? "member") as "owner" | "admin" | "member",
  };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = (await ctx.params) as { id: string };
    const supabase = await supabaseServer();
    const admin = supabaseAdmin();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return authErrorResponse(userErr);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const access = await getDocumentAccess(id, userData.user.id);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: access.reason === "Not found" ? 404 : 403 });
    }

    const workspaceId = String((access.doc as { workspace_id?: string | null }).workspace_id ?? "");
    const ownerId = String((access.doc as { owner_id?: string }).owner_id ?? "");

    const reqUrl = new URL(req.url);
    const searchMode = reqUrl.searchParams.get("search") === "1";
    const summaryMode = reqUrl.searchParams.get("summary") === "1";

    const { data: respRows, error: respErr } = await supabase
      .from("document_responsibilities")
      .select("user_id,coverage_role,assigned_at")
      .eq("document_id", id);

    if (respErr && !isMissingTableError(respErr, "document_responsibilities")) {
      return NextResponse.json({ error: respErr.message }, { status: 500 });
    }

    const responsibilityRows = (respRows ?? []) as Array<{ user_id: string; coverage_role: string; assigned_at: string }>;
    const selectedSet = new Set<string>([
      ownerId,
      ...responsibilityRows.map((row) => String(row.user_id)),
    ]);

    if (searchMode) {
      const q = String(reqUrl.searchParams.get("q") ?? "").trim();
      const limit = normalizeLimit(reqUrl.searchParams.get("limit"), 10);
      const offset = normalizeOffset(reqUrl.searchParams.get("offset"));

      if (!workspaceId || q.length < 2) {
        return NextResponse.json({
          owner_user_id: ownerId,
          can_manage: access.role === "owner" || access.role === "admin",
          results: [],
          next_offset: null,
        });
      }

      const rpcRes = await supabase.rpc("search_workspace_co_owners", {
        p_workspace_id: workspaceId,
        p_q: q,
        p_limit: limit + 1,
        p_offset: offset,
      });

      if (rpcRes.error) return NextResponse.json({ error: rpcRes.error.message }, { status: 500 });

      const rawRows = (rpcRes.data ?? []) as CoOwnerSearchRow[];
      const hasMore = rawRows.length > limit;
      const rows = hasMore ? rawRows.slice(0, limit) : rawRows;

      return NextResponse.json({
        owner_user_id: ownerId,
        can_manage: access.role === "owner" || access.role === "admin",
        results: rows.map((row) => {
          const userId = String(row.user_id);
          return {
            user_id: userId,
            email: row.email ?? null,
            display_name: row.display_name ?? null,
            role: row.role,
            license_active: row.license_active !== false,
            hint: row.hint ?? null,
            selected: selectedSet.has(userId),
            is_owner: userId === ownerId,
          };
        }),
        next_offset: hasMore ? offset + limit : null,
      });
    }

    if (summaryMode) {
      const selectedUserIds = Array.from(selectedSet).filter(Boolean);

      if (!workspaceId) {
        const ownerLookup = await admin.auth.admin.getUserById(ownerId);
        const ownerEmail = ownerLookup.error ? null : ownerLookup.data.user?.email ?? null;
        return NextResponse.json({
          owner_user_id: ownerId,
          can_manage: access.role === "owner" || access.role === "admin",
          responsible_user_ids: [ownerId],
          selected_users: [
            {
              user_id: ownerId,
              email: ownerEmail,
              display_name: null,
              role: "owner",
              license_active: true,
              hint: "Owner • Primary owner",
              is_owner: true,
            },
          ],
        });
      }

      const membersRes = await supabase
        .from("workspace_members")
        .select("user_id,role,license_active")
        .eq("workspace_id", workspaceId)
        .in("user_id", selectedUserIds);

      if (membersRes.error && String(membersRes.error.code ?? "") !== "42703") {
        return NextResponse.json({ error: membersRes.error.message }, { status: 500 });
      }

      const fallbackMembers = membersRes.error
        ? await supabase
            .from("workspace_members")
            .select("user_id,role")
            .eq("workspace_id", workspaceId)
            .in("user_id", selectedUserIds)
        : null;

      if (fallbackMembers?.error) {
        return NextResponse.json({ error: fallbackMembers.error.message }, { status: 500 });
      }

      const selectedMembers = (
        (membersRes.error ? fallbackMembers?.data : membersRes.data) ?? []
      ) as Array<WorkspaceSelectedUserRow | WorkspaceMemberRow>;

      const profileRes = await supabase
        .from("profiles")
        .select("id,display_name")
        .in("id", selectedUserIds);
      if (profileRes.error) return NextResponse.json({ error: profileRes.error.message }, { status: 500 });

      const displayNameByUserId = new Map<string, string | null>(
        ((profileRes.data ?? []) as Array<{ id: string; display_name: string | null }>).map((row) => [
          String(row.id),
          row.display_name ?? null,
        ])
      );

      const emailsByUserId = new Map<string, string | null>();
      await Promise.all(
        selectedUserIds.map(async (uid) => {
          const userRes = await admin.auth.admin.getUserById(uid);
          emailsByUserId.set(uid, userRes.error ? null : (userRes.data.user?.email ?? null));
        })
      );

      const order = { owner: 0, admin: 1, member: 2 } as const;
      const selectedUsers = selectedMembers
        .map((row) => {
          const userId = String(row.user_id);
          const role = String(row.role) as "owner" | "admin" | "member";
          const licenseActive =
            "license_active" in row ? row.license_active !== false : true;
          return {
            user_id: userId,
            email: emailsByUserId.get(userId) ?? null,
            display_name: displayNameByUserId.get(userId) ?? null,
            role,
            license_active: licenseActive,
            hint:
              `${role.charAt(0).toUpperCase()}${role.slice(1)} • ${licenseActive ? "License active" : "License inactive"}`,
            is_owner: userId === ownerId,
          };
        })
        .sort((a, b) => {
          const orderA = order[a.role] ?? 3;
          const orderB = order[b.role] ?? 3;
          if (orderA !== orderB) return orderA - orderB;
          const aLabel = (a.display_name ?? a.email ?? a.user_id).toLowerCase();
          const bLabel = (b.display_name ?? b.email ?? b.user_id).toLowerCase();
          return aLabel.localeCompare(bLabel);
        });

      return NextResponse.json({
        owner_user_id: ownerId,
        can_manage: access.role === "owner" || access.role === "admin",
        responsible_user_ids: selectedUserIds,
        selected_users: selectedUsers,
      });
    }

    if (!workspaceId) {
      return NextResponse.json({
        members: [],
        responsibilities: [],
        can_manage: true,
      });
    }

    const { data: members, error: membersErr } = await supabase
      .from("workspace_members")
      .select("user_id,role")
      .eq("workspace_id", workspaceId)
      .order("joined_at", { ascending: true });
    if (membersErr) return NextResponse.json({ error: membersErr.message }, { status: 500 });

    const memberRows = (members ?? []) as WorkspaceMemberRow[];
    const userIds = Array.from(new Set(memberRows.map((m) => m.user_id)));
    const emailsByUserId = new Map<string, string | null>();
    await Promise.all(
      userIds.map(async (uid) => {
        const { data, error } = await admin.auth.admin.getUserById(uid);
        if (error) {
          emailsByUserId.set(uid, null);
          return;
        }
        emailsByUserId.set(uid, data.user?.email ?? null);
      })
    );

    const responsibilityByUser = new Map<string, { coverage_role: string; assigned_at: string }>();
    for (const r of responsibilityRows) responsibilityByUser.set(String(r.user_id), r);

    return NextResponse.json({
      owner_user_id: ownerId,
      members: memberRows.map((m) => ({
        user_id: m.user_id,
        role: m.role,
        email: emailsByUserId.get(m.user_id) ?? null,
      })),
      responsibilities: memberRows
        .filter((m) => m.user_id === ownerId || responsibilityByUser.has(m.user_id))
        .map((m) => ({
          user_id: m.user_id,
          email: emailsByUserId.get(m.user_id) ?? null,
          role: m.role,
          coverage_role: m.user_id === ownerId ? "owner" : (responsibilityByUser.get(m.user_id)?.coverage_role ?? "shared"),
          assigned_at: responsibilityByUser.get(m.user_id)?.assigned_at ?? null,
        })),
      can_manage: access.role === "owner" || access.role === "admin",
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = (await ctx.params) as { id: string };
    const supabase = await supabaseServer();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return authErrorResponse(userErr);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const access = await getDocumentAccess(id, userData.user.id);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: access.reason === "Not found" ? 404 : 403 });
    }
    if (access.role !== "owner" && access.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workspaceId = String((access.doc as { workspace_id?: string | null }).workspace_id ?? "");
    if (!workspaceId) return NextResponse.json({ error: "Not a workspace document." }, { status: 400 });

    const body = (await req.json().catch(() => null)) as { user_ids?: string[] } | null;
    const incoming = Array.isArray(body?.user_ids) ? body!.user_ids : [];
    const selectedUserIds = Array.from(new Set(incoming.map((x) => String(x).trim()).filter(Boolean)));

    const { data: members, error: membersErr } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId);
    if (membersErr) return NextResponse.json({ error: membersErr.message }, { status: 500 });
    const memberSet = new Set((members ?? []).map((m) => String((m as { user_id: string }).user_id)));
    const invalid = selectedUserIds.filter((uid) => !memberSet.has(uid));
    if (invalid.length > 0) {
      return NextResponse.json({ error: "One or more selected users are not workspace members." }, { status: 400 });
    }

    const ownerId = String((access.doc as { owner_id?: string }).owner_id ?? "");
    const finalUserIds = Array.from(new Set([ownerId, ...selectedUserIds]));

    const { error: delErr } = await supabase
      .from("document_responsibilities")
      .delete()
      .eq("document_id", id)
      .neq("user_id", ownerId);
    if (delErr && !isMissingTableError(delErr, "document_responsibilities")) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    const toInsert = finalUserIds
      .filter((uid) => uid !== ownerId)
      .map((uid) => ({
        workspace_id: workspaceId,
        document_id: id,
        user_id: uid,
        coverage_role: "shared",
        assigned_by: userData.user.id,
      }));

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase
        .from("document_responsibilities")
        .upsert(toInsert, { onConflict: "document_id,user_id" });
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, responsible_user_ids: finalUserIds });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

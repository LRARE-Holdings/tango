import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api/auth";
import { composeDashboardPayload } from "@/lib/dashboard/composer";
import type {
  DashboardCompletionInput,
  DashboardOpenActivityInput,
  DashboardQuickAction,
  DashboardRecipientInput,
  DashboardWorkspaceUsage,
} from "@/lib/dashboard/types";
import { currentUtcMonthRange, getDocumentQuota, normalizeEffectivePlan } from "@/lib/document-limits";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

function firstToken(value: unknown) {
  const clean = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return "";
  return clean.split(" ")[0] ?? "";
}

function firstName(
  displayName: string | null | undefined,
  email: string | null | undefined,
  userMetadata: unknown
) {
  const fromDisplayName = firstToken(displayName);
  if (fromDisplayName) return fromDisplayName;

  const meta = (userMetadata ?? {}) as Record<string, unknown>;
  const fromMetaFirstName = firstToken(meta.first_name);
  if (fromMetaFirstName) return fromMetaFirstName;

  const fromMetaFullName = firstToken(meta.full_name);
  if (fromMetaFullName) return fromMetaFullName;

  const fromMetaName = firstToken(meta.name);
  if (fromMetaName) return fromMetaName;

  return firstToken(String(email ?? "").trim().split("@")[0] ?? "") || "there";
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, column: string) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes(column.toLowerCase());
}

export async function GET(
  _req: Request,
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

    const userId = userData.user.id;
    const entitlements = await getWorkspaceEntitlementsForUser(admin, workspaceId, userId);
    if (!entitlements || !entitlements.license_active) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [workspaceRes, profileWithNameRes, recentActivityRes, memberWithPermRes, membersCountRes] = await Promise.all([
      supabase.from("workspaces").select("id,name,slug").eq("id", workspaceId).maybeSingle(),
      supabase
        .from("profiles")
        .select("display_name,last_seen_at,last_login_at")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("document_user_activity")
        .select("document_id,last_opened_at,last_action")
        .eq("user_id", userId)
        .eq("workspace_id", workspaceId)
        .order("last_opened_at", { ascending: false })
        .limit(60),
      supabase
        .from("workspace_members")
        .select("can_view_analytics")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("workspace_members").select("workspace_id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    ]);

    if (workspaceRes.error) return NextResponse.json({ error: workspaceRes.error.message }, { status: 500 });
    if (!workspaceRes.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const profileRes =
      profileWithNameRes.error && isMissingColumnError(profileWithNameRes.error, "display_name")
        ? await supabase
            .from("profiles")
            .select("last_seen_at,last_login_at")
            .eq("id", userId)
            .maybeSingle()
        : profileWithNameRes;

    if (profileRes.error) return NextResponse.json({ error: profileRes.error.message }, { status: 500 });

    const memberPermRes =
      memberWithPermRes.error && isMissingColumnError(memberWithPermRes.error, "can_view_analytics")
        ? ({ data: { can_view_analytics: false }, error: null } as const)
        : memberWithPermRes;

    if (memberPermRes.error) return NextResponse.json({ error: memberPermRes.error.message }, { status: 500 });
    if (membersCountRes.error) return NextResponse.json({ error: membersCountRes.error.message }, { status: 500 });

    const docsWithMeta = await supabase
      .from("documents")
      .select("id,title,public_id,created_at,priority,labels")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(300);

    let docsData = docsWithMeta.data as Array<{
      id: string;
      title?: string;
      public_id?: string;
      created_at?: string;
      priority?: string;
      labels?: string[];
    }> | null;
    let docsErr = docsWithMeta.error;

    if (docsErr && (isMissingColumnError(docsErr, "priority") || isMissingColumnError(docsErr, "labels"))) {
      const fallback = await supabase
        .from("documents")
        .select("id,title,public_id,created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(300);
      docsData = fallback.data?.map((row) => ({ ...row, priority: "normal", labels: [] })) as typeof docsData;
      docsErr = fallback.error;
    }

    if (docsErr) return NextResponse.json({ error: docsErr.message }, { status: 500 });

    const docs = (docsData ?? []).map((doc) => ({
      id: String(doc.id),
      title: String(doc.title ?? "Untitled"),
      public_id: String(doc.public_id ?? ""),
      created_at: String(doc.created_at ?? new Date().toISOString()),
      priority: String(doc.priority ?? "normal"),
      labels: Array.isArray(doc.labels) ? doc.labels.map((value) => String(value)) : [],
    }));

    const docIds = docs.map((doc) => doc.id);

    let recipients: DashboardRecipientInput[] = [];
    let completions: DashboardCompletionInput[] = [];

    if (docIds.length > 0) {
      const [recipientsRes, completionsRes] = await Promise.all([
        admin
          .from("recipients")
          .select("id,document_id,name,email")
          .in("document_id", docIds)
          .limit(4000),
        admin
          .from("completions")
          .select("id,document_id,recipient_id,acknowledged,submitted_at")
          .in("document_id", docIds)
          .eq("acknowledged", true)
          .order("submitted_at", { ascending: false })
          .limit(7000),
      ]);

      if (recipientsRes.error) return NextResponse.json({ error: recipientsRes.error.message }, { status: 500 });
      if (completionsRes.error) return NextResponse.json({ error: completionsRes.error.message }, { status: 500 });

      recipients = (recipientsRes.data ?? []).map((row) => ({
        id: String((row as { id: string }).id),
        document_id: String((row as { document_id: string }).document_id),
        name: ((row as { name?: string | null }).name ?? null) as string | null,
        email: ((row as { email?: string | null }).email ?? null) as string | null,
      }));

      completions = (completionsRes.data ?? []).map((row) => ({
        id: String((row as { id: string }).id),
        document_id: String((row as { document_id: string }).document_id),
        recipient_id: ((row as { recipient_id?: string | null }).recipient_id ?? null) as string | null,
        acknowledged: Boolean((row as { acknowledged?: boolean }).acknowledged),
        submitted_at: ((row as { submitted_at?: string | null }).submitted_at ?? null) as string | null,
      }));
    }

    const openActivity: DashboardOpenActivityInput[] = (recentActivityRes.error ? [] : recentActivityRes.data ?? []).map((row) => ({
      document_id: String((row as { document_id: string }).document_id),
      last_opened_at: ((row as { last_opened_at?: string | null }).last_opened_at ?? null) as string | null,
      last_action: ((row as { last_action?: string | null }).last_action ?? null) as string | null,
    }));

    const effectivePlan = normalizeEffectivePlan(entitlements.plan);
    const quota = getDocumentQuota(effectivePlan, entitlements.seat_limit ?? 1);

    let usageUsed = docs.length;
    if (quota.limit !== null) {
      let usageQuery = supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);
      if (quota.window === "monthly") {
        const { startIso, endIso } = currentUtcMonthRange();
        usageQuery = usageQuery.gte("created_at", startIso).lt("created_at", endIso);
      }
      const usageRes = await usageQuery;
      if (usageRes.error) return NextResponse.json({ error: usageRes.error.message }, { status: 500 });
      usageUsed = usageRes.count ?? 0;
    }

    const usage: DashboardWorkspaceUsage = {
      documents_used: usageUsed,
      documents_limit: quota.limit,
      utilization_percent: quota.limit && quota.limit > 0 ? Math.round((usageUsed / quota.limit) * 100) : null,
      members: membersCountRes.count ?? null,
      plan: effectivePlan,
    };

    const canViewAnalytics =
      entitlements.role === "owner" || entitlements.role === "admin"
        ? true
        : ((memberPermRes.data as { can_view_analytics?: boolean } | null)?.can_view_analytics === true);

    const linkId = workspaceRes.data.slug ?? workspaceId;
    const quickActions: DashboardQuickAction[] = [
      { id: "new", label: "Send a new Receipt", href: "/app/new", primary: true },
      { id: "documents", label: "Open files", href: `/app/workspaces/${linkId}/documents` },
      ...(canViewAnalytics ? [{ id: "analytics", label: "Open analytics", href: `/app/workspaces/${linkId}/analytics` }] : []),
    ];

    const dashboard = composeDashboardPayload({
      docs,
      recipients,
      completions,
      openActivity,
      workspaceUsage: usage,
      quickActions,
    });

    const profile = profileRes.data as {
      display_name?: string | null;
      last_seen_at?: string | null;
      last_login_at?: string | null;
    } | null;

    const since = profile?.last_seen_at ?? profile?.last_login_at ?? null;
    let whileAway = {
      acknowledged_count: 0,
      documents_affected: 0,
      latest_at: null as string | null,
    };

    if (since) {
      const sinceMs = new Date(since).getTime();
      const sinceCompletions = completions.filter((row) => {
        if (!row.submitted_at) return false;
        return new Date(row.submitted_at).getTime() >= sinceMs;
      });
      whileAway = {
        acknowledged_count: sinceCompletions.length,
        documents_affected: new Set(sinceCompletions.map((row) => row.document_id)).size,
        latest_at: sinceCompletions[0]?.submitted_at ?? null,
      };
    }

    return NextResponse.json({
      workspace: workspaceRes.data,
      viewer: {
        user_id: userId,
        role: entitlements.role,
        plan: entitlements.plan,
        can_view_analytics: canViewAnalytics,
      },
      greeting: {
        text: greetingForNow(),
        first_name: firstName(
          profile?.display_name ?? null,
          userData.user.email ?? null,
          userData.user.user_metadata
        ),
      },
      while_away: {
        ...whileAway,
        since,
      },
      ...dashboard,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

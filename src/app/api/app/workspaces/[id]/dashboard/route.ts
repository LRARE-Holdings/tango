import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";
import { currentUtcMonthRange, getDocumentQuota, normalizeEffectivePlan } from "@/lib/document-limits";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActivityItem =
  | {
      type: "document_created";
      at: string;
      document: { id: string; title: string; public_id: string };
    }
  | {
      type: "completion_submitted";
      at: string;
      acknowledged: boolean;
      document: { id: string; title: string; public_id: string };
      recipient: { name: string | null; email: string | null };
      metrics: {
        max_scroll_percent: number | null;
        time_on_page_seconds: number | null;
        active_seconds: number | null;
      };
    };

type DashboardScope = "workspace" | "personal";
type UsageWindow = "total" | "monthly" | "custom";

function isMissingTableError(error: { code?: string; message?: string } | null | undefined, table: string) {
  if (!error) return false;
  if (error.code === "42P01") return true;
  return String(error.message ?? "").toLowerCase().includes(table.toLowerCase());
}

type DashboardCompletion = {
  document_id: string;
  acknowledged: boolean | null;
  submitted_at: string | null;
  max_scroll_percent: number | null;
  time_on_page_seconds: number | null;
  active_seconds: number | null;
  recipients?:
    | { name: string | null; email: string | null }
    | Array<{ name: string | null; email: string | null }>
    | null;
};

function safeIso(s: unknown): string | null {
  if (!s) return null;
  if (typeof s !== "string" && typeof s !== "number" && !(s instanceof Date)) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function avg(nums: Array<number | null | undefined>) {
  const xs = nums.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export async function GET(
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
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = userData.user.id;

    // Ensure membership (RLS should already enforce, but be explicit)
    const { data: mem, error: memErr } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });
    if (!mem) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const viewerRole = String(mem.role ?? "member") as "owner" | "admin" | "member";
    const requestedScopeRaw = String(new URL(req.url).searchParams.get("scope") ?? "")
      .trim()
      .toLowerCase();
    const requestedScope: DashboardScope | null =
      requestedScopeRaw === "personal" || requestedScopeRaw === "workspace"
        ? (requestedScopeRaw as DashboardScope)
        : null;
    const scope: DashboardScope =
      viewerRole === "member" ? "personal" : requestedScope ?? "workspace";

    const workspaceEntitlements = await getWorkspaceEntitlementsForUser(admin, workspaceId, userId);
    if (!workspaceEntitlements || !workspaceEntitlements.license_active) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const effectivePlan = normalizeEffectivePlan(workspaceEntitlements.plan);
    let seatLimitForQuota = workspaceEntitlements.seat_limit;
    if (effectivePlan === "team" && !seatLimitForQuota) {
      const { data: ent } = await supabase
        .from("profile_entitlements")
        .select("seats")
        .eq("id", userId)
        .maybeSingle();
      const seats = Number((ent as { seats?: unknown } | null)?.seats ?? 1);
      seatLimitForQuota = Number.isFinite(seats) && seats > 0 ? Math.floor(seats) : 1;
    }

    // Run independent dashboard queries in parallel to reduce first-byte time.
    const [workspaceResult, membersResult, invitesResult, docsResult] = await Promise.all([
      supabase
        .from("workspaces")
        .select("id,name,slug,created_at,brand_logo_updated_at")
        .eq("id", workspaceId)
        .maybeSingle(),
      supabase.from("workspace_members").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId),
      supabase
        .from("workspace_invites")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .in("status", ["pending", "sent"]),
      supabase
        .from("documents")
        .select("id,title,public_id,created_at,owner_id")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(250),
    ]);

    const { data: workspace, error: wsErr } = workspaceResult;
    if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 });
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { count: membersCount, error: mcErr } = membersResult;
    if (mcErr) return NextResponse.json({ error: mcErr.message }, { status: 500 });

    const { count: invitesPendingCount, error: icErr } = invitesResult;
    const safeInvitesPendingCount = icErr ? 0 : (invitesPendingCount ?? 0);

    const { data: docs, error: dErr } = docsResult;

    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

    let documents = (docs ?? []).map((d) => ({
      id: d.id as string,
      title: (d.title as string) ?? "Untitled",
      public_id: (d.public_id as string) ?? "",
      created_at: (d.created_at as string) ?? new Date().toISOString(),
      owner_id: (d.owner_id as string) ?? "",
    }));

    if (scope === "personal" && documents.length > 0) {
      const docIds = documents.map((d) => d.id);
      const { data: assignedRows, error: assignedErr } = await supabase
        .from("document_responsibilities")
        .select("document_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .in("document_id", docIds);

      let assignedDocIds = new Set<string>();
      if (assignedErr && !isMissingTableError(assignedErr, "document_responsibilities")) {
        return NextResponse.json({ error: assignedErr.message }, { status: 500 });
      }
      if (!assignedErr) {
        assignedDocIds = new Set((assignedRows ?? []).map((r) => String((r as { document_id: string }).document_id)));
      }

      documents = documents.filter((d) => d.owner_id === userId || assignedDocIds.has(d.id));
    }

    const docIds = documents.map((d) => d.id);
    const docsTotal = documents.length;

    // Recent completions for those docs
    let completions: DashboardCompletion[] = [];
    if (docIds.length > 0) {
      const { data: comps, error: cErr } = await supabase
        .from("completions")
        .select(
          "id,document_id,acknowledged,submitted_at,max_scroll_percent,time_on_page_seconds,active_seconds,recipients(name,email)"
        )
        .in("document_id", docIds)
        .order("submitted_at", { ascending: false })
        .limit(80);

      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
      completions = (comps ?? []) as DashboardCompletion[];
    }

    // Aggregate per document
    const ackCountByDoc = new Map<string, number>();
    let acknowledgementsTotal = 0;

    for (const c of completions) {
      const docId = c.document_id as string;
      if (c.acknowledged) {
        acknowledgementsTotal += 1;
        ackCountByDoc.set(docId, (ackCountByDoc.get(docId) ?? 0) + 1);
      }
    }

    const docsAcknowledged = documents.filter((d) => (ackCountByDoc.get(d.id) ?? 0) > 0).length;
    const docsPending = docsTotal - docsAcknowledged;
    const completionsTotal = completions.length;

    // Averages
    const avgScroll = avg(completions.map((c) => c.max_scroll_percent));
    const avgTime = avg(completions.map((c) => c.time_on_page_seconds));
    const avgActive = avg(completions.map((c) => c.active_seconds));

    // Speed-up for activity feed lookups
    const docById = new Map(documents.map((d) => [d.id, d] as const));

    // Build activity feed (document_created + completion_submitted)
    const docCreatedEvents: ActivityItem[] = documents.slice(0, 30).map((d) => ({
      type: "document_created",
      at: safeIso(d.created_at) ?? new Date().toISOString(),
      document: { id: d.id, title: d.title, public_id: d.public_id },
    }));

    const completionEvents: ActivityItem[] = completions.slice(0, 80).map((c) => {
      const doc = docById.get(c.document_id as string);
      const recipient = normalizeRecipient(c.recipients);
      return {
        type: "completion_submitted",
        at: safeIso(c.submitted_at) ?? new Date().toISOString(),
        acknowledged: !!c.acknowledged,
        document: {
          id: (c.document_id as string) ?? "",
          title: doc?.title ?? "Untitled",
          public_id: doc?.public_id ?? "",
        },
        recipient: {
          name: recipient?.name ?? null,
          email: recipient?.email ?? null,
        },
        metrics: {
          max_scroll_percent: typeof c.max_scroll_percent === "number" ? c.max_scroll_percent : null,
          time_on_page_seconds:
            typeof c.time_on_page_seconds === "number" ? c.time_on_page_seconds : null,
          active_seconds: typeof c.active_seconds === "number" ? c.active_seconds : null,
        },
      };
    });

    const activity = [...docCreatedEvents, ...completionEvents]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 25);

    // Pending list: newest docs with 0 acknowledgements
    const pendingList = documents
      .filter((d) => (ackCountByDoc.get(d.id) ?? 0) === 0)
      .slice(0, 8)
      .map((d) => ({
        ...d,
        acknowledgements: 0,
      }));

    const quota = getDocumentQuota(effectivePlan, seatLimitForQuota);
    const usageLimit: number | null = quota.limit;
    let usageUsed = 0;
    const usageWindow: UsageWindow = quota.window;
    const usageCountBy = effectivePlan === "team" ? "workspace" : "user";

    if (quota.limit !== null) {
      let usageQuery = supabase.from("documents").select("id", { count: "exact", head: true });
      if (quota.window === "monthly") {
        const { startIso, endIso } = currentUtcMonthRange();
        usageQuery = usageQuery.gte("created_at", startIso).lt("created_at", endIso);
      }
      if (effectivePlan === "team") {
        usageQuery = usageQuery.eq("workspace_id", workspaceId);
      } else {
        usageQuery = usageQuery.eq("owner_id", userId);
      }

      const { count: usageCount, error: usageErr } = await usageQuery;
      if (usageErr) return NextResponse.json({ error: usageErr.message }, { status: 500 });
      usageUsed = usageCount ?? 0;
    }

    const usageRemaining =
      usageLimit == null ? null : Math.max(0, usageLimit - usageUsed);
    const usagePercent =
      usageLimit == null || usageLimit <= 0
        ? null
        : Math.min(100, Math.round((usageUsed / usageLimit) * 100));
    const usageNearLimit = usageLimit != null && usageUsed >= Math.floor(usageLimit * 0.8);
    const usageAtLimit = usageLimit != null && usageUsed >= usageLimit;

    return NextResponse.json({
      scope,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: (workspace as { slug?: string | null }).slug ?? null,
        created_at: workspace.created_at,
        brand_logo_updated_at: workspace.brand_logo_updated_at ?? null,
      },
      viewer: {
        user_id: userId,
        role: viewerRole,
      },
      counts: {
        members: membersCount ?? 0,
        invites_pending: safeInvitesPendingCount,
        documents_total: docsTotal,
        documents_pending: docsPending,
        documents_acknowledged: docsAcknowledged,
        completions_total: completionsTotal,
        acknowledgements_total: acknowledgementsTotal,
      },
      averages: {
        max_scroll_percent: avgScroll,
        time_on_page_seconds: avgTime,
        active_seconds: avgActive,
      },
      usage: {
        plan: effectivePlan,
        count_by: usageCountBy,
        used: usageUsed,
        limit: usageLimit,
        remaining: usageRemaining,
        percent: usagePercent,
        window: usageWindow,
        near_limit: usageNearLimit,
        at_limit: usageAtLimit,
      },
      pending: pendingList,
      activity,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dashboard failed" },
      { status: 500 }
    );
  }
}
function normalizeRecipient(
  value: DashboardCompletion["recipients"]
): { name: string | null; email: string | null } | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

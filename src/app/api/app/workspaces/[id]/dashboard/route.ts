import { NextResponse } from "next/server";
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

function safeIso(s: any): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function avg(nums: Array<number | null | undefined>) {
  const xs = nums.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
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

    // Workspace basics
    const { data: workspace, error: wsErr } = await supabase
      .from("workspaces")
      .select("id,name,slug,created_at,brand_logo_updated_at")
      .eq("id", workspaceId)
      .maybeSingle();

    if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 });
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Members count
    const { count: membersCount, error: mcErr } = await supabase
      .from("workspace_members")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    if (mcErr) return NextResponse.json({ error: mcErr.message }, { status: 500 });

    // Pending invites count (status column assumed; if not present, we fall back to 0)
    const { count: invitesPendingCount, error: icErr } = await supabase
      .from("workspace_invites")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .in("status", ["pending", "sent"]);

    const safeInvitesPendingCount = icErr ? 0 : (invitesPendingCount ?? 0);

    // Recent documents
    const { data: docs, error: dErr } = await supabase
      .from("documents")
      .select("id,title,public_id,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(60);

    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

    const documents = (docs ?? []).map((d) => ({
      id: d.id as string,
      title: (d.title as string) ?? "Untitled",
      public_id: (d.public_id as string) ?? "",
      created_at: (d.created_at as string) ?? new Date().toISOString(),
    }));

    const docIds = documents.map((d) => d.id);
    const docsTotal = documents.length;

    // Recent completions for those docs
    let completions: any[] = [];
    if (docIds.length > 0) {
      const { data: comps, error: cErr } = await supabase
        .from("completions")
        .select(
          "id,document_id,acknowledged,submitted_at,max_scroll_percent,time_on_page_seconds,active_seconds,recipients(name,email)"
        )
        .in("document_id", docIds)
        .order("submitted_at", { ascending: false })
        .limit(120);

      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
      completions = comps ?? [];
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
          name: c.recipients?.name ?? null,
          email: c.recipients?.email ?? null,
        },
        metrics: {
          max_scroll_percent: typeof c.max_scroll_percent === "number" ? c.max_scroll_percent : null,
          time_on_page_seconds:
            typeof c.time_on_page_seconds === "number" ? c.time_on_page_seconds : null,
          active_seconds: typeof c.active_seconds === "number" ? c.active_seconds : null,
        },
      } as ActivityItem;
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

    return NextResponse.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: (workspace as { slug?: string | null }).slug ?? null,
        created_at: workspace.created_at,
        brand_logo_updated_at: workspace.brand_logo_updated_at ?? null,
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
      pending: pendingList,
      activity,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Dashboard failed" }, { status: 500 });
  }
}

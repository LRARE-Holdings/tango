import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";
import { supabaseAdmin } from "@/lib/supabase/admin";

function firstName(displayName: string | null | undefined, email: string | null | undefined) {
  const clean = String(displayName ?? "").trim().replace(/\s+/g, " ");
  if (clean) return clean.split(" ")[0] ?? "";
  const fromEmail = String(email ?? "").trim().split("@")[0];
  return fromEmail || "there";
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
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = userData.user.id;
    const entitlements = await getWorkspaceEntitlementsForUser(admin, workspaceId, userId);
    if (!entitlements || !entitlements.license_active) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const memberWithPerm = await supabase
      .from("workspace_members")
      .select("can_view_analytics")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    const memberRes =
      memberWithPerm.error && isMissingColumnError(memberWithPerm.error, "can_view_analytics")
        ? { data: { can_view_analytics: false } as { can_view_analytics: boolean }, error: null as null }
        : memberWithPerm;
    if (memberRes.error) return NextResponse.json({ error: memberRes.error.message }, { status: 500 });

    const [workspaceRes, profileWithNameRes, recentActivityRes] = await Promise.all([
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
        .limit(8),
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

    const activityRows = recentActivityRes.error ? [] : (recentActivityRes.data ?? []);
    const recentDocIds = activityRows.map((row) => String((row as { document_id: string }).document_id));

    let recentDocs: Array<{
      id: string;
      title: string;
      public_id: string;
      created_at: string;
      priority: string;
      labels: string[];
      source: "opened" | "created";
      at: string;
    }> = [];

    if (recentDocIds.length > 0) {
      const withMeta = await supabase
        .from("documents")
        .select("id,title,public_id,created_at,priority,labels")
        .in("id", recentDocIds)
        .eq("workspace_id", workspaceId);
      let docsData = withMeta.data;
      let docsErr = withMeta.error;
      if (docsErr && (isMissingColumnError(docsErr, "priority") || isMissingColumnError(docsErr, "labels"))) {
        const fallback = await supabase
          .from("documents")
          .select("id,title,public_id,created_at")
          .in("id", recentDocIds)
          .eq("workspace_id", workspaceId);
        docsData = fallback.data?.map((d) => ({ ...d, priority: "normal", labels: [] })) ?? null;
        docsErr = fallback.error;
      }
      if (docsErr) return NextResponse.json({ error: docsErr.message }, { status: 500 });

      const byId = new Map(
        (docsData ?? []).map((doc) => [String((doc as { id: string }).id), doc as Record<string, unknown>])
      );
      recentDocs = activityRows
        .map((row) => {
          const docId = String((row as { document_id: string }).document_id);
          const doc = byId.get(docId);
          if (!doc) return null;
          return {
            id: docId,
            title: String(doc.title ?? "Untitled"),
            public_id: String(doc.public_id ?? ""),
            created_at: String(doc.created_at ?? new Date().toISOString()),
            priority: String(doc.priority ?? "normal").toLowerCase(),
            labels: Array.isArray(doc.labels) ? doc.labels.map((x) => String(x)) : [],
            source: "opened" as const,
            at: String((row as { last_opened_at?: string }).last_opened_at ?? doc.created_at ?? new Date().toISOString()),
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
    }

    if (recentDocs.length === 0) {
      const withMetaFallback = await supabase
        .from("documents")
        .select("id,title,public_id,created_at,priority,labels")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(8);
      let docsData = withMetaFallback.data;
      let docsErr = withMetaFallback.error;
      if (docsErr && (isMissingColumnError(docsErr, "priority") || isMissingColumnError(docsErr, "labels"))) {
        const fallback = await supabase
          .from("documents")
          .select("id,title,public_id,created_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(8);
        docsData = fallback.data?.map((d) => ({ ...d, priority: "normal", labels: [] })) ?? null;
        docsErr = fallback.error;
      }
      if (docsErr) return NextResponse.json({ error: docsErr.message }, { status: 500 });

      recentDocs = (docsData ?? []).map((doc) => ({
        id: String((doc as { id: string }).id),
        title: String((doc as { title?: string }).title ?? "Untitled"),
        public_id: String((doc as { public_id?: string }).public_id ?? ""),
        created_at: String((doc as { created_at?: string }).created_at ?? new Date().toISOString()),
        priority: String((doc as { priority?: string }).priority ?? "normal").toLowerCase(),
        labels: Array.isArray((doc as { labels?: unknown }).labels)
          ? ((doc as { labels: unknown[] }).labels.map((x) => String(x)))
          : [],
        source: "created" as const,
        at: String((doc as { created_at?: string }).created_at ?? new Date().toISOString()),
      }));
    }

    const profile = profileRes.data as {
      display_name?: string | null;
      last_seen_at?: string | null;
      last_login_at?: string | null;
    } | null;
    const since = profile?.last_seen_at ?? profile?.last_login_at ?? null;
    let away = {
      acknowledged_count: 0,
      documents_affected: 0,
      latest_at: null as string | null,
    };

    if (since) {
      const docsForWorkspace = await supabase
        .from("documents")
        .select("id")
        .eq("workspace_id", workspaceId)
        .limit(800);
      if (docsForWorkspace.error) return NextResponse.json({ error: docsForWorkspace.error.message }, { status: 500 });
      const workspaceDocIds = (docsForWorkspace.data ?? []).map((d) => String((d as { id: string }).id));

      if (workspaceDocIds.length > 0) {
        const completionsRes = await admin
          .from("completions")
          .select("document_id,submitted_at,acknowledged")
          .in("document_id", workspaceDocIds)
          .eq("acknowledged", true)
          .gte("submitted_at", since)
          .order("submitted_at", { ascending: false })
          .limit(500);
        if (completionsRes.error) {
          return NextResponse.json({ error: completionsRes.error.message }, { status: 500 });
        }
        const completions = completionsRes.data ?? [];
        away = {
          acknowledged_count: completions.length,
          documents_affected: new Set(
            completions.map((c) => String((c as { document_id: string }).document_id))
          ).size,
          latest_at:
            String(
              (
                (completions[0] as { submitted_at?: string | null } | undefined)?.submitted_at ?? ""
              ) || ""
            ) || null,
        };
      }
    }

    return NextResponse.json({
      workspace: workspaceRes.data,
      viewer: {
        user_id: userId,
        role: entitlements.role,
        plan: entitlements.plan,
        can_view_analytics:
          entitlements.role === "owner" || entitlements.role === "admin"
            ? true
            : ((memberRes.data as { can_view_analytics?: boolean } | null)?.can_view_analytics === true),
      },
      greeting: {
        text: greetingForNow(),
        first_name: firstName(profile?.display_name ?? null, userData.user.email ?? null),
      },
      recent_files: recentDocs,
      while_away: {
        ...away,
        since,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

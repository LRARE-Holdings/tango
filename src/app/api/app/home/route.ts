import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api/auth";
import { composeDashboardPayload } from "@/lib/dashboard/composer";
import type {
  DashboardCompletionInput,
  DashboardOpenActivityInput,
  DashboardQuickAction,
  DashboardRecipientInput,
} from "@/lib/dashboard/types";
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

export async function GET() {
  try {
    const supabase = await supabaseServer();
    const admin = supabaseAdmin();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return authErrorResponse(userErr);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = userData.user.id;

    const profileWithName = await supabase
      .from("profiles")
      .select("display_name,last_seen_at,last_login_at,plan,primary_workspace_id")
      .eq("id", userId)
      .maybeSingle();

    const profileRes =
      profileWithName.error && isMissingColumnError(profileWithName.error, "display_name")
        ? await supabase
            .from("profiles")
            .select("last_seen_at,last_login_at,plan,primary_workspace_id")
            .eq("id", userId)
            .maybeSingle()
        : profileWithName;

    if (profileRes.error) return NextResponse.json({ error: profileRes.error.message }, { status: 500 });

    const profile = profileRes.data as {
      display_name?: string | null;
      last_seen_at?: string | null;
      last_login_at?: string | null;
      plan?: string | null;
      primary_workspace_id?: string | null;
    } | null;

    const since = profile?.last_seen_at ?? profile?.last_login_at ?? null;

    const [activityRes, docsWithMeta] = await Promise.all([
      supabase
        .from("document_user_activity")
        .select("document_id,last_opened_at,last_action")
        .eq("user_id", userId)
        .is("workspace_id", null)
        .order("last_opened_at", { ascending: false })
        .limit(60),
      supabase
        .from("documents")
        .select("id,title,public_id,created_at,priority,labels")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(250),
    ]);

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
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(250);
      docsData =
        fallback.data?.map((row) => ({ ...row, priority: "normal", labels: [] })) as typeof docsData;
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
          .limit(3000),
        admin
          .from("completions")
          .select("id,document_id,recipient_id,acknowledged,submitted_at")
          .in("document_id", docIds)
          .eq("acknowledged", true)
          .order("submitted_at", { ascending: false })
          .limit(5000),
      ]);

      if (recipientsRes.error) return NextResponse.json({ error: recipientsRes.error.message }, { status: 500 });
      if (completionsRes.error) return NextResponse.json({ error: completionsRes.error.message }, { status: 500 });

      recipients = (recipientsRes.data ?? []).map((row) => ({
        id: String((row as { id: string }).id),
        document_id: String((row as { document_id: string }).document_id),
        name: (row as { name?: string | null }).name ?? null,
        email: (row as { email?: string | null }).email ?? null,
      }));

      completions = (completionsRes.data ?? []).map((row) => ({
        id: String((row as { id: string }).id),
        document_id: String((row as { document_id: string }).document_id),
        recipient_id: ((row as { recipient_id?: string | null }).recipient_id ?? null) as string | null,
        acknowledged: Boolean((row as { acknowledged?: boolean }).acknowledged),
        submitted_at: ((row as { submitted_at?: string | null }).submitted_at ?? null) as string | null,
      }));
    }

    const openActivity: DashboardOpenActivityInput[] = (activityRes.error ? [] : activityRes.data ?? []).map((row) => ({
      document_id: String((row as { document_id: string }).document_id),
      last_opened_at: ((row as { last_opened_at?: string | null }).last_opened_at ?? null) as string | null,
      last_action: ((row as { last_action?: string | null }).last_action ?? null) as string | null,
    }));

    const quickActions: DashboardQuickAction[] = [
      { id: "new", label: "Send a new Receipt", href: "/app/new", primary: true },
      { id: "files", label: "Open files", href: "/app/files" },
      { id: "workspaces", label: "Open workspaces", href: "/app/workspaces" },
    ];

    const dashboard = composeDashboardPayload({
      docs,
      recipients,
      completions,
      openActivity,
      workspaceUsage: null,
      quickActions,
    });

    let whileAway = { acknowledged_count: 0, documents_affected: 0, latest_at: null as string | null };
    if (since && docIds.length > 0) {
      const sinceCompletions = completions.filter((row) => {
        if (!row.submitted_at) return false;
        return new Date(row.submitted_at).getTime() >= new Date(since).getTime();
      });

      whileAway = {
        acknowledged_count: sinceCompletions.length,
        documents_affected: new Set(sinceCompletions.map((row) => row.document_id)).size,
        latest_at: sinceCompletions[0]?.submitted_at ?? null,
      };
    }

    return NextResponse.json({
      greeting: {
        text: greetingForNow(),
        first_name: firstName(
          profile?.display_name ?? null,
          userData.user.email ?? null,
          userData.user.user_metadata
        ),
      },
      while_away: { ...whileAway, since },
      plan: profile?.plan ?? "free",
      primary_workspace_id: profile?.primary_workspace_id ?? null,
      ...dashboard,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

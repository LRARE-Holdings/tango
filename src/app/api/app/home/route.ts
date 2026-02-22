import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
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

    const activityRes = await supabase
      .from("document_user_activity")
      .select("document_id,last_opened_at,last_action")
      .eq("user_id", userId)
      .is("workspace_id", null)
      .order("last_opened_at", { ascending: false })
      .limit(8);
    const recentIds = (activityRes.error ? [] : activityRes.data ?? []).map((x) => String((x as { document_id: string }).document_id));

    let recentFiles: Array<{ id: string; title: string; public_id: string; at: string; source: "opened" | "created" }> = [];
    if (recentIds.length > 0) {
      const docsRes = await supabase
        .from("documents")
        .select("id,title,public_id,created_at")
        .eq("owner_id", userId)
        .in("id", recentIds);
      if (docsRes.error) return NextResponse.json({ error: docsRes.error.message }, { status: 500 });
      const byId = new Map((docsRes.data ?? []).map((d) => [String((d as { id: string }).id), d]));
      recentFiles = (activityRes.data ?? [])
        .map((row) => {
          const id = String((row as { document_id: string }).document_id);
          const doc = byId.get(id);
          if (!doc) return null;
          return {
            id,
            title: String((doc as { title?: string }).title ?? "Untitled"),
            public_id: String((doc as { public_id?: string }).public_id ?? ""),
            at: String((row as { last_opened_at?: string }).last_opened_at ?? (doc as { created_at?: string }).created_at ?? ""),
            source: "opened" as const,
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
    }

    if (recentFiles.length === 0) {
      const fallback = await supabase
        .from("documents")
        .select("id,title,public_id,created_at")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
      recentFiles = (fallback.data ?? []).map((doc) => ({
        id: String((doc as { id: string }).id),
        title: String((doc as { title?: string }).title ?? "Untitled"),
        public_id: String((doc as { public_id?: string }).public_id ?? ""),
        at: String((doc as { created_at?: string }).created_at ?? ""),
        source: "created" as const,
      }));
    }

    let whileAway = { acknowledged_count: 0, documents_affected: 0, latest_at: null as string | null };
    if (since) {
      const docsRes = await supabase.from("documents").select("id").eq("owner_id", userId).limit(800);
      if (docsRes.error) return NextResponse.json({ error: docsRes.error.message }, { status: 500 });
      const docIds = (docsRes.data ?? []).map((d) => String((d as { id: string }).id));
      if (docIds.length > 0) {
        const compsRes = await admin
          .from("completions")
          .select("document_id,submitted_at,acknowledged")
          .in("document_id", docIds)
          .eq("acknowledged", true)
          .gte("submitted_at", since)
          .order("submitted_at", { ascending: false })
          .limit(500);
        if (compsRes.error) return NextResponse.json({ error: compsRes.error.message }, { status: 500 });
        const comps = compsRes.data ?? [];
        whileAway = {
          acknowledged_count: comps.length,
          documents_affected: new Set(comps.map((c) => String((c as { document_id: string }).document_id))).size,
          latest_at:
            String(((comps[0] as { submitted_at?: string | null } | undefined)?.submitted_at ?? "") || "") || null,
        };
      }
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
      recent_files: recentFiles,
      while_away: { ...whileAway, since },
      plan: profile?.plan ?? "free",
      primary_workspace_id: profile?.primary_workspace_id ?? null,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

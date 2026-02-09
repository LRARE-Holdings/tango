import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";

type DocRow = {
  id: string;
  title: string;
  public_id: string;
  created_at: string;
};

type CompletionRow = {
  document_id: string;
  acknowledged: boolean | null;
  submitted_at: string | null;
};

function normalizeQuery(v: string | null) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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

    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message);
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = userData.user.id;

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);

    const plan = String(profile?.plan ?? "free").toLowerCase();
    if (plan !== "team" && plan !== "enterprise") {
      return NextResponse.json({ error: "Workspace documents are available on Team plans." }, { status: 403 });
    }

    const { data: member, error: memberErr } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", resolved.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (memberErr) throw new Error(memberErr.message);
    if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: workspace, error: wsErr } = await supabase
      .from("workspaces")
      .select("id,name,slug")
      .eq("id", resolved.id)
      .maybeSingle();
    if (wsErr) throw new Error(wsErr.message);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const q = normalizeQuery(new URL(req.url).searchParams.get("q"));

    const { data: docs, error: docsErr } = await supabase
      .from("documents")
      .select("id,title,public_id,created_at")
      .eq("workspace_id", resolved.id)
      .order("created_at", { ascending: false })
      .limit(250);
    if (docsErr) throw new Error(docsErr.message);

    let documents = (docs ?? []) as DocRow[];
    if (q) {
      documents = documents.filter((d) => {
        const hay = `${d.title ?? ""} ${d.public_id ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (documents.length === 0) {
      return NextResponse.json({
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: (workspace as { slug?: string | null }).slug ?? null,
        },
        documents: [],
      });
    }

    const ids = documents.map((d) => d.id);
    const { data: completions, error: compErr } = await admin
      .from("completions")
      .select("document_id,acknowledged,submitted_at")
      .in("document_id", ids)
      .order("submitted_at", { ascending: false });
    if (compErr) throw new Error(compErr.message);

    const completionRows = (completions ?? []) as CompletionRow[];
    const agg = new Map<string, { acknowledgements: number; latestSubmittedAt: string | null }>();

    for (const c of completionRows) {
      const current = agg.get(c.document_id) ?? { acknowledgements: 0, latestSubmittedAt: null };
      if (c.acknowledged) current.acknowledgements += 1;
      if (!current.latestSubmittedAt && c.submitted_at) current.latestSubmittedAt = c.submitted_at;
      agg.set(c.document_id, current);
    }

    const out = documents.map((d) => {
      const a = agg.get(d.id);
      const acknowledgements = a?.acknowledgements ?? 0;
      return {
        id: d.id,
        title: d.title,
        publicId: d.public_id,
        createdAt: d.created_at,
        acknowledgements,
        latestAcknowledgedAt: a?.latestSubmittedAt ?? null,
        status: acknowledgements > 0 ? ("Acknowledged" as const) : ("Pending" as const),
      };
    });

    return NextResponse.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: (workspace as { slug?: string | null }).slug ?? null,
      },
      documents: out,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}


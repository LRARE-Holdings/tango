import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import crypto from "crypto";

const MAX_MB = 20;

function errMessage(e: unknown) {
  return e instanceof Error ? e.message : "Server error";
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const titleRaw = form.get("title");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDFs only" }, { status: 400 });
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      return NextResponse.json({ error: `Max file size is ${MAX_MB}MB` }, { status: 400 });
    }

    const title = typeof titleRaw === "string" && titleRaw.trim().length
      ? titleRaw.trim()
      : "Untitled";

    const supabase = await supabaseServer();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }
    if (!userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const owner_id = userData.user.id;
    let workspace_id: string | null = null;

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("plan,primary_workspace_id")
      .eq("id", owner_id)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    const plan = String(profile?.plan ?? "free").toLowerCase();
    const activeWorkspaceId = (profile?.primary_workspace_id as string | null) ?? null;
    const isWorkspacePlan = plan === "team" || plan === "enterprise";

    if (activeWorkspaceId) {
      const { data: membership, error: membershipErr } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", activeWorkspaceId)
        .eq("user_id", owner_id)
        .maybeSingle();

      if (membershipErr) {
        return NextResponse.json({ error: membershipErr.message }, { status: 500 });
      }
      if (!membership) {
        return NextResponse.json({ error: "Active workspace is invalid for this user." }, { status: 403 });
      }
      workspace_id = activeWorkspaceId;
    } else if (isWorkspacePlan) {
      const { count: membershipCount, error: countErr } = await supabase
        .from("workspace_members")
        .select("workspace_id", { count: "exact", head: true })
        .eq("user_id", owner_id);

      if (countErr) {
        return NextResponse.json({ error: countErr.message }, { status: 500 });
      }

      if ((membershipCount ?? 0) > 0) {
        return NextResponse.json(
          {
            error:
              "Select an active workspace before creating receipts. Team/Enterprise receipts must belong to a workspace.",
          },
          { status: 409 }
        );
      }
    }

    const public_id = nanoid(10);

    // 1) Create the doc row (file_path temp)
    const { data: doc, error: insertErr } = await supabase
      .from("documents")
      .insert({
        owner_id,
        workspace_id,
        public_id,
        title,
        file_path: "pending",
      })
      .select("id, public_id")
      .single();

    if (insertErr || !doc) {
      return NextResponse.json({ error: insertErr?.message ?? "Insert failed" }, { status: 500 });
    }

    // 2) Upload PDF to Storage
    const arrayBuffer = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);

    // Compute document integrity hash (hex)
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

    // Path convention: keep it simple for now.
    // Later: consider docs/{userId}/{docId}.pdf and enforce Storage RLS.
    const file_path = `public/${doc.id}.pdf`;

    const { error: uploadErr } = await admin.storage
      .from("docs")
      .upload(file_path, buf, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    // 3) Update doc with real file_path
    const { error: updErr } = await supabase
      .from("documents")
      .update({ file_path, sha256 })
      .eq("id", doc.id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      id: doc.id,
      public_id: doc.public_id,
      share_url: `/d/${doc.public_id}`,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMessage(e) }, { status: 500 });
  }
}

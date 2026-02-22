import type { supabaseAdmin } from "@/lib/supabase/admin";

export type ParsedRecipient = {
  name: string;
  email: string;
};

type QueryClient = Pick<ReturnType<typeof supabaseAdmin>, "from">;

type WorkspaceContactRow = {
  id: string;
  name: string;
  email: string;
};

type ContactGroupRow = {
  id: string;
};

type ContactGroupMemberRow = {
  group_id: string;
  contact_id: string;
};

type WorkspaceMemberRow = {
  user_id: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type AuthUserRow = {
  id: string;
  email: string | null;
};

function normalizeEmail(input: string) {
  return input.trim().toLowerCase();
}

function fallbackNameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  const clean = local.replace(/[._-]+/g, " ").trim();
  return clean || email;
}

function normalizeDisplayName(input: string | null | undefined) {
  return String(input ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
}

export function parseIdList(input: unknown, max = 100): string[] {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, max);
}

export type WorkspaceContactSource = "workspace_member" | "external";

export async function listWorkspaceMemberDirectory(
  admin: ReturnType<typeof supabaseAdmin>,
  workspaceId: string
): Promise<Array<{ user_id: string; email: string; display_name: string | null }>> {
  const membersRes = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);

  if (membersRes.error) throw new Error(membersRes.error.message);

  const memberRows = (membersRes.data ?? []) as WorkspaceMemberRow[];
  const userIds = Array.from(new Set(memberRows.map((row) => String(row.user_id)).filter(Boolean)));
  if (userIds.length === 0) return [];

  const profileRes = await admin
    .from("profiles")
    .select("id,display_name")
    .in("id", userIds);
  if (profileRes.error) throw new Error(profileRes.error.message);

  const displayNameByUserId = new Map<string, string | null>(
    ((profileRes.data ?? []) as ProfileRow[]).map((row) => [String(row.id), normalizeDisplayName(row.display_name) || null])
  );

  const memberEmails = new Map<string, string>();
  const authUsersRes = await admin
    .schema("auth")
    .from("users")
    .select("id,email")
    .in("id", userIds);

  if (!authUsersRes.error) {
    for (const row of (authUsersRes.data ?? []) as AuthUserRow[]) {
      const userId = String(row.id);
      const email = normalizeEmail(String(row.email ?? ""));
      if (!email) continue;
      memberEmails.set(userId, email);
    }
  } else {
    await Promise.all(
      userIds.map(async (userId) => {
        const userRes = await admin.auth.admin.getUserById(userId);
        if (userRes.error) return;
        const email = normalizeEmail(String(userRes.data.user?.email ?? ""));
        if (!email) return;
        memberEmails.set(userId, email);
      })
    );
  }

  return userIds
    .map((userId) => {
      const email = memberEmails.get(userId);
      if (!email) return null;
      return {
        user_id: userId,
        email,
        display_name: displayNameByUserId.get(userId) ?? null,
      };
    })
    .filter((row): row is { user_id: string; email: string; display_name: string | null } => Boolean(row));
}

export async function ensureWorkspaceMemberContacts(args: {
  admin: ReturnType<typeof supabaseAdmin>;
  workspaceId: string;
  actorUserId?: string | null;
}): Promise<{ inserted: number; memberEmails: Set<string> }> {
  const members = await listWorkspaceMemberDirectory(args.admin, args.workspaceId);
  const memberEmails = new Set<string>(members.map((member) => normalizeEmail(member.email)).filter(Boolean));
  const memberEmailList = Array.from(memberEmails);

  if (members.length === 0 || memberEmailList.length === 0) {
    return { inserted: 0, memberEmails };
  }

  const existingRes = await args.admin
    .from("workspace_contacts")
    .select("email")
    .eq("workspace_id", args.workspaceId)
    .in("email", memberEmailList);

  if (existingRes.error) throw new Error(existingRes.error.message);

  const existingEmails = new Set(
    ((existingRes.data ?? []) as Array<{ email: string | null }>)
      .map((row) => normalizeEmail(String(row.email ?? "")))
      .filter(Boolean)
  );

  let inserted = 0;
  for (const member of members) {
    const email = normalizeEmail(member.email);
    if (!email || existingEmails.has(email)) continue;

    const name = normalizeDisplayName(member.display_name) || fallbackNameFromEmail(email);
    const insertRes = await args.admin.from("workspace_contacts").insert({
      workspace_id: args.workspaceId,
      name,
      email,
      created_by: args.actorUserId ?? null,
    });

    if (insertRes.error) {
      if (insertRes.error.code === "23505") {
        existingEmails.add(email);
        continue;
      }
      throw new Error(insertRes.error.message);
    }

    existingEmails.add(email);
    inserted += 1;
  }

  return { inserted, memberEmails };
}

function addRecipient(map: Map<string, ParsedRecipient>, recipient: ParsedRecipient) {
  const email = normalizeEmail(recipient.email);
  if (!email) return;
  const name = recipient.name.trim() || fallbackNameFromEmail(email);
  map.set(email, {
    name: name.slice(0, 120),
    email,
  });
}

export type ResolveWorkspaceRecipientsArgs = {
  client: QueryClient;
  workspaceId: string;
  manualRecipients: ParsedRecipient[];
  contactIds: string[];
  contactGroupIds: string[];
  maxRecipients?: number;
};

export type ResolveWorkspaceRecipientsResult = {
  recipients: ParsedRecipient[];
  contactCount: number;
  groupCount: number;
  expandedGroupMemberCount: number;
};

export async function resolveWorkspaceRecipients(
  args: ResolveWorkspaceRecipientsArgs
): Promise<ResolveWorkspaceRecipientsResult> {
  const maxRecipients = Math.max(1, Math.min(Number(args.maxRecipients ?? 200), 500));
  const dedup = new Map<string, ParsedRecipient>();

  for (const recipient of args.manualRecipients) {
    addRecipient(dedup, recipient);
  }

  const contactIds = parseIdList(args.contactIds);
  const groupIds = parseIdList(args.contactGroupIds);

  let contactCount = 0;
  let expandedGroupMemberCount = 0;

  if (contactIds.length > 0) {
    const res = await args.client
      .from("workspace_contacts")
      .select("id,name,email")
      .eq("workspace_id", args.workspaceId)
      .in("id", contactIds);

    if (res.error) throw new Error(res.error.message);

    const rows = (res.data ?? []) as WorkspaceContactRow[];
    if (rows.length !== contactIds.length) {
      throw new Error("One or more selected contacts are unavailable.");
    }

    for (const row of rows) {
      addRecipient(dedup, { name: String(row.name ?? ""), email: String(row.email ?? "") });
    }

    contactCount = rows.length;
  }

  if (groupIds.length > 0) {
    const groupsRes = await args.client
      .from("contact_groups")
      .select("id")
      .eq("workspace_id", args.workspaceId)
      .in("id", groupIds);

    if (groupsRes.error) throw new Error(groupsRes.error.message);

    const groups = (groupsRes.data ?? []) as ContactGroupRow[];
    if (groups.length !== groupIds.length) {
      throw new Error("One or more selected contact groups are unavailable.");
    }

    const memberRes = await args.client
      .from("contact_group_members")
      .select("group_id,contact_id")
      .eq("workspace_id", args.workspaceId)
      .in("group_id", groupIds);

    if (memberRes.error) throw new Error(memberRes.error.message);

    const members = (memberRes.data ?? []) as ContactGroupMemberRow[];
    const groupContactIds = Array.from(new Set(members.map((member) => String(member.contact_id))));

    if (groupContactIds.length > 0) {
      const groupContactRes = await args.client
        .from("workspace_contacts")
        .select("id,name,email")
        .eq("workspace_id", args.workspaceId)
        .in("id", groupContactIds);

      if (groupContactRes.error) throw new Error(groupContactRes.error.message);

      const rows = (groupContactRes.data ?? []) as WorkspaceContactRow[];
      for (const row of rows) {
        addRecipient(dedup, { name: String(row.name ?? ""), email: String(row.email ?? "") });
      }

      expandedGroupMemberCount = rows.length;
    }
  }

  return {
    recipients: Array.from(dedup.values()).slice(0, maxRecipients),
    contactCount,
    groupCount: groupIds.length,
    expandedGroupMemberCount,
  };
}

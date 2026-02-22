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

function normalizeEmail(input: string) {
  return input.trim().toLowerCase();
}

function fallbackNameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  const clean = local.replace(/[._-]+/g, " ").trim();
  return clean || email;
}

export function parseIdList(input: unknown, max = 100): string[] {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, max);
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

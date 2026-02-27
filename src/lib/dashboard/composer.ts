import {
  OVERDUE_DAYS,
  type DashboardActivityItem,
  type DashboardCompletionInput,
  type DashboardDocumentInput,
  type DashboardOpenActivityInput,
  type DashboardPayloadBase,
  type DashboardQuickAction,
  type DashboardRecipientInput,
  type DashboardWorkspaceUsage,
} from "@/lib/dashboard/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function parseDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatRelativeTime(iso: string | null | undefined, now: Date) {
  const d = parseDate(iso);
  if (!d) return "—";
  const diffMs = Math.max(0, now.getTime() - d.getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

type ComposeDashboardArgs = {
  docs: DashboardDocumentInput[];
  recipients: DashboardRecipientInput[];
  completions: DashboardCompletionInput[];
  openActivity: DashboardOpenActivityInput[];
  workspaceUsage?: DashboardWorkspaceUsage | null;
  quickActions?: DashboardQuickAction[];
  now?: Date;
};

export function composeDashboardPayload({
  docs,
  recipients,
  completions,
  openActivity,
  workspaceUsage = null,
  quickActions = [],
  now = new Date(),
}: ComposeDashboardArgs): DashboardPayloadBase {
  const docsById = new Map(docs.map((doc) => [doc.id, doc]));

  const recipientsByDoc = new Map<string, DashboardRecipientInput[]>();
  for (const row of recipients) {
    const current = recipientsByDoc.get(row.document_id) ?? [];
    current.push(row);
    recipientsByDoc.set(row.document_id, current);
  }

  const ackRecipientIdsByDoc = new Map<string, Set<string>>();
  const ackCountByDoc = new Map<string, number>();
  const latestAckAtByDoc = new Map<string, string>();
  let completedThisWeek = 0;

  for (const completion of completions) {
    if (!completion.acknowledged) continue;
    const submittedDate = parseDate(completion.submitted_at);
    if (!submittedDate) continue;

    if (now.getTime() - submittedDate.getTime() <= WEEK_MS) {
      completedThisWeek += 1;
    }

    const existingLatest = latestAckAtByDoc.get(completion.document_id);
    if (!existingLatest || (parseDate(existingLatest)?.getTime() ?? 0) < submittedDate.getTime()) {
      latestAckAtByDoc.set(completion.document_id, submittedDate.toISOString());
    }

    if (completion.recipient_id) {
      const ids = ackRecipientIdsByDoc.get(completion.document_id) ?? new Set<string>();
      ids.add(completion.recipient_id);
      ackRecipientIdsByDoc.set(completion.document_id, ids);
      ackCountByDoc.set(completion.document_id, ids.size);
      continue;
    }

    ackCountByDoc.set(completion.document_id, (ackCountByDoc.get(completion.document_id) ?? 0) + 1);
  }

  const openedAtByDoc = new Map<string, string>();
  for (const row of openActivity) {
    const openedAt = row.last_opened_at;
    if (!openedAt) continue;
    const existing = openedAtByDoc.get(row.document_id);
    if (!existing || (parseDate(existing)?.getTime() ?? 0) < (parseDate(openedAt)?.getTime() ?? 0)) {
      openedAtByDoc.set(row.document_id, openedAt);
    }
  }

  const rankedDocs = docs
    .map((doc) => {
      const recipientCount = recipientsByDoc.get(doc.id)?.length ?? 0;
      const ackCount = Math.min(recipientCount || Number.MAX_SAFE_INTEGER, ackCountByDoc.get(doc.id) ?? 0);
      const pending = Math.max(0, recipientCount - ackCount);
      const createdAt = parseDate(doc.created_at);
      const ageMs = createdAt ? now.getTime() - createdAt.getTime() : 0;
      const overdue = recipientCount > 0 && pending > 0 && ageMs > OVERDUE_DAYS * DAY_MS;
      const isNew = recipientCount > 0 && ackCount === 0 && ageMs <= DAY_MS;
      const isClosing = recipientCount > 0 && pending > 0 && recipientCount > 0 && ackCount / recipientCount >= 0.75;

      let status: "attention" | "closing" | "new";
      if (overdue) status = "attention";
      else if (isClosing) status = "closing";
      else if (isNew) status = "new";
      else status = "attention";

      const fileStatus: "draft" | "sent" | "complete" =
        recipientCount === 0 ? "draft" : pending === 0 ? "complete" : "sent";

      const openedAt = openedAtByDoc.get(doc.id) ?? null;
      const ackAt = latestAckAtByDoc.get(doc.id) ?? null;
      const createdIso = parseDate(doc.created_at)?.toISOString() ?? null;
      const lastActivityAt = [openedAt, ackAt, createdIso]
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => (parseDate(b)?.getTime() ?? 0) - (parseDate(a)?.getTime() ?? 0))[0] ?? null;

      return {
        doc,
        recipientCount,
        ackCount,
        pending,
        overdue,
        status,
        fileStatus,
        lastActivityAt,
      };
    })
    .sort((a, b) => {
      const aTime = parseDate(a.lastActivityAt)?.getTime() ?? 0;
      const bTime = parseDate(b.lastActivityAt)?.getTime() ?? 0;
      return bTime - aTime;
    });

  const activeDocuments = rankedDocs.filter((row) => row.recipientCount > 0 && row.pending > 0);
  const overdueDocuments = activeDocuments.filter((row) => row.overdue);

  const stats = {
    active_documents: activeDocuments.length,
    pending_acknowledgements: activeDocuments.reduce((total, row) => total + row.pending, 0),
    overdue_documents: overdueDocuments.length,
    completed_this_week: completedThisWeek,
  };

  const attention = activeDocuments
    .slice(0, 6)
    .map((row) => ({
      id: row.doc.id,
      name: row.doc.title,
      recipients: row.recipientCount,
      acknowledged: row.ackCount,
      pending: row.pending,
      overdue: row.overdue ? row.pending : 0,
      last_activity_at: row.lastActivityAt,
      last_activity_label: formatRelativeTime(row.lastActivityAt, now),
      status: row.status,
    }));

  const recent_files = rankedDocs.slice(0, 8).map((row) => {
    const openedAt = openedAtByDoc.get(row.doc.id) ?? null;
    const fallbackAt = parseDate(row.doc.created_at)?.toISOString() ?? now.toISOString();
    return {
      id: row.doc.id,
      title: row.doc.title,
      public_id: row.doc.public_id,
      at: openedAt ?? fallbackAt,
      source: openedAt ? ("opened" as const) : ("created" as const),
      status: row.fileStatus,
      priority: String(row.doc.priority ?? "normal").toLowerCase(),
      labels: Array.isArray(row.doc.labels) ? row.doc.labels : [],
      recipients: row.recipientCount,
      acknowledged: row.ackCount,
    };
  });

  const completionByRecipient = new Map<string, DashboardRecipientInput>();
  for (const recipient of recipients) completionByRecipient.set(recipient.id, recipient);

  const ackActivity: DashboardActivityItem[] = completions
    .filter((row) => row.acknowledged && row.submitted_at)
    .sort((a, b) => (parseDate(b.submitted_at)?.getTime() ?? 0) - (parseDate(a.submitted_at)?.getTime() ?? 0))
    .slice(0, 16)
    .map((row) => {
      const recipient = row.recipient_id ? completionByRecipient.get(row.recipient_id) : null;
      const doc = docsById.get(row.document_id);
      const actor = String(recipient?.name ?? recipient?.email ?? "Recipient").trim() || "Recipient";
      const at = parseDate(row.submitted_at)?.toISOString() ?? now.toISOString();
      return {
        id: `ack:${row.id}`,
        type: "ack" as const,
        event: `${actor} acknowledged`,
        doc: doc?.title ?? "Document",
        at,
        time: formatRelativeTime(at, now),
      };
    });

  const openedActivity = openActivity
    .filter((row) => row.last_opened_at)
    .sort((a, b) => (parseDate(b.last_opened_at)?.getTime() ?? 0) - (parseDate(a.last_opened_at)?.getTime() ?? 0))
    .slice(0, 10)
    .map((row) => {
      const doc = docsById.get(row.document_id);
      const at = parseDate(row.last_opened_at)?.toISOString() ?? now.toISOString();
      return {
        id: `open:${row.document_id}:${at}`,
        type: "open" as const,
        event: "Opened",
        doc: doc?.title ?? "Document",
        at,
        time: formatRelativeTime(at, now),
      };
    });

  const sentActivity = docs
    .slice()
    .sort((a, b) => (parseDate(b.created_at)?.getTime() ?? 0) - (parseDate(a.created_at)?.getTime() ?? 0))
    .slice(0, 8)
    .map((doc) => ({
      id: `sent:${doc.id}`,
      type: "sent" as const,
      event: "Receipt sent",
      doc: doc.title,
      at: parseDate(doc.created_at)?.toISOString() ?? now.toISOString(),
      time: formatRelativeTime(doc.created_at, now),
    }));

  const activity = [...ackActivity, ...openedActivity, ...sentActivity]
    .sort((a, b) => (parseDate(b.at)?.getTime() ?? 0) - (parseDate(a.at)?.getTime() ?? 0))
    .slice(0, 20);

  const normalizedUsage = workspaceUsage
    ? {
        ...workspaceUsage,
        utilization_percent:
          workspaceUsage.documents_limit && workspaceUsage.documents_limit > 0
            ? clampPercent((workspaceUsage.documents_used / workspaceUsage.documents_limit) * 100)
            : workspaceUsage.utilization_percent,
      }
    : null;

  return {
    stats,
    attention,
    activity,
    quick_actions: quickActions,
    workspace_usage: normalizedUsage,
    recent_files,
  };
}

export const OVERDUE_DAYS = 7;

export type DashboardFileStatus = "draft" | "sent" | "complete";
export type DashboardAttentionStatus = "attention" | "closing" | "new";
export type DashboardActivityType = "ack" | "open" | "sent";

export type DashboardStats = {
  active_documents: number;
  pending_acknowledgements: number;
  overdue_documents: number;
  completed_this_week: number;
};

export type DashboardAttentionItem = {
  id: string;
  name: string;
  recipients: number;
  acknowledged: number;
  pending: number;
  overdue: number;
  last_activity_at: string | null;
  last_activity_label: string;
  status: DashboardAttentionStatus;
};

export type DashboardActivityItem = {
  id: string;
  type: DashboardActivityType;
  event: string;
  doc: string;
  at: string;
  time: string;
};

export type DashboardQuickAction = {
  id: string;
  label: string;
  href: string;
  primary?: boolean;
};

export type DashboardWorkspaceUsage = {
  documents_used: number;
  documents_limit: number | null;
  utilization_percent: number | null;
  members: number | null;
  plan: string | null;
};

export type DashboardRecentFile = {
  id: string;
  title: string;
  public_id: string;
  at: string;
  source: "opened" | "created";
  status: DashboardFileStatus;
  priority?: string;
  labels?: string[];
  recipients: number;
  acknowledged: number;
};

export type DashboardPayloadBase = {
  stats: DashboardStats;
  attention: DashboardAttentionItem[];
  activity: DashboardActivityItem[];
  quick_actions: DashboardQuickAction[];
  workspace_usage: DashboardWorkspaceUsage | null;
  recent_files: DashboardRecentFile[];
};

export type DashboardDocumentInput = {
  id: string;
  title: string;
  public_id: string;
  created_at: string;
  priority?: string | null;
  labels?: string[] | null;
};

export type DashboardRecipientInput = {
  id: string;
  document_id: string;
  name: string | null;
  email: string | null;
};

export type DashboardCompletionInput = {
  id: string;
  document_id: string;
  recipient_id: string | null;
  acknowledged: boolean;
  submitted_at: string | null;
};

export type DashboardOpenActivityInput = {
  document_id: string;
  last_opened_at: string | null;
  last_action?: string | null;
};

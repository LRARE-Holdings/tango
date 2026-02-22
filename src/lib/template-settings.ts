export type TemplatePriority = "low" | "normal" | "high";

export type ReceiptTemplateSettings = {
  priority?: TemplatePriority;
  labels?: string[];
  tags?: Record<string, string>;
  send_emails?: boolean;
  require_recipient_identity?: boolean;
  password_enabled?: boolean;
  max_acknowledgers_enabled?: boolean;
  max_acknowledgers?: number | null;
};

function normalizeTagKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toBoolean(input: unknown): boolean | undefined {
  if (typeof input === "boolean") return input;
  return undefined;
}

function toPriority(input: unknown): TemplatePriority | undefined {
  const value = String(input ?? "").trim().toLowerCase();
  if (value === "low" || value === "normal" || value === "high") return value;
  return undefined;
}

function toLabels(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const values = input
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .map((value) => value.slice(0, 48));
  if (values.length === 0) return [];
  return Array.from(new Set(values)).slice(0, 20);
}

function toTags(input: unknown): Record<string, string> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const normalizedKey = normalizeTagKey(key);
    if (!normalizedKey) continue;
    const normalizedValue = String(value ?? "").trim();
    if (!normalizedValue) continue;
    out[normalizedKey] = normalizedValue.slice(0, 120);
  }
  return out;
}

function toMaxAcknowledgers(input: unknown): number | null | undefined {
  if (input == null) return null;
  const value = Number(input);
  if (!Number.isFinite(value)) return undefined;
  return Math.max(1, Math.min(1000, Math.floor(value)));
}

export function normalizeTemplateSettings(input: unknown): ReceiptTemplateSettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};

  const source = input as Record<string, unknown>;
  const output: ReceiptTemplateSettings = {};

  const priority = toPriority(source.priority);
  if (priority) output.priority = priority;

  const labels = toLabels(source.labels);
  if (labels) output.labels = labels;

  const tags = toTags(source.tags);
  if (tags) output.tags = tags;

  const sendEmails = toBoolean(source.send_emails);
  if (sendEmails !== undefined) output.send_emails = sendEmails;

  const requireIdentity = toBoolean(source.require_recipient_identity);
  if (requireIdentity !== undefined) output.require_recipient_identity = requireIdentity;

  const passwordEnabled = toBoolean(source.password_enabled);
  if (passwordEnabled !== undefined) output.password_enabled = passwordEnabled;

  const maxAckEnabled = toBoolean(source.max_acknowledgers_enabled);
  if (maxAckEnabled !== undefined) output.max_acknowledgers_enabled = maxAckEnabled;

  const maxAck = toMaxAcknowledgers(source.max_acknowledgers);
  if (maxAck !== undefined) output.max_acknowledgers = maxAck;

  return output;
}

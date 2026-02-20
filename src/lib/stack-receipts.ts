export type StackReceiptSummary = {
  stack_title: string;
  recipient_name: string | null;
  recipient_email: string;
  total_documents: number;
  required_documents: number;
  acknowledged_documents: number;
  completed_at: string | null;
};

export type StackReceiptDocument = {
  document_id: string;
  document_title: string;
  document_public_id: string;
  required: boolean;
  acknowledged: boolean;
  acknowledged_at: string | null;
  method: string | null;
  acknowledgement_data: Record<string, unknown>;
};

export type StackReceiptEvidence = {
  stack_public_id: string;
  delivery_id: string;
  generated_at: string | null;
  documents: StackReceiptDocument[];
};

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

function asString(input: unknown, fallback = "") {
  const value = String(input ?? "").trim();
  return value || fallback;
}

function asNullableString(input: unknown) {
  const value = String(input ?? "").trim();
  return value || null;
}

function asInt(input: unknown, fallback = 0) {
  const value = Number(input);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

export function parseStackReceiptSummary(input: unknown): StackReceiptSummary {
  const summary = asRecord(input);
  return {
    stack_title: asString(summary.stack_title, "Stack delivery"),
    recipient_name: asNullableString(summary.recipient_name),
    recipient_email: asString(summary.recipient_email),
    total_documents: asInt(summary.total_documents),
    required_documents: asInt(summary.required_documents),
    acknowledged_documents: asInt(summary.acknowledged_documents),
    completed_at: asNullableString(summary.completed_at),
  };
}

export function parseStackReceiptEvidence(input: unknown): StackReceiptEvidence {
  const evidence = asRecord(input);
  const documentsRaw = Array.isArray(evidence.documents) ? evidence.documents : [];
  const documents = documentsRaw.map((item) => {
    const doc = asRecord(item);
    return {
      document_id: asString(doc.document_id),
      document_title: asString(doc.document_title, "Untitled"),
      document_public_id: asString(doc.document_public_id),
      required: doc.required !== false,
      acknowledged: doc.acknowledged === true,
      acknowledged_at: asNullableString(doc.acknowledged_at),
      method: asNullableString(doc.method),
      acknowledgement_data: asRecord(doc.acknowledgement_data),
    };
  });
  return {
    stack_public_id: asString(evidence.stack_public_id),
    delivery_id: asString(evidence.delivery_id),
    generated_at: asNullableString(evidence.generated_at),
    documents,
  };
}

export function safeFilename(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppHero, AppPage, AppPanel } from "@/components/app/page-layout";

type StackSummary = {
  id: string;
  name: string;
  description?: string | null;
  item_count: number;
};

type ReceiptRow = {
  id: string;
  stack_id: string;
  delivery_id: string;
  completed_at: string;
  stack_title: string;
  recipient_name: string | null;
  recipient_email: string;
  total_documents: number;
  acknowledged_documents: number;
};

type ReceiptDetail = {
  receipt: {
    id: string;
    stack_id: string | null;
    delivery_id: string;
    completed_at: string | null;
  };
  summary: {
    stack_title: string;
    recipient_name: string | null;
    recipient_email: string;
    total_documents: number;
    acknowledged_documents: number;
    completed_at: string | null;
  };
  evidence: {
    documents: Array<{
      document_id: string;
      document_title: string;
      document_public_id: string;
      acknowledged: boolean;
      acknowledged_at: string | null;
      method: string | null;
      acknowledgement_data: Record<string, unknown>;
    }>;
  };
};

function formatUtc(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toUTCString();
}

function formatDuration(seconds: unknown) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return "—";
  const s = Math.floor(value);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

export default function WorkspaceStacksPage() {
  const params = useParams<{ id?: string }>();
  const workspaceIdentifier = typeof params?.id === "string" ? params.id.trim() : "";

  const [stacks, setStacks] = useState<StackSummary[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string>("");
  const [detail, setDetail] = useState<ReceiptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const selectedReceipt = useMemo(() => receipts.find((row) => row.id === selectedReceiptId) ?? null, [receipts, selectedReceiptId]);

  async function loadBase() {
    if (!workspaceIdentifier) return;
    setLoading(true);
    setError(null);
    try {
      const [stacksRes, receiptsRes] = await Promise.all([
        fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/stacks`, { cache: "no-store" }),
        fetch(
          `/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/stacks/receipts?from=${encodeURIComponent(
            `${fromDate}T00:00:00.000Z`
          )}&to=${encodeURIComponent(`${toDate}T23:59:59.999Z`)}&q=${encodeURIComponent(q)}`,
          { cache: "no-store" }
        ),
      ]);
      const stacksJson = await stacksRes.json().catch(() => null);
      const receiptsJson = await receiptsRes.json().catch(() => null);
      if (!stacksRes.ok) throw new Error(stacksJson?.error ?? "Failed to load stacks.");
      if (!receiptsRes.ok) throw new Error(receiptsJson?.error ?? "Failed to load receipts.");
      setStacks(((stacksJson?.stacks ?? []) as StackSummary[]).map((stack) => ({ ...stack, id: String(stack.id) })));
      setReceipts(((receiptsJson?.receipts ?? []) as ReceiptRow[]).map((row) => ({ ...row, id: String(row.id) })));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load stacks.");
      setStacks([]);
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceIdentifier]);

  async function runFilters() {
    await loadBase();
  }

  useEffect(() => {
    if (!selectedReceiptId || !workspaceIdentifier) {
      setDetail(null);
      return;
    }
    let active = true;
    async function loadDetail() {
      setDetailLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/stacks/receipts/${encodeURIComponent(selectedReceiptId)}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load receipt detail.");
        if (!active) return;
        setDetail(json as ReceiptDetail);
      } catch (e: unknown) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load receipt detail.");
        setDetail(null);
      } finally {
        if (active) setDetailLoading(false);
      }
    }
    void loadDetail();
    return () => {
      active = false;
    };
  }, [selectedReceiptId, workspaceIdentifier]);

  return (
    <AppPage>
      <AppHero
        kicker="STACKS"
        title="Stacks"
        description="Send stacks quickly and retrieve compiled acknowledgement evidence."
        actions={
          <button type="button" onClick={() => void runFilters()} className="focus-ring app-btn-secondary">
            Refresh
          </button>
        }
      />

      {error ? <div className="app-error">{error}</div> : null}
      {loading ? <div className="app-subtle text-sm">Loading…</div> : null}

      {!loading ? (
        <>
          <AppPanel title="Stack management">
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {stacks.map((stack) => (
                <div key={stack.id} className="app-card p-3">
                  <div className="text-sm font-semibold">{stack.name}</div>
                  <div className="app-subtle-2 mt-1 text-xs">
                    {stack.item_count} documents
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/app/new?mode=full_stack&stackId=${encodeURIComponent(stack.id)}`}
                      className="focus-ring app-btn-chip"
                    >
                      Send stack
                    </Link>
                    <Link
                      href={`/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/documents`}
                      className="focus-ring app-btn-chip"
                    >
                      Manage in Files
                    </Link>
                  </div>
                </div>
              ))}
              {stacks.length === 0 ? (
                <div className="app-empty">
                  No stacks yet. Create one from Files.
                </div>
              ) : null}
            </div>
          </AppPanel>

          <AppPanel title="Stack acknowledgements">
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search stack title, email, receipt id"
                className="app-input"
              />
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="app-input"
              />
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="app-input"
              />
            </div>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => void runFilters()}
                className="focus-ring app-btn-chip"
              >
                Apply filters
              </button>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                {receipts.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedReceiptId(row.id)}
                    className="focus-ring w-full rounded-xl border px-3 py-3 text-left"
                    style={{
                      borderColor: selectedReceiptId === row.id ? "var(--fg)" : "var(--border)",
                      background: selectedReceiptId === row.id ? "color-mix(in srgb, var(--card2) 70%, transparent)" : "transparent",
                    }}
                  >
                    <div className="text-sm font-semibold">{row.stack_title}</div>
                    <div className="app-subtle-2 mt-1 text-xs">
                      {row.recipient_email} · {formatUtc(row.completed_at)}
                    </div>
                    <div className="app-subtle mt-1 text-xs">
                      {row.acknowledged_documents}/{row.total_documents} acknowledged
                    </div>
                  </button>
                ))}
                {receipts.length === 0 ? (
                  <div className="app-empty">
                    No stack acknowledgement receipts found in this range.
                  </div>
                ) : null}
              </div>

              <div className="app-card p-3">
                {!selectedReceipt ? (
                  <div className="app-subtle text-sm">
                    Select a receipt to review document-level evidence and download the PDF.
                  </div>
                ) : null}
                {selectedReceipt && detailLoading ? (
                  <div className="app-subtle text-sm">Loading receipt details…</div>
                ) : null}
                {selectedReceipt && detail ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-semibold">{detail.summary.stack_title}</div>
                      <div className="app-subtle-2 mt-1 text-xs">
                        {detail.summary.recipient_name ? `${detail.summary.recipient_name} · ` : ""}
                        {detail.summary.recipient_email}
                      </div>
                      <div className="app-subtle-2 mt-1 text-xs">
                        Completed {formatUtc(detail.summary.completed_at ?? detail.receipt.completed_at)}
                      </div>
                    </div>

                    <a
                      href={`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/stacks/receipts/${encodeURIComponent(
                        detail.receipt.id
                      )}/evidence/pdf`}
                      className="focus-ring app-btn-chip"
                    >
                      Download stack evidence PDF
                    </a>

                    <div className="space-y-2">
                      {detail.evidence.documents.map((doc) => (
                        <div key={`${doc.document_id}-${doc.document_public_id}`} className="app-card-soft p-2.5">
                          <div className="text-sm font-medium">{doc.document_title}</div>
                          <div className="app-subtle-2 mt-1 text-xs">
                            {doc.document_public_id || "No public ID"} · {doc.acknowledged ? "Acknowledged" : "Not acknowledged"}
                          </div>
                          <div className="app-subtle mt-1 text-xs">
                            Method: {doc.method ?? "—"} · At: {formatUtc(doc.acknowledged_at)}
                          </div>
                          <div className="app-subtle mt-1 text-xs">
                            Scroll: {String(doc.acknowledgement_data.max_scroll_percent ?? "—")}%
                            {" · "}Active: {formatDuration(doc.acknowledgement_data.active_seconds)}
                            {" · "}Page: {formatDuration(doc.acknowledgement_data.time_on_page_seconds)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </AppPanel>
        </>
      ) : null}
    </AppPage>
  );
}

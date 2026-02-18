"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { SectionDisclosure, StatusDotLabel } from "@/components/ui/calm-core";
import { UiModal, UiPanel, UiSectionCaption } from "@/components/ui/system";

type Recipient = {
  id: string;
  name: string | null;
  email: string | null;
};

type Completion = {
  id: string;
  document_version_id?: string | null;
  acknowledged: boolean | null;
  max_scroll_percent: number | null;
  time_on_page_seconds: number | null;
  active_seconds: number | null;
  submitted_at: string | null;
  ip: string | null;
  user_agent: string | null;
  recipients?: Recipient | null;
};

type Doc = {
  id: string;
  title: string;
  publicId: string;
  createdAt: string;
  workspaceId?: string | null;
  tags?: Record<string, string>;
  workspaceTagFields?: Array<{ key: string; label: string; placeholder?: string }>;
  currentVersionId?: string | null;
  versionCount?: number;
  status: "Acknowledged" | "Pending";
  acknowledgements: number;
  latestAcknowledgedAt: string | null;
};

type VersionRow = {
  id: string;
  version_number: number;
  version_label?: string | null;
  source_type: string;
  created_at: string | null;
  file_path: string | null;
  sha256: string | null;
};

type NotifyRecipient = {
  email: string;
  selected: boolean;
};

type DocMenuTab = "summary" | "completions" | "sharing" | "versions" | "exports" | "settings";

type ResponsibilityMember = {
  user_id: string;
  email: string | null;
  role: "owner" | "admin" | "member";
};

type ResponsibilityEntry = {
  user_id: string;
  email: string | null;
  role: "owner" | "admin" | "member";
  coverage_role: string;
  assigned_at: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim().toLowerCase());
}

function statusUi(status: Doc["status"]) {
  if (status === "Acknowledged") return { tone: "good" as const, label: "Acknowledged" };
  return { tone: "warn" as const, label: "Opened" };
}

export default function DocDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = use(params as any) as { id: string };
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [versionNumberInput, setVersionNumberInput] = useState("");
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionUploading, setVersionUploading] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyRecipients, setNotifyRecipients] = useState<NotifyRecipient[]>([]);
  const [notifyCustomEmails, setNotifyCustomEmails] = useState("");
  const [notifyVersionNumber, setNotifyVersionNumber] = useState<string>("");
  const [notifySending, setNotifySending] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);
  const [notifyPopupSuppressed, setNotifyPopupSuppressed] = useState(false);
  const [activeTab, setActiveTab] = useState<DocMenuTab>("summary");
  const [shareEmailsInput, setShareEmailsInput] = useState("");
  const [shareEmails, setShareEmails] = useState<string[]>([]);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSending, setShareSending] = useState(false);
  const [responsibilityMembers, setResponsibilityMembers] = useState<ResponsibilityMember[]>([]);
  const [responsibleUserIds, setResponsibleUserIds] = useState<string[]>([]);
  const [documentOwnerUserId, setDocumentOwnerUserId] = useState<string | null>(null);
  const [canManageResponsibilities, setCanManageResponsibilities] = useState(false);
  const [responsibilityLoading, setResponsibilityLoading] = useState(false);
  const [responsibilitySaving, setResponsibilitySaving] = useState(false);
  const [responsibilityError, setResponsibilityError] = useState<string | null>(null);
  const [tagValues, setTagValues] = useState<Record<string, string>>({});
  const [tagsSaving, setTagsSaving] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/app/documents/${id}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Failed to load document");
        setDoc(json.document);
        setTagValues((json?.document?.tags ?? {}) as Record<string, string>);
        setCompletions(json.completions ?? []);
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    async function loadVersions() {
      try {
        const res = await fetch(`/api/app/documents/${id}/versions`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load versions");
        setVersions((json?.versions ?? []) as VersionRow[]);
      } catch {
        setVersions([]);
      }
    }
    loadVersions();
  }, [id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const suppressed = window.localStorage.getItem(`receipt:version-notify:suppress:${id}`) === "1";
    setNotifyPopupSuppressed(suppressed);
  }, [id]);

  useEffect(() => {
    const fromCompletions = Array.from(
      new Set(
        completions
          .map((c) => String(c?.recipients?.email ?? "").trim().toLowerCase())
          .filter((x) => isEmail(x))
      )
    );
    if (typeof window === "undefined") {
      setShareEmails(fromCompletions);
      return;
    }
    const storedRaw = window.localStorage.getItem(`receipt:share-emails:${id}`);
    const storedList = storedRaw
      ? storedRaw
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .filter((x) => isEmail(x))
      : [];
    const merged = Array.from(new Set([...storedList, ...fromCompletions]));
    setShareEmails(merged);
  }, [id, completions]);

  useEffect(() => {
    if (activeTab !== "settings") return;
    let alive = true;
    async function loadResponsibilities() {
      setResponsibilityLoading(true);
      setResponsibilityError(null);
      try {
        const res = await fetch(`/api/app/documents/${id}/responsibilities`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load responsibilities.");
        if (!alive) return;
        setResponsibilityMembers((json?.members ?? []) as ResponsibilityMember[]);
        setResponsibleUserIds(
          ((json?.responsibilities ?? []) as ResponsibilityEntry[]).map((r) => String(r.user_id))
        );
        setDocumentOwnerUserId(typeof json?.owner_user_id === "string" ? json.owner_user_id : null);
        setCanManageResponsibilities(Boolean(json?.can_manage));
      } catch (e: unknown) {
        if (!alive) return;
        setResponsibilityError(e instanceof Error ? e.message : "Failed to load responsibilities.");
      } finally {
        if (alive) setResponsibilityLoading(false);
      }
    }
    void loadResponsibilities();
    return () => {
      alive = false;
    };
  }, [activeTab, id]);

  const shareUrl = useMemo(() => {
    if (!doc) return null;
    return `/d/${doc.publicId}`;
  }, [doc]);

  const suggestedNextVersion = useMemo(() => {
    const maxFromRows = versions.reduce((m, v) => Math.max(m, Number(v.version_number) || 0), 0);
    const maxKnown = Math.max(maxFromRows, Number(doc?.versionCount ?? 0));
    return Math.max(1, maxKnown + 1);
  }, [versions, doc?.versionCount]);

  const latestCompletion = useMemo(() => {
    return [...completions]
      .sort((a, b) => new Date(b.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime())[0] ?? null;
  }, [completions]);

  const firstOpenedAt = useMemo(() => {
    const times = completions
      .map((c) => c.submitted_at)
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return times[0] ?? null;
  }, [completions]);

  const timelineEvents = useMemo(() => {
    const events: Array<{ key: string; label: string; at: string | null }> = [];
    events.push({ key: "sent", label: "Sent", at: doc?.createdAt ?? null });
    if (firstOpenedAt) events.push({ key: "opened", label: "Opened", at: firstOpenedAt });
    if ((latestCompletion?.max_scroll_percent ?? 0) >= 50) {
      events.push({ key: "scroll50", label: "Reached 50% scroll", at: latestCompletion?.submitted_at ?? null });
    }
    if ((latestCompletion?.max_scroll_percent ?? 0) >= 100) {
      events.push({ key: "scroll100", label: "Reached 100% scroll", at: latestCompletion?.submitted_at ?? null });
    }
    if (latestCompletion?.acknowledged) {
      events.push({ key: "ack", label: "Acknowledged", at: latestCompletion?.submitted_at ?? null });
    }
    return events;
  }, [doc?.createdAt, firstOpenedAt, latestCompletion]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  async function copyLink() {
    if (!shareUrl) return;
    const abs = `${window.location.origin}${shareUrl}`;
    try {
      await navigator.clipboard.writeText(abs);
      toast.success("Copied", "Share link copied to clipboard.");

      setCopiedId("share");
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error("Copy failed", "Your browser blocked clipboard access.");
    }
  }

  async function downloadEvidence() {
    if (!doc) return;

    toast.info("Preparing JSON…");

    try {
      const res = await fetch(`/api/app/documents/${doc.id}/evidence`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Failed to download evidence");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-record-${doc.id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("Downloaded", "JSON evidence saved.");
    } catch (e: any) {
      toast.error("Download failed", e?.message ?? "Could not download JSON evidence");
    }
  }

  async function downloadPdfEvidence() {
    if (!doc) return;

    toast.info("Preparing PDF…");

    try {
      const res = await fetch(`/api/app/documents/${doc.id}/evidence/pdf`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Failed to download PDF");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-record-${doc.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("Downloaded", "PDF evidence pack saved.");
    } catch (e: any) {
      toast.error("Download failed", e?.message ?? "Could not download PDF evidence pack");
    }
  }

  async function uploadNewVersion() {
    setVersionError(null);
    if (!versionFile) {
      setVersionError("Choose a PDF or DOCX file.");
      return;
    }

    setVersionUploading(true);
    try {
      const form = new FormData();
      form.append("source_type", "upload");
      if (versionNumberInput.trim()) form.append("version_number", versionNumberInput.trim());
      if (versionFile) {
        form.append("file", versionFile);
      }

      const res = await fetch(`/api/app/documents/${id}/versions`, {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to create new version");

      const newVersionNumber = String(json?.version_label ?? json?.version_number ?? "");
      toast.success("Version created", `Document updated to v${newVersionNumber || "?"}.`);
      setShowVersionModal(false);
      setVersionNumberInput("");
      setVersionFile(null);

      const [docRes, versionsRes] = await Promise.all([
        fetch(`/api/app/documents/${id}`, { cache: "no-store" }),
        fetch(`/api/app/documents/${id}/versions`, { cache: "no-store" }),
      ]);
      const docJson = await docRes.json().catch(() => null);
      if (docRes.ok) {
        setDoc(docJson?.document ?? null);
        setCompletions(docJson?.completions ?? []);
      }
      const versionsJson = await versionsRes.json().catch(() => null);
      if (versionsRes.ok) {
        setVersions((versionsJson?.versions ?? []) as VersionRow[]);
      }

      const recipientsSource = (docJson?.completions ?? completions) as Completion[];
      const emails = Array.from(
        new Set(
          recipientsSource
            .map((c) => String(c?.recipients?.email ?? "").trim().toLowerCase())
            .filter((e) => e.length > 0)
        )
      );

      const suppressKey = `receipt:version-notify:suppress:${id}`;
      const suppressed = typeof window !== "undefined" && window.localStorage.getItem(suppressKey) === "1";
      if (!suppressed) {
        setNotifyRecipients(emails.map((email) => ({ email, selected: true })));
        setNotifyCustomEmails("");
        setNotifyVersionNumber(newVersionNumber || String(suggestedNextVersion));
        setNotifyError(null);
        setDoNotShowAgain(false);
        setShowNotifyModal(true);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to upload new version";
      setVersionError(msg);
      toast.error("Version failed", msg);
    } finally {
      setVersionUploading(false);
    }
  }

  function toggleNotifyRecipient(email: string) {
    setNotifyRecipients((list) =>
      list.map((r) => (r.email === email ? { ...r, selected: !r.selected } : r))
    );
  }

  function closeNotifyModal() {
    if (doNotShowAgain && typeof window !== "undefined") {
      window.localStorage.setItem(`receipt:version-notify:suppress:${id}`, "1");
      setNotifyPopupSuppressed(true);
    }
    setShowNotifyModal(false);
    setNotifyError(null);
    setNotifySending(false);
  }

  async function sendVersionNotifications() {
    setNotifyError(null);
    const picked = notifyRecipients.filter((r) => r.selected).map((r) => r.email);
    const extras = notifyCustomEmails
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    const emails = Array.from(new Set([...picked, ...extras]));
    if (emails.length === 0) {
      setNotifyError("Select at least one recipient or enter emails.");
      return;
    }

    setNotifySending(true);
    try {
      const res = await fetch(`/api/app/documents/${id}/versions/notify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emails, version_label: notifyVersionNumber }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to send notifications.");

      if (doNotShowAgain && typeof window !== "undefined") {
        window.localStorage.setItem(`receipt:version-notify:suppress:${id}`, "1");
        setNotifyPopupSuppressed(true);
      }

      const sent = Number(json?.sent ?? 0);
      const failed = Array.isArray(json?.failed) ? json.failed.length : 0;
      if (failed > 0) {
        toast.error("Partial send", `${sent} sent, ${failed} failed.`);
      } else {
        toast.success("Notifications sent", `${sent} recipient${sent === 1 ? "" : "s"} notified.`);
      }
      setShowNotifyModal(false);
    } catch (e: unknown) {
      setNotifyError(e instanceof Error ? e.message : "Failed to send notifications");
    } finally {
      setNotifySending(false);
    }
  }

  const currentVersionLabel =
    versions[0]?.version_label ??
    String(versions[0]?.version_number ?? Math.max(1, Number(doc?.versionCount ?? 1)));

  function toggleVersionNotifyPreference() {
    if (typeof window === "undefined") return;
    const key = `receipt:version-notify:suppress:${id}`;
    if (notifyPopupSuppressed) {
      window.localStorage.removeItem(key);
      setNotifyPopupSuppressed(false);
      toast.success("Updated", "Version notification popup re-enabled.");
      return;
    }
    window.localStorage.setItem(key, "1");
    setNotifyPopupSuppressed(true);
    toast.success("Updated", "Version notification popup disabled for this document.");
  }

  function addShareEmailsFromInput() {
    setShareError(null);
    const next = shareEmailsInput
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    if (next.length === 0) return;
    const invalid = next.filter((x) => !isEmail(x));
    if (invalid.length > 0) {
      setShareError("One or more emails are invalid.");
      return;
    }
    setShareEmailsInput("");
    setShareEmails((list) => {
      const merged = Array.from(new Set([...list, ...next]));
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`receipt:share-emails:${id}`, merged.join(","));
      }
      return merged;
    });
  }

  function removeShareEmail(email: string) {
    setShareEmails((list) => {
      const next = list.filter((x) => x !== email);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`receipt:share-emails:${id}`, next.join(","));
      }
      return next;
    });
  }

  async function sendShareEmails() {
    setShareError(null);
    if (shareEmails.length === 0) {
      setShareError("Add at least one email.");
      return;
    }
    setShareSending(true);
    try {
      const res = await fetch(`/api/app/documents/${id}/share`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emails: shareEmails }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to send share emails.");
      const sent = Number(json?.sent ?? 0);
      const failed = Array.isArray(json?.failed) ? json.failed.length : 0;
      if (failed > 0) {
        toast.error("Partial send", `${sent} sent, ${failed} failed.`);
      } else {
        toast.success("Emails sent", `${sent} recipient${sent === 1 ? "" : "s"} notified.`);
      }
    } catch (e: unknown) {
      setShareError(e instanceof Error ? e.message : "Failed to send share emails.");
    } finally {
      setShareSending(false);
    }
  }

  function toggleResponsibleUser(userId: string) {
    setResponsibleUserIds((list) =>
      list.includes(userId) ? list.filter((x) => x !== userId) : [...list, userId]
    );
  }

  async function saveDocumentTags() {
    if (!doc) return;
    setTagsSaving(true);
    setTagsError(null);
    try {
      const res = await fetch(`/api/app/documents/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tags: tagValues }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to save document tags.");
      setDoc((prev) => (prev ? { ...prev, tags: (json?.tags ?? {}) as Record<string, string> } : prev));
      toast.success("Saved", "Document tags updated.");
    } catch (e: unknown) {
      setTagsError(e instanceof Error ? e.message : "Failed to save document tags.");
    } finally {
      setTagsSaving(false);
    }
  }

  async function saveResponsibilities() {
    setResponsibilityError(null);
    setResponsibilitySaving(true);
    try {
      const res = await fetch(`/api/app/documents/${id}/responsibilities`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_ids: responsibleUserIds }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to save responsibilities.");
      toast.success("Saved", "Document responsibility updated.");
    } catch (e: unknown) {
      setResponsibilityError(e instanceof Error ? e.message : "Failed to save responsibilities.");
    } finally {
      setResponsibilitySaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div
        className="rounded-3xl border px-6 py-6 md:px-7 md:py-7"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              RECORD VIEW
            </div>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight md:text-3xl">
              {doc?.title ?? "Record"}
            </h1>
            {doc ? (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--muted)" }}>
                <StatusDotLabel {...statusUi(doc.status)} />
                <span>Version v{currentVersionLabel}</span>
                <span>Record ID {doc.publicId}</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/app"
              className="focus-ring rounded-full border px-5 py-2 text-sm hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              Back
            </Link>
            <button
              type="button"
              onClick={downloadPdfEvidence}
              disabled={!doc}
              className="focus-ring rounded-full border px-5 py-2 text-sm hover:opacity-80 disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              Export PDF record
            </button>
            <button
              type="button"
              onClick={() => setShowVersionModal(true)}
              disabled={!doc}
              className="focus-ring rounded-full px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--fg)", color: "var(--bg)" }}
            >
              New version
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          Loading…
        </div>
      )}

      {error && (
        <UiPanel className="rounded-3xl p-6 md:p-8">
          <div className="text-sm font-semibold">Couldn’t load document</div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {error}
          </div>
        </UiPanel>
      )}

      {!loading && !error && doc && (
        <div className="space-y-5">
          <div className="border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex min-w-0 gap-8 overflow-x-auto">
              {(
                [
                  ["summary", "Summary"],
                  ["completions", "Completions"],
                  ["sharing", "Sharing"],
                  ["versions", "Versions"],
                  ["exports", "Export"],
                  ["settings", "Settings"],
                ] as Array<[DocMenuTab, string]>
              ).map(([tab, label]) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className="focus-ring shrink-0 border-b-2 pb-3 text-xl hover:opacity-90"
                    style={{
                      borderColor: isActive ? "var(--fg)" : "transparent",
                      color: isActive ? "var(--fg)" : "var(--muted)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === "summary" && (
            <div className="space-y-4 pt-1">
              <div
                className="border p-4 md:p-5"
                style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}
              >
                <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                  TIMELINE
                </div>
                <div className="mt-3 space-y-3">
                  {timelineEvents.map((event) => (
                    <div key={event.key} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: "var(--muted2)" }}
                        />
                        <span>{event.label}</span>
                      </div>
                      <div className="text-xs" style={{ color: "var(--muted)" }}>
                        {formatDate(event.at)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <SectionDisclosure title="Delivery" summary="Delivery and open lifecycle" defaultOpen>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div style={{ color: "var(--muted2)" }}>Delivered at</div>
                    <div>{formatDate(doc.createdAt)}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted2)" }}>First opened at</div>
                    <div>{formatDate(firstOpenedAt)}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted2)" }}>status</div>
                    <div>{doc.status}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted2)" }}>acknowledgements</div>
                    <div>{doc.acknowledgements}</div>
                  </div>
                </div>
              </SectionDisclosure>

              <SectionDisclosure title="Engagement" summary="Reader interaction signals">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div style={{ color: "var(--muted2)" }}>Max scroll percent</div>
                    <div>
                      {latestCompletion?.max_scroll_percent == null ? "—" : `${latestCompletion.max_scroll_percent}%`}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted2)" }}>Time on page</div>
                    <div>{formatDuration(latestCompletion?.time_on_page_seconds ?? null)}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted2)" }}>Acknowledged</div>
                    <div>{latestCompletion?.acknowledged ? "Yes" : "No"}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted2)" }}>Submitted at</div>
                    <div>{formatDate(latestCompletion?.submitted_at ?? null)}</div>
                  </div>
                </div>
              </SectionDisclosure>

              <SectionDisclosure title="Technical" summary="Version and request metadata">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div style={{ color: "var(--muted2)" }}>IP address</div>
                    <div>{latestCompletion?.ip ?? "—"}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted2)" }}>User agent</div>
                    <div className="break-all">{latestCompletion?.user_agent ?? "—"}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted2)" }}>Document hash</div>
                    <div className="break-all">{versions[0]?.sha256 ?? "—"}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted2)" }}>version</div>
                    <div>v{currentVersionLabel}</div>
                  </div>
                </div>
              </SectionDisclosure>

              {doc.tags && Object.keys(doc.tags).length > 0 ? (
                <div className="text-sm" style={{ color: "var(--muted)" }}>
                  {Object.entries(doc.tags)
                    .map(([k, v]) => {
                      const label = doc.workspaceTagFields?.find((f) => f.key === k)?.label ?? k;
                      return `${label}: ${v}`;
                    })
                    .join(" • ")}
                </div>
              ) : null}
            </div>
          )}

          {activeTab === "sharing" && (
            <div className="space-y-4 pt-1">
              <div
                className="border p-4"
                style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                      SHARING
                    </div>
                    <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                      Manage recipients and send the public document link.
                    </div>
                  </div>
                  <div className="rounded-md border px-3 py-1 text-xs" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                    {shareEmails.length} recipient{shareEmails.length === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                  <input
                    value={shareEmailsInput}
                    onChange={(e) => setShareEmailsInput(e.target.value)}
                    placeholder="name@company.com, team@company.com"
                    className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
                    style={{ borderColor: "var(--border)", borderRadius: 10 }}
                  />
                  <button
                    type="button"
                    onClick={addShareEmailsFromInput}
                    className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                  >
                    Add recipients
                  </button>
                </div>

                <div
                  className="mt-3 border p-3"
                  style={{ borderColor: "var(--border2)", borderRadius: 10, background: "var(--card2)" }}
                >
                  {shareEmails.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {shareEmails.map((email) => (
                        <button
                          key={email}
                          type="button"
                          onClick={() => removeShareEmail(email)}
                          className="focus-ring rounded-md border px-3 py-1 text-xs hover:opacity-80"
                          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                          title="Remove email"
                        >
                          {email} ×
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs" style={{ color: "var(--muted2)" }}>
                      No recipient emails configured yet.
                    </div>
                  )}
                </div>

                {shareError ? (
                  <div className="mt-3 text-sm" style={{ color: "#ff3b30" }}>
                    {shareError}
                  </div>
                ) : null}
              </div>

              <div
                className="border p-4"
                style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}
              >
                <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                  PUBLIC LINK
                </div>
                <div
                  className="mt-2 break-all rounded-lg border px-3 py-2 text-xs"
                  style={{ borderColor: "var(--border2)", color: "var(--muted)" }}
                >
                  {shareUrl}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={shareUrl!}
                    className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                  >
                    Open link
                  </Link>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                  >
                    {copiedId === "share" ? "Copied link" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendShareEmails()}
                    disabled={shareSending}
                    className="focus-ring rounded-full px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                    style={{ background: "var(--fg)", color: "var(--bg)" }}
                  >
                    {shareSending ? "Sending…" : "Send email"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "versions" && (
            <div className="space-y-3 pt-1">
              <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                VERSIONS
              </div>
              <div className="mt-2 text-sm font-medium">Current v{currentVersionLabel}</div>
              <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                {doc.versionCount ?? Math.max(1, versions.length)} total versions
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowVersionModal(true)}
                  className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                >
                  Add new version
                </button>
                <Link
                  href={`/app/docs/${id}/versions`}
                  className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                >
                  Open version history
                </Link>
              </div>

              <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                  VERSION HISTORY
                </div>
                {versions.length === 0 ? (
                  <div className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
                    No version history yet.
                  </div>
                ) : (
                  <div className="mt-3 divide-y" style={{ borderColor: "var(--border)" }}>
                    {versions.map((v) => {
                      const label = v.version_label ?? String(v.version_number);
                      const isCurrent = doc.currentVersionId && v.id === doc.currentVersionId;
                      return (
                        <div
                          key={v.id}
                          className="grid grid-cols-1 gap-2 py-3 text-sm md:grid-cols-[160px_1fr_140px]"
                        >
                          <div className="font-medium">
                            v{label}
                            {isCurrent ? (
                              <span
                                className="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]"
                                style={{ borderColor: "var(--border)", color: "var(--muted2)" }}
                              >
                                CURRENT
                              </span>
                            ) : null}
                          </div>
                          <div style={{ color: "var(--muted)" }}>
                            {formatDate(v.created_at)}
                          </div>
                          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted2)" }}>
                            {v.source_type}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "exports" && (
            <div className="space-y-3 pt-1">
              <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                EXPORT OPTIONS
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={downloadPdfEvidence}
                  className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                >
                  Download PDF evidence
                </button>
                <button
                  type="button"
                  onClick={downloadEvidence}
                  className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                >
                  Download JSON evidence
                </button>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-3 pt-1">
              <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                DOCUMENT SETTINGS
              </div>
              <div className="mt-3 text-sm">
                <span style={{ color: "var(--muted2)" }}>Version notification popup:</span>{" "}
                <span style={{ color: "var(--muted)" }}>{notifyPopupSuppressed ? "Disabled" : "Enabled"}</span>
              </div>
              <button
                type="button"
                onClick={toggleVersionNotifyPreference}
                className="focus-ring mt-3 rounded-full border px-4 py-2 text-sm hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                {notifyPopupSuppressed ? "Enable popup" : "Disable popup"}
              </button>

              <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                  DOCUMENT RESPONSIBILITY
                </div>
                <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                  Assign shared responsibility so coverage continues across departments and during leave.
                </div>
                {responsibilityLoading ? (
                  <div className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
                    Loading responsibility settings…
                  </div>
                ) : responsibilityMembers.length === 0 ? (
                  <div className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
                    Not available for personal documents.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {responsibilityMembers.map((m) => {
                      const email = String(m.email ?? "");
                      const isOwner = documentOwnerUserId === m.user_id;
                      const checked = responsibleUserIds.includes(m.user_id) || isOwner;
                      return (
                        <label key={m.user_id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleResponsibleUser(m.user_id)}
                            disabled={!canManageResponsibilities || isOwner || responsibilitySaving}
                          />
                          <span>{email || m.user_id}</span>
                          <span className="text-xs" style={{ color: "var(--muted2)" }}>
                            ({m.role})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {responsibilityError ? (
                  <div className="mt-3 text-sm" style={{ color: "#ff3b30" }}>
                    {responsibilityError}
                  </div>
                ) : null}
              {canManageResponsibilities && responsibilityMembers.length > 0 ? (
                <button
                    type="button"
                    onClick={() => void saveResponsibilities()}
                    disabled={responsibilitySaving}
                    className="focus-ring mt-3 rounded-full border px-4 py-2 text-sm hover:opacity-80 disabled:opacity-50"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                  >
                    {responsibilitySaving ? "Saving…" : "Save responsibility"}
                  </button>
                ) : null}
              </div>

              {doc.workspaceTagFields && doc.workspaceTagFields.length > 0 ? (
                <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                    DOCUMENT TAGS
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {doc.workspaceTagFields.map((f) => (
                      <input
                        key={f.key}
                        value={tagValues[f.key] ?? ""}
                        onChange={(e) => setTagValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.placeholder || f.label}
                        className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
                        style={{ borderColor: "var(--border)", borderRadius: 10 }}
                      />
                    ))}
                  </div>
                  {tagsError ? (
                    <div className="mt-3 text-sm" style={{ color: "#ff3b30" }}>
                      {tagsError}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void saveDocumentTags()}
                    disabled={tagsSaving}
                    className="focus-ring mt-3 rounded-full border px-4 py-2 text-sm hover:opacity-80 disabled:opacity-50"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                  >
                    {tagsSaving ? "Saving…" : "Save tags"}
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {activeTab === "completions" && (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                  COMPLETIONS
                </div>
                <div className="text-xs" style={{ color: "var(--muted2)" }}>
                  {completions.length} total
                </div>
              </div>

              {completions.length === 0 ? (
                <UiPanel className="rounded-3xl p-6 md:p-8">
                  <div className="text-sm font-semibold">No acknowledgements yet</div>
                  <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                    Share the link to collect a Receipt Record.
                  </div>
                </UiPanel>
              ) : (
                <div className="space-y-3">
                  {completions.map((c) => {
                    const who =
                      c.recipients?.name?.trim() ||
                      c.recipients?.email?.trim() ||
                      "Recipient";

                    const emailLine =
                      c.recipients?.email && c.recipients?.name
                        ? c.recipients.email
                        : null;

                    return (
                      <div
                        key={c.id}
                        className="rounded-3xl border p-5 md:p-6"
                        style={{ borderColor: "var(--border)", background: "var(--card)" }}
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{who}</div>
                            {emailLine && (
                              <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                                {emailLine}
                              </div>
                            )}

                            <div className="mt-2 space-y-1 text-xs" style={{ color: "var(--muted)" }}>
                              <div>Submitted at: {formatDate(c.submitted_at)}</div>
                              <div>Acknowledged: {c.acknowledged ? "Yes" : "No"}</div>
                            </div>
                          </div>

                          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 md:w-auto">
                            <div
                              className="rounded-2xl border p-4"
                              style={{ borderColor: "var(--border)", background: "var(--card2)" }}
                            >
                              <div className="text-xs" style={{ color: "var(--muted2)" }}>
                                Max scroll percent
                              </div>
                              <div className="text-sm font-medium">
                                {c.max_scroll_percent == null ? "—" : `${c.max_scroll_percent}%`}
                              </div>
                            </div>

                            <div
                              className="rounded-2xl border p-4"
                              style={{ borderColor: "var(--border)", background: "var(--card2)" }}
                            >
                              <div className="text-xs" style={{ color: "var(--muted2)" }}>
                                Time on page
                              </div>
                              <div className="text-sm font-medium">
                                {formatDuration(c.time_on_page_seconds)}
                              </div>
                            </div>

                            <div
                              className="rounded-2xl border p-4"
                              style={{ borderColor: "var(--border)", background: "var(--card2)" }}
                            >
                              <div className="text-xs" style={{ color: "var(--muted2)" }}>
                                Active time
                              </div>
                              <div className="text-sm font-medium">
                                {formatDuration(c.active_seconds)}
                              </div>
                            </div>

                            <div
                              className="rounded-2xl border p-4"
                              style={{ borderColor: "var(--border)", background: "var(--card2)" }}
                            >
                              <div className="text-xs" style={{ color: "var(--muted2)" }}>
                                IP address
                              </div>
                              <div className="text-sm font-medium">
                                {c.ip ?? "—"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <details className="mt-4">
                          <summary
                            className="cursor-pointer text-xs hover:opacity-80"
                            style={{ color: "var(--muted)" }}
                          >
                            Technical details
                          </summary>
                          <div
                            className="mt-2 rounded-2xl border p-4 text-xs leading-relaxed"
                            style={{ borderColor: "var(--border)", background: "transparent", color: "var(--muted)" }}
                          >
                            <div><span style={{ color: "var(--muted2)" }}>Completion ID:</span> {c.id}</div>
                            <div><span style={{ color: "var(--muted2)" }}>Active time:</span> {formatDuration(c.active_seconds)}</div>
                            <div><span style={{ color: "var(--muted2)" }}>IP address:</span> {c.ip ?? "—"}</div>
                            <div><span style={{ color: "var(--muted2)" }}>User agent:</span> {c.user_agent ?? "—"}</div>
                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showNotifyModal && (
        <UiModal className="max-w-xl">
            <UiSectionCaption>NEW VERSION</UiSectionCaption>
            <h3 className="mt-2 text-lg font-semibold">Who should receive the version notification?</h3>
            <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              {notifyVersionNumber ? `Version v${notifyVersionNumber} has been created.` : "A new version has been created."}
            </div>

            <div className="mt-4 max-h-52 overflow-auto space-y-2">
              {notifyRecipients.length > 0 ? (
                notifyRecipients.map((r) => (
                  <label key={r.email} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={r.selected}
                      onChange={() => toggleNotifyRecipient(r.email)}
                      disabled={notifySending}
                    />
                    <span>{r.email}</span>
                  </label>
                ))
              ) : (
                <div className="text-sm" style={{ color: "var(--muted)" }}>
                  No previous signer emails found. You can add manual recipients below.
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="text-xs" style={{ color: "var(--muted2)" }}>
                VERSION NUMBER
              </div>
              <input
                value={notifyVersionNumber}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                  setNotifyVersionNumber(cleaned);
                }}
                placeholder="e.g. 1.2"
                disabled={notifySending}
                className="focus-ring mt-2 w-full border px-3 py-2 text-sm bg-transparent"
                style={{ borderColor: "var(--border)", borderRadius: 10 }}
              />
            </div>

            <div className="mt-4">
              <div className="text-xs" style={{ color: "var(--muted2)" }}>
                ADDITIONAL EMAILS (COMMA-SEPARATED)
              </div>
              <input
                value={notifyCustomEmails}
                onChange={(e) => setNotifyCustomEmails(e.target.value)}
                placeholder="alex@company.com, team@company.com"
                disabled={notifySending}
                className="focus-ring mt-2 w-full border px-3 py-2 text-sm bg-transparent"
                style={{ borderColor: "var(--border)", borderRadius: 10 }}
              />
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={doNotShowAgain}
                onChange={(e) => setDoNotShowAgain(e.target.checked)}
                disabled={notifySending}
              />
              <span>Do not show again for this document</span>
            </label>

            {notifyError ? (
              <div className="mt-3 text-sm" style={{ color: "#ff3b30" }}>
                {notifyError}
              </div>
            ) : null}

            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeNotifyModal}
                disabled={notifySending}
                className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80 disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => void sendVersionNotifications()}
                disabled={notifySending}
                className="focus-ring rounded-full px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--fg)", color: "var(--bg)" }}
              >
                {notifySending ? "Sending…" : "Send notifications"}
              </button>
            </div>
        </UiModal>
      )}

      {showVersionModal && (
        <UiModal className="max-w-2xl">
            <UiSectionCaption>NEW VERSION</UiSectionCaption>
            <h3 className="mt-2 text-lg font-semibold">Create a new version</h3>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs" style={{ color: "var(--muted2)" }}>
                  VERSION NUMBER (OPTIONAL)
                </div>
                <input
                  value={versionNumberInput}
                  onChange={(e) => setVersionNumberInput(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder={String(suggestedNextVersion)}
                  disabled={versionUploading}
                  className="focus-ring mt-2 w-full border px-3 py-2 text-sm bg-transparent"
                  style={{ borderColor: "var(--border)", borderRadius: 10 }}
                />
                <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                  Use formats like 2, 2.1, 2.1.3. Leave empty to auto-increment.
                </div>
              </div>

              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setVersionFile(e.target.files?.[0] ?? null)}
                className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
                style={{ borderColor: "var(--border)", borderRadius: 10 }}
              />
            </div>

            {versionError ? (
              <div className="mt-3 text-sm" style={{ color: "#ff3b30" }}>
                {versionError}
              </div>
            ) : null}

            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowVersionModal(false)}
                disabled={versionUploading}
                className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80 disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void uploadNewVersion()}
                disabled={versionUploading}
                className="focus-ring rounded-full px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--fg)", color: "var(--bg)" }}
              >
                {versionUploading ? "Uploading…" : "Create version"}
              </button>
            </div>
        </UiModal>
      )}
    </div>
  );
}

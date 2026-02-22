"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { InlineNotice, SectionDisclosure } from "@/components/ui/calm-core";
import { normalizeTemplateSettings, type ReceiptTemplateSettings } from "@/lib/template-settings";

type Plan = "free" | "personal" | "pro" | "team" | "enterprise";
type SendMode = "single_upload" | "selected_documents" | "full_stack";

type Recipient = {
  id: string;
  name: string;
  email: string;
  save: boolean; // Pro+ only
};

type WorkspaceContact = {
  id: string;
  name: string;
  email: string;
  source?: "workspace_member" | "external";
};

type ContactGroup = {
  id: string;
  name: string;
  member_count: number;
  members: Array<{ contact_id: string; name: string; email: string }>;
};

type WorkspaceTemplate = {
  id: string;
  name: string;
  description: string | null;
  settings: ReceiptTemplateSettings;
};

function uid() {
  return `${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function normalizeEmail(s: string) {
  return s.trim().toLowerCase();
}

function isEmail(s: string) {
  const v = normalizeEmail(s);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function fallbackRecipientName(name: string, email: string) {
  const trimmed = name.trim();
  if (trimmed) return trimmed;
  const localPart = normalizeEmail(email).split("@")[0] ?? "";
  const clean = localPart.replace(/[._-]+/g, " ").trim();
  return clean || normalizeEmail(email);
}

function serializeLabels(labels: string[] | undefined) {
  if (!labels || labels.length === 0) return "";
  return labels.join(", ");
}

function planRank(p: Plan) {
  switch (p) {
    case "free":
      return 0;
    case "personal":
      return 1;
    case "pro":
      return 2;
    case "team":
      return 3;
    case "enterprise":
      return 4;
    default:
      return 0;
  }
}

function can(plan: Plan, min: Plan) {
  return planRank(plan) >= planRank(min);
}

const UPGRADE_NUDGE_KEY = "receipt_upgrade_nudges_v1";
const UPGRADE_NUDGE_COOLDOWN_MS = 1000 * 60 * 60 * 8; // 8 hours per nudge key

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center text-[11px] font-semibold tracking-wide" style={{ color: "var(--muted)" }}>
      {children}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      type={type}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="focus-ring w-full px-4 py-3 text-sm"
      style={{
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--fg)",
        opacity: disabled ? 0.6 : 1,
      }}
    />
  );
}

function Select({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="focus-ring w-full px-4 py-3 text-sm"
      style={{
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--fg)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </select>
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="focus-ring px-5 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
      style={{ borderRadius: 12, background: "var(--fg)", color: "var(--bg)" }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="focus-ring px-5 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
      style={{
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--fg)",
      }}
    >
      {children}
    </button>
  );
}

function Toggle({
  checked,
  setChecked,
  disabled,
}: {
  checked: boolean;
  setChecked: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setChecked(!checked)}
      className="focus-ring shrink-0"
      aria-pressed={checked}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        border: "1px solid var(--border)",
        background: checked ? "var(--fg)" : "transparent",
        opacity: disabled ? 0.6 : 1,
        position: "relative",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 4,
          left: checked ? 24 : 5,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: checked ? "var(--bg)" : "var(--muted2)",
          transition: "left 120ms ease",
        }}
      />
    </button>
  );
}

function Panel({
  id,
  title,
  subtitle,
  children,
  right,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="p-6 md:p-7"
      style={{
        borderRadius: 18,
        border: "1px solid var(--border)",
        background: "color-mix(in srgb, var(--bg) 90%, var(--card))",
        boxShadow: "0 12px 40px rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-lg font-semibold tracking-tight">{title}</div>
          {subtitle ? (
            <div className="mt-1 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function NewReceipt() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const nudgesShownRef = useRef<Record<string, boolean>>({});
  const lastAppliedTemplateIdRef = useRef<string | null>(null);

  const [plan, setPlan] = useState<Plan>("free");
  const [primaryWorkspaceId, setPrimaryWorkspaceId] = useState<string | null>(null);
  const [workspaceCount, setWorkspaceCount] = useState(0);

  const personalPlus = can(plan, "personal");
  const proPlus = can(plan, "pro");
  const canStackSend = can(plan, "pro");
  const workspaceProFeaturesEnabled = proPlus && Boolean(primaryWorkspaceId);

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [labelsInput, setLabelsInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [workspaceTagFields, setWorkspaceTagFields] = useState<Array<{ key: string; label: string; placeholder?: string }>>([]);
  const [tagValues, setTagValues] = useState<Record<string, string>>({});

  const [maxAcknowledgersEnabled, setMaxAcknowledgersEnabled] = useState(true);
  const [maxAcknowledgers, setMaxAcknowledgers] = useState<number>(1);

  const [sendEmails, setSendEmails] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([{ id: uid(), name: "", email: "", save: true }]);
  const [requireRecipientIdentity, setRequireRecipientIdentity] = useState(false);
  const [policyModeEnabled, setPolicyModeEnabled] = useState(false);

  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword] = useState("");

  const [useTemplate, setUseTemplate] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showUpgradeCard, setShowUpgradeCard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [sendMode, setSendMode] = useState<SendMode>("single_upload");
  const [availableDocuments, setAvailableDocuments] = useState<Array<{ id: string; title: string; publicId: string }>>([]);
  const [availableStacks, setAvailableStacks] = useState<Array<{ id: string; name: string; item_count: number }>>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [selectedStackId, setSelectedStackId] = useState("");
  const [workspaceContacts, setWorkspaceContacts] = useState<WorkspaceContact[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectedContactGroupIds, setSelectedContactGroupIds] = useState<string[]>([]);
  const [contactPickerQuery, setContactPickerQuery] = useState("");
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [contactsError, setContactsError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMe() {
      try {
        const [meRes, wsRes] = await Promise.all([
          fetch("/api/app/me", { cache: "no-store" }),
          fetch("/api/app/workspaces", { cache: "no-store" }),
        ]);
        if (!meRes.ok) return;
        const json = (await meRes.json()) as {
          id?: string | null;
          plan?: string | null;
          tier?: string | null;
          subscription_plan?: string | null;
          primary_workspace_id?: string | null;
          email?: string | null;
        };
        const wsJson = wsRes.ok ? await wsRes.json() : { workspaces: [] };

        setPrimaryWorkspaceId(json.primary_workspace_id ?? null);
        setWorkspaceCount(Array.isArray(wsJson?.workspaces) ? wsJson.workspaces.length : 0);

        const activeWorkspaceId = String(json.primary_workspace_id ?? "").trim();
        if (activeWorkspaceId) {
          const wsRes = await fetch(`/api/app/workspaces/${encodeURIComponent(activeWorkspaceId)}`, { cache: "no-store" });
          const wsJson2 = wsRes.ok
            ? (await wsRes.json().catch(() => null)) as
                | {
                    workspace?: {
                      document_tag_fields?: Array<{ key: string; label: string; placeholder?: string }>;
                      policy_mode_enabled?: boolean;
                    };
                    licensing?: { plan?: string };
                    viewer?: { user_id?: string };
                    members?: Array<{ user_id?: string; license_active?: boolean }>;
                  }
                | null
            : null;
          const fields = Array.isArray(wsJson2?.workspace?.document_tag_fields)
            ? (wsJson2.workspace.document_tag_fields as Array<{ key: string; label: string; placeholder?: string }>)
            : [];
          setWorkspaceTagFields(fields);
          setTagValues((prev) => {
            const next: Record<string, string> = {};
            for (const f of fields) next[f.key] = prev[f.key] ?? "";
            return next;
          });
          setPolicyModeEnabled(wsJson2?.workspace?.policy_mode_enabled === true);

          const meId = String(json?.id ?? wsJson2?.viewer?.user_id ?? "").trim();
          const memberRow = Array.isArray(wsJson2?.members)
            ? wsJson2.members.find((m) => String(m?.user_id ?? "") === meId)
            : null;
          const licenseActive = memberRow?.license_active !== false;
          const workspacePlan = String(wsJson2?.licensing?.plan ?? "").toLowerCase();
          if (
            licenseActive &&
            (workspacePlan === "free" ||
              workspacePlan === "personal" ||
              workspacePlan === "pro" ||
              workspacePlan === "team" ||
              workspacePlan === "enterprise")
          ) {
            setPlan(workspacePlan as Plan);
            return;
          }
        } else {
          setWorkspaceTagFields([]);
          setTagValues({});
          setPolicyModeEnabled(false);
          setWorkspaceContacts([]);
          setContactGroups([]);
          setTemplates([]);
          setSelectedContactIds([]);
          setSelectedContactGroupIds([]);
          setContactsError(null);
          setTemplatesError(null);
          setTemplateId("");
        }

        const p = String(json.plan ?? json.tier ?? json.subscription_plan ?? "").toLowerCase();
        if (p === "free" || p === "personal" || p === "pro" || p === "team" || p === "enterprise") {
          setPlan(p as Plan);
        }
      } catch {
        // ignore
      }
    }
    loadMe();
  }, []);

  useEffect(() => {
    if (!policyModeEnabled) return;
    setMaxAcknowledgersEnabled(false);
    setSendEmails(true);
    setRequireRecipientIdentity(true);
  }, [policyModeEnabled]);

  useEffect(() => {
    if (!canStackSend && sendMode !== "single_upload") {
      setSendMode("single_upload");
    }
  }, [canStackSend, sendMode]);

  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "selected_documents" || mode === "full_stack" || mode === "single_upload") {
      setSendMode(mode);
    }
    const stackId = searchParams.get("stackId");
    if (stackId) setSelectedStackId(stackId);
    const docsCsv = searchParams.get("documentIds");
    if (docsCsv) {
      const ids = Array.from(
        new Set(
          docsCsv
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
        )
      ).slice(0, 100);
      setSelectedDocumentIds(ids);
      if (ids.length > 0 && mode !== "full_stack") setSendMode("selected_documents");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!primaryWorkspaceId || !canStackSend) {
      setAvailableDocuments([]);
      setAvailableStacks([]);
      return;
    }
    const workspaceId = primaryWorkspaceId;
    let cancelled = false;
    async function loadWorkspaceDeliveryOptions() {
      try {
        const [docsRes, stacksRes] = await Promise.all([
          fetch(`/api/app/workspaces/${encodeURIComponent(workspaceId)}/documents`, { cache: "no-store" }),
          fetch(`/api/app/workspaces/${encodeURIComponent(workspaceId)}/stacks`, { cache: "no-store" }),
        ]);
        const docsJson = docsRes.ok ? await docsRes.json() : { documents: [] };
        const stacksJson = stacksRes.ok ? await stacksRes.json() : { stacks: [] };
        if (!cancelled) {
          setAvailableDocuments(
            Array.isArray(docsJson?.documents)
              ? docsJson.documents.map((doc: { id: string; title: string; publicId: string }) => ({
                  id: String(doc.id),
                  title: String(doc.title ?? "Untitled"),
                  publicId: String(doc.publicId ?? ""),
                }))
              : []
          );
          setAvailableStacks(
            Array.isArray(stacksJson?.stacks)
              ? stacksJson.stacks.map((stack: { id: string; name: string; item_count?: number }) => ({
                  id: String(stack.id),
                  name: String(stack.name ?? "Stack"),
                  item_count: Number(stack.item_count ?? 0),
                }))
              : []
          );
        }
      } catch {
        if (!cancelled) {
          setAvailableDocuments([]);
          setAvailableStacks([]);
        }
      }
    }
    void loadWorkspaceDeliveryOptions();
    return () => {
      cancelled = true;
    };
  }, [primaryWorkspaceId, canStackSend]);

  useEffect(() => {
    if (!workspaceProFeaturesEnabled || !primaryWorkspaceId) {
      setWorkspaceContacts([]);
      setContactGroups([]);
      setTemplates([]);
      setSelectedContactIds([]);
      setSelectedContactGroupIds([]);
      setContactPickerQuery("");
      setContactsLoading(false);
      setTemplatesLoading(false);
      setContactsError(null);
      setTemplatesError(null);
      setUseTemplate(false);
      setTemplateId("");
      return;
    }

    const workspaceId = primaryWorkspaceId;
    let cancelled = false;

    async function loadWorkspaceAssets() {
      setContactsLoading(true);
      setTemplatesLoading(true);
      setContactsError(null);
      setTemplatesError(null);

      try {
        const [contactsRes, groupsRes, templatesRes] = await Promise.all([
          fetch(`/api/app/workspaces/${encodeURIComponent(workspaceId)}/contacts?limit=400`, { cache: "no-store" }),
          fetch(`/api/app/workspaces/${encodeURIComponent(workspaceId)}/contact-groups?include_members=true&limit=200`, {
            cache: "no-store",
          }),
          fetch(`/api/app/workspaces/${encodeURIComponent(workspaceId)}/templates?limit=150`, { cache: "no-store" }),
        ]);

        const contactsJson = (await contactsRes.json().catch(() => null)) as
          | { contacts?: WorkspaceContact[]; error?: string }
          | null;
        const groupsJson = (await groupsRes.json().catch(() => null)) as
          | { groups?: ContactGroup[]; error?: string }
          | null;
        const templatesJson = (await templatesRes.json().catch(() => null)) as
          | { templates?: WorkspaceTemplate[]; error?: string }
          | null;

        if (!cancelled) {
          if (contactsRes.status === 403 || groupsRes.status === 403) {
            setWorkspaceContacts([]);
            setContactGroups([]);
            setSelectedContactIds([]);
            setSelectedContactGroupIds([]);
            setContactsError("Contacts and groups require a Pro+ workspace plan.");
          } else if (!contactsRes.ok || !groupsRes.ok) {
            throw new Error(
              contactsJson?.error ??
                groupsJson?.error ??
                "Failed to load workspace contacts and groups."
            );
          } else {
            const nextContacts = Array.isArray(contactsJson?.contacts) ? contactsJson.contacts : [];
            const nextGroups = Array.isArray(groupsJson?.groups) ? groupsJson.groups : [];
            setWorkspaceContacts(nextContacts);
            setContactGroups(nextGroups);
            setSelectedContactIds((current) => current.filter((id) => nextContacts.some((contact) => contact.id === id)));
            setSelectedContactGroupIds((current) =>
              current.filter((id) => nextGroups.some((group) => group.id === id))
            );
            setContactsError(null);
          }

          if (templatesRes.status === 403) {
            setTemplates([]);
            setUseTemplate(false);
            setTemplateId("");
            setTemplatesError("Templates require a Pro+ workspace plan.");
          } else if (!templatesRes.ok) {
            throw new Error(templatesJson?.error ?? "Failed to load workspace templates.");
          } else {
            const nextTemplates = Array.isArray(templatesJson?.templates)
              ? templatesJson.templates.map((template) => ({
                  ...template,
                  settings: normalizeTemplateSettings(template.settings),
                }))
              : [];
            setTemplates(nextTemplates);
            setTemplateId((current) => (current && nextTemplates.some((template) => template.id === current)
              ? current
              : (nextTemplates[0]?.id ?? "")));
            setTemplatesError(null);
          }
        }
      } catch (loadError: unknown) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Failed to load workspace assets.";
          setContactsError(message);
          setTemplatesError(message);
          setWorkspaceContacts([]);
          setContactGroups([]);
          setTemplates([]);
        }
      } finally {
        if (!cancelled) {
          setContactsLoading(false);
          setTemplatesLoading(false);
        }
      }
    }

    void loadWorkspaceAssets();
    return () => {
      cancelled = true;
    };
  }, [workspaceProFeaturesEnabled, primaryWorkspaceId]);

  function maybeNudgeUpgrade(key: string, title: string, description: string) {
    if (plan !== "free") return;
    if (nudgesShownRef.current[key]) return;
    try {
      const raw = window.localStorage.getItem(UPGRADE_NUDGE_KEY);
      const history = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      const lastShownAt = Number(history[key] ?? 0);
      const now = Date.now();
      if (now - lastShownAt < UPGRADE_NUDGE_COOLDOWN_MS) return;

      history[key] = now;
      window.localStorage.setItem(UPGRADE_NUDGE_KEY, JSON.stringify(history));
      nudgesShownRef.current[key] = true;
      toast.info(title, description);
    } catch {
      // ignore storage parsing issues
    }
  }

  useEffect(() => {
    if (!file || plan !== "free") {
      setShowUpgradeCard(false);
      return;
    }
    try {
      const raw = window.localStorage.getItem(UPGRADE_NUDGE_KEY);
      const history = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      const lastShownAt = Number(history.on_file_upload_card ?? 0);
      const now = Date.now();
      if (now - lastShownAt >= UPGRADE_NUDGE_COOLDOWN_MS) {
        history.on_file_upload_card = now;
        window.localStorage.setItem(UPGRADE_NUDGE_KEY, JSON.stringify(history));
        setShowUpgradeCard(true);
      }
    } catch {
      // ignore storage parsing issues
    }
  }, [file, plan]);

  const needsWorkspaceSelection = useMemo(() => {
    const isWorkspacePlan = plan === "team" || plan === "enterprise";
    return isWorkspacePlan && workspaceCount > 0 && !primaryWorkspaceId;
  }, [plan, workspaceCount, primaryWorkspaceId]);

  const fileLabel = useMemo(() => {
    if (!file) return "No file selected";
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `${file.name} (${mb}MB)`;
  }, [file]);

  const hasFile = Boolean(file);
  const hasSource =
    sendMode === "single_upload"
      ? hasFile
      : sendMode === "full_stack"
        ? Boolean(selectedStackId)
        : selectedDocumentIds.length > 0;

  const flowStep = useMemo(() => {
    if (shareUrl) return 3;
    if (hasSource) return 2;
    return 1;
  }, [hasSource, shareUrl]);

  useEffect(() => {
    if (shareUrl) {
      setWizardStep(3);
      return;
    }
    if (hasSource && wizardStep === 1) {
      setWizardStep(2);
    }
    if (!hasSource && wizardStep > 1) {
      setWizardStep(1);
    }
  }, [hasSource, shareUrl, wizardStep]);

  const configuredRecipients = useMemo(() => {
    return recipients
      .filter((r) => r.name.trim() || r.email.trim())
      .map((r) => ({
        name: r.name.trim(),
        email: normalizeEmail(r.email),
        save: Boolean(r.save) && proPlus,
      }));
  }, [recipients, proPlus]);

  const manualRecipientsHaveInvalidEmail = useMemo(() => {
    const filled = recipients.filter((r) => r.name.trim() || r.email.trim());
    return filled.some((recipient) => !recipient.email.trim() || !isEmail(recipient.email));
  }, [recipients]);

  const filteredWorkspaceContacts = useMemo(() => {
    const needle = contactPickerQuery.trim().toLowerCase();
    if (!needle) return workspaceContacts;
    return workspaceContacts.filter((contact) =>
      `${contact.name} ${contact.email}`.toLowerCase().includes(needle)
    );
  }, [workspaceContacts, contactPickerQuery]);

  const filteredContactGroups = useMemo(() => {
    const needle = contactPickerQuery.trim().toLowerCase();
    if (!needle) return contactGroups;
    return contactGroups.filter((group) => group.name.toLowerCase().includes(needle));
  }, [contactGroups, contactPickerQuery]);

  const contactById = useMemo(
    () => new Map(workspaceContacts.map((contact) => [contact.id, contact])),
    [workspaceContacts]
  );

  const groupById = useMemo(
    () => new Map(contactGroups.map((group) => [group.id, group])),
    [contactGroups]
  );

  const expandedRecipientPreview = useMemo(() => {
    const dedup = new Map<string, { name: string; email: string }>();

    for (const recipient of configuredRecipients) {
      if (!isEmail(recipient.email)) continue;
      const email = normalizeEmail(recipient.email);
      dedup.set(email, {
        email,
        name: fallbackRecipientName(recipient.name, email),
      });
    }

    for (const contactId of selectedContactIds) {
      const contact = contactById.get(contactId);
      if (!contact || !isEmail(contact.email)) continue;
      const email = normalizeEmail(contact.email);
      dedup.set(email, {
        email,
        name: fallbackRecipientName(contact.name, email),
      });
    }

    for (const groupId of selectedContactGroupIds) {
      const group = groupById.get(groupId);
      if (!group) continue;
      for (const member of group.members) {
        const email = normalizeEmail(member.email);
        if (!isEmail(email)) continue;
        dedup.set(email, {
          email,
          name: fallbackRecipientName(member.name, email),
        });
      }
    }

    return Array.from(dedup.values());
  }, [configuredRecipients, selectedContactIds, selectedContactGroupIds, contactById, groupById]);

  const recipientsCount = expandedRecipientPreview.length;
  const recipientPreviewHead = expandedRecipientPreview.slice(0, 5);

  const recipientsValid = useMemo(() => {
    if (!sendEmails) return true;
    if (manualRecipientsHaveInvalidEmail) return false;
    return expandedRecipientPreview.length > 0;
  }, [sendEmails, manualRecipientsHaveInvalidEmail, expandedRecipientPreview.length]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templates, templateId]
  );

  function setRecipient(id: string, patch: Partial<Recipient>) {
    setRecipients((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRecipient() {
    setRecipients((rs) => [...rs, { id: uid(), name: "", email: "", save: true }]);
    maybeNudgeUpgrade(
      "on_add_recipient",
      "Manual sharing on Free",
      "Upgrade to Personal to send receipt links directly by email from Receipt."
    );
  }

  function removeRecipient(id: string) {
    setRecipients((rs) => rs.filter((r) => r.id !== id));
  }

  function toggleSelectedContact(contactId: string) {
    setSelectedContactIds((current) =>
      current.includes(contactId) ? current.filter((id) => id !== contactId) : [...current, contactId]
    );
  }

  function toggleSelectedContactGroup(groupId: string) {
    setSelectedContactGroupIds((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]
    );
  }

  useEffect(() => {
    if (!useTemplate || !workspaceProFeaturesEnabled) {
      lastAppliedTemplateIdRef.current = null;
      return;
    }

    if (!templateId) {
      const firstTemplateId = templates[0]?.id ?? "";
      if (firstTemplateId) setTemplateId(firstTemplateId);
      return;
    }

    const template = templates.find((row) => row.id === templateId);
    if (!template) return;
    if (lastAppliedTemplateIdRef.current === template.id) return;
    lastAppliedTemplateIdRef.current = template.id;

    const settings = normalizeTemplateSettings(template.settings);
    if (settings.priority) setPriority(settings.priority);
    if (settings.labels) setLabelsInput(serializeLabels(settings.labels));

    if (settings.tags) {
      setTagValues(() => {
        const next: Record<string, string> = {};
        for (const field of workspaceTagFields) {
          next[field.key] = String(settings.tags?.[field.key] ?? "");
        }
        return next;
      });
    }

    if (settings.send_emails !== undefined) {
      setSendEmails(policyModeEnabled ? true : (settings.send_emails === true && personalPlus));
    }
    if (settings.require_recipient_identity !== undefined) {
      setRequireRecipientIdentity(
        policyModeEnabled ? true : (settings.require_recipient_identity === true && plan !== "free")
      );
    }

    if (settings.password_enabled !== undefined) {
      setPasswordEnabled(settings.password_enabled === true && personalPlus);
      setPassword("");
    }

    if (!policyModeEnabled && settings.max_acknowledgers_enabled !== undefined) {
      const enabled = settings.max_acknowledgers_enabled === true;
      setMaxAcknowledgersEnabled(enabled);
      if (enabled) {
        setMaxAcknowledgers(Math.max(1, Math.min(999, Number(settings.max_acknowledgers ?? 1) || 1)));
      }
    }
  }, [
    useTemplate,
    workspaceProFeaturesEnabled,
    templateId,
    templates,
    workspaceTagFields,
    personalPlus,
    policyModeEnabled,
    plan,
  ]);

  function validate(): string | null {
    if (needsWorkspaceSelection) {
      return "Choose an active workspace from the top selector before creating a receipt.";
    }
    if (sendMode !== "single_upload" && !canStackSend) {
      return "Stack sending is available on Pro, Team, and Enterprise plans.";
    }
    if (sendMode === "single_upload" && !file) return "Please choose a PDF or DOCX file.";
    if (sendMode === "selected_documents" && selectedDocumentIds.length === 0) {
      return "Choose at least one existing document.";
    }
    if (sendMode === "full_stack" && !selectedStackId) {
      return "Choose a stack to send.";
    }
    if (sendMode !== "single_upload" && !primaryWorkspaceId) {
      return "Select an active workspace before sending a stack.";
    }
    if (!workspaceProFeaturesEnabled && (selectedContactIds.length > 0 || selectedContactGroupIds.length > 0)) {
      return "Contacts and groups require an active Pro+ workspace.";
    }
    if (sendEmails && !personalPlus) return "Email sending is available on Personal plans and above.";
    if (!recipientsValid) return "Please add valid recipient emails (or turn off email sending).";
    if (passwordEnabled && !personalPlus) return "Password protection is available on Personal plans and above.";
    if (passwordEnabled && password.trim().length < 6) return "Password must be at least 6 characters.";
    if (maxAcknowledgersEnabled && (!Number.isFinite(maxAcknowledgers) || maxAcknowledgers < 1)) {
      return "Acknowledger limit must be at least 1.";
    }
    if (useTemplate && !workspaceProFeaturesEnabled) {
      return "Templates require an active Pro+ workspace.";
    }
    if (useTemplate && workspaceProFeaturesEnabled && !templateId) {
      return "Choose a workspace template before continuing.";
    }
    return null;
  }

  async function create() {
    setError(null);
    setShareUrl(null);

    const v = validate();
    if (v) {
      setError(v);
      toast.error("Fix required", v);
      return;
    }

    setLoading(true);
    try {
      let res: Response;
      if (sendMode === "single_upload") {
        const form = new FormData();
        form.append("source_type", "upload");
        form.append("title", title || "Untitled");
        if (file) {
          form.append("file", file);
        }
        form.append("send_emails", String(sendEmails && personalPlus));
        form.append("recipients", JSON.stringify(configuredRecipients));
        form.append("require_recipient_identity", String(requireRecipientIdentity && plan !== "free"));
        form.append("password_enabled", String(passwordEnabled && personalPlus));
        form.append("password", passwordEnabled && personalPlus ? password : "");
        form.append("max_acknowledgers_enabled", String(maxAcknowledgersEnabled));
        form.append("max_acknowledgers", String(maxAcknowledgersEnabled ? maxAcknowledgers : 0));
        form.append("tags", JSON.stringify(tagValues));
        form.append("priority", priority);
        form.append("labels", labelsInput);
        form.append("template_enabled", String(useTemplate && workspaceProFeaturesEnabled));
        form.append("template_id", useTemplate && workspaceProFeaturesEnabled ? templateId : "");
        form.append("save_default", String(saveAsDefault && proPlus));
        if (workspaceProFeaturesEnabled && selectedContactIds.length > 0) {
          form.append("contact_ids", JSON.stringify(selectedContactIds));
        }
        if (workspaceProFeaturesEnabled && selectedContactGroupIds.length > 0) {
          form.append("contact_group_ids", JSON.stringify(selectedContactGroupIds));
        }
        res = await fetch("/api/app/documents/create-from-source", { method: "POST", body: form });
      } else {
        res = await fetch(`/api/app/workspaces/${encodeURIComponent(primaryWorkspaceId ?? "")}/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: sendMode,
            stack_id: sendMode === "full_stack" ? selectedStackId : undefined,
            document_ids: sendMode === "selected_documents" ? selectedDocumentIds : undefined,
            title: title || undefined,
            send_emails: sendEmails && personalPlus,
            recipients: configuredRecipients,
            contact_ids: workspaceProFeaturesEnabled && selectedContactIds.length > 0 ? selectedContactIds : undefined,
            contact_group_ids:
              workspaceProFeaturesEnabled && selectedContactGroupIds.length > 0
                ? selectedContactGroupIds
                : undefined,
          }),
        });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Upload failed");

      setShareUrl(json.share_url);
      const failedEmails = Array.isArray(json?.emails?.failed) ? json.emails.failed.length : 0;
      if (failedEmails > 0) {
        toast.error(
          "Created with email issues",
          `${failedEmails} recipient email${failedEmails === 1 ? "" : "s"} failed to send.`
        );
      } else if (json?.emails?.requested) {
        const sent = Number(json?.emails?.sent ?? 0);
        toast.success("Created", `Link ready. Sent to ${sent} recipient${sent === 1 ? "" : "s"}.`);
      } else {
        toast.success("Created", "Your link is ready.");
      }
      maybeNudgeUpgrade(
        "on_create_success",
        "Ready to automate delivery?",
        "Personal adds email sending and password protection. Pro adds reusable templates."
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      toast.error("Failed", msg);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    const abs = `${window.location.origin}${shareUrl}`;
    try {
      await navigator.clipboard.writeText(abs);
      toast.success("Copied", "Share link copied to clipboard.");
    } catch {
      toast.error("Copy failed", "Your browser blocked clipboard access.");
    }
  }

  function goNext() {
    if (wizardStep === 1) {
      if (!hasSource) {
        setError(
          sendMode === "single_upload"
            ? "Please choose a PDF or DOCX file."
            : sendMode === "full_stack"
              ? "Please choose a stack."
              : "Please choose at least one document."
        );
        return;
      }
      setWizardStep(2);
      return;
    }
    if (wizardStep === 2) {
      setWizardStep(3);
    }
  }

  function goBack() {
    setWizardStep((s) => (s === 3 ? 2 : 1));
  }

  const summary = useMemo(() => {
    const emailState = sendEmails && personalPlus ? "On" : "Off";
    const passState = passwordEnabled && personalPlus ? "On" : "Off";
    const ackState = maxAcknowledgersEnabled ? `Max ${maxAcknowledgers}` : "Unlimited";
    const templateState = useTemplate && workspaceProFeaturesEnabled
      ? (selectedTemplate?.name ?? "Not selected")
      : "Off";
    return [
      { k: "Plan", v: plan.toUpperCase() },
      {
        k: "Mode",
        v: primaryWorkspaceId ? (policyModeEnabled ? "Workspace (Policy mode)" : "Workspace") : "Personal",
      },
      {
        k: "Source",
        v:
          sendMode === "single_upload"
            ? "Upload file"
            : sendMode === "full_stack"
              ? "Entire stack"
              : "Selected existing documents",
      },
      { k: "Priority", v: priority.toUpperCase() },
      {
        k: sendMode === "single_upload" ? "File" : "Selection",
        v:
          sendMode === "single_upload"
            ? hasFile
              ? "Attached"
              : "Missing"
            : sendMode === "full_stack"
              ? (selectedStackId ? "Stack selected" : "Missing")
              : selectedDocumentIds.length > 0
                ? `${selectedDocumentIds.length} selected`
                : "Missing",
      },
      { k: "Email", v: emailState },
      { k: "Recipients", v: String(recipientsCount) },
      { k: "Require identity", v: requireRecipientIdentity && plan !== "free" ? "On" : "Off" },
      { k: "Acknowledgers", v: ackState },
      { k: "Password", v: passState },
      { k: "Template", v: templateState },
    ];
  }, [
    plan,
    primaryWorkspaceId,
    policyModeEnabled,
    sendMode,
    hasFile,
    selectedStackId,
    selectedDocumentIds.length,
    priority,
    sendEmails,
    personalPlus,
    recipientsCount,
    requireRecipientIdentity,
    passwordEnabled,
    maxAcknowledgersEnabled,
    maxAcknowledgers,
    useTemplate,
    workspaceProFeaturesEnabled,
    selectedTemplate?.name,
  ]);

  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden p-6 md:p-8"
        style={{
          borderRadius: 24,
          border: "1px solid var(--border)",
          background:
            "radial-gradient(circle at 20% 0%, color-mix(in srgb, var(--card) 70%, transparent), transparent 45%), linear-gradient(155deg, color-mix(in srgb, var(--bg) 92%, var(--card2)), color-mix(in srgb, var(--bg) 84%, var(--card)))",
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
          <div className="min-w-0">
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <h1 className="app-hero-title text-4xl md:text-5xl">Create New Receipt</h1>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href="/app"
              className="focus-ring px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
              style={{ borderRadius: 12, border: "1px solid var(--border)", color: "var(--fg)" }}
            >
              Back
            </Link>
            {wizardStep > 1 ? <SecondaryButton onClick={goBack} disabled={loading}>Previous</SecondaryButton> : null}
            {wizardStep < 3 ? (
              <PrimaryButton onClick={goNext} disabled={loading || (wizardStep === 1 && !hasSource)}>
                Next
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={create} disabled={loading || needsWorkspaceSelection || !hasSource}>
                {loading ? "Creating…" : "Create"}
              </PrimaryButton>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-7 space-y-2">
            <div className="space-y-1">
              <Label>SEND MODE</Label>
              <Select
                value={sendMode}
                onChange={(v) => setSendMode(v as SendMode)}
                disabled={!canStackSend && sendMode !== "single_upload"}
              >
                <option value="single_upload">Single document (upload)</option>
                <option value="selected_documents" disabled={!canStackSend}>
                  Selected existing documents (Pro+)
                </option>
                <option value="full_stack" disabled={!canStackSend}>
                  Entire stack (Pro+)
                </option>
              </Select>
            </div>
            {wizardStep >= 2 ? (
              <>
                <Label>TITLE (OPTIONAL)</Label>
                <Input
                  value={title}
                  onChange={setTitle}
                  placeholder="e.g. Client Care Letter, Residential Conveyancing"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                  <div className="space-y-1">
                    <Label>PRIORITY</Label>
                    <Select value={priority} onChange={(v) => setPriority(v as "low" | "normal" | "high")}>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>LABELS (COMMA SEPARATED)</Label>
                    <Input value={labelsInput} onChange={setLabelsInput} placeholder="HR, onboarding, policy" />
                  </div>
                </div>
                <div className="text-xs" style={{ color: "var(--muted2)" }}>
                  This appears on your dashboard and evidence export.
                </div>
                {workspaceTagFields.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                    {workspaceTagFields.map((f) => (
                      <div key={f.key} className="space-y-1">
                        <Label>{f.label.toUpperCase()}</Label>
                        <Input
                          value={tagValues[f.key] ?? ""}
                          onChange={(v) => setTagValues((prev) => ({ ...prev, [f.key]: v }))}
                          placeholder={f.placeholder || f.label}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                {sendMode === "single_upload"
                  ? "Step 1: upload your file. Step 2 will collect title, labels, and metadata."
                  : sendMode === "full_stack"
                    ? "Step 1: choose a stack. Step 2 will let you set title and metadata for the stack delivery."
                    : "Step 1: select one or more existing documents. Step 2 will let you set title and metadata."}
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <Label>DOCUMENT SOURCE</Label>
            {sendMode === "single_upload" ? (
              <label
                className="focus-ring mt-2 block cursor-pointer p-5"
                style={{
                  borderRadius: 16,
                  border: hasFile ? "1px solid var(--fg)" : "1px solid var(--border)",
                  background: hasFile
                    ? "color-mix(in srgb, var(--card2) 78%, transparent)"
                    : "color-mix(in srgb, var(--bg) 92%, var(--card))",
                  transition: "all 180ms ease",
                }}
              >
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{hasFile ? "File attached" : "Select your file"}</div>
                    <div className="mt-1 text-xs truncate" style={{ color: "var(--muted)" }}>
                      {fileLabel}
                    </div>
                    <div className="mt-2 text-[11px]" style={{ color: "var(--muted2)" }}>
                      Max 20MB. PDF or DOCX.
                    </div>
                  </div>
                  <span
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold"
                    style={{ borderRadius: 999, border: "1px solid var(--border)", color: "var(--fg)" }}
                  >
                    {hasFile ? "Replace" : "Browse"}
                  </span>
                </div>
              </label>
            ) : null}
            {sendMode === "selected_documents" ? (
              <div className="mt-2 space-y-2 rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
                {!canStackSend ? (
                  <div className="text-xs" style={{ color: "var(--muted2)" }}>
                    Upgrade to Pro to send selected document groups.
                  </div>
                ) : availableDocuments.length === 0 ? (
                  <div className="text-xs" style={{ color: "var(--muted2)" }}>
                    No workspace documents found.
                  </div>
                ) : (
                  <div className="max-h-56 space-y-2 overflow-auto pr-1">
                    {availableDocuments.map((doc) => {
                      const selected = selectedDocumentIds.includes(doc.id);
                      return (
                        <label key={doc.id} className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) =>
                              setSelectedDocumentIds((current) =>
                                event.target.checked
                                  ? Array.from(new Set([...current, doc.id]))
                                  : current.filter((id) => id !== doc.id)
                              )
                            }
                          />
                          <span className="min-w-0">
                            <span className="block font-medium">{doc.title}</span>
                            <span className="block text-xs" style={{ color: "var(--muted2)" }}>{doc.publicId}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
            {sendMode === "full_stack" ? (
              <div className="mt-2 space-y-2 rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
                <div className="text-xs" style={{ color: "var(--muted2)" }}>
                  Choose a stack to send as one delivery link.
                </div>
                <Select value={selectedStackId} onChange={setSelectedStackId} disabled={!canStackSend || availableStacks.length === 0}>
                  <option value="">Select stack…</option>
                  {availableStacks.map((stack) => (
                    <option key={stack.id} value={stack.id}>
                      {stack.name} ({stack.item_count})
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section
        className="p-4"
        style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }}
      >
        <div className="grid grid-cols-3 gap-3 text-xs">
          {[
            { id: 1, label: "Source" },
            { id: 2, label: "Configure" },
            { id: 3, label: "Create" },
          ].map((step) => {
            const done = flowStep > step.id;
            const active = flowStep === step.id;
            return (
              <div key={step.id} className="flex items-center gap-2">
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={{
                    background: done || active ? "var(--fg)" : "transparent",
                    color: done || active ? "var(--bg)" : "var(--muted2)",
                    border: done || active ? "1px solid transparent" : "1px solid var(--border)",
                  }}
                >
                  {done ? "✓" : step.id}
                </span>
                <span style={{ color: active ? "var(--fg)" : "var(--muted)" }}>{step.label}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-xs" style={{ color: "var(--muted2)" }}>
          Current step: {wizardStep === 1 ? "Choose source" : wizardStep === 2 ? "Name and metadata" : "Receipt settings"}
        </div>
      </section>

      {showUpgradeCard ? (
        <section
          className="p-4 md:p-5"
          style={{
            borderRadius: 16,
            border: "1px solid var(--border)",
            background: "color-mix(in srgb, var(--card2) 80%, var(--bg))",
          }}
        >
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div className="min-w-0">
              <div className="text-sm font-semibold">You are on Free</div>
              <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                Personal unlocks email sending and password protection. Pro adds templates and saved defaults.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/pricing"
                className="focus-ring px-3 py-2 text-sm font-medium hover:opacity-90"
                style={{ borderRadius: 10, border: "1px solid var(--border)", color: "var(--fg)" }}
              >
                Compare plans
              </Link>
              <button
                type="button"
                className="focus-ring px-3 py-2 text-sm hover:opacity-80"
                style={{ borderRadius: 10, color: "var(--muted)" }}
                onClick={() => setShowUpgradeCard(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {needsWorkspaceSelection ? (
        <div
          className="border px-4 py-3 text-sm"
          style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}
        >
          Team/Enterprise accounts must create receipts inside an active workspace.
          Switch context using the top selector, then continue.
        </div>
      ) : null}

      {wizardStep === 1 ? (
        <section
          className="p-6"
          style={{
            borderRadius: 18,
            border: "1px solid var(--border)",
            background: "color-mix(in srgb, var(--bg) 92%, var(--card))",
          }}
        >
          <div className="text-sm font-semibold">
            {sendMode === "single_upload" ? "Start by uploading your document" : "Start by choosing what to send"}
          </div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {sendMode === "single_upload"
              ? "After upload, you can add recipients and adjust options before sending."
              : "After selecting documents or a stack, you can add recipients and adjust options before sending."}
          </div>
          <InlineNotice>Your first record only takes a minute. You can refine defaults later in settings.</InlineNotice>
        </section>
      ) : null}

      <div
        style={{
          opacity: hasSource && wizardStep >= 3 ? 1 : 0,
          transform: hasSource && wizardStep >= 3 ? "translateY(0)" : "translateY(8px)",
          maxHeight: hasSource && wizardStep >= 3 ? "6000px" : "0px",
          overflow: "hidden",
          pointerEvents: hasSource && wizardStep >= 3 ? "auto" : "none",
          transition: "opacity 280ms ease, transform 280ms ease, max-height 560ms ease",
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section className="lg:col-span-9 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href="#recipients"
                className="focus-ring px-3 py-1.5 text-xs font-semibold hover:opacity-90"
                style={{ borderRadius: 999, border: "1px solid var(--border)", color: "var(--fg)" }}
              >
                Recipients
              </a>
              <a
                href="#rules"
                className="focus-ring px-3 py-1.5 text-xs font-semibold hover:opacity-90"
                style={{ borderRadius: 999, border: "1px solid var(--border)", color: "var(--fg)" }}
              >
                Rules
              </a>
              <a
                href="#protection"
                className="focus-ring px-3 py-1.5 text-xs font-semibold hover:opacity-90"
                style={{ borderRadius: 999, border: "1px solid var(--border)", color: "var(--fg)" }}
              >
                Protection
              </a>
              <a
                href="#templates"
                className="focus-ring px-3 py-1.5 text-xs font-semibold hover:opacity-90"
                style={{ borderRadius: 999, border: "1px solid var(--border)", color: "var(--fg)" }}
              >
                Templates
              </a>
            </div>

            <Panel
              id="recipients"
              title="Recipients"
              subtitle="Add recipients, optionally send from Receipt, and save recipients on Pro+."
              right={
                !personalPlus ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold tracking-wide" style={{ color: "var(--muted)" }}>
                      PERSONAL+
                    </span>
                    <Link href="/pricing" className="text-xs font-semibold underline" style={{ color: "var(--muted)" }}>
                      Upgrade
                    </Link>
                  </div>
                ) : (
                  <Pill>{sendEmails ? "Email on" : "Email off"}</Pill>
                )
              }
            >
              <div className="space-y-5">
                {policyModeEnabled ? (
                  <div
                    className="p-3 text-xs"
                    style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)" }}
                  >
                    Policy mode default: bulk email + link delivery is enabled.
                  </div>
                ) : null}
                <div
                  className="flex items-start justify-between gap-4 p-4"
                  style={{ borderRadius: 14, border: "1px solid var(--border)", background: "transparent" }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Send link by email</div>
                    <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                      {personalPlus
                        ? "Receipt will email the recipients you list below."
                        : "Upgrade to Personal to send emails from Receipt."}
                    </div>
                  </div>
                  <Toggle checked={sendEmails} setChecked={setSendEmails} disabled={!personalPlus} />
                </div>

                <div
                  className="flex items-start justify-between gap-4 p-4"
                  style={{ borderRadius: 14, border: "1px solid var(--border)", background: "transparent" }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Require name and email on acknowledgement</div>
                    <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                      {plan !== "free"
                        ? "Recipients must provide both fields before submitting acknowledgement."
                        : "Upgrade to a paid plan to require identity fields."}
                    </div>
                  </div>
                  <Toggle checked={requireRecipientIdentity} setChecked={setRequireRecipientIdentity} disabled={plan === "free"} />
                </div>

                <div className="space-y-3">
                  {recipients.map((r) => {
                    const emailOk = !r.email.trim() || isEmail(r.email);
                    return (
                      <div
                        key={r.id}
                        className="grid grid-cols-12 gap-3 items-start p-4"
                        style={{ borderRadius: 14, border: "1px solid var(--border)" }}
                      >
                        <div className="col-span-12 md:col-span-4 space-y-2">
                          <Label>NAME</Label>
                          <Input value={r.name} onChange={(v) => setRecipient(r.id, { name: v })} placeholder="Alex Smith" />
                        </div>

                        <div className="col-span-12 md:col-span-5 space-y-2">
                          <Label>EMAIL</Label>
                          <Input
                            value={r.email}
                            onChange={(v) => setRecipient(r.id, { email: v })}
                            placeholder="alex@client.com"
                          />
                          {!emailOk ? (
                            <div className="text-xs" style={{ color: "#ff3b30" }}>
                              Enter a valid email address.
                            </div>
                          ) : null}
                        </div>

                        <div className="col-span-12 md:col-span-3 space-y-2">
                          <Label>SAVE</Label>
                          <div className="flex items-center justify-between gap-3">
                            <label className="flex items-center gap-2 text-sm" style={{ opacity: proPlus ? 1 : 0.6 }}>
                              <input
                                type="checkbox"
                                checked={r.save}
                                onChange={(e) => setRecipient(r.id, { save: e.target.checked })}
                                disabled={!proPlus}
                              />
                              <span>Save</span>
                            </label>
                            {!proPlus ? (
                              <span className="text-[11px] font-semibold tracking-wide" style={{ color: "var(--muted)" }}>
                                PRO+
                              </span>
                            ) : null}
                          </div>
                          {recipients.length > 1 ? (
                            <button
                              type="button"
                              className="focus-ring text-xs px-3 py-2 hover:opacity-80"
                              style={{ borderRadius: 999, border: "1px solid var(--border)", color: "var(--muted)" }}
                              onClick={() => removeRecipient(r.id)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-xs" style={{ color: "var(--muted2)" }}>
                      {recipientsCount} recipient{recipientsCount === 1 ? "" : "s"}
                    </div>
                    <button
                      type="button"
                      className="focus-ring text-xs px-3 py-2 hover:opacity-90"
                      style={{
                        borderRadius: 999,
                        border: "1px solid var(--border)",
                        color: "var(--fg)",
                        background: "transparent",
                      }}
                      onClick={addRecipient}
                    >
                      Add recipient
                    </button>
                  </div>

                  <div
                    className="space-y-3 p-4"
                    style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--card)" }}
                  >
                    <div className="flex items-start justify-between gap-3 flex-col sm:flex-row">
                      <div>
                        <div className="text-sm font-semibold">Directory recipients</div>
                        <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                          Select contacts and groups for mass sending. Recipients are deduped automatically at send-time.
                        </div>
                      </div>
                      <Pill>
                        {selectedContactIds.length} contacts • {selectedContactGroupIds.length} groups
                      </Pill>
                    </div>

                    {!workspaceProFeaturesEnabled ? (
                      <div className="text-xs" style={{ color: "var(--muted2)" }}>
                        {primaryWorkspaceId
                          ? "Upgrade this workspace to Pro+ to use contacts and groups."
                          : "Select an active Pro+ workspace to use contacts and groups."}
                      </div>
                    ) : contactsLoading ? (
                      <div className="text-xs" style={{ color: "var(--muted2)" }}>
                        Loading contacts and groups…
                      </div>
                    ) : contactsError ? (
                      <div className="text-xs" style={{ color: "#ff3b30" }}>
                        {contactsError}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Input
                          value={contactPickerQuery}
                          onChange={setContactPickerQuery}
                          placeholder="Search contacts or groups"
                        />
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                          <div className="space-y-2">
                            <Label>CONTACTS</Label>
                            <div className="max-h-44 space-y-1 overflow-auto rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                              {filteredWorkspaceContacts.length === 0 ? (
                                <div className="text-xs" style={{ color: "var(--muted2)" }}>
                                  No contacts found.
                                </div>
                              ) : (
                                filteredWorkspaceContacts.map((contact) => (
                                  <label key={contact.id} className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={selectedContactIds.includes(contact.id)}
                                      onChange={() => toggleSelectedContact(contact.id)}
                                    />
                                    <span className="truncate">{contact.name}</span>
                                    <span className="truncate text-xs" style={{ color: "var(--muted2)" }}>
                                      {contact.email}
                                    </span>
                                    <span className="truncate text-[11px]" style={{ color: "var(--muted2)" }}>
                                      {contact.source === "workspace_member" ? "Member" : "External"}
                                    </span>
                                  </label>
                                ))
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>GROUPS</Label>
                            <div className="max-h-44 space-y-1 overflow-auto rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                              {filteredContactGroups.length === 0 ? (
                                <div className="text-xs" style={{ color: "var(--muted2)" }}>
                                  No groups found.
                                </div>
                              ) : (
                                filteredContactGroups.map((group) => (
                                  <label key={group.id} className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={selectedContactGroupIds.includes(group.id)}
                                      onChange={() => toggleSelectedContactGroup(group.id)}
                                    />
                                    <span className="truncate">{group.name}</span>
                                    <span className="truncate text-xs" style={{ color: "var(--muted2)" }}>
                                      {group.member_count} member{group.member_count === 1 ? "" : "s"}
                                    </span>
                                  </label>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div
                      className="space-y-2 rounded-xl border p-3"
                      style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg) 88%, var(--card2))" }}
                    >
                      <div className="text-xs font-semibold" style={{ color: "var(--muted2)" }}>
                        Recipient preview
                      </div>
                      <div className="text-sm font-semibold">
                        {recipientsCount} unique recipient{recipientsCount === 1 ? "" : "s"}
                      </div>
                      <div className="text-xs" style={{ color: "var(--muted2)" }}>
                        Manual ({configuredRecipients.length}) + Contacts ({selectedContactIds.length}) + Groups ({selectedContactGroupIds.length})
                      </div>
                      {recipientPreviewHead.length > 0 ? (
                        <div className="space-y-1">
                          {recipientPreviewHead.map((recipient) => (
                            <div key={recipient.email} className="text-xs" style={{ color: "var(--muted)" }}>
                              {recipient.name} · {recipient.email}
                            </div>
                          ))}
                          {recipientsCount > recipientPreviewHead.length ? (
                            <div className="text-xs" style={{ color: "var(--muted2)" }}>
                              +{recipientsCount - recipientPreviewHead.length} more
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-xs" style={{ color: "var(--muted2)" }}>
                          Add a manual recipient, contact, or group to preview recipients.
                        </div>
                      )}
                    </div>
                  </div>

                  {sendEmails && !recipientsValid ? (
                    <div className="text-xs" style={{ color: "#ff3b30" }}>
                      If email sending is on, add at least one valid recipient email, contact, or group.
                    </div>
                  ) : null}
                </div>
              </div>
            </Panel>
            <SectionDisclosure
              title="Advanced options"
              summary="Rules, protection, and templates. Keep collapsed for a faster default flow."
            >
              <div className="space-y-4">
                <Panel
                  id="rules"
                  title="Rules"
                  subtitle="Limit acknowledgements and close the link when complete."
                  right={<Pill>{maxAcknowledgersEnabled ? `Max ${maxAcknowledgers}` : "Unlimited"}</Pill>}
                >
                  <div className="space-y-4">
                    {policyModeEnabled ? (
                      <div
                        className="p-3 text-xs"
                        style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)" }}
                      >
                        Policy mode default: unlimited acknowledgements.
                      </div>
                    ) : null}
                    <div
                      className="flex items-start justify-between gap-4 p-4"
                      style={{ borderRadius: 14, border: "1px solid var(--border)" }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">Close after acknowledgements</div>
                        <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                          Typical flow: set max acknowledgers to 1.
                        </div>
                      </div>
                      <Toggle checked={maxAcknowledgersEnabled} setChecked={setMaxAcknowledgersEnabled} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>MAX ACKNOWLEDGERS</Label>
                        <Input
                          type="number"
                          value={String(maxAcknowledgers)}
                          onChange={(v) => setMaxAcknowledgers(Math.max(1, Math.min(999, Number(v || 1))))}
                          disabled={!maxAcknowledgersEnabled}
                          placeholder="1"
                        />
                        <div className="text-xs" style={{ color: "var(--muted2)" }}>
                          If disabled, the link stays open for unlimited acknowledgements.
                        </div>
                      </div>

                      <div
                        className="p-4"
                        style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--card)" }}
                      >
                        <div className="text-sm font-semibold">Server-side enforcement</div>
                        <div className="mt-2 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                          When the acknowledgement limit is reached, the link is closed and additional acknowledgements are rejected.
                        </div>
                      </div>
                    </div>
                  </div>
                </Panel>

                <Panel
                  id="protection"
                  title="Protection"
                  subtitle="Optionally require a password before the PDF can be opened."
                  right={
                    !personalPlus ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold tracking-wide" style={{ color: "var(--muted)" }}>
                          PERSONAL+
                        </span>
                        <Link href="/pricing" className="text-xs font-semibold underline" style={{ color: "var(--muted)" }}>
                          Upgrade
                        </Link>
                      </div>
                    ) : (
                      <Pill>{passwordEnabled ? "On" : "Off"}</Pill>
                    )
                  }
                >
                  <div className="space-y-4">
                    <div
                      className="flex items-start justify-between gap-4 p-4"
                      style={{ borderRadius: 14, border: "1px solid var(--border)" }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">Require a password</div>
                        <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                          {personalPlus
                            ? "Recipients must enter the password before viewing."
                            : "Upgrade to Personal to enable passwords."}
                        </div>
                      </div>
                      <Toggle
                        checked={passwordEnabled}
                        setChecked={(v) => {
                          setPasswordEnabled(v);
                          if (!v) setPassword("");
                        }}
                        disabled={!personalPlus}
                      />
                    </div>

                    {passwordEnabled ? (
                      <div className="space-y-2">
                        <Label>PASSWORD</Label>
                        <Input
                          value={password}
                          onChange={setPassword}
                          placeholder="Minimum 6 characters"
                          disabled={!personalPlus}
                        />
                        <div className="text-xs" style={{ color: "var(--muted2)" }}>
                          Share this separately. Receipt records access; it does not verify identity.
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Panel>

                <Panel
                  id="templates"
                  title="Templates"
                  subtitle="Use presets and save defaults (Pro+)."
                  right={
                    !workspaceProFeaturesEnabled ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold tracking-wide" style={{ color: "var(--muted)" }}>
                          PRO+
                        </span>
                        <Link href="/pricing" className="text-xs font-semibold underline" style={{ color: "var(--muted)" }}>
                          Upgrade
                        </Link>
                      </div>
                    ) : (
                      <Pill>{useTemplate ? "On" : "Off"}</Pill>
                    )
                  }
                >
                  <div className="space-y-4">
                    <div
                      className="flex items-start justify-between gap-4 p-4"
                      style={{ borderRadius: 14, border: "1px solid var(--border)" }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">Use a template</div>
                        <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                          {workspaceProFeaturesEnabled
                            ? "Pick a workspace template for this receipt."
                            : "Templates require an active Pro+ workspace."}
                        </div>
                      </div>
                      <Toggle checked={useTemplate} setChecked={setUseTemplate} disabled={!workspaceProFeaturesEnabled} />
                    </div>

                    {useTemplate ? (
                      !workspaceProFeaturesEnabled ? (
                        <div className="text-xs" style={{ color: "var(--muted2)" }}>
                          Select an active Pro+ workspace to load templates.
                        </div>
                      ) : templatesLoading ? (
                        <div className="text-xs" style={{ color: "var(--muted2)" }}>
                          Loading templates…
                        </div>
                      ) : templatesError ? (
                        <div className="text-xs" style={{ color: "#ff3b30" }}>
                          {templatesError}
                        </div>
                      ) : templates.length === 0 ? (
                        <div className="text-xs" style={{ color: "var(--muted2)" }}>
                          No templates found. Create one in the Templates page.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>TEMPLATE</Label>
                          <Select value={templateId} onChange={setTemplateId} disabled={!workspaceProFeaturesEnabled}>
                            {templates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.name}
                              </option>
                            ))}
                          </Select>
                          <div className="text-xs" style={{ color: "var(--muted2)" }}>
                            {selectedTemplate?.description
                              ? selectedTemplate.description
                              : "Selecting a template applies its settings. You can still override manually."}
                          </div>
                        </div>
                      )
                    ) : null}

                    <div
                      className="flex items-start justify-between gap-4 p-4"
                      style={{ borderRadius: 14, border: "1px solid var(--border)" }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">Save these settings as default</div>
                        <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                          {proPlus ? "Prefill next time." : "Upgrade to Pro to save defaults."}
                        </div>
                      </div>
                      <Toggle checked={saveAsDefault} setChecked={setSaveAsDefault} disabled={!proPlus} />
                    </div>
                  </div>
                </Panel>
              </div>
            </SectionDisclosure>

            {error ? (
              <div
                className="p-4 text-sm"
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,59,48,0.35)",
                  background: "color-mix(in srgb, var(--bg) 90%, rgba(255,59,48,0.10))",
                  color: "#ff3b30",
                }}
              >
                {error}
              </div>
            ) : null}

            {shareUrl ? (
              <div className="p-5" style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--card2)" }}>
                <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>
                      SHARE LINK
                    </div>
                    <div className="mt-2 text-sm">
                      <Link className="underline underline-offset-4 break-all" href={shareUrl}>
                        {shareUrl}
                      </Link>
                    </div>
                    <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
                      {sendEmails && personalPlus
                        ? "Email sending is enabled (wire server-side to actually send)."
                        : "Share manually, or enable email sending on Personal+."}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <SecondaryButton onClick={copyLink}>Copy</SecondaryButton>
                    <PrimaryButton onClick={() => (window.location.href = shareUrl)}>Open</PrimaryButton>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <aside className="lg:col-span-3">
            <div
              className="p-5"
              style={{
                position: "sticky",
                top: 18,
                borderRadius: 18,
                border: "1px solid var(--border)",
                background: "color-mix(in srgb, var(--bg) 92%, var(--card))",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Summary</div>
                <Pill>{loading ? "Working…" : hasSource ? "Configured" : "Waiting for source"}</Pill>
              </div>

              <div className="mt-4 space-y-2">
                {summary.map((x) => (
                  <div key={x.k} className="flex items-center justify-between gap-3">
                    <div className="text-xs" style={{ color: "var(--muted2)" }}>
                      {x.k}
                    </div>
                    <div className="text-xs font-semibold" style={{ color: "var(--fg)" }}>
                      {x.v}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                <div className="text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
                  Receipt records access, review activity, and acknowledgement. It does not assess understanding and is not an e-signature product.
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <SecondaryButton onClick={() => (window.location.href = "/app")} disabled={loading}>
                  Cancel
                </SecondaryButton>
                <PrimaryButton onClick={create} disabled={loading || needsWorkspaceSelection || !hasSource}>
                  {loading ? "Creating…" : "Create"}
                </PrimaryButton>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast";

type Plan = "free" | "personal" | "pro" | "team" | "enterprise";

type Recipient = {
  id: string;
  name: string;
  email: string;
  save: boolean; // Pro+ only
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

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide"
      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
    >
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
  const toast = useToast();

  const [plan, setPlan] = useState<Plan>("free");
  const [meEmail, setMeEmail] = useState<string | null>(null);
  const [primaryWorkspaceId, setPrimaryWorkspaceId] = useState<string | null>(null);
  const [workspaceCount, setWorkspaceCount] = useState(0);

  const personalPlus = can(plan, "personal");
  const proPlus = can(plan, "pro");

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [workspaceTagFields, setWorkspaceTagFields] = useState<Array<{ key: string; label: string; placeholder?: string }>>([]);
  const [tagValues, setTagValues] = useState<Record<string, string>>({});

  const [maxAcknowledgersEnabled, setMaxAcknowledgersEnabled] = useState(true);
  const [maxAcknowledgers, setMaxAcknowledgers] = useState<number>(1);

  const [sendEmails, setSendEmails] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([{ id: uid(), name: "", email: "", save: true }]);
  const [requireRecipientIdentity, setRequireRecipientIdentity] = useState(false);

  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword] = useState("");

  const [useTemplate, setUseTemplate] = useState(false);
  const [templateId, setTemplateId] = useState<string>("default");
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

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

        setMeEmail(json.email ?? null);
        setPrimaryWorkspaceId(json.primary_workspace_id ?? null);
        setWorkspaceCount(Array.isArray(wsJson?.workspaces) ? wsJson.workspaces.length : 0);

        const activeWorkspaceId = String(json.primary_workspace_id ?? "").trim();
        if (activeWorkspaceId) {
          const wsRes = await fetch(`/api/app/workspaces/${encodeURIComponent(activeWorkspaceId)}`, { cache: "no-store" });
          const wsJson2 = wsRes.ok
            ? (await wsRes.json().catch(() => null)) as
                | {
                    workspace?: { document_tag_fields?: Array<{ key: string; label: string; placeholder?: string }> };
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

          const meId = String(json?.id ?? wsJson2?.viewer?.user_id ?? "").trim();
          const memberRow = Array.isArray(wsJson2?.members)
            ? wsJson2.members.find((m) => String(m?.user_id ?? "") === meId)
            : null;
          const licenseActive = memberRow?.license_active !== false;
          const workspacePlan = String(wsJson2?.licensing?.plan ?? "").toLowerCase();
          if (licenseActive && (workspacePlan === "team" || workspacePlan === "enterprise")) {
            setPlan(workspacePlan as Plan);
            return;
          }
        } else {
          setWorkspaceTagFields([]);
          setTagValues({});
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

  const recipientsCount = useMemo(() => recipients.filter((r) => r.name.trim() || r.email.trim()).length, [recipients]);

  const recipientsValid = useMemo(() => {
    if (!sendEmails) return true;
    const filled = recipients.filter((r) => r.name.trim() || r.email.trim());
    if (filled.length === 0) return false;
    for (const r of filled) {
      if (!r.email.trim() || !isEmail(r.email)) return false;
    }
    return true;
  }, [recipients, sendEmails]);

  const configuredRecipients = useMemo(() => {
    return recipients
      .filter((r) => r.name.trim() || r.email.trim())
      .map((r) => ({
        name: r.name.trim(),
        email: normalizeEmail(r.email),
        save: Boolean(r.save) && proPlus,
      }));
  }, [recipients, proPlus]);

  function setRecipient(id: string, patch: Partial<Recipient>) {
    setRecipients((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRecipient() {
    setRecipients((rs) => [...rs, { id: uid(), name: "", email: "", save: true }]);
  }

  function removeRecipient(id: string) {
    setRecipients((rs) => rs.filter((r) => r.id !== id));
  }

  function validate(): string | null {
    if (needsWorkspaceSelection) {
      return "Choose an active workspace from the top selector before creating a receipt.";
    }
    if (!file) return "Please choose a PDF or DOCX file.";
    if (sendEmails && !personalPlus) return "Email sending is available on Personal plans and above.";
    if (!recipientsValid) return "Please add valid recipient emails (or turn off email sending).";
    if (passwordEnabled && !personalPlus) return "Password protection is available on Personal plans and above.";
    if (passwordEnabled && password.trim().length < 6) return "Password must be at least 6 characters.";
    if (maxAcknowledgersEnabled && (!Number.isFinite(maxAcknowledgers) || maxAcknowledgers < 1)) {
      return "Acknowledger limit must be at least 1.";
    }
    if (useTemplate && !proPlus) return "Templates and defaults are available on Pro plans and above.";
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
      form.append("template_enabled", String(useTemplate && proPlus));
      form.append("template_id", useTemplate && proPlus ? templateId : "");
      form.append("save_default", String(saveAsDefault && proPlus));

      const res = await fetch("/api/app/documents/create-from-source", { method: "POST", body: form });
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

  const summary = useMemo(() => {
    const emailState = sendEmails && personalPlus ? "On" : "Off";
    const passState = passwordEnabled && personalPlus ? "On" : "Off";
    const ackState = maxAcknowledgersEnabled ? `Max ${maxAcknowledgers}` : "Unlimited";
    const templateState = useTemplate && proPlus ? templateId : "Off";
    return [
      { k: "Plan", v: plan.toUpperCase() },
      { k: "Mode", v: primaryWorkspaceId ? "Workspace" : "Personal" },
      { k: "Source", v: "Upload file" },
      { k: "File", v: hasFile ? "Attached" : "Missing" },
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
    hasFile,
    sendEmails,
    personalPlus,
    recipientsCount,
    requireRecipientIdentity,
    passwordEnabled,
    maxAcknowledgersEnabled,
    maxAcknowledgers,
    useTemplate,
    proPlus,
    templateId,
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
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Create New Receipt</h1>
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
            <PrimaryButton onClick={create} disabled={loading || needsWorkspaceSelection || !hasFile}>
              {loading ? "Creating…" : "Create link"}
            </PrimaryButton>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-7 space-y-2">
            <Label>TITLE (OPTIONAL)</Label>
            <Input
              value={title}
              onChange={setTitle}
              placeholder="e.g. Client Care Letter , Residential Conveyancing"
            />
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
          </div>

          <div className="lg:col-span-5">
            <Label>DOCUMENT SOURCE</Label>
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
          </div>
        </div>
      </section>

      {needsWorkspaceSelection ? (
        <div
          className="border px-4 py-3 text-sm"
          style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}
        >
          Team/Enterprise accounts must create receipts inside an active workspace.
          Switch context using the top selector, then continue.
        </div>
      ) : null}

      {!hasFile ? (
        <section
          className="p-6"
          style={{
            borderRadius: 18,
            border: "1px solid var(--border)",
            background: "color-mix(in srgb, var(--bg) 92%, var(--card))",
          }}
        >
          <div className="text-sm font-semibold">Upload to unlock configuration</div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Recipient controls, password protection, closure rules, and template defaults appear here after your source is added.
          </div>
        </section>
      ) : null}

      <div
        style={{
          opacity: hasFile ? 1 : 0,
          transform: hasFile ? "translateY(0)" : "translateY(8px)",
          maxHeight: hasFile ? "6000px" : "0px",
          overflow: "hidden",
          pointerEvents: hasFile ? "auto" : "none",
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
              right={!personalPlus ? <Pill>PERSONAL+</Pill> : <Pill>{sendEmails ? "Email on" : "Email off"}</Pill>}
            >
              <div className="space-y-5">
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
                            {!proPlus ? <Pill>PRO+</Pill> : null}
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

                  {sendEmails && !recipientsValid ? (
                    <div className="text-xs" style={{ color: "#ff3b30" }}>
                      If email sending is on, at least one valid recipient email is required.
                    </div>
                  ) : null}
                </div>
              </div>
            </Panel>

            <Panel
              id="rules"
              title="Rules"
              subtitle="Limit acknowledgements and close the link when complete."
              right={<Pill>{maxAcknowledgersEnabled ? `Max ${maxAcknowledgers}` : "Unlimited"}</Pill>}
            >
              <div className="space-y-4">
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
              right={!personalPlus ? <Pill>PERSONAL+</Pill> : <Pill>{passwordEnabled ? "On" : "Off"}</Pill>}
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
              right={!proPlus ? <Pill>PRO+</Pill> : <Pill>{useTemplate ? "On" : "Off"}</Pill>}
            >
              <div className="space-y-4">
                <div
                  className="flex items-start justify-between gap-4 p-4"
                  style={{ borderRadius: 14, border: "1px solid var(--border)" }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Use a template</div>
                    <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                      {proPlus ? "Pick a preset (wire to DB later)." : "Upgrade to Pro to use templates."}
                    </div>
                  </div>
                  <Toggle checked={useTemplate} setChecked={setUseTemplate} disabled={!proPlus} />
                </div>

                {useTemplate ? (
                  <div className="space-y-2">
                    <Label>TEMPLATE</Label>
                    <Select value={templateId} onChange={setTemplateId} disabled={!proPlus}>
                      <option value="default">Default</option>
                      <option value="client-care-letter">Client Care Letter</option>
                      <option value="terms-of-business">Terms of Business</option>
                      <option value="completion-statement">Completion Statement</option>
                    </Select>
                    <div className="text-xs" style={{ color: "var(--muted2)" }}>
                      Replace these options with your real template IDs.
                    </div>
                  </div>
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
                <Pill>{loading ? "Working…" : hasFile ? "Configured" : "Waiting for source"}</Pill>
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
                <PrimaryButton onClick={create} disabled={loading || needsWorkspaceSelection || !hasFile}>
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

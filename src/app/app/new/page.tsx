"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast";

type Plan = "free" | "personal" | "pro" | "team" | "enterprise";
type TabKey = "basics" | "recipients" | "rules" | "protection" | "templates";

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

/* ---------- small UI primitives (minimal + consistent) ---------- */

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
        border: `1px solid var(--border)`,
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
        border: `1px solid var(--border)`,
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
        border: `1px solid var(--border)`,
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
        border: `1px solid var(--border)`,
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
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      className="p-6 md:p-7"
      style={{
        borderRadius: 18,
        border: `1px solid var(--border)`,
        background: "color-mix(in srgb, var(--bg) 92%, var(--card))",
        boxShadow: "var(--shadow)",
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
    </div>
  );
}

function SubmenuItem({
  active,
  onClick,
  label,
  hint,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring w-full text-left px-3 py-2.5 transition"
      style={{
        borderRadius: 12,
        background: active ? "var(--card2)" : "transparent",
        border: `1px solid ${active ? "transparent" : "transparent"}`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{label}</div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {hint ? (
        <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
          {hint}
        </div>
      ) : null}
    </button>
  );
}

/* --------------------- Page --------------------- */

export default function NewReceipt() {
  const toast = useToast();

  const [plan, setPlan] = useState<Plan>("free");
  const [meEmail, setMeEmail] = useState<string | null>(null);

  const personalPlus = can(plan, "personal");
  const proPlus = can(plan, "pro");

  const [tab, setTab] = useState<TabKey>("basics");

  // base fields
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // share rules
  const [maxAcknowledgersEnabled, setMaxAcknowledgersEnabled] = useState(true);
  const [maxAcknowledgers, setMaxAcknowledgers] = useState<number>(1);

  // recipients + emails
  const [sendEmails, setSendEmails] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([
    { id: uid(), name: "", email: "", save: true },
  ]);

  // password (Personal+)
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword] = useState("");

  // templates/defaults (Pro+)
  const [useTemplate, setUseTemplate] = useState(false);
  const [templateId, setTemplateId] = useState<string>("default");
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  // create state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const copiedTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    async function loadMe() {
      try {
        const res = await fetch("/api/app/me", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();

        setMeEmail(json.email ?? null);

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

  const fileLabel = useMemo(() => {
    if (!file) return "Choose a PDF";
    const mb = file ? (file.size / (1024 * 1024)).toFixed(1) : "0.0";
    return `${file.name} (${mb}MB)`;
  }, [file]);

  const recipientsCount = useMemo(
    () => recipients.filter((r) => r.name.trim() || r.email.trim()).length,
    [recipients]
  );

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
    if (!file) return "Please choose a PDF.";
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
      form.append("title", title || "Untitled");
      form.append("file", file as File);

      // backend can ignore until wired
      form.append("send_emails", String(sendEmails && personalPlus));
      form.append("recipients", JSON.stringify(configuredRecipients));

      form.append("password_enabled", String(passwordEnabled && personalPlus));
      form.append("password", passwordEnabled && personalPlus ? password : "");

      form.append("max_acknowledgers_enabled", String(maxAcknowledgersEnabled));
      form.append("max_acknowledgers", String(maxAcknowledgersEnabled ? maxAcknowledgers : 0));

      form.append("template_enabled", String(useTemplate && proPlus));
      form.append("template_id", useTemplate && proPlus ? templateId : "");
      form.append("save_default", String(saveAsDefault && proPlus));

      const res = await fetch("/api/docs", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Upload failed");

      setShareUrl(json.share_url);
      toast.success("Created", "Your link is ready.");
    } catch (e: any) {
      const msg = e?.message ?? "Something went wrong";
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
      { k: "Email", v: emailState },
      { k: "Recipients", v: String(recipientsCount) },
      { k: "Acknowledgers", v: ackState },
      { k: "Password", v: passState },
      { k: "Template", v: templateState },
    ];
  }, [
    plan,
    sendEmails,
    personalPlus,
    recipientsCount,
    passwordEnabled,
    maxAcknowledgersEnabled,
    maxAcknowledgers,
    useTemplate,
    proPlus,
    templateId,
  ]);

  const gating = {
    recipients: !personalPlus ? <Pill>PERSONAL+</Pill> : <Pill>{sendEmails ? "Email on" : "Email off"}</Pill>,
    protection: !personalPlus ? <Pill>PERSONAL+</Pill> : <Pill>{passwordEnabled ? "On" : "Off"}</Pill>,
    templates: !proPlus ? <Pill>PRO+</Pill> : <Pill>{useTemplate ? "On" : "Off"}</Pill>,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 flex-col lg:flex-row">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">New share link</h1>
            <Pill>{plan.toUpperCase()}</Pill>
          </div>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Upload a PDF, configure the rules, then generate a link.
          </p>
          {meEmail ? (
            <div className="mt-2 text-xs" style={{ color: "var(--muted2)" }}>
              Signed in as {meEmail}
            </div>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Link
            href="/app"
            className="focus-ring px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
            style={{ borderRadius: 12, border: `1px solid var(--border)`, color: "var(--fg)" }}
          >
            Back
          </Link>
          <PrimaryButton onClick={create} disabled={loading}>
            {loading ? "Creating…" : "Create link"}
          </PrimaryButton>
        </div>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left submenu */}
        <aside
          className="lg:col-span-3 p-3"
          style={{
            borderRadius: 18,
            border: `1px solid var(--border)`,
            background: "color-mix(in srgb, var(--bg) 94%, var(--card))",
          }}
        >
          <div className="px-2 pb-2">
            <div className="text-xs font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>
              SETUP
            </div>
          </div>

          <div className="space-y-1">
            <SubmenuItem
              active={tab === "basics"}
              onClick={() => setTab("basics")}
              label="Basics"
              hint="Title + PDF"
              badge={file ? <Pill>Ready</Pill> : <Pill>PDF</Pill>}
            />
            <SubmenuItem
              active={tab === "recipients"}
              onClick={() => setTab("recipients")}
              label="Recipients"
              hint="Email + saved recipients"
              badge={gating.recipients}
            />
            <SubmenuItem
              active={tab === "rules"}
              onClick={() => setTab("rules")}
              label="Rules"
              hint="Close after acknowledgements"
              badge={<Pill>{maxAcknowledgersEnabled ? `Max ${maxAcknowledgers}` : "Unlimited"}</Pill>}
            />
            <SubmenuItem
              active={tab === "protection"}
              onClick={() => setTab("protection")}
              label="Protection"
              hint="Password gate"
              badge={gating.protection}
            />
            <SubmenuItem
              active={tab === "templates"}
              onClick={() => setTab("templates")}
              label="Templates"
              hint="Pro defaults"
              badge={gating.templates}
            />
          </div>

          <div className="mt-3 px-2">
            <a
              href="/pricing"
              className="focus-ring inline-flex items-center justify-center w-full px-4 py-2.5 text-xs font-semibold"
              style={{
                borderRadius: 12,
                border: `1px solid var(--border)`,
                color: "var(--fg)",
                background: "transparent",
              }}
            >
              View pricing
            </a>
          </div>
        </aside>

        {/* Main panel */}
        <section className="lg:col-span-6">
          {tab === "basics" ? (
            <Panel
              title="Basics"
              subtitle="Give it a title (optional) and choose a PDF."
              right={<Pill>PDF</Pill>}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>TITLE (OPTIONAL)</Label>
                  <Input
                    value={title}
                    onChange={setTitle}
                    placeholder="e.g. Client Care Letter , Residential Conveyancing"
                  />
                  <div className="text-xs" style={{ color: "var(--muted2)" }}>
                    This appears on your dashboard and evidence export.
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>PDF</Label>
                  <div
                    className="flex items-center justify-between gap-3 px-4 py-3"
                    style={{ borderRadius: 12, border: `1px solid var(--border)` }}
                  >
                    <span className="truncate text-sm" style={{ color: "var(--muted)" }}>
                      {fileLabel}
                    </span>
                    <label
                      className="focus-ring px-3 py-1.5 text-xs font-semibold cursor-pointer hover:opacity-90"
                      style={{
                        borderRadius: 999,
                        border: `1px solid var(--border)`,
                        color: "var(--fg)",
                      }}
                    >
                      Browse
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                  <div className="text-xs" style={{ color: "var(--muted2)" }}>
                    Max 20MB. PDF only.
                  </div>
                </div>
              </div>
            </Panel>
          ) : null}

          {tab === "recipients" ? (
            <Panel
              title="Recipients"
              subtitle="Add recipients, optionally send from Receipt, and save recipients on Pro+."
              right={!personalPlus ? <Pill>PERSONAL+</Pill> : <Pill>{sendEmails ? "Email on" : "Email off"}</Pill>}
            >
              <div className="space-y-5">
                {/* email toggle */}
                <div
                  className="flex items-start justify-between gap-4 p-4"
                  style={{ borderRadius: 14, border: `1px solid var(--border)`, background: "transparent" }}
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

                {/* recipients list */}
                <div className="space-y-3">
                  {recipients.map((r) => {
                    const emailOk = !r.email.trim() || isEmail(r.email);
                    return (
                      <div
                        key={r.id}
                        className="grid grid-cols-12 gap-3 items-start p-4"
                        style={{ borderRadius: 14, border: `1px solid var(--border)` }}
                      >
                        <div className="col-span-12 md:col-span-4 space-y-2">
                          <Label>NAME</Label>
                          <Input
                            value={r.name}
                            onChange={(v) => setRecipient(r.id, { name: v })}
                            placeholder="Alex Smith"
                          />
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
                              style={{
                                borderRadius: 999,
                                border: `1px solid var(--border)`,
                                color: "var(--muted)",
                              }}
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
                        border: `1px solid var(--border)`,
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
          ) : null}

          {tab === "rules" ? (
            <Panel
              title="Rules"
              subtitle="Limit acknowledgements and close the link when complete."
              right={<Pill>{maxAcknowledgersEnabled ? `Max ${maxAcknowledgers}` : "Unlimited"}</Pill>}
            >
              <div className="space-y-4">
                <div
                  className="flex items-start justify-between gap-4 p-4"
                  style={{ borderRadius: 14, border: `1px solid var(--border)` }}
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
                    style={{
                      borderRadius: 14,
                      border: `1px solid var(--border)`,
                      background: "var(--card)",
                    }}
                  >
                    <div className="text-sm font-semibold">Server-side next</div>
                    <div className="mt-2 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                      This UI is ready , once your API enforces closure, the link can hard-stop further
                      acknowledgements.
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          ) : null}

          {tab === "protection" ? (
            <Panel
              title="Protection"
              subtitle="Optionally require a password before the PDF can be opened."
              right={!personalPlus ? <Pill>PERSONAL+</Pill> : <Pill>{passwordEnabled ? "On" : "Off"}</Pill>}
            >
              <div className="space-y-4">
                <div
                  className="flex items-start justify-between gap-4 p-4"
                  style={{ borderRadius: 14, border: `1px solid var(--border)` }}
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
                      Share this separately. Receipt records access; it doesn’t verify identity.
                    </div>
                  </div>
                ) : null}
              </div>
            </Panel>
          ) : null}

          {tab === "templates" ? (
            <Panel
              title="Templates"
              subtitle="Use presets + save defaults (Pro+)."
              right={!proPlus ? <Pill>PRO+</Pill> : <Pill>{useTemplate ? "On" : "Off"}</Pill>}
            >
              <div className="space-y-4">
                <div
                  className="flex items-start justify-between gap-4 p-4"
                  style={{ borderRadius: 14, border: `1px solid var(--border)` }}
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
                  style={{ borderRadius: 14, border: `1px solid var(--border)` }}
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
          ) : null}

          {/* Inline feedback */}
          {error ? (
            <div
              className="mt-4 p-4 text-sm"
              style={{
                borderRadius: 14,
                border: `1px solid rgba(255,59,48,0.35)`,
                background: "color-mix(in srgb, var(--bg) 90%, rgba(255,59,48,0.10))",
                color: "#ff3b30",
              }}
            >
              {error}
            </div>
          ) : null}

          {shareUrl ? (
            <div
              className="mt-4 p-5"
              style={{
                borderRadius: 16,
                border: `1px solid var(--border)`,
                background: "var(--card2)",
              }}
            >
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

        {/* Right summary (sticky) */}
        <aside className="lg:col-span-3">
          <div
            className="p-5"
            style={{
              position: "sticky",
              top: 18,
              borderRadius: 18,
              border: `1px solid var(--border)`,
              background: "color-mix(in srgb, var(--bg) 92%, var(--card))",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Summary</div>
              <Pill>{loading ? "Working…" : "Ready"}</Pill>
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
                Receipt records access, review activity, and acknowledgement. It does not assess understanding
                and is not an e-signature product.
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <SecondaryButton onClick={() => (window.location.href = "/app")} disabled={loading}>
                Cancel
              </SecondaryButton>
              <PrimaryButton onClick={create} disabled={loading}>
                {loading ? "Creating…" : "Create"}
              </PrimaryButton>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
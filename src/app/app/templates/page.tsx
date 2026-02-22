"use client";

import { useEffect, useMemo, useState } from "react";
import { AppHero, AppPage, AppPanel } from "@/components/app/page-layout";
import { FeaturePaywall } from "@/components/app/feature-paywall";
import { normalizeTemplateSettings, type ReceiptTemplateSettings } from "@/lib/template-settings";

type MeResponse = {
  primary_workspace_id?: string | null;
};

type WorkspaceTemplate = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  settings: ReceiptTemplateSettings;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type TemplatesResponse = {
  templates: WorkspaceTemplate[];
  can_manage: boolean;
};

type TemplateFormState = {
  name: string;
  description: string;
  priority: "low" | "normal" | "high";
  labelsInput: string;
  tagsInput: string;
  sendEmails: boolean;
  requireRecipientIdentity: boolean;
  passwordEnabled: boolean;
  maxAcknowledgersEnabled: boolean;
  maxAcknowledgers: number;
};

function defaultTemplateForm(): TemplateFormState {
  return {
    name: "",
    description: "",
    priority: "normal",
    labelsInput: "",
    tagsInput: "",
    sendEmails: false,
    requireRecipientIdentity: false,
    passwordEnabled: false,
    maxAcknowledgersEnabled: false,
    maxAcknowledgers: 1,
  };
}

function parseLabels(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value.slice(0, 48))
    )
  ).slice(0, 20);
}

function serializeLabels(labels: string[] | undefined) {
  if (!labels || labels.length === 0) return "";
  return labels.join(", ");
}

function parseTagsInput(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  const chunks = input.split(",");
  for (const chunk of chunks) {
    const [rawKey, ...rest] = chunk.split(":");
    const key = String(rawKey ?? "").trim().toLowerCase().replace(/[^a-z0-9_\-\s]/g, "").replace(/\s+/g, "_");
    const value = rest.join(":").trim();
    if (!key || !value) continue;
    out[key.slice(0, 64)] = value.slice(0, 120);
  }
  return out;
}

function serializeTags(tags: Record<string, string> | undefined) {
  if (!tags || Object.keys(tags).length === 0) return "";
  return Object.entries(tags)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}

function buildSettings(form: TemplateFormState): ReceiptTemplateSettings {
  return normalizeTemplateSettings({
    priority: form.priority,
    labels: parseLabels(form.labelsInput),
    tags: parseTagsInput(form.tagsInput),
    send_emails: form.sendEmails,
    require_recipient_identity: form.requireRecipientIdentity,
    password_enabled: form.passwordEnabled,
    max_acknowledgers_enabled: form.maxAcknowledgersEnabled,
    max_acknowledgers: form.maxAcknowledgersEnabled ? form.maxAcknowledgers : null,
  });
}

function hydrateForm(template: WorkspaceTemplate): TemplateFormState {
  const settings = normalizeTemplateSettings(template.settings ?? {});
  return {
    name: template.name,
    description: template.description ?? "",
    priority: settings.priority ?? "normal",
    labelsInput: serializeLabels(settings.labels),
    tagsInput: serializeTags(settings.tags),
    sendEmails: settings.send_emails === true,
    requireRecipientIdentity: settings.require_recipient_identity === true,
    passwordEnabled: settings.password_enabled === true,
    maxAcknowledgersEnabled: settings.max_acknowledgers_enabled === true,
    maxAcknowledgers: Math.max(1, Math.min(1000, Number(settings.max_acknowledgers ?? 1) || 1)),
  };
}

function formatUtc(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function TemplatesPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState(false);

  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [canManage, setCanManage] = useState(false);

  const [createForm, setCreateForm] = useState<TemplateFormState>(defaultTemplateForm());
  const [createSaving, setCreateSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TemplateFormState>(defaultTemplateForm());
  const [editSaving, setEditSaving] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadWorkspaceAndTemplates() {
      setLoading(true);
      setError(null);
      setPaywall(false);
      try {
        const meRes = await fetch("/api/app/me", { cache: "no-store" });
        const meJson = (await meRes.json().catch(() => null)) as MeResponse | null;
        if (!meRes.ok) throw new Error("Failed to load user context.");

        const nextWorkspaceId = String(meJson?.primary_workspace_id ?? "").trim() || null;
        if (!active) return;
        setWorkspaceId(nextWorkspaceId);

        if (!nextWorkspaceId) {
          setTemplates([]);
          setCanManage(false);
          return;
        }

        const templatesRes = await fetch(`/api/app/workspaces/${encodeURIComponent(nextWorkspaceId)}/templates?limit=100`, {
          cache: "no-store",
        });

        if (templatesRes.status === 403) {
          setPaywall(true);
          setTemplates([]);
          setCanManage(false);
          return;
        }

        const templatesJson = (await templatesRes.json().catch(() => null)) as TemplatesResponse | { error?: string } | null;
        if (!templatesRes.ok) throw new Error(templatesJson && "error" in templatesJson ? String(templatesJson.error) : "Failed to load templates.");

        if (!active) return;
        const rows = Array.isArray((templatesJson as TemplatesResponse).templates)
          ? (templatesJson as TemplatesResponse).templates
          : [];

        setTemplates(
          rows.map((row) => ({
            ...row,
            settings: normalizeTemplateSettings(row.settings),
          }))
        );
        setCanManage((templatesJson as TemplatesResponse).can_manage === true);
      } catch (loadError: unknown) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load templates.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadWorkspaceAndTemplates();
    return () => {
      active = false;
    };
  }, []);

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [templates]
  );

  async function createTemplate() {
    if (!workspaceId || createSaving) return;
    if (!createForm.name.trim()) {
      setError("Template name is required.");
      return;
    }

    setCreateSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceId)}/templates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          description: createForm.description,
          settings: buildSettings(createForm),
        }),
      });

      const json = (await res.json().catch(() => null)) as { template?: WorkspaceTemplate; error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Failed to create template.");
      if (!json?.template) throw new Error("Template was not returned by the server.");
      const createdTemplate: WorkspaceTemplate = {
        ...json.template,
        settings: normalizeTemplateSettings(json.template.settings),
      };

      setTemplates((current) => [
        createdTemplate,
        ...current,
      ]);
      setCreateForm(defaultTemplateForm());
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : "Failed to create template.");
    } finally {
      setCreateSaving(false);
    }
  }

  function startEdit(template: WorkspaceTemplate) {
    setEditingId(template.id);
    setEditForm(hydrateForm(template));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(defaultTemplateForm());
  }

  async function saveEdit() {
    if (!workspaceId || !editingId || editSaving) return;
    if (!editForm.name.trim()) {
      setError("Template name is required.");
      return;
    }

    setEditSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceId)}/templates/${encodeURIComponent(editingId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          settings: buildSettings(editForm),
        }),
      });

      const json = (await res.json().catch(() => null)) as { template?: WorkspaceTemplate; error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Failed to update template.");
      if (!json?.template) throw new Error("Template was not returned by the server.");
      const updatedTemplate: WorkspaceTemplate = {
        ...json.template,
        settings: normalizeTemplateSettings(json.template.settings),
      };

      setTemplates((current) =>
        current.map((template) =>
          template.id === editingId
            ? updatedTemplate
            : template
        )
      );
      cancelEdit();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update template.");
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteTemplate(templateId: string) {
    if (!workspaceId || deleteBusyId) return;
    setDeleteBusyId(templateId);
    setError(null);
    try {
      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceId)}/templates/${encodeURIComponent(templateId)}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete template.");

      setTemplates((current) => current.filter((template) => template.id !== templateId));
      if (editingId === templateId) cancelEdit();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete template.");
    } finally {
      setDeleteBusyId(null);
    }
  }

  const showWorkspaceRequired = !loading && !error && !workspaceId;

  return (
    <AppPage>
      <AppHero
        kicker="TEMPLATES"
        title="Templates"
        description="Reusable workspace defaults for send-time controls, metadata, and policy-oriented consistency."
      />

      {loading ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--card2)" }} />
          <div className="h-48 animate-pulse rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--card2)" }} />
        </div>
      ) : null}

      {!loading && paywall ? (
        <FeaturePaywall featureName="Templates" detail="Templates are unlocked for Pro, Team, and Enterprise workspaces." />
      ) : null}

      {showWorkspaceRequired ? (
        <AppPanel title="Select an active workspace">
          <div className="app-subtle text-sm">
            Templates are workspace-scoped. Choose an active workspace from the top switcher, then refresh this page.
          </div>
        </AppPanel>
      ) : null}

      {!loading && !paywall && workspaceId ? (
        <div className="space-y-4">
          {error ? <div className="app-error">{error}</div> : null}

          <AppPanel
            title="Create template"
            subtitle={canManage ? "Define reusable defaults for /app/new." : "Only workspace owners/admins can manage templates."}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                value={createForm.name}
                onChange={(event) => setCreateForm((form) => ({ ...form, name: event.target.value }))}
                placeholder="Template name"
                className="app-input"
                disabled={!canManage}
              />
              <input
                value={createForm.description}
                onChange={(event) => setCreateForm((form) => ({ ...form, description: event.target.value }))}
                placeholder="Description (optional)"
                className="app-input"
                disabled={!canManage}
              />
              <select
                value={createForm.priority}
                onChange={(event) =>
                  setCreateForm((form) => ({ ...form, priority: event.target.value as "low" | "normal" | "high" }))
                }
                className="app-input"
                disabled={!canManage}
              >
                <option value="low">Priority: Low</option>
                <option value="normal">Priority: Normal</option>
                <option value="high">Priority: High</option>
              </select>
              <input
                value={createForm.labelsInput}
                onChange={(event) => setCreateForm((form) => ({ ...form, labelsInput: event.target.value }))}
                placeholder="Labels (comma separated)"
                className="app-input"
                disabled={!canManage}
              />
              <input
                value={createForm.tagsInput}
                onChange={(event) => setCreateForm((form) => ({ ...form, tagsInput: event.target.value }))}
                placeholder="Tags (key: value, key2: value2)"
                className="app-input md:col-span-2"
                disabled={!canManage}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createForm.sendEmails}
                  onChange={(event) => setCreateForm((form) => ({ ...form, sendEmails: event.target.checked }))}
                  disabled={!canManage}
                />
                Send emails by default
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createForm.requireRecipientIdentity}
                  onChange={(event) =>
                    setCreateForm((form) => ({ ...form, requireRecipientIdentity: event.target.checked }))
                  }
                  disabled={!canManage}
                />
                Require recipient identity
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createForm.passwordEnabled}
                  onChange={(event) => setCreateForm((form) => ({ ...form, passwordEnabled: event.target.checked }))}
                  disabled={!canManage}
                />
                Password enabled
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createForm.maxAcknowledgersEnabled}
                  onChange={(event) =>
                    setCreateForm((form) => ({ ...form, maxAcknowledgersEnabled: event.target.checked }))
                  }
                  disabled={!canManage}
                />
                Limit acknowledgers
              </label>
              {createForm.maxAcknowledgersEnabled ? (
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={createForm.maxAcknowledgers}
                  onChange={(event) =>
                    setCreateForm((form) => ({
                      ...form,
                      maxAcknowledgers: Math.max(1, Math.min(1000, Number(event.target.value) || 1)),
                    }))
                  }
                  className="app-input"
                  disabled={!canManage}
                />
              ) : null}
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => void createTemplate()}
                disabled={!canManage || createSaving}
                className="focus-ring app-btn-primary disabled:opacity-50"
              >
                {createSaving ? "Creating…" : "Create template"}
              </button>
            </div>
          </AppPanel>

          <AppPanel title="Workspace templates" subtitle="Apply from /app/new when creating receipts.">
            {sortedTemplates.length === 0 ? (
              <div className="app-empty">No templates yet. Create your first template above.</div>
            ) : (
              <div className="space-y-3">
                {sortedTemplates.map((template) => (
                  <div key={template.id} className="app-list-item p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{template.name}</div>
                        <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                          Updated {formatUtc(template.updated_at)}
                        </div>
                        {template.description ? (
                          <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                            {template.description}
                          </div>
                        ) : null}
                      </div>
                      {canManage ? (
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => startEdit(template)} className="focus-ring app-btn-secondary">
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteTemplate(template.id)}
                            disabled={deleteBusyId === template.id}
                            className="focus-ring app-btn-secondary disabled:opacity-50"
                          >
                            {deleteBusyId === template.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AppPanel>

          {editingId ? (
            <AppPanel title="Edit template">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={editForm.name}
                  onChange={(event) => setEditForm((form) => ({ ...form, name: event.target.value }))}
                  placeholder="Template name"
                  className="app-input"
                />
                <input
                  value={editForm.description}
                  onChange={(event) => setEditForm((form) => ({ ...form, description: event.target.value }))}
                  placeholder="Description (optional)"
                  className="app-input"
                />
                <select
                  value={editForm.priority}
                  onChange={(event) => setEditForm((form) => ({ ...form, priority: event.target.value as "low" | "normal" | "high" }))}
                  className="app-input"
                >
                  <option value="low">Priority: Low</option>
                  <option value="normal">Priority: Normal</option>
                  <option value="high">Priority: High</option>
                </select>
                <input
                  value={editForm.labelsInput}
                  onChange={(event) => setEditForm((form) => ({ ...form, labelsInput: event.target.value }))}
                  placeholder="Labels (comma separated)"
                  className="app-input"
                />
                <input
                  value={editForm.tagsInput}
                  onChange={(event) => setEditForm((form) => ({ ...form, tagsInput: event.target.value }))}
                  placeholder="Tags (key: value, key2: value2)"
                  className="app-input md:col-span-2"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.sendEmails}
                    onChange={(event) => setEditForm((form) => ({ ...form, sendEmails: event.target.checked }))}
                  />
                  Send emails by default
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.requireRecipientIdentity}
                    onChange={(event) => setEditForm((form) => ({ ...form, requireRecipientIdentity: event.target.checked }))}
                  />
                  Require recipient identity
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.passwordEnabled}
                    onChange={(event) => setEditForm((form) => ({ ...form, passwordEnabled: event.target.checked }))}
                  />
                  Password enabled
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.maxAcknowledgersEnabled}
                    onChange={(event) => setEditForm((form) => ({ ...form, maxAcknowledgersEnabled: event.target.checked }))}
                  />
                  Limit acknowledgers
                </label>
                {editForm.maxAcknowledgersEnabled ? (
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={editForm.maxAcknowledgers}
                    onChange={(event) =>
                      setEditForm((form) => ({
                        ...form,
                        maxAcknowledgers: Math.max(1, Math.min(1000, Number(event.target.value) || 1)),
                      }))
                    }
                    className="app-input"
                  />
                ) : null}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  disabled={editSaving}
                  className="focus-ring app-btn-primary disabled:opacity-50"
                >
                  {editSaving ? "Saving…" : "Save template"}
                </button>
                <button type="button" onClick={cancelEdit} className="focus-ring app-btn-secondary">
                  Cancel
                </button>
              </div>
            </AppPanel>
          ) : null}
        </div>
      ) : null}
    </AppPage>
  );
}

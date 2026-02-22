"use client";

import { useEffect, useMemo, useState } from "react";
import { AppHero, AppPage, AppPanel } from "@/components/app/page-layout";
import { FeaturePaywall } from "@/components/app/feature-paywall";

type MeResponse = {
  primary_workspace_id?: string | null;
};

type WorkspaceContact = {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  source: "workspace_member" | "external";
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ContactGroupMember = {
  contact_id: string;
  name: string;
  email: string;
};

type ContactGroup = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  member_count: number;
  members: ContactGroupMember[];
  created_at: string;
  updated_at: string;
};

type ContactsResponse = {
  contacts: WorkspaceContact[];
};

type GroupsResponse = {
  groups: ContactGroup[];
  can_manage: boolean;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatUtc(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function ContactsPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState(false);

  const [contacts, setContacts] = useState<WorkspaceContact[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [canManageGroups, setCanManageGroups] = useState(false);

  const [contactQuery, setContactQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSaving, setContactSaving] = useState(false);

  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupContactSearch, setGroupContactSearch] = useState("");
  const [newGroupContactIds, setNewGroupContactIds] = useState<string[]>([]);
  const [groupSaving, setGroupSaving] = useState(false);

  const [memberEditorGroupId, setMemberEditorGroupId] = useState<string | null>(null);
  const [memberEditorSelection, setMemberEditorSelection] = useState<string[]>([]);
  const [memberEditorSaving, setMemberEditorSaving] = useState(false);
  const [contactDeleteBusyId, setContactDeleteBusyId] = useState<string | null>(null);
  const [groupDeleteBusyId, setGroupDeleteBusyId] = useState<string | null>(null);

  async function loadWorkspaceData(nextWorkspaceId: string) {
    const [contactsRes, groupsRes] = await Promise.all([
      fetch(`/api/app/workspaces/${encodeURIComponent(nextWorkspaceId)}/contacts?limit=500`, { cache: "no-store" }),
      fetch(`/api/app/workspaces/${encodeURIComponent(nextWorkspaceId)}/contact-groups?include_members=true&limit=200`, {
        cache: "no-store",
      }),
    ]);

    if (contactsRes.status === 403 || groupsRes.status === 403) {
      setPaywall(true);
      setContacts([]);
      setGroups([]);
      setCanManageGroups(false);
      return;
    }

    const contactsJson = (await contactsRes.json().catch(() => null)) as ContactsResponse | { error?: string } | null;
    const groupsJson = (await groupsRes.json().catch(() => null)) as GroupsResponse | { error?: string } | null;

    if (!contactsRes.ok) {
      throw new Error(contactsJson && "error" in contactsJson ? String(contactsJson.error) : "Failed to load contacts.");
    }
    if (!groupsRes.ok) {
      throw new Error(groupsJson && "error" in groupsJson ? String(groupsJson.error) : "Failed to load groups.");
    }

    setContacts(Array.isArray((contactsJson as ContactsResponse).contacts) ? (contactsJson as ContactsResponse).contacts : []);
    setGroups(Array.isArray((groupsJson as GroupsResponse).groups) ? (groupsJson as GroupsResponse).groups : []);
    setCanManageGroups((groupsJson as GroupsResponse).can_manage === true);
  }

  useEffect(() => {
    let active = true;

    async function load() {
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
          setContacts([]);
          setGroups([]);
          setCanManageGroups(false);
          return;
        }

        await loadWorkspaceData(nextWorkspaceId);
      } catch (loadError: unknown) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load contacts.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const activeGroup = useMemo(() => groups.find((group) => group.id === selectedGroupId) ?? null, [groups, selectedGroupId]);

  const filteredContacts = useMemo(() => {
    const needle = contactQuery.trim().toLowerCase();
    const groupMemberIds = activeGroup ? new Set(activeGroup.members.map((member) => member.contact_id)) : null;

    return contacts.filter((contact) => {
      if (groupMemberIds && !groupMemberIds.has(contact.id)) return false;
      if (!needle) return true;
      return `${contact.name} ${contact.email}`.toLowerCase().includes(needle);
    });
  }, [contacts, contactQuery, activeGroup]);

  const groupSearchOptions = useMemo(() => {
    const needle = groupContactSearch.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter((contact) => `${contact.name} ${contact.email}`.toLowerCase().includes(needle));
  }, [contacts, groupContactSearch]);

  function toggleNewGroupContact(contactId: string) {
    setNewGroupContactIds((current) =>
      current.includes(contactId) ? current.filter((id) => id !== contactId) : [...current, contactId]
    );
  }

  function beginMemberEdit(group: ContactGroup) {
    setMemberEditorGroupId(group.id);
    setMemberEditorSelection(group.members.map((member) => member.contact_id));
  }

  function toggleMemberEditorContact(contactId: string) {
    setMemberEditorSelection((current) =>
      current.includes(contactId) ? current.filter((id) => id !== contactId) : [...current, contactId]
    );
  }

  async function refresh() {
    if (!workspaceId) return;
    await loadWorkspaceData(workspaceId);
  }

  async function createContact() {
    if (!workspaceId || contactSaving) return;
    const name = contactName.trim();
    const email = contactEmail.trim().toLowerCase();

    if (!name) {
      setError("Contact name is required.");
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setError("Please enter a valid contact email.");
      return;
    }

    setContactSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceId)}/contacts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const json = (await res.json().catch(() => null)) as { contact?: WorkspaceContact; error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Failed to create contact.");

      if (json?.contact) {
        setContacts((current) => [json.contact!, ...current]);
      }
      setContactName("");
      setContactEmail("");
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : "Failed to create contact.");
    } finally {
      setContactSaving(false);
    }
  }

  async function deleteContact(contactId: string) {
    if (!workspaceId || contactDeleteBusyId) return;

    setContactDeleteBusyId(contactId);
    setError(null);
    try {
      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceId)}/contacts/${encodeURIComponent(contactId)}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete contact.");

      setContacts((current) => current.filter((contact) => contact.id !== contactId));
      setGroups((current) =>
        current.map((group) => ({
          ...group,
          members: group.members.filter((member) => member.contact_id !== contactId),
          member_count: group.members.filter((member) => member.contact_id !== contactId).length,
        }))
      );
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete contact.");
    } finally {
      setContactDeleteBusyId(null);
    }
  }

  async function createGroup() {
    if (!workspaceId || !canManageGroups || groupSaving) return;
    const name = groupName.trim();

    if (!name) {
      setError("Group name is required.");
      return;
    }

    setGroupSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceId)}/contact-groups`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description: groupDescription,
          contact_ids: newGroupContactIds,
        }),
      });
      const json = (await res.json().catch(() => null)) as { group?: ContactGroup; error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Failed to create contact group.");

      setGroupName("");
      setGroupDescription("");
      setNewGroupContactIds([]);
      await refresh();
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : "Failed to create contact group.");
    } finally {
      setGroupSaving(false);
    }
  }

  async function renameGroup(group: ContactGroup) {
    if (!workspaceId || !canManageGroups) return;
    const nextName = window.prompt("Rename group", group.name)?.trim();
    if (!nextName || nextName === group.name) return;

    setError(null);
    try {
      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceId)}/contact-groups/${encodeURIComponent(group.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      const json = (await res.json().catch(() => null)) as { group?: ContactGroup; error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Failed to rename group.");

      await refresh();
    } catch (renameError: unknown) {
      setError(renameError instanceof Error ? renameError.message : "Failed to rename group.");
    }
  }

  async function deleteGroup(groupId: string) {
    if (!workspaceId || !canManageGroups || groupDeleteBusyId) return;

    setGroupDeleteBusyId(groupId);
    setError(null);
    try {
      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceId)}/contact-groups/${encodeURIComponent(groupId)}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete group.");

      setGroups((current) => current.filter((group) => group.id !== groupId));
      if (selectedGroupId === groupId) setSelectedGroupId(null);
      if (memberEditorGroupId === groupId) setMemberEditorGroupId(null);
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete group.");
    } finally {
      setGroupDeleteBusyId(null);
    }
  }

  async function saveGroupMembers() {
    if (!workspaceId || !memberEditorGroupId || !canManageGroups || memberEditorSaving) return;

    setMemberEditorSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/app/workspaces/${encodeURIComponent(workspaceId)}/contact-groups/${encodeURIComponent(memberEditorGroupId)}/members`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contact_ids: memberEditorSelection }),
        }
      );
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Failed to update group members.");

      await refresh();
      setMemberEditorGroupId(null);
      setMemberEditorSelection([]);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update group members.");
    } finally {
      setMemberEditorSaving(false);
    }
  }

  const showWorkspaceRequired = !loading && !error && !workspaceId;

  return (
    <AppPage>
      <AppHero
        kicker="CONTACTS"
        title="Contacts"
        description="Workspace-shared recipients and groups for fast, deduplicated bulk sending."
      />

      {loading ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--card2)" }} />
          <div className="h-56 animate-pulse rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--card2)" }} />
        </div>
      ) : null}

      {!loading && paywall ? (
        <FeaturePaywall featureName="Contacts" detail="Contacts and groups are unlocked for Pro, Team, and Enterprise workspaces." />
      ) : null}

      {showWorkspaceRequired ? (
        <AppPanel title="Select an active workspace">
          <div className="app-subtle text-sm">
            Contacts and groups are workspace-scoped. Choose an active workspace from the top switcher, then refresh.
          </div>
        </AppPanel>
      ) : null}

      {!loading && !paywall && workspaceId ? (
        <div className="space-y-4">
          {error ? <div className="app-error">{error}</div> : null}

          <section
            className="rounded-2xl border p-5 md:p-6"
            style={{
              borderColor: "var(--border)",
              background:
                "radial-gradient(circle at 10% 0%, color-mix(in srgb, var(--fg) 14%, transparent), transparent 42%), linear-gradient(135deg, color-mix(in srgb, var(--card2) 72%, transparent), color-mix(in srgb, var(--card) 78%, transparent))",
            }}
          >
            <div className="flex items-start justify-between gap-3 flex-col md:flex-row">
              <div>
                <div className="text-xs font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>
                  GROUPS
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">+ New group</h2>
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                  Build recipient groups once, then target them in send flows with deduplicated expansion.
                </p>
              </div>
              {!canManageGroups ? (
                <div className="text-xs" style={{ color: "var(--muted2)" }}>
                  Group edits require owner/admin role.
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="Group name"
                className="app-input"
                disabled={!canManageGroups}
              />
              <input
                value={groupDescription}
                onChange={(event) => setGroupDescription(event.target.value)}
                placeholder="Description (optional)"
                className="app-input"
                disabled={!canManageGroups}
              />
              <input
                value={groupContactSearch}
                onChange={(event) => setGroupContactSearch(event.target.value)}
                placeholder="Search contacts to add"
                className="app-input md:col-span-2"
                disabled={!canManageGroups}
              />
            </div>

            <div className="mt-3 max-h-40 overflow-auto rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
              {groupSearchOptions.length === 0 ? (
                <div className="text-xs" style={{ color: "var(--muted2)" }}>
                  No contacts found.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                  {groupSearchOptions.map((contact) => (
                    <label key={contact.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newGroupContactIds.includes(contact.id)}
                        onChange={() => toggleNewGroupContact(contact.id)}
                        disabled={!canManageGroups}
                      />
                      <span className="truncate">{contact.name}</span>
                      <span className="truncate text-xs" style={{ color: "var(--muted2)" }}>
                        {contact.email}
                      </span>
                      <span className="truncate text-[11px]" style={{ color: "var(--muted2)" }}>
                        {contact.source === "workspace_member" ? "Member" : "External"}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs" style={{ color: "var(--muted2)" }}>
                {newGroupContactIds.length} contact{newGroupContactIds.length === 1 ? "" : "s"} selected
              </div>
              <button
                type="button"
                onClick={() => void createGroup()}
                disabled={!canManageGroups || groupSaving}
                className="focus-ring app-btn-primary disabled:opacity-50"
              >
                {groupSaving ? "Creating…" : "Create group"}
              </button>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <AppPanel title="Contacts" subtitle="Create and maintain workspace recipient records." className="xl:col-span-2">
              <div className="flex items-center gap-2">
                <input
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  placeholder="Name"
                  className="app-input"
                />
                <input
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="Email"
                  className="app-input"
                />
                <button
                  type="button"
                  onClick={() => void createContact()}
                  disabled={contactSaving}
                  className="focus-ring app-btn-primary disabled:opacity-50"
                >
                  {contactSaving ? "Adding…" : "Add"}
                </button>
              </div>

              <div className="mt-3">
                <input
                  value={contactQuery}
                  onChange={(event) => setContactQuery(event.target.value)}
                  placeholder="Search contacts"
                  className="app-input"
                />
              </div>

              <div className="mt-4 space-y-2">
                <div className="text-xs" style={{ color: "var(--muted2)" }}>
                  Workspace members are included automatically. External contacts can be added manually.
                </div>
                {filteredContacts.length === 0 ? (
                  <div className="app-empty">No contacts found.</div>
                ) : (
                  filteredContacts.map((contact) => (
                    <div key={contact.id} className="app-list-item p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{contact.name}</div>
                          <div className="text-xs truncate" style={{ color: "var(--muted2)" }}>
                            {contact.email}
                          </div>
                          <div className="text-[11px]" style={{ color: "var(--muted2)" }}>
                            {contact.source === "workspace_member" ? "Workspace member" : "External contact"}
                          </div>
                          <div className="text-[11px]" style={{ color: "var(--muted2)" }}>
                            Updated {formatUtc(contact.updated_at)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteContact(contact.id)}
                          disabled={contact.source === "workspace_member" || contactDeleteBusyId === contact.id}
                          className="focus-ring app-btn-secondary disabled:opacity-50"
                        >
                          {contact.source === "workspace_member"
                            ? "Managed"
                            : (contactDeleteBusyId === contact.id ? "Removing…" : "Delete")}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </AppPanel>

            <AppPanel title="Groups" subtitle="Filter contacts by group and manage membership.">
              <div className="space-y-2">
                {groups.length === 0 ? (
                  <div className="app-empty">No groups yet.</div>
                ) : (
                  groups.map((group) => {
                    const active = selectedGroupId === group.id;
                    return (
                      <div
                        key={group.id}
                        className="rounded-xl border p-3"
                        style={{
                          borderColor: active ? "var(--fg)" : "var(--border)",
                          background: active ? "color-mix(in srgb, var(--card2) 65%, transparent)" : "transparent",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedGroupId((current) => (current === group.id ? null : group.id))}
                          className="focus-ring w-full text-left"
                        >
                          <div className="text-sm font-semibold">{group.name}</div>
                          <div className="text-xs" style={{ color: "var(--muted2)" }}>
                            {group.member_count} member{group.member_count === 1 ? "" : "s"}
                          </div>
                        </button>
                        <div className="mt-2 flex items-center gap-2">
                          <button type="button" onClick={() => beginMemberEdit(group)} className="focus-ring app-btn-secondary">
                            View
                          </button>
                          {canManageGroups ? (
                            <>
                              <button type="button" onClick={() => void renameGroup(group)} className="focus-ring app-btn-secondary">
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteGroup(group.id)}
                                disabled={groupDeleteBusyId === group.id}
                                className="focus-ring app-btn-secondary disabled:opacity-50"
                              >
                                {groupDeleteBusyId === group.id ? "Deleting…" : "Delete"}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </AppPanel>
          </div>

          {memberEditorGroupId ? (
            <AppPanel title="Manage group members" subtitle="Replace the entire member set for this group.">
              <div className="max-h-56 overflow-auto rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                {contacts.length === 0 ? (
                  <div className="text-sm" style={{ color: "var(--muted2)" }}>
                    Create contacts first.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                    {contacts.map((contact) => (
                      <label key={contact.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={memberEditorSelection.includes(contact.id)}
                          onChange={() => toggleMemberEditorContact(contact.id)}
                          disabled={!canManageGroups}
                        />
                        <span className="truncate">{contact.name}</span>
                        <span className="truncate text-xs" style={{ color: "var(--muted2)" }}>
                          {contact.email}
                        </span>
                        <span className="truncate text-[11px]" style={{ color: "var(--muted2)" }}>
                          {contact.source === "workspace_member" ? "Member" : "External"}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void saveGroupMembers()}
                  disabled={!canManageGroups || memberEditorSaving}
                  className="focus-ring app-btn-primary disabled:opacity-50"
                >
                  {memberEditorSaving ? "Saving…" : "Save members"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMemberEditorGroupId(null);
                    setMemberEditorSelection([]);
                  }}
                  className="focus-ring app-btn-secondary"
                >
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

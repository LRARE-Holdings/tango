"use client";

import { useMemo, useState } from "react";

export type DocumentSourceType = "upload" | "google_drive" | "microsoft_graph";

type CloudSourceFields = {
  fileUrl: string;
  fileId: string;
  revisionId: string;
  accessToken?: string;
};

type PickerItem = {
  id: string;
  name: string;
  isFolder: boolean;
  mimeType: string | null;
  modifiedAt: string | null;
  downloadUrl: string | null;
};

function SourceButton({
  active,
  label,
  icon,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="focus-ring px-3 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
      style={{
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: active ? "var(--fg)" : "transparent",
        color: active ? "var(--bg)" : "var(--fg)",
      }}
    >
      <span className="inline-flex items-center gap-2">
        {icon ? <span className="inline-flex items-center">{icon}</span> : null}
        <span>{label}</span>
      </span>
    </button>
  );
}

function GoogleDriveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#0F9D58" d="M7.4 3h9.2l5.4 9.3h-9.2z" />
      <path fill="#DB4437" d="M7.4 3 2 12.3l4.6 8L12 11z" />
      <path fill="#F4B400" d="M12 20.3h9.2l4.6-8H16.6z" />
    </svg>
  );
}

function OneDriveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#0078D4"
        d="M10.6 8.1a5.2 5.2 0 0 1 9.2 2.7A4.4 4.4 0 0 1 19.6 19H8.1A4.1 4.1 0 0 1 7.9 11a5.3 5.3 0 0 1 2.7-2.9z"
      />
    </svg>
  );
}

export function DocumentSourceChooser({
  sourceType,
  onSourceTypeChange,
  cloud,
  onCloudChange,
  disabled,
}: {
  sourceType: DocumentSourceType;
  onSourceTypeChange: (next: DocumentSourceType) => void;
  cloud: CloudSourceFields;
  onCloudChange: (patch: Partial<CloudSourceFields>) => void;
  disabled?: boolean;
}) {
  const isCloud = sourceType !== "upload";
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
  const [pickerPath, setPickerPath] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: "Root" },
  ]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const providerLabel = sourceType === "google_drive" ? "Google Drive" : "OneDrive";
  const selectedFileSummary = useMemo(() => {
    if (!cloud.fileId && !cloud.fileUrl) return "No cloud file selected";
    const idShort = cloud.fileId ? cloud.fileId.slice(0, 16) : "manual";
    return `Selected file (${idShort}${cloud.fileId && cloud.fileId.length > 16 ? "…" : ""})`;
  }, [cloud.fileId, cloud.fileUrl]);

  function oauthStartPath(provider: DocumentSourceType) {
    if (provider === "google_drive") return "/api/app/cloud/google/start";
    return "/api/app/cloud/microsoft/start";
  }

  function openOAuthPopup(provider: DocumentSourceType): Promise<string> {
    return new Promise((resolve, reject) => {
      const popup = window.open(
        `${oauthStartPath(provider)}?origin=${encodeURIComponent(window.location.origin)}`,
        "receipt-cloud-auth",
        "width=560,height=720,menubar=no,toolbar=no,status=no"
      );
      if (!popup) {
        reject(new Error("Your browser blocked the auth popup."));
        return;
      }

      let done = false;
      const timer = window.setInterval(() => {
        if (!popup || popup.closed) {
          if (!done) {
            done = true;
            cleanup();
            reject(new Error("Authentication popup closed before completion."));
          }
        }
      }, 250);

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        const data = event.data as
          | { type?: string; provider?: DocumentSourceType; accessToken?: string; error?: string }
          | undefined;
        if (!data || data.type !== "receipt-cloud-picker-auth") return;
        if (data.provider !== provider) return;
        done = true;
        cleanup();
        popup.close();
        if (data.error) {
          reject(new Error(data.error));
          return;
        }
        if (!data.accessToken) {
          reject(new Error("Missing access token from provider."));
          return;
        }
        resolve(data.accessToken);
      };

      const cleanup = () => {
        window.clearInterval(timer);
        window.removeEventListener("message", onMessage);
      };

      window.addEventListener("message", onMessage);
    });
  }

  async function ensureCloudAuth(provider: DocumentSourceType) {
    if (cloud.accessToken) return cloud.accessToken;
    const token = await openOAuthPopup(provider);
    onCloudChange({ accessToken: token });
    return token;
  }

  function clearCloudSelection() {
    onCloudChange({
      fileUrl: "",
      fileId: "",
      revisionId: "",
      accessToken: "",
    });
  }

  function handleSourceSelect(next: DocumentSourceType) {
    if (next === sourceType) return;
    onSourceTypeChange(next);
    setPickerError(null);

    if (next === "upload") return;

    // Switching provider should reset stale token/file refs, then prompt auth immediately.
    clearCloudSelection();
    void openOAuthPopup(next)
      .then((token) => {
        onCloudChange({ accessToken: token });
      })
      .catch((e: unknown) => {
        setPickerError(e instanceof Error ? e.message : "Could not connect provider.");
      });
  }

  async function listGoogleFiles(token: string, folderId: string | null) {
    const q = folderId
      ? `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`
      : `'root' in parents and trashed = false`;
    const params = new URLSearchParams({
      q,
      fields: "files(id,name,mimeType,modifiedTime,size)",
      pageSize: "200",
      orderBy: "folder,name_natural",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json().catch(() => null)) as
      | { files?: Array<{ id: string; name: string; mimeType: string; modifiedTime?: string | null }> }
      | { error?: { message?: string } }
      | null;
    const errJson = json as { error?: { message?: string } } | null;
    if (!res.ok) throw new Error(errJson?.error?.message ?? "Failed to list Google Drive files.");

    const files = "files" in (json ?? {}) && Array.isArray((json as { files?: unknown }).files)
      ? ((json as { files: Array<{ id: string; name: string; mimeType: string; modifiedTime?: string | null }> }).files)
      : [];

    return files.map((f) => ({
      id: String(f.id),
      name: String(f.name || "Untitled"),
      isFolder: String(f.mimeType) === "application/vnd.google-apps.folder",
      mimeType: String(f.mimeType || ""),
      modifiedAt: f.modifiedTime ?? null,
      downloadUrl: null,
    }));
  }

  async function listMicrosoftFiles(token: string, folderId: string | null) {
    const base = folderId
      ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(folderId)}/children`
      : "https://graph.microsoft.com/v1.0/me/drive/root/children";
    const params = new URLSearchParams({
      $select: "id,name,file,folder,lastModifiedDateTime,@microsoft.graph.downloadUrl",
      $top: "200",
    });
    const res = await fetch(`${base}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json().catch(() => null)) as
      | {
          value?: Array<{
            id: string;
            name: string;
            file?: { mimeType?: string | null };
            folder?: { childCount?: number };
            lastModifiedDateTime?: string | null;
            "@microsoft.graph.downloadUrl"?: string | null;
          }>;
          error?: { message?: string };
        }
      | null;
    if (!res.ok) throw new Error(json?.error?.message ?? "Failed to list OneDrive files.");

    return (json?.value ?? []).map((f) => ({
      id: String(f.id),
      name: String(f.name || "Untitled"),
      isFolder: Boolean(f.folder),
      mimeType: f.file?.mimeType ?? null,
      modifiedAt: f.lastModifiedDateTime ?? null,
      downloadUrl: f["@microsoft.graph.downloadUrl"] ?? null,
    }));
  }

  async function openCloudBrowser() {
    setPickerError(null);
    setPickerOpen(true);
    setPickerPath([{ id: null, name: "Root" }]);

    const token = await ensureCloudAuth(sourceType).catch((e) => {
      setPickerError(e instanceof Error ? e.message : "Could not connect provider.");
      return null;
    });
    if (!token) return;

    setPickerLoading(true);
    try {
      const items =
        sourceType === "google_drive"
          ? await listGoogleFiles(token, null)
          : await listMicrosoftFiles(token, null);
      setPickerItems(items);
    } catch (e: unknown) {
      setPickerError(e instanceof Error ? e.message : "Could not load files.");
    } finally {
      setPickerLoading(false);
    }
  }

  async function openFolder(item: PickerItem) {
    if (!item.isFolder) return;
    setPickerError(null);
    setPickerLoading(true);
    try {
      const token = await ensureCloudAuth(sourceType);
      const items =
        sourceType === "google_drive"
          ? await listGoogleFiles(token, item.id)
          : await listMicrosoftFiles(token, item.id);
      setPickerItems(items);
      setPickerPath((prev) => [...prev, { id: item.id, name: item.name }]);
    } catch (e: unknown) {
      setPickerError(e instanceof Error ? e.message : "Could not open folder.");
    } finally {
      setPickerLoading(false);
    }
  }

  async function goToPathIndex(index: number) {
    const target = pickerPath[index];
    if (!target) return;
    setPickerError(null);
    setPickerLoading(true);
    try {
      const token = await ensureCloudAuth(sourceType);
      const items =
        sourceType === "google_drive"
          ? await listGoogleFiles(token, target.id)
          : await listMicrosoftFiles(token, target.id);
      setPickerItems(items);
      setPickerPath((prev) => prev.slice(0, index + 1));
    } catch (e: unknown) {
      setPickerError(e instanceof Error ? e.message : "Could not load folder.");
    } finally {
      setPickerLoading(false);
    }
  }

  async function chooseFile(item: PickerItem) {
    if (item.isFolder) {
      await openFolder(item);
      return;
    }
    if (item.mimeType !== "application/pdf") {
      setPickerError("Only PDF files can be imported.");
      return;
    }
    const token = await ensureCloudAuth(sourceType).catch(() => "");
    if (!token) return;

    if (sourceType === "google_drive") {
      onCloudChange({
        fileId: item.id,
        fileUrl: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.id)}?alt=media`,
        revisionId: item.modifiedAt ?? "",
        accessToken: token,
      });
    } else {
      onCloudChange({
        fileId: item.id,
        fileUrl:
          item.downloadUrl ??
          `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(item.id)}/content`,
        revisionId: item.modifiedAt ?? "",
        accessToken: token,
      });
    }

    setPickerOpen(false);
    setPickerError(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <SourceButton
          active={sourceType === "upload"}
          label="Upload PDF"
          onClick={() => handleSourceSelect("upload")}
          disabled={disabled}
        />
        <SourceButton
          active={sourceType === "google_drive"}
          label="Import from Google Drive"
          icon={<GoogleDriveIcon />}
          onClick={() => handleSourceSelect("google_drive")}
          disabled={disabled}
        />
        <SourceButton
          active={sourceType === "microsoft_graph"}
          label="Import from OneDrive"
          icon={<OneDriveIcon />}
          onClick={() => handleSourceSelect("microsoft_graph")}
          disabled={disabled}
        />
      </div>

      {isCloud ? (
        <div
          className="space-y-3 border p-4"
          style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card2)" }}
        >
          <div className="text-xs" style={{ color: "var(--muted2)" }}>
            {sourceType === "google_drive" ? "GOOGLE DRIVE SOURCE" : "ONEDRIVE SOURCE"}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                void ensureCloudAuth(sourceType).catch((e: unknown) =>
                  setPickerError(e instanceof Error ? e.message : "Could not connect provider.")
                );
              }}
              className="focus-ring rounded-full border px-3 py-1.5 text-xs hover:opacity-90 disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              {cloud.accessToken ? `Connected to ${providerLabel}` : `Connect ${providerLabel}`}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void openCloudBrowser()}
              className="focus-ring rounded-full border px-3 py-1.5 text-xs hover:opacity-90 disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              Browse {providerLabel}
            </button>
            <span className="text-xs" style={{ color: "var(--muted2)" }}>
              {selectedFileSummary}
            </span>
          </div>

          <input
            value={cloud.fileUrl}
            onChange={(e) => onCloudChange({ fileUrl: e.target.value })}
            placeholder="Direct PDF URL or signed provider download URL"
            disabled={disabled}
            className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "var(--border)", borderRadius: 10 }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              value={cloud.fileId}
              onChange={(e) => onCloudChange({ fileId: e.target.value })}
              placeholder="Provider file ID (optional)"
              disabled={disabled}
              className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
              style={{ borderColor: "var(--border)", borderRadius: 10 }}
            />
            <input
              value={cloud.revisionId}
              onChange={(e) => onCloudChange({ revisionId: e.target.value })}
              placeholder="Provider revision/version ID (optional)"
              disabled={disabled}
              className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
              style={{ borderColor: "var(--border)", borderRadius: 10 }}
            />
          </div>

          <div className="text-xs" style={{ color: "var(--muted2)" }}>
            Tip: Use Browse to pick files directly. Manual URL entry remains available.
          </div>

          {pickerError ? (
            <div className="text-sm" style={{ color: "#ff3b30" }}>
              {pickerError}
            </div>
          ) : null}
        </div>
      ) : null}

      {pickerOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "var(--bg)" }}>
          <div
            className="w-full max-w-3xl border p-4 md:p-5"
            style={{ borderColor: "var(--border)", borderRadius: 14, background: "var(--card)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                  {providerLabel.toUpperCase()} BROWSER
                </div>
                <div className="mt-1 text-sm font-semibold">Select a PDF</div>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="focus-ring rounded-full border px-3 py-1.5 text-xs hover:opacity-90"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                Close
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--muted2)" }}>
              {pickerPath.map((part, idx) => (
                <button
                  key={`${part.id ?? "root"}-${idx}`}
                  type="button"
                  onClick={() => void goToPathIndex(idx)}
                  className="focus-ring rounded-full border px-2.5 py-1 hover:opacity-90"
                  style={{ borderColor: "var(--border)" }}
                >
                  {part.name}
                </button>
              ))}
            </div>

            <div
              className="mt-3 max-h-[52vh] overflow-auto border"
              style={{ borderColor: "var(--border)", borderRadius: 10 }}
            >
              {pickerLoading ? (
                <div className="px-4 py-4 text-sm" style={{ color: "var(--muted)" }}>
                  Loading…
                </div>
              ) : pickerItems.length === 0 ? (
                <div className="px-4 py-4 text-sm" style={{ color: "var(--muted)" }}>
                  No files found in this folder.
                </div>
              ) : (
                pickerItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void chooseFile(item)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:opacity-90"
                    style={{ borderTop: "1px solid var(--border2)" }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {item.isFolder ? "📁 " : "📄 "}
                        {item.name}
                      </div>
                      <div className="mt-0.5 text-xs" style={{ color: "var(--muted2)" }}>
                        {item.isFolder
                          ? "Folder"
                          : item.mimeType === "application/pdf"
                            ? "PDF"
                            : item.mimeType || "File"}
                      </div>
                    </div>
                    <div className="text-xs" style={{ color: "var(--muted2)" }}>
                      {item.isFolder ? "Open" : "Select"}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

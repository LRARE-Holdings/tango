"use client";

export type DocumentSourceType = "upload" | "google_drive" | "microsoft_graph";

type CloudSourceFields = {
  fileUrl: string;
  fileId: string;
  revisionId: string;
};

function SourceButton({
  active,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
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
      {label}
    </button>
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <SourceButton
          active={sourceType === "upload"}
          label="Upload PDF"
          onClick={() => onSourceTypeChange("upload")}
          disabled={disabled}
        />
        <SourceButton
          active={sourceType === "google_drive"}
          label="Import from Google Drive"
          onClick={() => onSourceTypeChange("google_drive")}
          disabled={disabled}
        />
        <SourceButton
          active={sourceType === "microsoft_graph"}
          label="Import from OneDrive"
          onClick={() => onSourceTypeChange("microsoft_graph")}
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
        </div>
      ) : null}
    </div>
  );
}


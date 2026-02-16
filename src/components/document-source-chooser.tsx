"use client";

export type DocumentSourceType = "upload";

export function DocumentSourceChooser({
  sourceType,
  onSourceTypeChange,
  disabled,
}: {
  sourceType: DocumentSourceType;
  onSourceTypeChange: (next: DocumentSourceType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onSourceTypeChange("upload")}
        disabled={disabled}
        className="focus-ring px-3 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
        style={{
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: sourceType === "upload" ? "var(--fg)" : "transparent",
          color: sourceType === "upload" ? "var(--bg)" : "var(--fg)",
        }}
      >
        Upload File (PDF or DOCX)
      </button>
    </div>
  );
}

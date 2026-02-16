"use client";

import type { ReactNode } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function UiPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx("rounded-2xl border p-4 md:p-5", className)}
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      {children}
    </section>
  );
}

export function UiSectionCaption({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
      {children}
    </div>
  );
}

export function UiInput({
  value,
  onChange,
  placeholder,
  type = "text",
  accept,
  className,
}: {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  accept?: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      type={type}
      accept={accept}
      className={cx("focus-ring w-full rounded-xl border bg-transparent px-3 py-2 text-sm", className)}
      style={{ borderColor: "var(--border)" }}
    />
  );
}

export function UiButton({
  children,
  onClick,
  disabled,
  variant = "secondary",
  className,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
  type?: "button" | "submit";
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "focus-ring rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50",
        className
      )}
      style={
        isPrimary
          ? { background: "var(--fg)", color: "var(--bg)" }
          : { border: "1px solid var(--border)", color: "var(--muted)" }
      }
    >
      {children}
    </button>
  );
}

export function UiBadge({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs"
      style={
        active
          ? { background: "var(--fg)", color: "var(--bg)", borderColor: "transparent" }
          : { borderColor: "var(--border)", color: "var(--muted)" }
      }
    >
      {children}
    </span>
  );
}

export function UiModal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "var(--bg)" }}>
      <div
        className={cx("w-full max-w-2xl rounded-2xl border p-5 md:p-6", className)}
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        {children}
      </div>
    </div>
  );
}


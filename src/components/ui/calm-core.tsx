"use client";

import Link from "next/link";
import type { ReactNode } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function PageHeaderSimple({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-5 flex-wrap">
      <div>
        {eyebrow ? (
          <div className="text-xs font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>
            {eyebrow}
          </div>
        ) : null}
        <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2 flex-wrap">{actions}</div> : null}
    </div>
  );
}

export function EmptyStateSimple({
  title,
  body,
  ctaHref,
  ctaLabel,
  onCtaClick,
  hint,
}: {
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel: string;
  onCtaClick?: () => void;
  hint?: string;
}) {
  return (
    <div
      className="border p-8 text-center"
      style={{ borderColor: "var(--border)", borderRadius: 14, background: "var(--card)" }}
    >
      <div className="text-base font-semibold">{title}</div>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        {body}
      </p>
      <div className="mt-5">
        {onCtaClick ? (
          <button
            type="button"
            onClick={onCtaClick}
            className="focus-ring inline-flex items-center justify-center px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
          >
            {ctaLabel}
          </button>
        ) : (
          <Link
            href={ctaHref ?? "#"}
            className="focus-ring inline-flex items-center justify-center px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
          >
            {ctaLabel}
          </Link>
        )}
      </div>
      {hint ? (
        <div className="mt-3 text-xs" style={{ color: "var(--muted2)" }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function StatusDotLabel({
  tone,
  label,
}: {
  tone: "neutral" | "good" | "warn" | "bad";
  label: string;
}) {
  const dotBg =
    tone === "good"
      ? "#22c55e"
      : tone === "warn"
        ? "#f59e0b"
        : tone === "bad"
          ? "#ef4444"
          : "#9ca3af";
  const glow =
    tone === "good" ? "0 0 0 4px color-mix(in srgb, #22c55e 20%, transparent)" : "none";

  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium" style={{ color: "var(--muted)" }}>
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ background: dotBg, boxShadow: glow }}
      />
      {label}
    </span>
  );
}

export function ChecklistInline({
  title,
  items,
  onDismiss,
}: {
  title: string;
  items: Array<{ id: string; label: string; done: boolean }>;
  onDismiss?: () => void;
}) {
  return (
    <div className="border p-4" style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold">{title}</div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="focus-ring text-xs hover:opacity-80"
            style={{ color: "var(--muted)" }}
          >
            Dismiss
          </button>
        ) : null}
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className={cx("inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px]", item.done && "font-semibold")}
              style={{
                borderColor: item.done ? "transparent" : "var(--border)",
                background: item.done ? "var(--fg)" : "transparent",
                color: item.done ? "var(--bg)" : "var(--muted)",
              }}
            >
              {item.done ? "✓" : ""}
            </span>
            <span style={{ color: item.done ? "var(--fg)" : "var(--muted)" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionDisclosure({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="border rounded-xl p-4"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{title}</div>
            {summary ? (
              <div className="text-xs mt-1" style={{ color: "var(--muted2)" }}>
                {summary}
              </div>
            ) : null}
          </div>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Expand
          </span>
        </div>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function ActionRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function InlineNotice({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
      {children}
    </div>
  );
}

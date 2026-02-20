"use client";

import Link from "next/link";

export function SettingsCog({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Settings"
      className="focus-ring inline-flex h-12 w-12 items-center justify-center border transition"
      style={{
        borderColor: "var(--border)",
        borderRadius: 999,
        color: "var(--muted)",
        background: "color-mix(in srgb, var(--card2) 60%, #fff)",
      }}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
        <path d="M19.2 12a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.5 1a8 8 0 0 0-2-1.2l-.4-2.7h-4l-.4 2.7a8 8 0 0 0-2 1.2l-2.5-1-2 3.4 2 1.5A7.4 7.4 0 0 0 4.8 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.5-1a8 8 0 0 0 2 1.2l.4 2.7h4l.4-2.7a8 8 0 0 0 2-1.2l2.5 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
      </svg>
    </Link>
  );
}

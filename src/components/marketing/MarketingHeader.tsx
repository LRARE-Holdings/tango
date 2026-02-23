"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const NAV_ITEMS = [
  { href: "/product", label: "Product" },
  { href: "/use-cases", label: "Use cases" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
] as const;

export function MarketingHeader() {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (menuRef.current) {
      menuRef.current.open = false;
    }
  }, [pathname]);

  return (
    <header className="marketing-chrome sticky top-0 z-50 border-b">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-6">
        <details ref={menuRef} className="group relative justify-self-start">
          <summary className="focus-ring inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-[var(--mk-border)] bg-[var(--mk-surface)] text-[var(--mk-muted)]">
            <span className="sr-only">Open menu</span>
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </summary>
          <nav className="absolute left-0 mt-2 w-64 rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-3 shadow-[var(--mk-shadow-md)]">
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-xl px-3 py-2 text-sm text-[var(--mk-muted)] hover:bg-[var(--mk-surface-soft)] hover:text-[var(--mk-fg)]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </details>

        <Link href="/" className="mx-auto flex items-center justify-center">
          <div className="relative h-8 w-28 overflow-hidden">
            <Image
              src="/receipt-logo.svg"
              alt="Receipt"
              fill
              className="object-contain transition dark:invert"
              priority
            />
          </div>
        </Link>

        <div className="flex items-center justify-self-end gap-2">
          <Link
            href="/auth"
            className="rounded-[10px] px-3 py-2 text-sm font-medium text-[var(--mk-muted)] hover:bg-[var(--mk-surface-soft)] hover:text-[var(--mk-fg)]"
          >
            Log in
          </Link>
          <Link
            href="/get-started"
            className="focus-ring inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[var(--mk-border-strong)] bg-[var(--mk-surface)] px-3 text-[var(--mk-muted)] hover:border-[var(--mk-accent)] hover:text-[var(--mk-accent)]"
          >
            <span className="text-xs font-semibold tracking-wide">Start</span>
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}

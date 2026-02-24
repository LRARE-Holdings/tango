"use client";

import Link from "next/link";
import Image from "next/image";

function cx(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

export function PoweredByReceipt({
  className,
  invert = false,
}: {
  className?: string;
  invert?: boolean;
}) {
  return (
    <Link
      href="/"
      target="_blank"
      rel="noreferrer"
      className={cx(
        "focus-ring inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition hover:opacity-85",
        className
      )}
      style={
        invert
          ? { borderColor: "color-mix(in srgb, var(--bg) 30%, transparent)", color: "color-mix(in srgb, var(--bg) 84%, transparent)" }
          : { borderColor: "var(--border)", color: "var(--muted2)" }
      }
      aria-label="Powered by Receipt"
    >
      <span>Powered by</span>
      <Image src="/receipt-logo.svg" alt="Receipt" width={78} height={30} className="h-3 w-auto" />
    </Link>
  );
}

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="focus-ring rounded-full border px-3 py-1.5 text-xs tracking-wide transition hover:opacity-80"
      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
    >
      {children}
    </Link>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="mx-auto max-w-6xl px-6 pt-6">
        <div
          className="rounded-full border px-4 py-3 flex items-center justify-between"
          style={{
            borderColor: "var(--border)",
            background: "color-mix(in srgb, var(--bg) 70%, transparent)",
          }}
        >
          <div className="flex items-center gap-3">
            <Link href="/app" className="text-sm font-semibold tracking-tight">
              Receipt
            </Link>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              workspace
            </span>
          </div>

          <div className="flex items-center gap-2">
            <NavLink href="/">Home</NavLink>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-6 pb-10">
        <div
          className="border-t pt-6 flex items-center justify-between text-xs"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          <span>Receipt — Utility 001</span>
          <span style={{ color: "var(--muted2)" }}>LRARE</span>
        </div>
      </footer>
    </div>
  );
}
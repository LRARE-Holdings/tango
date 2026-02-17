import Image from "next/image";
import Link from "next/link";

export function MarketingHeader() {
  return (
    <header className="marketing-chrome sticky top-0 z-50 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center">
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

        {/* Primary nav */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="/product"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Product
          </Link>
          <Link
            href="/use-cases"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Use cases
          </Link>
          <Link
            href="/how-it-works"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            How it works
          </Link>
          <Link
            href="/pricing"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Pricing
          </Link>
          <Link
            href="/security"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Security
          </Link>
        </nav>

        {/* Auth actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/auth"
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900 sm:inline-flex"
          >
            Login
          </Link>
          <Link
            href="/app"
            className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-white dark:text-zinc-950"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

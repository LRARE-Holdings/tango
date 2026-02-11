import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="marketing-chrome border-t border-zinc-200 bg-white py-10 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          {/* Legal */}
          <div className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
            © {new Date().getFullYear()} LRARE Holdings Ltd. Registered Company
            no. 16807366.
          </div>

          {/* Sitemap */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-xs sm:grid-cols-4">
            <div>
              <div className="mb-2 font-semibold text-zinc-700 dark:text-zinc-300">Product</div>
              <ul className="space-y-1">
                <li>
                  <Link href="/product" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Product</Link>
                </li>
                <li>
                  <Link href="/how-it-works" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">How it works</Link>
                </li>
                <li>
                  <Link href="/pricing" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Pricing</Link>
                </li>
                <li>
                  <Link href="/security" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Security</Link>
                </li>
              </ul>
            </div>

            <div>
              <div className="mb-2 font-semibold text-zinc-700 dark:text-zinc-300">Company</div>
              <ul className="space-y-1">
                <li>
                  <Link href="/" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Home</Link>
                </li>
                <li>
                  <a href="https://lrare.co.uk" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">LRARE</a>
                </li>
                <li>
                  <Link href="/enterprise" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Enterprise</Link>
                </li>
              </ul>
            </div>

            <div>
              <div className="mb-2 font-semibold text-zinc-700 dark:text-zinc-300">Legal</div>
              <ul className="space-y-1">
                <li>
                  <Link href="/terms" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Terms</Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Privacy</Link>
                </li>
              </ul>
            </div>

            <div>
              <div className="mb-2 font-semibold text-zinc-700 dark:text-zinc-300">More</div>
              <ul className="space-y-1">
                <li>
                  <a href="https://status.getreceipt.xyz" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Status</a>
                </li>
                <li>
                  <Link href="/auth" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Login</Link>
                </li>
                <li>
                  <Link href="/app" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Get started</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

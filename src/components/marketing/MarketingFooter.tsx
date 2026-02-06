export function MarketingFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white py-10 dark:border-zinc-800 dark:bg-zinc-950">
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
                  <a href="/product" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Product</a>
                </li>
                <li>
                  <a href="/how-it-works" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">How it works</a>
                </li>
                <li>
                  <a href="/pricing" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Pricing</a>
                </li>
                <li>
                  <a href="/security" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Security</a>
                </li>
              </ul>
            </div>

            <div>
              <div className="mb-2 font-semibold text-zinc-700 dark:text-zinc-300">Company</div>
              <ul className="space-y-1">
                <li>
                  <a href="/" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Home</a>
                </li>
                <li>
                  <a href="/enterprise" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Enterprise</a>
                </li>
              </ul>
            </div>

            <div>
              <div className="mb-2 font-semibold text-zinc-700 dark:text-zinc-300">Legal</div>
              <ul className="space-y-1">
                <li>
                  <a href="/terms" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Terms</a>
                </li>
                <li>
                  <a href="/privacy" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Privacy</a>
                </li>
              </ul>
            </div>

            <div>
              <div className="mb-2 font-semibold text-zinc-700 dark:text-zinc-300">Account</div>
              <ul className="space-y-1">
                <li>
                  <a href="/login" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Login</a>
                </li>
                <li>
                  <a href="/app" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">Get started</a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
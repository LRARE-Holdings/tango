import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="marketing-chrome border-t py-10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          {/* Legal */}
          <div className="text-xs leading-relaxed text-[var(--mk-muted)]">
            © {new Date().getFullYear()} LRARE Holdings Ltd. Registered Company
            no. 16807366.
          </div>

          {/* Sitemap */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-xs sm:grid-cols-4">
            <div>
              <div className="mb-2 font-semibold text-[var(--mk-fg)]">
                Product
              </div>
              <ul className="space-y-1">
                <li>
                  <Link href="/product" className="marketing-link">
                    Product
                  </Link>
                </li>
                <li>
                  <Link href="/use-cases" className="marketing-link">
                    Use cases
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="marketing-link">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/security" className="marketing-link">
                    Security
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <div className="mb-2 font-semibold text-[var(--mk-fg)]">
                Company
              </div>
              <ul className="space-y-1">
                <li>
                  <Link href="/" className="marketing-link">
                    Home
                  </Link>
                </li>
                <li>
                  <a href="https://lrare.co.uk" className="marketing-link">
                    LRARE
                  </a>
                </li>
                <li>
                  <Link href="/enterprise" className="marketing-link">
                    Enterprise
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <div className="mb-2 font-semibold text-[var(--mk-fg)]">
                Legal
              </div>
              <ul className="space-y-1">
                <li>
                  <Link href="/terms" className="marketing-link">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="marketing-link">
                    Privacy
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <div className="mb-2 font-semibold text-[var(--mk-fg)]">More</div>
              <ul className="space-y-1">
                <li>
                  <a
                    href="https://status.getreceipt.xyz"
                    className="marketing-link"
                  >
                    Status
                  </a>
                </li>
                <li>
                  <Link href="/auth" className="marketing-link">
                    Login
                  </Link>
                </li>
                <li>
                  <Link href="/get-started" className="marketing-link">
                    Get started
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

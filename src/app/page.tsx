import { ThemeToggle } from "@/components/theme-toggle";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs tracking-wide"
      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
    >
      {children}
    </span>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-3xl border p-5 md:p-6 transition"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        {children}
      </div>
    </div>
  );
}

function ReceiptPreview() {
  return (
    <div
      className="rounded-3xl border overflow-hidden"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <div
        className="px-5 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <div className="text-sm font-semibold tracking-tight">Receipt Record</div>
            <div className="text-xs" style={{ color: "var(--muted2)" }}>
              example
            </div>
          </div>
          <span
            className="text-[11px] rounded-full border px-2 py-1"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            neutral evidence
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="space-y-1">
          <div className="text-xs" style={{ color: "var(--muted2)" }}>
            Document
          </div>
          <div className="text-sm font-medium">
            Client Care Letter — Residential Conveyancing
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-xs" style={{ color: "var(--muted2)" }}>
              Recipient
            </div>
            <div className="text-sm font-medium">Alex Smith</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              alex@client.com
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs" style={{ color: "var(--muted2)" }}>
              Acknowledged
            </div>
            <div className="text-sm font-medium">Yes</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              12 Feb 2026, 09:22
            </div>
          </div>
        </div>

        <div
          className="rounded-2xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--card2)" }}
        >
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs" style={{ color: "var(--muted2)" }}>
                First opened
              </div>
              <div className="text-sm font-medium">09:17</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: "var(--muted2)" }}>
                Scroll depth
              </div>
              <div className="text-sm font-medium">100%</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: "var(--muted2)" }}>
                Time on page
              </div>
              <div className="text-sm font-medium">4m 32s</div>
            </div>
          </div>
        </div>

        <div className="text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
          Receipt records access, review activity, and acknowledgement. It does not assess
          understanding and is not an e-signature product.
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen receipt-grid">
      {/* Top bar */}
      <header className="mx-auto max-w-6xl px-6 pt-6">
        <div
          className="rounded-full border px-4 py-3 flex items-center justify-between"
          style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg) 70%, transparent)" }}
        >
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold tracking-tight">Receipt</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              a utility by LRARE
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="#how"
              className="text-xs tracking-wide hover:opacity-80"
              style={{ color: "var(--muted)" }}
            >
              HOW IT WORKS
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div>
            <div className="flex flex-wrap gap-2">
              <Pill>No AI analysis</Pill>
              <Pill>Recipient = no account</Pill>
              <Pill>Neutral record</Pill>
            </div>

            <h1 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
              Proof your document was read —
              <span style={{ color: "var(--muted)" }}> without interpreting it.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed" style={{ color: "var(--muted)" }}>
              Receipt produces a clean record of delivery, access, review activity, and acknowledgement.
              Designed to sit neatly in the file.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <a
                href="/app"
                className="focus-ring inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium transition hover:opacity-90"
                style={{ background: "var(--fg)", color: "var(--bg)" }}
              >
                Open Receipt
              </a>
              <a
                href="#how"
                className="focus-ring inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium border transition hover:opacity-80"
                style={{ borderColor: "var(--border)" }}
              >
                See what it records
              </a>
            </div>

            <div className="mt-8 text-xs leading-relaxed max-w-xl" style={{ color: "var(--muted2)" }}>
              Receipt is not an e-signature tool and does not provide legal advice. It records observable
              events and an explicit acknowledgement.
            </div>
          </div>

          <div className="lg:pt-2">
            <ReceiptPreview />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Panel title="1. Share">
            Upload a PDF and send a single link to the recipient. No accounts required.
          </Panel>
          <Panel title="2. Review">
            Receipt records access and review activity (time and scroll depth) as the document is viewed.
          </Panel>
          <Panel title="3. Acknowledge">
            The recipient confirms review. Receipt produces a timestamped record you can keep on file.
          </Panel>
        </div>

        <div
          className="mt-6 rounded-3xl border p-6 md:p-8"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="text-xl font-semibold tracking-tight">What gets recorded</h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                Receipt stays neutral: it records timestamps, activity, and acknowledgement — not intent,
                consent, or understanding.
              </p>
            </div>

            <div
              className="rounded-2xl border p-4 text-xs leading-relaxed"
              style={{ borderColor: "var(--border)", background: "var(--card2)", color: "var(--muted)" }}
            >
              <div className="font-semibold" style={{ color: "var(--fg)" }}>Fields</div>
              <div className="mt-2 space-y-1">
                <div>• delivered_at / first_opened_at</div>
                <div>• max_scroll_percent</div>
                <div>• time_on_page_seconds</div>
                <div>• acknowledgement + submitted_at</div>
                <div>• (optional) ip + user_agent</div>
                <div>• document hash / version</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-6 pb-10">
        <div
          className="border-t pt-6 flex items-center justify-between text-xs"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          <span>© {new Date().getFullYear()} LRARE</span>
          <span>Utility 001</span>
        </div>
      </footer>
    </main>
  );
}
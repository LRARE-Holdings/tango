import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>

        <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          We’ve sent you a secure sign-in link.
          <br />
          Click the link to continue.
        </p>

        <p className="text-xs" style={{ color: "var(--muted2)" }}>
          You can close this tab once you’ve clicked the link.
        </p>

        <Link
          href="/"
          className="inline-block text-xs underline underline-offset-4"
          style={{ color: "var(--muted)" }}
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
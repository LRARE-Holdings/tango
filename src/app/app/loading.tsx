export default function AppRouteLoading() {
  return (
    <div className="space-y-5" aria-live="polite" aria-busy="true">
      <div
        className="h-36 animate-pulse rounded-2xl border"
        style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--card2) 55%, transparent)" }}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div
          className="h-64 animate-pulse rounded-2xl border lg:col-span-2"
          style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--card2) 55%, transparent)" }}
        />
        <div
          className="h-64 animate-pulse rounded-2xl border"
          style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--card2) 55%, transparent)" }}
        />
      </div>
      <div className="text-sm" style={{ color: "var(--muted)" }}>
        Preparing your page...
      </div>
    </div>
  );
}


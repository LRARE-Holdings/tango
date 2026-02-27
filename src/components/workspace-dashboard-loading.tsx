type WorkspaceDashboardLoadingProps = {
  label?: string;
};

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl ${className}`} style={{ background: "var(--app-surface-3)" }} />;
}

export function WorkspaceDashboardLoading({
  label = "Preparing your workspace dashboard",
}: WorkspaceDashboardLoadingProps) {
  return (
    <div className="space-y-5" aria-live="polite" aria-busy="true">
      <section className="app-content-card p-6 md:p-7 space-y-3">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-10 w-80 max-w-full" />
        <SkeletonBlock className="h-4 w-96 max-w-full" />
      </section>

      <div className="app-v2-stats-grid">
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
      </div>

      <section className="app-v2-dashboard-grid">
        <div className="app-v2-dashboard-main space-y-4">
          <SkeletonBlock className="h-64" />
          <SkeletonBlock className="h-64" />
        </div>
        <aside className="app-v2-dashboard-rail space-y-4">
          <SkeletonBlock className="h-44" />
          <SkeletonBlock className="h-56" />
          <SkeletonBlock className="h-36" />
        </aside>
      </section>

      <div className="text-sm" style={{ color: "var(--muted)" }}>
        {label}
      </div>
    </div>
  );
}

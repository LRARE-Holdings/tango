type WorkspaceDashboardLoadingProps = {
  label?: string;
};

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{ background: "color-mix(in srgb, var(--muted2) 24%, transparent)" }}
    />
  );
}

export function WorkspaceDashboardLoading({
  label = "Preparing your workspace dashboard",
}: WorkspaceDashboardLoadingProps) {
  return (
    <div className="space-y-6" aria-live="polite" aria-busy="true">
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-14 w-14" />
          <div className="space-y-2">
            <SkeletonBlock className="h-6 w-60" />
            <SkeletonBlock className="h-4 w-36" />
          </div>
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-10 w-24" />
          <SkeletonBlock className="h-10 w-24" />
          <SkeletonBlock className="h-10 w-28" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SkeletonBlock className="h-72" />
        <SkeletonBlock className="h-72" />
      </div>

      <div className="text-sm" style={{ color: "var(--muted)" }}>
        {label}
      </div>
    </div>
  );
}

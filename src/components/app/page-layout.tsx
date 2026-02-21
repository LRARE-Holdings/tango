import type { ReactNode } from "react";

export function AppPage({ children }: { children: ReactNode }) {
  return <div className="app-page">{children}</div>;
}

export function AppHero({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="app-content-card app-hero-card">
      {kicker ? <div className="app-section-kicker">{kicker}</div> : null}
      <h1 className="app-hero-title mt-3 text-4xl tracking-tight">{title}</h1>
      {description ? <p className="app-subtle mt-3 max-w-3xl text-sm">{description}</p> : null}
      {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
    </section>
  );
}

export function AppPanel({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`app-content-card p-5 ${className}`.trim()}>
      {title || actions ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            {title ? <div className="text-sm font-semibold">{title}</div> : null}
            {subtitle ? <div className="app-subtle mt-1 text-xs">{subtitle}</div> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={title || actions ? "mt-3" : ""}>{children}</div>
    </section>
  );
}


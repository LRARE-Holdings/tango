"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MenuItem = {
  href: string;
  label: string;
};

export function PlanMenu({
  items,
  vertical = false,
  collapsed = false,
  onNavigate,
}: {
  items: MenuItem[];
  vertical?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={vertical ? "app-sidebar-nav" : "app-nav-menu flex items-center gap-1"}
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const visibleLabel = collapsed ? item.label.charAt(0).toUpperCase() : item.label;

        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            data-active={active ? "true" : "false"}
            className={
              vertical
                ? `app-sidebar-link focus-ring ${collapsed ? "is-collapsed" : ""}`.trim()
                : "app-topbar-link focus-ring px-3.5 py-1.5 text-sm font-medium transition"
            }
            onClick={onNavigate}
          >
            {visibleLabel}
          </Link>
        );
      })}
    </nav>
  );
}

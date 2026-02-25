"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type MenuIcon = "home" | "send" | "files" | "templates" | "contacts" | "stacks" | "analytics";

type MenuItem = {
  href: string;
  label: string;
  icon?: MenuIcon;
};

function MenuIconGlyph({ icon }: { icon: MenuIcon }) {
  switch (icon) {
    case "home":
      return (
        <svg aria-hidden viewBox="0 0 24 24" className="app-sidebar-link-icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.8 12 3l9 7.8" />
          <path d="M6.5 9.8V21h11V9.8" />
        </svg>
      );
    case "send":
      return (
        <svg aria-hidden viewBox="0 0 24 24" className="app-sidebar-link-icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 11.8 17.8-8.3-4.5 17.8-3.6-6-9.7-3.5Z" />
          <path d="m12.7 15.4 8.1-11.9" />
        </svg>
      );
    case "files":
      return (
        <svg aria-hidden viewBox="0 0 24 24" className="app-sidebar-link-icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.8 7.3h6l2 2h8.4v9.9a1.8 1.8 0 0 1-1.8 1.8H5.6a1.8 1.8 0 0 1-1.8-1.8Z" />
          <path d="M3.8 7.3v-2a1.8 1.8 0 0 1 1.8-1.8h4.6l2 2h6.2a1.8 1.8 0 0 1 1.8 1.8v2" />
        </svg>
      );
    case "templates":
      return (
        <svg aria-hidden viewBox="0 0 24 24" className="app-sidebar-link-icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.8" y="4" width="16.4" height="16" rx="2" />
          <path d="M8 4v16M3.8 9.4h16.4" />
        </svg>
      );
    case "contacts":
      return (
        <svg aria-hidden viewBox="0 0 24 24" className="app-sidebar-link-icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15.8 19.5v-1.2a3.9 3.9 0 0 0-3.9-3.8H6.6a3.9 3.9 0 0 0-3.9 3.8v1.2" />
          <circle cx="9.3" cy="8.6" r="3.3" />
          <path d="M20.4 19.5v-1a3.1 3.1 0 0 0-2.5-3.1" />
          <path d="M15.8 5.6a3.1 3.1 0 0 1 0 6.1" />
        </svg>
      );
    case "stacks":
      return (
        <svg aria-hidden viewBox="0 0 24 24" className="app-sidebar-link-icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3.8 8.2 4.3L12 12.3 3.8 8.1 12 3.8Z" />
          <path d="m3.8 12.1 8.2 4.2 8.2-4.2" />
          <path d="m3.8 16 8.2 4.2 8.2-4.2" />
        </svg>
      );
    case "analytics":
      return (
        <svg aria-hidden viewBox="0 0 24 24" className="app-sidebar-link-icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20.2h16" />
          <path d="M7.3 20.2V11" />
          <path d="M12 20.2V6.2" />
          <path d="M16.7 20.2v-8.3" />
        </svg>
      );
  }
}

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
        const icon = item.icon;

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
            {vertical && icon ? (
              <>
                <MenuIconGlyph icon={icon} />
                {!collapsed ? <span className="app-sidebar-link-label">{item.label}</span> : <span className="sr-only">{item.label}</span>}
              </>
            ) : (
              item.label
            )}
          </Link>
        );
      })}
    </nav>
  );
}

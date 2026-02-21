"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MenuItem = {
  href: string;
  label: string;
};

export function PlanMenu({ items }: { items: MenuItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="app-nav-menu flex items-center gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active ? "true" : "false"}
            className="app-topbar-link focus-ring px-3.5 py-1.5 text-sm font-medium transition"
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

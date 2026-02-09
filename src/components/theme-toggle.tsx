"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  useEffect(() => {
    const stored = localStorage.getItem("receipt-theme");
    if (stored) return () => {};

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next: Theme = mql.matches ? "dark" : "light";
      document.documentElement.classList.toggle("dark", next === "dark");
      setTheme(next);
    };

    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("receipt-theme", next);
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      className="focus-ring rounded-full border px-3 py-1.5 text-xs tracking-wide transition hover:opacity-80"
      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {theme === "dark" ? "LIGHT" : "DARK"}
    </button>
  );
}

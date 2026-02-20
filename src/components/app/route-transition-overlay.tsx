"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const MIN_VISIBLE_MS = 260;

export function RouteTransitionOverlay() {
  const pathname = usePathname();
  const firstRenderRef = useRef(true);
  const currentPathRef = useRef(pathname);
  const startedAtRef = useRef(0);
  const hideTimerRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const showNow = useCallback(() => {
    if (!visible) setVisible(true);
    if (!startedAtRef.current) startedAtRef.current = Date.now();
  }, [visible]);

  const hideWithMinimumDelay = useCallback(() => {
    const elapsed = Date.now() - startedAtRef.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      startedAtRef.current = 0;
      hideTimerRef.current = null;
    }, wait);
  }, [clearHideTimer]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (!url.pathname.startsWith("/app")) return;
      const nextPath = `${url.pathname}${url.search}${url.hash}`;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextPath === currentPath) return;

      showNow();
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
    };
  }, [showNow]);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      currentPathRef.current = pathname;
      return;
    }
    if (pathname === currentPathRef.current) return;
    currentPathRef.current = pathname;
    if (startedAtRef.current) {
      hideWithMinimumDelay();
    }
  }, [pathname, hideWithMinimumDelay]);

  useEffect(() => {
    return () => {
      clearHideTimer();
    };
  }, [clearHideTimer]);

  return (
    <div
      aria-hidden={!visible}
      className="pointer-events-none fixed inset-0 z-[70] transition-opacity duration-200"
      style={{
        opacity: visible ? 1 : 0,
        background: "color-mix(in srgb, var(--bg) 84%, transparent)",
        backdropFilter: "blur(1.5px)",
      }}
    >
      <div className="flex h-full items-center justify-center">
        <div
          className="inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm"
          style={{
            borderColor: "var(--border)",
            background: "color-mix(in srgb, var(--card) 88%, transparent)",
            color: "var(--muted)",
          }}
        >
          <span
            className="inline-block h-2.5 w-2.5 animate-pulse rounded-full"
            style={{ background: "var(--fg)" }}
          />
          Loading
        </div>
      </div>
    </div>
  );
}

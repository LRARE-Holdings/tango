"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  createdAt: number;
};

type ToastContextValue = {
  push: (t: Omit<Toast, "id" | "createdAt">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, number>>({});

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current[id]) {
      window.clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (t: Omit<Toast, "id" | "createdAt">) => {
      const id = uid();
      const toast: Toast = { ...t, id, createdAt: Date.now() };
      setToasts((prev) => [toast, ...prev].slice(0, 5));

      timers.current[id] = window.setTimeout(() => remove(id), 3500);
    },
    [remove]
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");

  return {
    success: (title: string, description?: string) => ctx.push({ type: "success", title, description }),
    error: (title: string, description?: string) => ctx.push({ type: "error", title, description }),
    info: (title: string, description?: string) => ctx.push({ type: "info", title, description }),
  };
}

function ToastViewport({
  toasts,
  onClose,
}: {
  toasts: Toast[];
  onClose: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-5 right-5 z-50 w-85 max-w-[calc(100vw-40px)] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rounded-2xl border p-4 shadow-sm"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg)",
            color: "var(--fg)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Dot type={t.type} />
                <span className="truncate">{t.title}</span>
              </div>
              {t.description ? (
                <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                  {t.description}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => onClose(t.id)}
              className="focus-ring rounded-full border px-2.5 py-1 text-xs hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Dot({ type }: { type: ToastType }) {
  const bg =
    type === "success"
      ? "var(--fg)"
      : type === "error"
        ? "#ff3b30"
        : "var(--muted)";
  return <span className="inline-block h-2 w-2 rounded-full" style={{ background: bg }} />;
}
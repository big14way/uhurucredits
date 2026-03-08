"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

const EXPLORER = "https://sepolia.basescan.org/tx";

type ToastType = "success" | "error" | "pending";

interface ToastData {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  txHash?: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, message?: string, txHash?: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, toast.type === "pending" ? 60000 : 6000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  const colors = {
    success: {
      border: "rgba(16,185,129,0.25)",
      bg: "rgba(6,6,15,0.95)",
      icon: "✓",
      iconBg: "rgba(16,185,129,0.15)",
      iconColor: "#10b981",
      titleColor: "#d1fae5",
    },
    error: {
      border: "rgba(239,68,68,0.25)",
      bg: "rgba(6,6,15,0.95)",
      icon: "✕",
      iconBg: "rgba(239,68,68,0.12)",
      iconColor: "#ef4444",
      titleColor: "#fee2e2",
    },
    pending: {
      border: "rgba(251,191,36,0.2)",
      bg: "rgba(6,6,15,0.95)",
      icon: "…",
      iconBg: "rgba(251,191,36,0.1)",
      iconColor: "#fbbf24",
      titleColor: "#fef3c7",
    },
  }[toast.type];

  return (
    <div
      className="flex items-start gap-3 p-4 rounded-2xl shadow-2xl animate-slide-in"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        backdropFilter: "blur(20px)",
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${colors.border}`,
        minWidth: "300px",
        maxWidth: "380px",
      }}
    >
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
        style={{ background: colors.iconBg, color: colors.iconColor }}
      >
        {toast.type === "pending" ? (
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          colors.icon
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: colors.titleColor }}>{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{toast.message}</p>
        )}
        {toast.txHash && (
          <a
            href={`${EXPLORER}/${toast.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: "#2dd4bf" }}
          >
            View on BaseScan
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 1.5h7m0 0v7m0-7L1.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </a>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="text-gray-600 hover:text-gray-400 transition-colors shrink-0 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback((type: ToastType, title: string, message?: string, txHash?: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, type, title, message, txHash }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast stack */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 px-4 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

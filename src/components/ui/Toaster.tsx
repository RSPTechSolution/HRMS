"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Icon } from "./Icon";

type Toast = { id: number; message: string; leaving: boolean };
const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const toast = useCallback((message: string) => {
    const id = ++nextId.current;
    setToasts((t) => [...t, { id, message, leaving: false }]);
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x))), 3800);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.leaving ? " out" : ""}`}>
            <span className="t-ic"><Icon name="check" /></span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

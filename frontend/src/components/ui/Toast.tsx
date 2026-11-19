"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertOctagon, Info, X } from "lucide-react";
import { cn } from "@/lib/format";

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((p) => p.filter((i) => i.id !== id)), []);

  const push = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = Date.now() + Math.random();
      setItems((p) => [...p.slice(-3), { id, tone, message }]);
      setTimeout(() => dismiss(id), tone === "error" ? 6000 : 3500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-[70] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:bottom-4 lg:right-5 lg:items-end"
        aria-live="polite"
      >
        {items.map((i) => {
          const Icon = i.tone === "success" ? CheckCircle2 : i.tone === "error" ? AlertOctagon : Info;
          return (
            <div
              key={i.id}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-sm shadow-raised animate-rise-in"
            >
              <Icon
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  i.tone === "success" ? "text-ok" : i.tone === "error" ? "text-crit" : "text-info"
                )}
              />
              <span className="flex-1 font-medium text-ink">{i.message}</span>
              <button onClick={() => dismiss(i.id)} className="text-ink-3 hover:text-ink" aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

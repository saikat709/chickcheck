"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/format";

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-forest/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative w-full card shadow-pop animate-rise-in overflow-hidden", wide ? "max-w-4xl" : "max-w-lg")}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h3 className="text-sm font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm !px-1.5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  children,
  side = "right",
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: "left" | "right";
  className?: string;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[55] flex animate-fade-in" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-forest/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          "relative h-full shadow-pop",
          side === "right" ? "ml-auto animate-slide-in-right" : "mr-auto animate-slide-in-left",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

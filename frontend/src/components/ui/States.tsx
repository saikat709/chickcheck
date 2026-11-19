import React from "react";
import { cn } from "@/lib/format";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "neutral" | "ok" | "error";
  className?: string;
}) {
  const toneCls = tone === "ok" ? "bg-ok-soft text-ok" : tone === "error" ? "bg-crit-soft text-crit" : "bg-surface-2 text-ink-3";
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      {Icon && (
        <span className={cn("mb-3 grid h-11 w-11 place-items-center rounded-2xl", toneCls)}>
          <Icon className="h-5 w-5" />
        </span>
      )}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-3">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

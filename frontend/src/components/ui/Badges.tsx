"use client";

import React from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn, FlockStatus, normalizeSeverity, normalizeStatus } from "@/lib/format";
import { useLanguage } from "@/lib/LanguageContext";

const STATUS_STYLE: Record<FlockStatus, { cls: string; icon: typeof CheckCircle2; key: "status_healthy" | "status_watch" | "status_alert" }> = {
  healthy: { cls: "bg-ok-soft text-ok ring-ok/25", icon: CheckCircle2, key: "status_healthy" },
  watch: { cls: "bg-warn-soft text-warn ring-warn/30", icon: AlertTriangle, key: "status_watch" },
  alert: { cls: "bg-crit-soft text-crit ring-crit/30", icon: AlertOctagon, key: "status_alert" },
};

/** Status is never colour-alone: icon + label always accompany it. */
export function StatusPill({ status, size = "sm", className }: { status?: string; size?: "sm" | "md"; className?: string }) {
  const { t } = useLanguage();
  const s = STATUS_STYLE[normalizeStatus(status)];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold ring-1 ring-inset",
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]",
        s.cls,
        className
      )}
    >
      <Icon className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {t(s.key)}
    </span>
  );
}

const SEV_STYLE = {
  critical: { cls: "bg-crit-soft text-crit ring-crit/30", icon: AlertOctagon, key: "alert_severity_critical" as const },
  warning: { cls: "bg-warn-soft text-warn ring-warn/30", icon: AlertTriangle, key: "alert_severity_warning" as const },
  info: { cls: "bg-info-soft text-info ring-info/25", icon: Info, key: "alert_severity_info" as const },
};

export function severityMeta(sev?: string) {
  return SEV_STYLE[normalizeSeverity(sev)];
}

export function SeverityBadge({ severity, className }: { severity?: string; className?: string }) {
  const { t } = useLanguage();
  const s = severityMeta(severity);
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold ring-1 ring-inset", s.cls, className)}>
      <Icon className="h-3 w-3" />
      {t(s.key)}
    </span>
  );
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-2 ring-1 ring-inset ring-line", className)}>
      {children}
    </span>
  );
}

/** Animated live dot — pulses only when the signal is actually live. */
export function LiveDot({ state }: { state: "live" | "pending" | "down" }) {
  const color = state === "live" ? "bg-ok" : state === "pending" ? "bg-warn" : "bg-crit";
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {state === "live" && <span className={cn("absolute inset-0 rounded-full animate-pulse-ring", color)} />}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", color)} />
    </span>
  );
}

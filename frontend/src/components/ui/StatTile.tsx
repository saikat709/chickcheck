import React from "react";
import Link from "next/link";
import { cn } from "@/lib/format";

/**
 * KPI tile. Value wears ink colours (never the status colour); state is
 * carried by the small icon chip + the caption text.
 */
export function StatTile({
  label,
  value,
  unit,
  suffix,
  caption,
  icon: Icon,
  tone = "neutral",
  meter,
  href,
  loading,
  className,
  stale,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  suffix?: React.ReactNode;
  caption?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "ok" | "warn" | "crit" | "info";
  /** 0–100 progress bar */
  meter?: number;
  href?: string;
  loading?: boolean;
  className?: string;
  /** Value is not live (offline / reconnecting): dim it so it cannot pass as current. */
  stale?: boolean;
}) {
  const toneChip = {
    neutral: "bg-surface-2 text-ink-2",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    crit: "bg-crit-soft text-crit",
    info: "bg-info-soft text-info",
  }[tone];
  const toneBar = { neutral: "bg-ink-3", ok: "bg-ok", warn: "bg-warn", crit: "bg-crit", info: "bg-info" }[tone];

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-ink-2 leading-snug">{label}</span>
        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", toneChip)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      {loading ? (
        <div className="mt-3 space-y-2">
          <div className="skeleton h-7 w-20" />
          <div className="skeleton h-3 w-28" />
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-1.5 tabular">
            <span className="text-[22px] font-extrabold leading-none tracking-tight text-ink sm:text-[26px]">{value}</span>
            {suffix && <span className="text-sm font-semibold text-ink-3">{suffix}</span>}
            {unit && <span className="text-xs font-medium text-ink-3">{unit}</span>}
          </div>
          {meter !== undefined && (
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden>
              <div className={cn("h-full rounded-full transition-all duration-700", toneBar)} style={{ width: `${Math.max(2, Math.min(100, meter))}%` }} />
            </div>
          )}
          {caption && <p className="mt-2 truncate text-xs text-ink-3">{caption}</p>}
        </>
      )}
    </>
  );

  const cls = cn(
    "card flex min-h-[104px] flex-col justify-between p-3 min-[375px]:p-3.5 sm:min-h-[118px] sm:p-4",
    stale && "[&_.tabular]:opacity-50 [&_.tabular]:grayscale",
    className
  );
  return href ? (
    <Link href={href} className={cn(cls, "transition-all hover:-translate-y-0.5 hover:shadow-raised hover:border-line-strong")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

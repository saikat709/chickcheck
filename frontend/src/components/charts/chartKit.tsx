"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "@/lib/ThemeContext";
import { useLanguage } from "@/lib/LanguageContext";

/** Resolve design tokens to concrete colours (SVG attributes can't use var()). */
export function useChartColors() {
  const { theme } = useTheme();
  const read = () => {
    if (typeof window === "undefined") return null;
    const cs = getComputedStyle(document.documentElement);
    const v = (n: string) => `rgb(${cs.getPropertyValue(`--${n}`).trim().split(/\s+/).join(",")})`;
    return {
      series1: v("series-1"),
      series2: v("series-2"),
      brand: v("brand"),
      grid: v("line"),
      axis: v("ink-3"),
      surface: v("surface"),
      ink: v("ink"),
    };
  };
  const [colors, setColors] = useState(() => ({
    series1: "#2E7D4F",
    series2: "#5A6FD0",
    brand: "#2E7D4F",
    grid: "#E7DFCE",
    axis: "#687165",
    surface: "#FFFFFF",
    ink: "#1B251E",
  }));
  useEffect(() => {
    const c = read();
    if (c) setColors(c);
  }, [theme]);
  return colors;
}

interface TooltipPayload {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
}

/** Tokenised tooltip: values in ink, identity carried by the colour swatch. */
export function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  unit?: string;
}) {
  const { num } = useLanguage();
  if (!active || !payload || payload.length === 0) return null;
  const fmt = (v: number | string | undefined) =>
    typeof v === "number" ? num(v, Number.isInteger(v) ? 0 : v < 10 ? 2 : 1) : v;
  return (
    <div className="min-w-[150px] rounded-xl border border-line bg-surface px-3 py-2.5 text-xs shadow-raised">
      <div className="mb-1.5 font-semibold text-ink-2 tabular">{label}</div>
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-2">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-bold text-ink tabular">
              {fmt(p.value)}
              {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
      <span className="h-[3px] w-3.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

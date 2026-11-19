"use client";

import React from "react";
import { cn } from "@/lib/format";

/** Segmented control — for mutually exclusive views / ranges. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "sm",
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex items-center rounded-xl bg-surface-2 p-0.5 ring-1 ring-inset ring-line">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-[10px] font-semibold transition-all",
              size === "md" ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-xs",
              active ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-ink-3 hover:text-ink"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Accessible switch built on a real checkbox. */
export function Switch({
  checked,
  onChange,
  id,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
  label?: string;
}) {
  return (
    <label className="relative inline-flex cursor-pointer items-center" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-label={label}
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="h-6 w-11 rounded-full bg-line-strong transition-colors peer-checked:bg-brand peer-focus-visible:ring-4 peer-focus-visible:ring-brand/25" />
      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
    </label>
  );
}

/** Settings row: title + description on the left, control on the right. */
export function SettingRow({
  title,
  description,
  children,
  htmlFor,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
          {title}
        </label>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

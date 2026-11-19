import React from "react";
import { cn } from "@/lib/format";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section";
}

export function Card({ className, as: Tag = "section", ...rest }: CardProps) {
  return <Tag className={cn("card", className)} {...rest} />;
}

interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, icon: Icon, actions, className }: CardHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 pt-4 sm:pt-5", className)}>
      <div className="flex items-start gap-2.5 min-w-0">
        {Icon && (
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold leading-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 sm:px-5 pb-4 sm:pb-5 pt-4", className)} {...rest} />;
}

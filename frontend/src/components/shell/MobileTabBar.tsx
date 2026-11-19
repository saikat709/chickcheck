"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Video, LineChart, BellRing, Menu } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useLiveData } from "@/lib/LiveDataContext";
import { isActive } from "./navigation";
import { cn } from "@/lib/format";
import type { TranslationKey } from "@/lib/translations";

const TABS: { href: string; key: TranslationKey; icon: typeof Video; badge?: boolean }[] = [
  { href: "/", key: "nav_dashboard", icon: LayoutDashboard },
  { href: "/live", key: "nav_live", icon: Video },
  { href: "/analytics", key: "nav_analytics", icon: LineChart },
  { href: "/events", key: "nav_events", icon: BellRing, badge: true },
];

/** Bottom navigation for phones & tablets (< lg). Reports/Settings live under "More". */
export function MobileTabBar({ onMore, moreActive }: { onMore: () => void; moreActive: boolean }) {
  const pathname = usePathname();
  const { t, num } = useLanguage();
  const { openAlerts, openAlertsCapped } = useLiveData();

  const itemCls = (active: boolean) =>
    cn(
      "relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold transition-colors",
      active ? "text-brand" : "text-ink-3 active:text-ink"
    );

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex flex-1">
              <Link href={tab.href} aria-current={active ? "page" : undefined} className={itemCls(active)}>
                {active && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-brand" />}
                <span className="relative">
                  <Icon className="h-[22px] w-[22px]" />
                  {tab.badge && openAlerts > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-crit px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-surface tabular">
                      {openAlertsCapped || openAlerts > 99 ? `${num(99)}+` : num(openAlerts)}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{t(tab.key)}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <button onClick={onMore} className={itemCls(moreActive)} aria-haspopup="dialog">
            {moreActive && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-brand" />}
            <Menu className="h-[22px] w-[22px]" />
            <span>{t("nav_more")}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, ShieldAlert } from "lucide-react";
import { LogoMark } from "./Logo";
import { NAV, isActive } from "./navigation";
import { useLanguage } from "@/lib/LanguageContext";
import { useLiveData, useCameraState } from "@/lib/LiveDataContext";
import { LiveDot } from "@/components/ui/Badges";
import { cn } from "@/lib/format";

export function SidebarContent({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t, num } = useLanguage();
  const { openAlerts, openAlertsCapped, stats } = useLiveData();
  const camera = useCameraState();

  const cameraLabel =
    camera === "live"
      ? t("status_live")
      : camera === "connecting"
      ? t("status_connecting")
      : camera === "stale"
      ? t("status_reconnecting")
      : t("status_offline");

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden bg-forest text-[#E8EFE6]"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="bg-sidebar-texture pointer-events-none absolute inset-0" aria-hidden />

      {/* Brand */}
      <div className={cn("relative flex h-16 items-center gap-3 border-b border-white/[0.07]", collapsed ? "justify-center px-2" : "px-5")}>
        <Link href="/" onClick={onNavigate} className="flex items-center gap-3 min-w-0" aria-label="Khamar Prohori">
          <LogoMark className="h-9 w-9 shrink-0" />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="text-[15px] font-extrabold tracking-tight text-white">{t("app_title")}</div>
              <div className="text-[11px] font-medium text-[#A9C2AF]">{t("app_tagline")}</div>
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="relative flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        {NAV.map((group) => (
          <div key={group.key} className="mb-5 last:mb-0">
            {!collapsed ? (
              <div className="mb-1.5 px-2.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#7FA08A]">{t(group.key)}</div>
            ) : (
              <div className="mx-auto mb-2 h-px w-6 bg-white/10" />
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                const badge = item.badge === "alerts" && openAlerts > 0 ? (openAlertsCapped ? `${num(200)}+` : num(openAlerts)) : null;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? t(item.key) : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150",
                        collapsed ? "h-10 justify-center" : "h-11 px-2.5 lg:h-10",
                        active ? "bg-white/[0.11] text-white" : "text-[#BFD0C3] hover:bg-white/[0.06] hover:text-white"
                      )}
                    >
                      {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#7CCB98]" />}
                      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-[#9BDDB2]" : "text-[#93AF9B] group-hover:text-white")} />
                      {!collapsed && <span className="truncate">{t(item.key)}</span>}
                      {badge &&
                        (collapsed ? (
                          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#F0675F] ring-2 ring-forest" />
                        ) : (
                          <span className="ml-auto rounded-full bg-[#F0675F] px-1.5 py-px text-[10.5px] font-bold text-white tabular">{badge}</span>
                        ))}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: camera status + disclaimer */}
      <div className="relative border-t border-white/[0.07] p-3">
        {!collapsed ? (
          <div className="rounded-xl bg-white/[0.05] p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <LiveDot state={camera === "live" ? "live" : camera === "offline" ? "down" : "pending"} />
              <span className="capitalize">{t("metric_camera")} · {cameraLabel}</span>
            </div>
            <div className="mt-1 text-[11px] capitalize text-[#A9C2AF]">
              {t("hero_species")}: {stats.species}
            </div>
            <div className="mt-2.5 flex items-start gap-1.5 border-t border-white/[0.07] pt-2.5 text-[10.5px] leading-snug text-[#A9C2AF]">
              <ShieldAlert className="mt-px h-3 w-3 shrink-0 text-[#E3B56B]" />
              <span>{t("disclaimer_short")}</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-1" title={`${t("metric_camera")} · ${cameraLabel}`}>
            <LiveDot state={camera === "live" ? "live" : camera === "offline" ? "down" : "pending"} />
          </div>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={cn(
              "mt-2 flex h-8 w-full items-center gap-2 rounded-lg text-xs font-medium text-[#93AF9B] transition-colors hover:bg-white/[0.06] hover:text-white",
              collapsed ? "justify-center" : "px-2.5"
            )}
            aria-label={collapsed ? t("nav_expand") : t("nav_collapse")}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            {!collapsed && <span>{t("nav_collapse")}</span>}
          </button>
        )}
      </div>
    </div>
  );
}

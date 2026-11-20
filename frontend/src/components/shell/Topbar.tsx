"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Moon, Sun } from "lucide-react";
import { titleKeyFor } from "./navigation";
import { LogoMark } from "./Logo";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
import { useLiveData, useCameraState } from "@/lib/LiveDataContext";
import { LiveDot } from "@/components/ui/Badges";
import { cn } from "@/lib/format";

export function Topbar() {
  const pathname = usePathname();
  const { t, language, setLanguage, num } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { openAlerts, openAlertsCapped, stats } = useLiveData();
  const camera = useCameraState();

  const statusLabel =
    camera === "live"
      ? t("status_live")
      : camera === "connecting"
      ? t("status_connecting")
      : camera === "stale"
      ? t("status_reconnecting")
      : t("status_offline");

  return (
    <header
      className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex h-14 items-center gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
        {/* Mobile/tablet: brand + current page (navigation lives in the bottom tab bar) */}
        <Link href="/" className="shrink-0 lg:hidden" aria-label="Khamar Prohori">
          <LogoMark className="h-8 w-8" />
        </Link>
        <div className="min-w-0 flex-1 lg:flex-none">
          <div className="truncate text-[15px] font-bold text-ink lg:text-sm">{t(titleKeyFor(pathname))}</div>
        </div>
        {/* Mobile: compact live indicator */}
        <span
          className="grid h-11 w-8 shrink-0 place-items-center sm:hidden"
          role="img"
          aria-label={`${t("metric_camera")}: ${statusLabel}`}
          title={statusLabel}
        >
          <LiveDot state={camera === "live" ? "live" : camera === "offline" ? "down" : "pending"} />
        </span>

        <div className="flex shrink-0 items-center gap-1 sm:ml-auto sm:gap-2">
          {/* Real stream status (was hard-coded "Live" before) */}
          <div
            className={cn(
              "hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold sm:flex",
              camera === "live" ? "border-ok/25 bg-ok-soft text-ok" : camera === "offline" ? "border-crit/25 bg-crit-soft text-crit" : "border-warn/25 bg-warn-soft text-warn"
            )}
            title={`${t("metric_pipeline_fps")}: ${num(stats.fps, 1)}`}
          >
            <LiveDot state={camera === "live" ? "live" : camera === "offline" ? "down" : "pending"} />
            <span>{statusLabel}</span>
            {camera === "live" && stats.fps > 0 && <span className="font-medium opacity-70 tabular">· {num(stats.fps, 1)} fps</span>}
          </div>

          <Link
            href="/events?status=open"
            className="btn btn-ghost relative !h-11 !w-11 !px-0 sm:!h-9 sm:!w-9"
            aria-label={`${t("notifications")}: ${openAlerts} ${t("unacked_alerts")}`}
            title={`${openAlerts}${openAlertsCapped ? "+" : ""} ${t("unacked_alerts")}`}
          >
            <Bell className="h-[18px] w-[18px]" />
            {openAlerts > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-crit px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-canvas tabular">
                {openAlertsCapped || openAlerts > 99 ? `${num(99)}+` : num(openAlerts)}
              </span>
            )}
          </Link>

          {/* EN | বাংলা */}
          <div className="flex items-center rounded-xl bg-surface-2 p-0.5 ring-1 ring-inset ring-line" role="radiogroup" aria-label={t("lang_label")}>
            {(["en", "bn"] as const).map((l) => (
              <button
                key={l}
                role="radio"
                aria-checked={language === l}
                onClick={() => setLanguage(l)}
                className={cn(
                  "min-h-[36px] rounded-[10px] px-2 py-1 text-xs font-bold transition-all sm:min-h-0 sm:px-2.5",
                  language === l ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-ink-3 hover:text-ink"
                )}
              >
                {l === "en" ? "EN" : "বাংলা"}
              </button>
            ))}
          </div>

          <button
            onClick={toggleTheme}
            className="btn btn-ghost hidden !h-9 !px-2 sm:inline-flex"
            aria-label={theme === "dark" ? t("theme_light") : t("theme_dark")}
            title={theme === "dark" ? t("theme_light") : t("theme_dark")}
          >
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>
    </header>
  );
}

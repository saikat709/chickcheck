"use client";

import React, { useEffect, useState } from "react";
import { WifiOff, RefreshCw, Download, X, Share, PlusSquare, Smartphone, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { usePwa } from "@/lib/PwaContext";
import { useLiveData } from "@/lib/LiveDataContext";
import { Modal } from "@/components/ui/Overlay";
import { cn } from "@/lib/format";

/** Short local time of the last received metrics, e.g. "14:02" / "১৪:০২". */
export function useLastReceivedLabel() {
  const { language } = useLanguage();
  const { lastReceivedAt } = useLiveData();
  if (!lastReceivedAt) return "—";
  const d = new Date(lastReceivedAt);
  const sameDay = d.toDateString() === new Date().toDateString();
  return d.toLocaleString(language === "bn" ? "bn-BD" : "en-GB", {
    ...(sameDay ? {} : { day: "numeric", month: "short" }),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/**
 * Offline / reconnecting notice. Never lets cached or stale metrics pass as live:
 * it states when data was last received and offers an explicit reconnect.
 */
export function ConnectivityBanner() {
  const { t } = useLanguage();
  const { online } = usePwa();
  const { connection, hasStats, isLive, reconnect, fromCache } = useLiveData();
  const time = useLastReceivedLabel();
  // Give the SSE a moment on first load before calling it a problem.
  const [grace, setGrace] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setGrace(false), 6000);
    return () => clearTimeout(id);
  }, []);

  const offline = !online;
  const stale = !offline && hasStats && !isLive && (fromCache || connection === "reconnecting") && !grace;
  if (!offline && !stale) return null;

  return (
    <div
      role="status"
      className={cn(
        "relative flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5 text-sm sm:px-6 lg:px-8",
        offline ? "border-crit/20 bg-crit-soft text-crit" : "border-warn/25 bg-warn-soft text-warn"
      )}
    >
      {offline ? <WifiOff className="h-4 w-4 shrink-0" /> : <RefreshCw className="h-4 w-4 shrink-0 animate-spin [animation-duration:2s]" />}
      <div className="min-w-0 flex-1">
        {offline && <span className="font-semibold">{t("offline_title")}. </span>}
        <span className="text-ink-2">
          {offline
            ? hasStats
              ? t("offline_stale", undefined, { time })
              : t("offline_desc")
            : t("reconnecting_stale", undefined, { time })}
        </span>
      </div>
      <button onClick={() => (offline ? window.location.reload() : reconnect())} className="btn btn-sm btn-secondary">
        <RefreshCw className="h-3.5 w-3.5" />
        {t("retry_connection")}
      </button>
    </div>
  );
}

/** "New version ready" — the operator decides when to reload. */
export function UpdateBar() {
  const { t } = useLanguage();
  const { updateReady, applyUpdate } = usePwa();
  if (!updateReady) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-info/20 bg-info-soft px-4 py-2.5 text-sm text-ink-2 sm:px-6 lg:px-8" role="status">
      <Sparkles className="h-4 w-4 shrink-0 text-info" />
      <span className="flex-1">{t("update_ready")}</span>
      <button onClick={applyUpdate} className="btn btn-sm btn-primary">
        <RefreshCw className="h-3.5 w-3.5" />
        {t("update_reload")}
      </button>
    </div>
  );
}

export function IosInstallSteps() {
  const { t } = useLanguage();
  const steps = [
    { icon: Share, text: t("install_ios_step1") },
    { icon: PlusSquare, text: t("install_ios_step2") },
    { icon: Smartphone, text: t("install_ios_step3") },
  ];
  return (
    <div>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <s.icon className="h-4 w-4" />
            </span>
            <span className="pt-1.5 text-sm text-ink">{s.text}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">{t("install_ios_note")}</p>
    </div>
  );
}

const DISMISS_KEY = "chickcheck_install_dismissed_at";
const VISITS_KEY = "chickcheck_visits";
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Install invitation. Shown at most once per 30 days, only from the second
 * visit on (after the operator has actually used the app), never when installed.
 */
export function InstallPrompt() {
  const { t } = useLanguage();
  const { standalone, isIOS, canPromptInstall, promptInstall } = usePwa();
  const [eligible, setEligible] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);

  useEffect(() => {
    try {
      // Count one visit per browser session.
      let n = Number(localStorage.getItem(VISITS_KEY) || "0");
      if (!sessionStorage.getItem("cc_counted")) {
        n += 1;
        localStorage.setItem(VISITS_KEY, String(n));
        sessionStorage.setItem("cc_counted", "1");
      }
      const dismissed = Number(localStorage.getItem(DISMISS_KEY) || "0");
      setEligible(n >= 2 && Date.now() - dismissed > SNOOZE_MS);
    } catch {
      setEligible(false);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setEligible(false);
  };

  const iosSafari = isIOS && !standalone;
  if (standalone || !eligible || !(canPromptInstall || iosSafari)) return null;

  return (
    <>
      <div
        className="fixed inset-x-3 z-40 mx-auto max-w-md animate-rise-in rounded-2xl border border-line bg-surface p-3.5 shadow-pop lg:inset-x-auto lg:bottom-5 lg:right-5"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)" }}
        role="dialog"
        aria-label={t("install_title")}
      >
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-ink">{t("install_title")}</div>
            <p className="mt-0.5 text-xs text-ink-3">{t("install_desc")}</p>
          </div>
          <button onClick={dismiss} className="btn btn-ghost !h-9 !w-9 !p-0" aria-label={t("install_later")}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={dismiss} className="btn btn-ghost btn-sm">
            {t("install_later")}
          </button>
          {canPromptInstall ? (
            <button
              onClick={async () => {
                const r = await promptInstall();
                if (r !== "accepted") dismiss();
              }}
              className="btn btn-primary btn-sm"
            >
              <Download className="h-3.5 w-3.5" />
              {t("install_button")}
            </button>
          ) : (
            <button onClick={() => setIosOpen(true)} className="btn btn-primary btn-sm">
              <Share className="h-3.5 w-3.5" />
              {t("install_how")}
            </button>
          )}
        </div>
      </div>
      <Modal open={iosOpen} onClose={() => setIosOpen(false)} title={t("install_ios_title")}>
        <IosInstallSteps />
      </Modal>
    </>
  );
}

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BellRing, BellOff, Send, Smartphone, Info } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { usePwa } from "@/lib/PwaContext";
import { useToast } from "@/components/ui/Toast";
import { Segmented } from "@/components/ui/Controls";
import { fetchPushPublicKey, pushStatus, pushSubscribe, pushTest, pushUnsubscribe, PushSeverity } from "@/lib/api";
import { cn } from "@/lib/format";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Support = "checking" | "ok" | "unsupported" | "ios-install" | "dev" | "server-off";

/**
 * Per-device web push opt-in. Permission is requested only when the operator
 * presses "Enable notifications" (never on page load).
 */
export function PushSettings() {
  const { t } = useLanguage();
  const { registration, isIOS, standalone } = usePwa();
  const toast = useToast();
  const [support, setSupport] = useState<Support>("checking");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [level, setLevel] = useState<PushSeverity>("critical");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);

  // Capability + server + existing subscription check
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hasApis = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!hasApis) {
        setSupport(isIOS && !standalone ? "ios-install" : "unsupported");
        return;
      }
      setPermission(Notification.permission);
      if (process.env.NODE_ENV !== "production") {
        setSupport("dev");
        return;
      }
      try {
        const cfg = await fetchPushPublicKey();
        if (cancelled) return;
        if (!cfg.enabled || !cfg.public_key) {
          setSupport("server-off");
          return;
        }
        setPublicKey(cfg.public_key);
        setSupport("ok");
      } catch {
        if (!cancelled) setSupport("server-off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isIOS, standalone]);

  useEffect(() => {
    if (support !== "ok" || !registration) return;
    registration.pushManager.getSubscription().then(async (sub) => {
      setSubscription(sub);
      if (sub) {
        const st = await pushStatus(sub.endpoint).catch(() => null);
        if (st?.min_severity) setLevel(st.min_severity);
        // Browser still subscribed but server forgot (e.g. DB reset): re-register silently.
        if (st && !st.subscribed) await pushSubscribe(sub.toJSON(), level).catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [support, registration]);

  const enable = useCallback(async () => {
    if (!registration || !publicKey) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission(); // ← only on explicit user action
      setPermission(perm);
      if (perm !== "granted") return;
      const sub =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      await pushSubscribe(sub.toJSON(), level);
      setSubscription(sub);
      toast(t("push_enabled_toast"));
    } catch {
      toast(t("push_error"), "error");
    } finally {
      setBusy(false);
    }
  }, [registration, publicKey, level, toast, t]);

  const disable = useCallback(async () => {
    if (!subscription) return;
    setBusy(true);
    try {
      await pushUnsubscribe(subscription.endpoint).catch(() => {});
      await subscription.unsubscribe();
      setSubscription(null);
      toast(t("push_disabled_toast"));
    } catch {
      toast(t("push_error"), "error");
    } finally {
      setBusy(false);
    }
  }, [subscription, toast, t]);

  const changeLevel = async (v: PushSeverity) => {
    setLevel(v);
    if (!subscription) return;
    try {
      await pushSubscribe(subscription.toJSON(), v);
    } catch {
      toast(t("push_error"), "error");
    }
  };

  const test = async () => {
    if (!subscription) return;
    setBusy(true);
    try {
      const r = await pushTest(subscription.endpoint);
      if (r.success) toast(t("push_test_sent"));
      else toast(`${t("push_error")}: ${r.error ?? ""}`, "error");
    } catch (e) {
      toast(`${t("push_error")}: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const on = Boolean(subscription) && permission === "granted";
  const notice =
    support === "unsupported"
      ? t("push_unsupported")
      : support === "ios-install"
      ? t("push_ios_install")
      : support === "dev"
      ? t("push_dev")
      : support === "server-off"
      ? t("push_server_off")
      : permission === "denied"
      ? t("push_denied")
      : null;

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", on ? "bg-ok-soft text-ok" : "bg-surface-2 text-ink-3")}>
            <Smartphone className="h-4 w-4" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
              {t("push_title")}
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset",
                  on ? "bg-ok-soft text-ok ring-ok/25" : "bg-surface-2 text-ink-3 ring-line"
                )}
              >
                {on ? t("push_on") : t("push_off")}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink-3">{t("push_desc")}</p>
          </div>
        </div>
      </div>

      {notice ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-ink-2">
          <Info className="mt-px h-3.5 w-3.5 shrink-0 text-info" />
          {notice}
        </p>
      ) : support === "ok" ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-semibold text-ink-2">{t("push_level")}</span>
            <div className="overflow-x-auto">
              <Segmented<PushSeverity>
                value={level}
                onChange={changeLevel}
                ariaLabel={t("push_level")}
                options={[
                  { value: "critical", label: t("push_level_critical") },
                  { value: "warning", label: t("push_level_warning") },
                  { value: "info", label: t("push_level_info") },
                ]}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {on ? (
              <>
                <button type="button" onClick={test} disabled={busy} className="btn btn-secondary btn-sm">
                  <Send className="h-3.5 w-3.5" />
                  {t("push_test")}
                </button>
                <button type="button" onClick={disable} disabled={busy} className="btn btn-ghost btn-sm">
                  <BellOff className="h-3.5 w-3.5" />
                  {t("push_disable")}
                </button>
              </>
            ) : (
              <button type="button" onClick={enable} disabled={busy} className="btn btn-primary btn-sm">
                <BellRing className="h-3.5 w-3.5" />
                {t("push_enable")}
              </button>
            )}
          </div>
          <p className="text-[11px] text-ink-3">{t("push_quiet_note")}</p>
        </div>
      ) : null}
    </div>
  );
}

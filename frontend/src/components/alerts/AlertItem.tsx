"use client";

import React, { useState } from "react";
import { Check, Image as ImageIcon, Play, ThumbsDown, ThumbsUp, Bird } from "lucide-react";
import { AlertEvent } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageContext";
import { useLiveData } from "@/lib/LiveDataContext";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Overlay";
import { Chip, SeverityBadge } from "@/components/ui/Badges";
import { cn, formatTime, normalizeSeverity, ruleKey, timeAgo } from "@/lib/format";

export function AlertItem({
  event,
  variant = "full",
  onChange,
}: {
  event: AlertEvent;
  variant?: "compact" | "full";
  /** Lets a page-local list mirror the change (the shared context updates itself). */
  onChange?: (patch: Partial<AlertEvent>) => void;
}) {
  const { t, language, num } = useLanguage();
  const { acknowledge, sendFeedback } = useLiveData();
  const toast = useToast();
  const [busy, setBusy] = useState<null | "ack" | "fb">(null);
  const [evidence, setEvidence] = useState<null | "snapshot" | "clip">(null);

  const compact = variant === "compact";
  const ruleLabel = t(ruleKey(event.alert_type), event.title);

  const doAck = async () => {
    setBusy("ack");
    try {
      await acknowledge(event.event_id);
      onChange?.({ acknowledged: true });
      toast(t("alert_ack_success"));
    } catch {
      toast(t("alert_ack_error"), "error");
    } finally {
      setBusy(null);
    }
  };

  const doFeedback = async (fb: "correct" | "false_alarm") => {
    setBusy("fb");
    try {
      await sendFeedback(event.event_id, fb);
      onChange?.({ feedback: fb });
      toast(t("alert_feedback_thank_you"));
    } catch {
      toast(t("alert_feedback_error"), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <article
      className={cn(
        "group relative flex gap-3 transition-colors",
        compact ? "px-4 py-3 sm:px-5" : "px-4 py-4 sm:px-5",
        event.acknowledged ? "bg-transparent" : "hover:bg-surface-2/60"
      )}
    >
      {/* severity rail */}
      <span
        className={cn(
          "mt-1 w-1 shrink-0 self-stretch rounded-full",
          event.acknowledged ? "bg-line" : { critical: "bg-crit", warning: "bg-warn", info: "bg-info" }[normalizeSeverity(event.severity)]
        )}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <SeverityBadge severity={event.severity} />
          {event.animal_id !== null && event.animal_id !== undefined && (
            <Chip>
              <Bird className="h-3 w-3" />#{event.animal_id}
            </Chip>
          )}
          <time className="text-[11px] text-ink-3 tabular" dateTime={event.timestamp} title={formatTime(event.timestamp, language, true)}>
            {compact ? timeAgo(event.timestamp, language) : formatTime(event.timestamp, language, true)}
          </time>
          {event.acknowledged && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-ok">
              <Check className="h-3 w-3" />
              {t("alert_acked")}
            </span>
          )}
        </div>

        <h3 className={cn("mt-1.5 font-semibold leading-snug", compact ? "text-[13px]" : "text-sm", event.acknowledged ? "text-ink-2" : "text-ink")}>
          {ruleLabel}
        </h3>
        <p className={cn("mt-0.5 text-xs leading-relaxed text-ink-3", compact && "line-clamp-2")}>{event.description}</p>

        {/* Actions */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          {event.snapshot_path && (
            <button onClick={() => setEvidence("snapshot")} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
              <ImageIcon className="h-3.5 w-3.5" />
              {t("alert_snapshot")}
            </button>
          )}
          {event.clip_path && (
            <button onClick={() => setEvidence("clip")} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
              <Play className="h-3.5 w-3.5" />
              {t("alert_clip")}
            </button>
          )}
          {!compact && event.confidence > 0 && (
            <span className="text-[11px] text-ink-3 tabular">
              {t("alert_confidence")}: {num(event.confidence * 100)}%
            </span>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {event.feedback ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-[11px] font-semibold text-ink-2 ring-1 ring-inset ring-line">
                {event.feedback === "correct" ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                {event.feedback === "correct" ? t("alert_feedback_correct") : t("alert_feedback_false")}
              </span>
            ) : (
              <>
                {!compact && <span className="mr-0.5 text-[11px] text-ink-3">{t("alert_feedback_title")}</span>}
                <button
                  onClick={() => doFeedback("correct")}
                  disabled={busy !== null}
                  className="btn btn-sm btn-secondary !h-7 !gap-1 !px-2 !text-[11px]"
                  title={t("alert_feedback_correct")}
                  aria-label={t("alert_feedback_correct")}
                >
                  <ThumbsUp className="h-3 w-3 text-ok" />
                  {!compact && t("alert_feedback_correct")}
                </button>
                <button
                  onClick={() => doFeedback("false_alarm")}
                  disabled={busy !== null}
                  className="btn btn-sm btn-secondary !h-7 !gap-1 !px-2 !text-[11px]"
                  title={t("alert_feedback_false")}
                  aria-label={t("alert_feedback_false")}
                >
                  <ThumbsDown className="h-3 w-3 text-ink-3" />
                  {!compact && t("alert_feedback_false")}
                </button>
              </>
            )}
            {!event.acknowledged && (
              <button onClick={doAck} disabled={busy !== null} className="btn btn-sm btn-primary !h-7 !px-2.5 !text-[11px]">
                <Check className="h-3 w-3" />
                {busy === "ack" ? "…" : t("alert_ack_button")}
              </button>
            )}
          </div>
        </div>
      </div>

      <Modal open={evidence !== null} onClose={() => setEvidence(null)} title={`${ruleLabel} · ${t("alert_evidence")}`} wide>
        <div className="overflow-hidden rounded-xl bg-black">
          {evidence === "snapshot" && event.snapshot_path && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/data/${event.snapshot_path}`} alt={ruleLabel} className="max-h-[70vh] w-full object-contain" />
          )}
          {evidence === "clip" && event.clip_path && (
            <video src={`/data/${event.clip_path}`} controls autoPlay className="max-h-[70vh] w-full" />
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-3">
          <SeverityBadge severity={event.severity} />
          <span>{formatTime(event.timestamp, language, true)}</span>
          <span>·</span>
          <span>{event.description}</span>
        </div>
      </Modal>
    </article>
  );
}

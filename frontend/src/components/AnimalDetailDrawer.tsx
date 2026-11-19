"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Activity, Clock, Navigation, AlertOctagon } from "lucide-react";
import { LineChart, Line, Tooltip, ResponsiveContainer, YAxis } from "recharts";
import { AnimalDetail, fetchAnimalDetail } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageContext";
import { Drawer } from "@/components/ui/Overlay";
import { StatusPill, SeverityBadge } from "@/components/ui/Badges";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { useChartColors, ChartTooltip } from "@/components/charts/chartKit";
import { cn, formatTime, normalizeStatus, ruleKey } from "@/lib/format";

interface AnimalDetailDrawerProps {
  animalId: number | null;
  onClose: () => void;
}

export function AnimalDetailDrawer({ animalId, onClose }: AnimalDetailDrawerProps) {
  const { t, language, num } = useLanguage();
  const colors = useChartColors();
  const [detail, setDetail] = useState<AnimalDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (animalId === null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchAnimalDetail(animalId)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [animalId]);

  // Motion trail canvas (HiDPI aware)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!detail || !canvas || !detail.trail?.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const xs = detail.trail.map((p) => p[0]);
    const ys = detail.trail.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanX = Math.max(10, Math.max(...xs) - minX);
    const spanY = Math.max(10, Math.max(...ys) - minY);
    const pad = 18;
    const scale = Math.min((cssW - pad * 2) / spanX, (cssH - pad * 2) / spanY);
    const ox = (cssW - spanX * scale) / 2;
    const oy = (cssH - spanY * scale) / 2;
    const color = { alert: "#F0675F", watch: "#E9A342", healthy: "#7CCB98" }[normalizeStatus(detail.status)];

    // faint grid
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx < cssW; gx += 24) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, cssH);
      ctx.stroke();
    }
    for (let gy = 0; gy < cssH; gy += 24) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(cssW, gy);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    detail.trail.forEach((pt, i) => {
      const px = ox + (pt[0] - minX) * scale;
      const py = oy + (pt[1] - minY) * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    const last = detail.trail[detail.trail.length - 1];
    ctx.beginPath();
    ctx.arc(ox + (last[0] - minX) * scale, oy + (last[1] - minY) * scale, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }, [detail]);

  return (
    <Drawer open={animalId !== null} onClose={onClose} className="w-[440px] max-w-[100vw]">
      <div className="flex h-full flex-col bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <div className="eyebrow">{t("drawer_profile")}</div>
            <h2 className="mt-0.5 text-xl font-extrabold tracking-tight text-ink tabular">
              {t("table_col_id")} #{animalId}
            </h2>
          </div>
          <button onClick={onClose} className="btn btn-ghost !h-9 !px-2" aria-label={t("drawer_close")}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {error ? (
            <EmptyState icon={AlertOctagon} tone="error" title={t("drawer_error")} />
          ) : loading || !detail ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl bg-surface-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-2">{t("table_col_health")}</span>
                  <StatusPill status={detail.status} />
                </div>
                <div className="mt-1 text-3xl font-extrabold text-ink tabular">
                  {num(detail.health_score)} <span className="text-sm font-semibold text-ink-3">/ {num(100)}</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={cn("h-full rounded-full", { alert: "bg-crit", watch: "bg-warn", healthy: "bg-ok" }[normalizeStatus(detail.status)])}
                    style={{ width: `${Math.max(4, detail.health_score)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Activity, label: t("table_col_speed"), value: num(detail.last_speed_norm, 2), unit: "bl/s" },
                  { icon: Clock, label: t("table_col_idle"), value: num(detail.total_idle_seconds), unit: t("seconds_short") },
                  { icon: Navigation, label: t("drawer_distance"), value: num(detail.total_distance_px), unit: "px" },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl border border-line p-3">
                    <div className="flex items-center gap-1 text-[11px] text-ink-3">
                      <m.icon className="h-3 w-3" />
                      <span className="truncate">{m.label}</span>
                    </div>
                    <div className="mt-1 text-base font-bold text-ink tabular">
                      {m.value} <span className="text-[11px] font-medium text-ink-3">{m.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              <section>
                <h3 className="eyebrow mb-2">{t("drawer_trail")}</h3>
                <div className="overflow-hidden rounded-xl bg-[#0E1812] ring-1 ring-line">
                  {detail.trail?.length ? (
                    <canvas ref={canvasRef} className="block h-44 w-full" />
                  ) : (
                    <div className="grid h-44 place-items-center text-xs text-[#93AF9B]">—</div>
                  )}
                </div>
              </section>

              {detail.speed_history?.length > 0 && (
                <section>
                  <h3 className="eyebrow mb-2">{t("drawer_speed")}</h3>
                  <div className="h-28 rounded-xl border border-line p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={detail.speed_history.map((s) => ({ ...s, speed_norm: Math.round(s.speed_norm * 100) / 100 }))}>
                        <YAxis hide domain={[0, "auto"]} />
                        <Tooltip content={<ChartTooltip unit=" bl/s" />} />
                        <Line type="monotone" dataKey="speed_norm" name={t("table_col_speed")} stroke={colors.series1} strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

              <section>
                <h3 className="eyebrow mb-2">
                  {t("drawer_incidents")} ({num(detail.events.length)})
                </h3>
                {detail.events.length === 0 ? (
                  <p className="rounded-xl bg-surface-2 p-3 text-xs text-ink-3">{t("drawer_no_incidents")}</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.events.map((e) => (
                      <li key={e.event_id || e.id} className="rounded-xl border border-line p-3">
                        <div className="flex items-center gap-2">
                          <SeverityBadge severity={e.severity} />
                          <span className="text-[11px] text-ink-3 tabular">{formatTime(e.timestamp, language, true)}</span>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-ink">{t(ruleKey(e.alert_type), e.title)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>

        <div className="border-t border-line p-4">
          <button onClick={onClose} className="btn btn-secondary w-full">
            {t("drawer_close")}
          </button>
        </div>
      </div>
    </Drawer>
  );
}

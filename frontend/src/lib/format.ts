import type { LiveStats } from "./api";
import type { TranslationKey } from "./translations";

export type Severity = "critical" | "warning" | "info";
export type FlockStatus = "healthy" | "watch" | "alert";

export const ALERT_TYPES = [
  "panic_movement",
  "crowding_huddling",
  "count_drop",
  "low_flock_activity",
  "feeding_deviation",
  "camera_fault",
  "immobile_bird_candidate",
  "prolonged_inactivity",
  "sudden_stop",
  "fallen_posture",
  "isolation",
  "limping_gait",
] as const;

export function ruleKey(alertType: string): TranslationKey {
  return `rule_${alertType}` as TranslationKey;
}

export function normalizeSeverity(s: string | undefined): Severity {
  const v = (s || "").toLowerCase();
  return v === "critical" ? "critical" : v === "warning" ? "warning" : "info";
}

export function normalizeStatus(s: string | undefined): FlockStatus {
  const v = (s || "").toLowerCase();
  return v === "alert" ? "alert" : v === "watch" ? "watch" : "healthy";
}

/** Honest count display: density estimate with ± uncertainty when available. */
export function countDisplay(stats: LiveStats): { value: string; uncertainty: number | null } {
  if (stats.density_count !== undefined && stats.density_count !== null && stats.density_count > 0) {
    return { value: String(stats.density_count), uncertainty: stats.uncertainty || 0 };
  }
  return { value: String(stats.count ?? 0), uncertainty: null };
}

export function activityValue(stats: LiveStats): number {
  const v = stats.optical_flow_activity ?? stats.activity_index ?? 0;
  return Number.isFinite(v) ? v : 0;
}

/** Crowding thresholds mirror the existing UI (0.3 = elevated huddling). */
export function crowdingLevel(ci: number): "normal" | "elevated" | "high" {
  if (ci > 0.5) return "high";
  if (ci > 0.3) return "elevated";
  return "normal";
}

export function timeAgo(iso: string | number, lang: "en" | "bn"): string {
  const ts = typeof iso === "number" ? iso * 1000 : parseTs(iso).getTime();
  const diff = Math.max(0, (Date.now() - ts) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang === "bn" ? "bn-BD" : "en", { numeric: "auto", style: "short" });
  if (diff < 60) return rtf.format(-Math.round(diff), "second");
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  return rtf.format(-Math.round(diff / 86400), "day");
}

/** Backend timestamps are naive UTC (datetime.utcnow); treat them as UTC. */
export function parseTs(iso: string): Date {
  return new Date(iso.endsWith("Z") || /[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z");
}

export function formatTime(iso: string, lang: "en" | "bn", withDate = false): string {
  const d = parseTs(iso);
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  // 24-hour clock in both languages: avoids mixed output like "১০:০২ PM"
  return withDate
    ? d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    : d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
}

export function formatNumber(n: number, lang: "en" | "bn", digits = 0): string {
  return n.toLocaleString(lang === "bn" ? "bn-BD" : "en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

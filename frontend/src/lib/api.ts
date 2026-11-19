export interface LiveStats {
  species: string;
  count: number;
  active_count: number;
  idle_count: number;
  activity_index: number;
  flock_health_score: number;
  dispersion: number;
  crowding_index: number;
  mean_speed_norm: number;
  status: "healthy" | "watch" | "alert" | string;
  fps: number;
  timestamp: number;
  source_status: string;
  species_counts?: Record<string, number>;
  max_cluster_size?: number;
  is_enhanced?: boolean;
  density_count?: number;
  uncertainty?: number;
  count_min?: number;
  count_max?: number;
  density_regime?: string;
  density_method?: string;
  optical_flow_activity?: number;
  zone_occupancy?: Record<string, number>;
  immobile_candidates_count?: number;
}

export interface HistoryPoint {
  timestamp: string;
  count: number;
  activity_index: number;
  flock_health_score: number;
  mean_speed_norm: number;
  status: string;
}

export interface HistoryResponse {
  range: string;
  points: HistoryPoint[];
}

export interface AnimalTrack {
  animal_id: number;
  species: string;
  first_seen: string;
  last_seen: string;
  status: "healthy" | "watch" | "alert" | string;
  health_score: number;
  total_distance_px: number;
  total_idle_seconds: number;
  last_speed_norm: number;
  active: boolean;
}

export interface AnimalDetail extends AnimalTrack {
  trail: [number, number][];
  speed_history: { timestamp: number; speed_norm: number }[];
  events: AlertEvent[];
}

export interface AlertEvent {
  id: number;
  event_id: string;
  timestamp: string;
  species: string;
  animal_id: number | null;
  severity: "info" | "warning" | "critical" | string;
  alert_type: string;
  title: string;
  description: string;
  confidence: number;
  snapshot_path: string | null;
  clip_path: string | null;
  acknowledged: boolean;
  acknowledged_at?: string | null;
  feedback?: string | null;
  feedback_notes?: string | null;
  feedback_at?: string | null;
}

export interface ConfigData {
  project_name: string;
  species: string;
  available_species: string[];
  sensitivity: string;
  sensitivity_presets: string[];
  process_every_n: number;
  infer_imgsz: number;
  conf_threshold: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  telegram_enabled: boolean;
  telegram_chat_id_set: boolean;
  webhook_enabled: boolean;
  webhook_url_set: boolean;
  smtp_enabled: boolean;
  smtp_host_set: boolean;
  thresholds: Record<string, number>;
  enhance_low_res?: boolean;
  dense_crowd_mode?: boolean;
}

export interface DailyReport {
  date: string;
  species: string;
  generated_at: string;
  flock_summary: {
    avg_count: number;
    min_count: number;
    max_count: number;
    avg_activity_index: number;
    avg_health_score: number;
  };
  hourly_activity_trend: Record<string, number | null>;
  alerts_summary: {
    total_alerts: number;
    by_severity: Record<string, number>;
    by_type: Record<string, number>;
    top_flagged_animals: { animal_id: number; flag_count: number }[];
  };
  disclaimer: string;
}

const API_BASE = "";

export async function fetchLiveStats(): Promise<LiveStats> {
  const res = await fetch(`${API_BASE}/api/stats/live`);
  if (!res.ok) throw new Error("Failed to fetch live stats");
  return res.json();
}

export async function fetchHistory(range: string = "1h"): Promise<HistoryResponse> {
  const res = await fetch(`${API_BASE}/api/stats/history?range=${range}`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function fetchAnimals(activeOnly: boolean = false): Promise<AnimalTrack[]> {
  const res = await fetch(`${API_BASE}/api/animals?active_only=${activeOnly}`);
  if (!res.ok) throw new Error("Failed to fetch animals");
  return res.json();
}

export async function fetchAnimalDetail(id: number): Promise<AnimalDetail> {
  const res = await fetch(`${API_BASE}/api/animals/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch animal #${id}`);
  return res.json();
}

export async function fetchEvents(params: Record<string, any> = {}): Promise<AlertEvent[]> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      q.append(k, String(v));
    }
  }
  const res = await fetch(`${API_BASE}/api/events?${q.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
}

export async function acknowledgeEvent(eventId: string | number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/events/${eventId}/ack`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to acknowledge event");
}

export async function fetchConfig(): Promise<ConfigData> {
  const res = await fetch(`${API_BASE}/api/config`);
  if (!res.ok) throw new Error("Failed to fetch configuration");
  return res.json();
}

export interface ConfigUpdateRequest {
  species?: string;
  enhance_low_res?: boolean;
  dense_crowd_mode?: boolean;
  sensitivity?: string;
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: number;
  quiet_hours_end?: number;
  telegram_enabled?: boolean;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  webhook_enabled?: boolean;
  webhook_url?: string;
  webhook_secret?: string;
  smtp_enabled?: boolean;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  smtp_from?: string;
  smtp_to?: string;
  smtp_tls?: boolean;
  thresholds?: Record<string, number>;
}

export async function updateConfig(data: ConfigUpdateRequest): Promise<ConfigData> {
  const res = await fetch(`${API_BASE}/api/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update configuration");
  return res.json();
}

export async function testNotifications(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/config/test-notification`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to trigger test notification");
  return res.json();
}

export async function fetchDailyReport(date?: string, lang: string = "en"): Promise<DailyReport> {
  const url = date
    ? `${API_BASE}/api/reports/daily?date=${date}&lang=${lang}`
    : `${API_BASE}/api/reports/daily?lang=${lang}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch daily report");
  return res.json();
}

export async function submitEventFeedback(
  eventId: string,
  feedback: "correct" | "false_alarm",
  notes?: string
): Promise<{ success: boolean; event_id: string; feedback: string }> {
  const res = await fetch(`${API_BASE}/api/events/${eventId}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback, notes }),
  });
  if (!res.ok) throw new Error("Failed to submit event feedback");
  return res.json();
}

export interface HealthStatus {
  status: "healthy" | "degraded" | string;
  pipeline_fps: number;
  last_frame_age_s: number;
  source_status: string;
  source_type: "network_stream" | "file_loop" | string;
  db_status: string;
  species: string;
  tracked_count: number;
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Failed to fetch system health");
  return res.json();
}

export interface HeatmapGrid {
  rows: number;
  cols: number;
  grid: number[][];
}

export async function fetchHeatmapGrid(): Promise<HeatmapGrid> {
  const res = await fetch(`${API_BASE}/api/heatmap?format=json`);
  if (!res.ok) throw new Error("Failed to fetch heatmap");
  return res.json();
}

// ── Web push ──────────────────────────────────────────────────────────────
export type PushSeverity = "info" | "warning" | "critical";

export async function fetchPushPublicKey(): Promise<{ enabled: boolean; public_key: string | null }> {
  const res = await fetch(`${API_BASE}/api/push/public-key`);
  if (!res.ok) throw new Error("Failed to fetch push configuration");
  return res.json();
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || `Request failed: ${path}`);
  return res.json();
}

export const pushSubscribe = (subscription: PushSubscriptionJSON, min_severity: PushSeverity) =>
  postJson<{ subscribed: boolean; min_severity: PushSeverity }>("/api/push/subscribe", { subscription, min_severity });
export const pushStatus = (endpoint: string) =>
  postJson<{ subscribed: boolean; min_severity: PushSeverity | null }>("/api/push/status", { endpoint });
export const pushUnsubscribe = (endpoint: string) => postJson<{ unsubscribed: boolean }>("/api/push/unsubscribe", { endpoint });
export const pushTest = (endpoint: string) => postJson<{ success: boolean; error?: string }>("/api/push/test", { endpoint });

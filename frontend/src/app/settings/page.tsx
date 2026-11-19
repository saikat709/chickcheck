"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Globe2, ScanSearch, BellRing, Send, Save, CheckCircle2, XCircle, MinusCircle, AlertOctagon, MessageCircle, Webhook, Mail, Moon } from "lucide-react";
import { ConfigData, fetchConfig, updateConfig, testNotifications } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Segmented, SettingRow, Switch } from "@/components/ui/Controls";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { cn } from "@/lib/format";

interface FormState {
  species: string;
  sensitivity: string;
  enhanceLowRes: boolean;
  denseCrowdMode: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
  telegramEnabled: boolean;
  telegramToken: string;
  telegramChatId: string;
  webhookEnabled: boolean;
  webhookUrl: string;
  webhookSecret: string;
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  smtpTo: string;
}

function fromConfig(c: ConfigData): FormState {
  return {
    species: c.species,
    sensitivity: c.sensitivity,
    enhanceLowRes: c.enhance_low_res ?? true,
    denseCrowdMode: c.dense_crowd_mode ?? true,
    quietHoursEnabled: c.quiet_hours_enabled,
    quietHoursStart: c.quiet_hours_start,
    quietHoursEnd: c.quiet_hours_end,
    telegramEnabled: c.telegram_enabled,
    telegramToken: "",
    telegramChatId: "",
    webhookEnabled: c.webhook_enabled,
    webhookUrl: "",
    webhookSecret: "",
    smtpEnabled: c.smtp_enabled,
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    smtpFrom: "",
    smtpTo: "",
  };
}

const SECTIONS = [
  { id: "general", key: "settings_sec_general", icon: Globe2 },
  { id: "detection", key: "settings_sec_detection", icon: ScanSearch },
  { id: "alerting", key: "settings_sec_alerting", icon: Moon },
  { id: "notifications", key: "settings_sec_notifications", icon: BellRing },
] as const;

function ConfiguredBadge({ ok, t }: { ok: boolean; t: (k: "settings_configured" | "settings_not_configured") => string }) {
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset", ok ? "bg-ok-soft text-ok ring-ok/25" : "bg-surface-2 text-ink-3 ring-line")}>
      {ok ? t("settings_configured") : t("settings_not_configured")}
    </span>
  );
}

function TestResult({ name, r, t }: { name: string; r: any; t: (k: any) => string }) {
  const Icon = r?.success ? CheckCircle2 : r?.enabled ? XCircle : MinusCircle;
  return (
    <div className="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-xs">
      <Icon className={cn("mt-px h-4 w-4 shrink-0", r?.success ? "text-ok" : r?.enabled ? "text-crit" : "text-ink-3")} />
      <div className="min-w-0">
        <div className="font-semibold text-ink">{name}</div>
        <div className={cn("mt-0.5 break-words", r?.success ? "text-ok" : r?.enabled ? "text-crit" : "text-ink-3")}>
          {r?.success ? t("settings_success") : r?.enabled ? `${t("settings_error")}: ${r?.error ?? ""}` : t("settings_disabled")}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const toast = useToast();

  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [initial, setInitial] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const c = await fetchConfig();
      setConfig(c);
      const f = fromConfig(c);
      setForm(f);
      setInitial(f);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const updated = await updateConfig({
        species: form.species,
        sensitivity: form.sensitivity,
        enhance_low_res: form.enhanceLowRes,
        dense_crowd_mode: form.denseCrowdMode,
        quiet_hours_enabled: form.quietHoursEnabled,
        quiet_hours_start: form.quietHoursStart,
        quiet_hours_end: form.quietHoursEnd,
        telegram_enabled: form.telegramEnabled,
        telegram_bot_token: form.telegramToken || undefined,
        telegram_chat_id: form.telegramChatId || undefined,
        webhook_enabled: form.webhookEnabled,
        webhook_url: form.webhookUrl || undefined,
        webhook_secret: form.webhookSecret || undefined,
        smtp_enabled: form.smtpEnabled,
        smtp_host: form.smtpHost || undefined,
        smtp_port: form.smtpPort,
        smtp_user: form.smtpUser || undefined,
        smtp_password: form.smtpPassword || undefined,
        smtp_from: form.smtpFrom || undefined,
        smtp_to: form.smtpTo || undefined,
      });
      setConfig(updated);
      const f = fromConfig(updated);
      setForm(f);
      setInitial(f);
      toast(t("settings_saved"));
    } catch {
      toast(t("settings_save_error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testNotifications());
    } catch {
      toast(t("settings_error"), "error");
    } finally {
      setTesting(false);
    }
  };

  const scrollTo = (id: string) => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div>
      <PageHeader title={t("page_settings_title")} subtitle={t("page_settings_sub")} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[200px_1fr] lg:gap-8">
        {/* Section nav */}
        <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface hover:text-ink"
            >
              <s.icon className="h-4 w-4 text-ink-3" />
              {t(s.key)}
            </button>
          ))}
        </nav>

        <form onSubmit={handleSave} className="min-w-0 max-w-3xl space-y-5 pb-24">
          {/* General — client-side preferences, saved instantly */}
          <Card id="sec-general" className="scroll-mt-24">
            <CardHeader icon={Globe2} title={t("settings_sec_general")} />
            <CardBody className="divide-y divide-line pt-1">
              <SettingRow title={t("lang_label")} description={t("settings_language_desc")}>
                <Segmented
                  value={language}
                  onChange={setLanguage}
                  options={[
                    { value: "en", label: "English" },
                    { value: "bn", label: "বাংলা" },
                  ]}
                />
              </SettingRow>
              <SettingRow title={t("settings_theme")} description={t("settings_theme_desc")}>
                <Segmented
                  value={theme}
                  onChange={setTheme}
                  options={[
                    { value: "light", label: t("theme_light") },
                    { value: "dark", label: t("theme_dark") },
                  ]}
                />
              </SettingRow>
            </CardBody>
          </Card>

          {loading ? (
            <div className="space-y-5">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : loadError || !form || !config ? (
            <Card>
              <EmptyState
                icon={AlertOctagon}
                tone="error"
                title={t("settings_load_error")}
                action={
                  <button type="button" onClick={load} className="btn btn-secondary btn-sm">
                    {t("retry")}
                  </button>
                }
              />
            </Card>
          ) : (
            <>
              <Card id="sec-detection" className="scroll-mt-24">
                <CardHeader icon={ScanSearch} title={t("settings_sec_detection")} />
                <CardBody className="divide-y divide-line pt-1">
                  <SettingRow title={t("settings_species")} description={t("settings_species_desc")} htmlFor="species">
                    <select id="species" value={form.species} onChange={(e) => set("species", e.target.value)} className="input w-full capitalize sm:w-60">
                      {config.available_species.map((sp) => (
                        <option key={sp} value={sp}>
                          {sp.charAt(0).toUpperCase() + sp.slice(1)}
                        </option>
                      ))}
                      <option value="chicken,duck">Chicken & Duck (Poultry Barn)</option>
                      <option value="sheep,goat">Sheep & Goat (Pasture)</option>
                      <option value="all">All Species (Multi-Animal Barn)</option>
                    </select>
                  </SettingRow>
                  <SettingRow title={t("settings_sensitivity")} description={t("settings_sensitivity_desc")}>
                    <Segmented
                      value={form.sensitivity}
                      onChange={(v) => set("sensitivity", v)}
                      options={config.sensitivity_presets.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
                    />
                  </SettingRow>
                  <SettingRow title={t("settings_clahe")} description={t("settings_clahe_desc")} htmlFor="clahe">
                    <Switch id="clahe" checked={form.enhanceLowRes} onChange={(v) => set("enhanceLowRes", v)} label={t("settings_clahe")} />
                  </SettingRow>
                  <SettingRow title={t("settings_dense")} description={t("settings_dense_desc")} htmlFor="dense">
                    <Switch id="dense" checked={form.denseCrowdMode} onChange={(v) => set("denseCrowdMode", v)} label={t("settings_dense")} />
                  </SettingRow>
                </CardBody>
              </Card>

              <Card id="sec-alerting" className="scroll-mt-24">
                <CardHeader icon={Moon} title={t("settings_sec_alerting")} />
                <CardBody className="pt-1">
                  <SettingRow title={t("settings_quiet")} description={t("settings_quiet_desc")} htmlFor="quiet">
                    <Switch id="quiet" checked={form.quietHoursEnabled} onChange={(v) => set("quietHoursEnabled", v)} label={t("settings_quiet")} />
                  </SettingRow>
                  {form.quietHoursEnabled && (
                    <div className="grid grid-cols-2 gap-4 border-t border-line pt-4 animate-fade-in">
                      <div>
                        <label className="label" htmlFor="qs">
                          {t("settings_quiet_start")}
                        </label>
                        <input id="qs" type="number" min={0} max={23} value={form.quietHoursStart} onChange={(e) => set("quietHoursStart", Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))} className="input tabular" />
                      </div>
                      <div>
                        <label className="label" htmlFor="qe">
                          {t("settings_quiet_end")}
                        </label>
                        <input id="qe" type="number" min={0} max={23} value={form.quietHoursEnd} onChange={(e) => set("quietHoursEnd", Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))} className="input tabular" />
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>

              <Card id="sec-notifications" className="scroll-mt-24">
                <CardHeader
                  icon={BellRing}
                  title={t("settings_sec_notifications")}
                  subtitle={t("settings_channels_desc")}
                  actions={
                    <button type="button" onClick={handleTest} disabled={testing} className="btn btn-secondary btn-sm">
                      <Send className="h-3.5 w-3.5" />
                      {testing ? t("settings_testing") : t("settings_test")}
                    </button>
                  }
                />
                <CardBody className="space-y-3">
                  {testResult && (
                    <div className="animate-fade-in">
                      <div className="eyebrow mb-2">{t("settings_test_result")}</div>
                      {testResult.error ? (
                        <div className="rounded-xl bg-crit-soft p-3 text-xs text-crit">{testResult.error}</div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <TestResult name={t("settings_telegram")} r={testResult.telegram} t={t} />
                          <TestResult name={t("settings_webhook")} r={testResult.webhook} t={t} />
                          <TestResult name={t("settings_email")} r={testResult.email} t={t} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Telegram */}
                  <div className="rounded-xl border border-line p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-info-soft text-info">
                          <MessageCircle className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                            {t("settings_telegram")}
                            <ConfiguredBadge ok={config.telegram_chat_id_set} t={t} />
                          </div>
                          <p className="mt-0.5 text-xs text-ink-3">{t("settings_telegram_desc")}</p>
                        </div>
                      </div>
                      <Switch id="tg" checked={form.telegramEnabled} onChange={(v) => set("telegramEnabled", v)} label={t("settings_telegram")} />
                    </div>
                    {form.telegramEnabled && (
                      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-2 animate-fade-in">
                        <div>
                          <label className="label" htmlFor="tg-token">Bot token</label>
                          <input id="tg-token" type="password" autoComplete="off" placeholder="123456:ABC-DEF…" value={form.telegramToken} onChange={(e) => set("telegramToken", e.target.value)} className="input" />
                        </div>
                        <div>
                          <label className="label" htmlFor="tg-chat">Chat ID</label>
                          <input id="tg-chat" type="text" placeholder="-100123456789 / @channel" value={form.telegramChatId} onChange={(e) => set("telegramChatId", e.target.value)} className="input" />
                        </div>
                        <p className="help sm:col-span-2 !mt-0">{t("settings_leave_blank")}</p>
                      </div>
                    )}
                  </div>

                  {/* Webhook */}
                  <div className="rounded-xl border border-line p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-earth-soft text-earth">
                          <Webhook className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                            {t("settings_webhook")}
                            <ConfiguredBadge ok={config.webhook_url_set} t={t} />
                          </div>
                          <p className="mt-0.5 text-xs text-ink-3">{t("settings_webhook_desc")}</p>
                        </div>
                      </div>
                      <Switch id="wh" checked={form.webhookEnabled} onChange={(v) => set("webhookEnabled", v)} label={t("settings_webhook")} />
                    </div>
                    {form.webhookEnabled && (
                      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-2 animate-fade-in">
                        <div>
                          <label className="label" htmlFor="wh-url">URL</label>
                          <input id="wh-url" type="url" placeholder="https://your-server.com/alerts" value={form.webhookUrl} onChange={(e) => set("webhookUrl", e.target.value)} className="input" />
                        </div>
                        <div>
                          <label className="label" htmlFor="wh-secret">HMAC secret</label>
                          <input id="wh-secret" type="password" autoComplete="off" placeholder="Optional" value={form.webhookSecret} onChange={(e) => set("webhookSecret", e.target.value)} className="input" />
                        </div>
                        <p className="help sm:col-span-2 !mt-0">{t("settings_leave_blank")}</p>
                      </div>
                    )}
                  </div>

                  {/* Email */}
                  <div className="rounded-xl border border-line p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                          <Mail className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                            {t("settings_email")}
                            <ConfiguredBadge ok={config.smtp_host_set} t={t} />
                          </div>
                          <p className="mt-0.5 text-xs text-ink-3">{t("settings_email_desc")}</p>
                        </div>
                      </div>
                      <Switch id="smtp" checked={form.smtpEnabled} onChange={(v) => set("smtpEnabled", v)} label={t("settings_email")} />
                    </div>
                    {form.smtpEnabled && (
                      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-3 animate-fade-in">
                        <div className="sm:col-span-2">
                          <label className="label" htmlFor="smtp-host">Host</label>
                          <input id="smtp-host" type="text" placeholder="smtp.gmail.com" value={form.smtpHost} onChange={(e) => set("smtpHost", e.target.value)} className="input" />
                        </div>
                        <div>
                          <label className="label" htmlFor="smtp-port">Port</label>
                          <input id="smtp-port" type="number" value={form.smtpPort} onChange={(e) => set("smtpPort", parseInt(e.target.value) || 587)} className="input tabular" />
                        </div>
                        <div>
                          <label className="label" htmlFor="smtp-user">User</label>
                          <input id="smtp-user" type="text" autoComplete="off" value={form.smtpUser} onChange={(e) => set("smtpUser", e.target.value)} className="input" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="label" htmlFor="smtp-pass">Password</label>
                          <input id="smtp-pass" type="password" autoComplete="new-password" value={form.smtpPassword} onChange={(e) => set("smtpPassword", e.target.value)} className="input" />
                        </div>
                        <div className="sm:col-span-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="label" htmlFor="smtp-from">From</label>
                            <input id="smtp-from" type="email" placeholder="alerts@farm.local" value={form.smtpFrom} onChange={(e) => set("smtpFrom", e.target.value)} className="input" />
                          </div>
                          <div>
                            <label className="label" htmlFor="smtp-to">To</label>
                            <input id="smtp-to" type="email" placeholder="owner@farm.local" value={form.smtpTo} onChange={(e) => set("smtpTo", e.target.value)} className="input" />
                          </div>
                        </div>
                        <p className="help sm:col-span-3 !mt-0">{t("settings_leave_blank")}</p>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            </>
          )}

          {/* Sticky save bar — appears only with unsaved changes */}
          {dirty && (
            <div
              className="fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom,0px))] z-30 border-t border-line bg-surface/95 backdrop-blur-md animate-rise-in lg:bottom-0 lg:left-auto lg:right-0 lg:w-[calc(100%-var(--sidebar-w,248px))]"
            >
              <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
                <span className="text-sm font-medium text-ink-2">{t("settings_unsaved")}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm(initial)} className="btn btn-ghost">
                    {t("settings_discard")}
                  </button>
                  <button type="submit" disabled={saving} className="btn btn-primary">
                    <Save className="h-4 w-4" />
                    {saving ? t("settings_saving") : t("settings_save")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { ConfigData, fetchConfig, updateConfig, testNotifications } from "@/lib/api";
import { Settings as SettingsIcon, Save, Send, ShieldAlert, Moon, Bell, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

export default function SettingsPage() {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states
  const [species, setSpecies] = useState("chicken");
  const [sensitivity, setSensitivity] = useState("normal");
  const [enhanceLowRes, setEnhanceLowRes] = useState(true);
  const [denseCrowdMode, setDenseCrowdMode] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState(22);
  const [quietHoursEnd, setQuietHoursEnd] = useState(6);

  // Channels
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");

  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpTo, setSmtpTo] = useState("");

  // Test Notification
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const c = await fetchConfig();
        setConfig(c);
        setSpecies(c.species);
        setSensitivity(c.sensitivity);
        if (c.enhance_low_res !== undefined) setEnhanceLowRes(c.enhance_low_res);
        if (c.dense_crowd_mode !== undefined) setDenseCrowdMode(c.dense_crowd_mode);
        setQuietHoursEnabled(c.quiet_hours_enabled);
        setQuietHoursStart(c.quiet_hours_start);
        setQuietHoursEnd(c.quiet_hours_end);
        setTelegramEnabled(c.telegram_enabled);
        setWebhookEnabled(c.webhook_enabled);
        setSmtpEnabled(c.smtp_enabled);
      } catch (e) {
        console.error("Failed to load config:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const updated = await updateConfig({
        species,
        sensitivity,
        enhance_low_res: enhanceLowRes,
        dense_crowd_mode: denseCrowdMode,
        quiet_hours_enabled: quietHoursEnabled,
        quiet_hours_start: quietHoursStart,
        quiet_hours_end: quietHoursEnd,
        telegram_enabled: telegramEnabled,
        telegram_bot_token: telegramToken || undefined,
        telegram_chat_id: telegramChatId || undefined,
        webhook_enabled: webhookEnabled,
        webhook_url: webhookUrl || undefined,
        webhook_secret: webhookSecret || undefined,
        smtp_enabled: smtpEnabled,
        smtp_host: smtpHost || undefined,
        smtp_port: smtpPort,
        smtp_user: smtpUser || undefined,
        smtp_password: smtpPassword || undefined,
        smtp_from: smtpFrom || undefined,
        smtp_to: smtpTo || undefined,
      });
      setConfig(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotifications = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testNotifications();
      setTestResult(res);
    } catch (e) {
      console.error("Test notification failed:", e);
      setTestResult({ error: "Failed to connect to backend dispatch service." });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-slate-500" />
        <span>Loading system settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-emerald-600" />
          System Settings & Notification Profiles
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure species profile, detection sensitivity presets, quiet hours, and alerting channels
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Livestock Species & Sensitivity */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Farm Species & Detection Preset</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Active Animal Species
              </label>
              <select
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold capitalize"
              >
                {config?.available_species.map((sp) => (
                  <option key={sp} value={sp}>
                    {sp.charAt(0).toUpperCase() + sp.slice(1)}
                  </option>
                ))}
                <option value="chicken,duck">Chicken & Duck (Poultry Barn)</option>
                <option value="sheep,goat">Sheep & Goat (Pasture)</option>
                <option value="all">All Species (Multi-Animal Barn)</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Single or concurrent multi-species monitoring with adaptive kinematic baselines.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Anomaly Sensitivity Preset
              </label>
              <select
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold capitalize"
              >
                {config?.sensitivity_presets.map((pr) => (
                  <option key={pr} value={pr}>
                    {pr.charAt(0).toUpperCase() + pr.slice(1)} Preset
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Low = fewer alerts, Normal = balanced, High = early warning thresholds.
              </p>
            </div>
          </div>

          {/* Low-Resolution & Dense Crowd Adaptations */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <input
                id="enhance_low_res"
                type="checkbox"
                checked={enhanceLowRes}
                onChange={(e) => setEnhanceLowRes(e.target.checked)}
                className="mt-1 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <label htmlFor="enhance_low_res" className="cursor-pointer">
                <span className="block text-xs font-bold text-slate-900 dark:text-white">
                  Adaptive Low-Resolution Enhancement (CLAHE)
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Applies contrast-limited adaptive histogram equalization and unsharp masking on low-res/degraded camera feeds.
                </span>
              </label>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <input
                id="dense_crowd_mode"
                type="checkbox"
                checked={denseCrowdMode}
                onChange={(e) => setDenseCrowdMode(e.target.checked)}
                className="mt-1 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <label htmlFor="dense_crowd_mode" className="cursor-pointer">
                <span className="block text-xs font-bold text-slate-900 dark:text-white">
                  Dense Flock Tracking & Occlusion Re-ID
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Enables spatial cluster graph analysis, HSV color appearance histograms, and extended track memory during tight huddles.
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 2: Quiet Hours */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className="w-5 h-5 text-indigo-500" />
              <div>
                <h3 className="text-base font-bold">Quiet Hours Filter</h3>
                <p className="text-xs text-slate-500">Only critical alerts are sent during quiet hours</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={quietHoursEnabled}
                onChange={(e) => setQuietHoursEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
            </label>
          </div>

          {quietHoursEnabled && (
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Start Hour (24h)</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={quietHoursStart}
                  onChange={(e) => setQuietHoursStart(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">End Hour (24h)</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={quietHoursEnd}
                  onChange={(e) => setQuietHoursEnd(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Notification Channels */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-base font-bold">Alert Notification Channels</h3>
                <p className="text-xs text-slate-500">Configure Telegram Bot, Webhooks, and SMTP Email</p>
              </div>
            </div>

            {/* Test Notifications Button */}
            <button
              type="button"
              onClick={handleTestNotifications}
              disabled={testing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{testing ? "Testing..." : "Send Test Notification"}</span>
            </button>
          </div>

          {/* Test Results Banner */}
          {testResult && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
              <div className="font-bold text-slate-800 dark:text-slate-200">Channel Test Dispatch Status:</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">Telegram:</span>
                  {testResult.telegram?.success ? (
                    <span className="text-emerald-500 font-bold flex items-center gap-0.5"><CheckCircle2 className="w-3.5 h-3.5" /> Success</span>
                  ) : testResult.telegram?.enabled ? (
                    <span className="text-red-500 font-bold flex items-center gap-0.5"><XCircle className="w-3.5 h-3.5" /> Error: {testResult.telegram?.error}</span>
                  ) : (
                    <span className="text-slate-400">Disabled</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">Webhook:</span>
                  {testResult.webhook?.success ? (
                    <span className="text-emerald-500 font-bold flex items-center gap-0.5"><CheckCircle2 className="w-3.5 h-3.5" /> Success</span>
                  ) : testResult.webhook?.enabled ? (
                    <span className="text-red-500 font-bold flex items-center gap-0.5"><XCircle className="w-3.5 h-3.5" /> Error: {testResult.webhook?.error}</span>
                  ) : (
                    <span className="text-slate-400">Disabled</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">Email:</span>
                  {testResult.email?.success ? (
                    <span className="text-emerald-500 font-bold flex items-center gap-0.5"><CheckCircle2 className="w-3.5 h-3.5" /> Success</span>
                  ) : testResult.email?.enabled ? (
                    <span className="text-red-500 font-bold flex items-center gap-0.5"><XCircle className="w-3.5 h-3.5" /> Error: {testResult.email?.error}</span>
                  ) : (
                    <span className="text-slate-400">Disabled</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3.1 Telegram */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">Telegram Bot (Photos & Alerts)</span>
              <input
                type="checkbox"
                checked={telegramEnabled}
                onChange={(e) => setTelegramEnabled(e.target.checked)}
                className="rounded"
              />
            </div>
            {telegramEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <input
                  type="password"
                  placeholder="Bot Token (e.g. 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                />
                <input
                  type="text"
                  placeholder="Chat ID (e.g. -100123456789 or @channelname)"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
            )}
          </div>

          {/* 3.2 Webhook */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">Webhook (Signed JSON POST)</span>
              <input
                type="checkbox"
                checked={webhookEnabled}
                onChange={(e) => setWebhookEnabled(e.target.checked)}
                className="rounded"
              />
            </div>
            {webhookEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <input
                  type="url"
                  placeholder="Webhook URL (https://your-server.com/alerts)"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                />
                <input
                  type="password"
                  placeholder="HMAC Signing Secret (Optional)"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
            )}
          </div>

          {/* 3.3 SMTP Email */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">SMTP Email Notifications</span>
              <input
                type="checkbox"
                checked={smtpEnabled}
                onChange={(e) => setSmtpEnabled(e.target.checked)}
                className="rounded"
              />
            </div>
            {smtpEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <input
                  type="text"
                  placeholder="SMTP Host (e.g. smtp.gmail.com)"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                />
                <input
                  type="number"
                  placeholder="Port (587)"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)}
                  className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                />
                <input
                  type="text"
                  placeholder="User / Login"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                />
                <input
                  type="password"
                  placeholder="SMTP Password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                />
                <input
                  type="email"
                  placeholder="From Address"
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                />
                <input
                  type="email"
                  placeholder="To Address"
                  value={smtpTo}
                  onChange={(e) => setSmtpTo(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {saveSuccess && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Configuration successfully saved!
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving..." : "Save Configuration"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

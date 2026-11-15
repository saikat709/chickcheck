"use client";

import React, { useState, useEffect } from "react";
import { DailyReport, fetchDailyReport } from "@/lib/api";
import { FileText, Download, Calendar, Activity, AlertTriangle, Users, RefreshCw } from "lucide-react";

export default function ReportsPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await fetchDailyReport(selectedDate);
      setReport(data);
    } catch (e) {
      console.error("Failed to load daily report:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedDate]);

  const pdfDownloadUrl = `/api/reports/daily?date=${selectedDate}&format=pdf`;

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600" />
            Daily Livestock Reports
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Synthesized operational telemetry, anomaly breakdowns, and downloadable PDF audits
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-semibold outline-none"
            />
          </div>

          {/* Download PDF Button */}
          <a
            href={pdfDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </a>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-slate-500" />
          <span>Compiling daily report...</span>
        </div>
      ) : !report ? (
        <div className="py-24 text-center text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-2 text-slate-500" />
          <p>No report found for {selectedDate}.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Average Count</span>
              <div className="text-2xl font-black mt-1">{report.flock_summary.avg_count}</div>
              <p className="text-xs text-slate-400 mt-1">
                Peak: {report.flock_summary.max_count} · Min: {report.flock_summary.min_count}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Mean Activity Index</span>
              <div className="text-2xl font-black text-blue-500 mt-1">
                {report.flock_summary.avg_activity_index} <span className="text-xs font-normal text-slate-400">/ 100</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Diurnal aggregate</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Flock Health Score</span>
              <div className="text-2xl font-black text-emerald-500 mt-1">
                {report.flock_summary.avg_health_score} <span className="text-xs font-normal text-slate-400">/ 100</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Movement-based score</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Total Anomalies</span>
              <div className="text-2xl font-black text-amber-500 mt-1">
                {report.alerts_summary.total_alerts}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Critical: {report.alerts_summary.by_severity.critical || 0}
              </p>
            </div>
          </div>

          {/* Anomaly & Top Flagged Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Anomaly Breakdown by Category
              </h3>
              <div className="space-y-3">
                {Object.entries(report.alerts_summary.by_type).length === 0 ? (
                  <p className="text-xs text-slate-400 py-4">No anomalies logged for this date.</p>
                ) : (
                  Object.entries(report.alerts_summary.by_type).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 dark:border-slate-800">
                      <span className="capitalize text-slate-700 dark:text-slate-300">
                        {type.replace(/_/g, " ")}
                      </span>
                      <span className="font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs">
                        {count} incidents
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Most Flagged Animals */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                Most Flagged Livestock Tracks
              </h3>
              {report.alerts_summary.top_flagged_animals.length === 0 ? (
                <p className="text-xs text-slate-400 py-4">No specific animals repeatedly flagged.</p>
              ) : (
                <div className="space-y-3">
                  {report.alerts_summary.top_flagged_animals.map((item) => (
                    <div
                      key={item.animal_id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm">Track #{item.animal_id}</span>
                        <span className="text-xs text-slate-400 capitalize">({report.species})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-red-500">
                          {item.flag_count} alerts
                        </span>
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-medium">
                          {item.flag_count >= 3 ? "Inspect Animal" : "Monitor Track"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


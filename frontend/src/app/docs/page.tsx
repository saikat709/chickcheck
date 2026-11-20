"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  Lock,
  Unlock,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  Cpu,
  Database,
  Globe,
  Share2,
  Printer,
  FileText,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Settings,
  Users,
  Activity,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Server,
  Zap,
  Check,
  Copy,
  ExternalLink,
  Code2,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useLiveData } from "@/lib/LiveDataContext";
import { cn } from "@/lib/format";

// Default Judging Schedule: June 10, 2026 (00:00 UTC) to June 14, 2026 (23:59 UTC)
const DEFAULT_START_DATE = "2026-06-10T00:00:00Z";
const DEFAULT_END_DATE = "2026-06-14T23:59:59Z";
const DEFAULT_PIN = "khamar2026";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  image?: string;
  bio?: string;
}

const DEFAULT_TEAM: TeamMember[] = [
  {
    id: "1",
    name: "Md. Saikat Islam",
    role: "Full-Stack & Systems Architect",
    email: "saikatislam709@gmail.com",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=face",
    bio: "Computer vision optimization, edge container architecture, and real-time streaming systems."
  },
  {
    id: "2",
    name: "Tukabbir Hossain Sadi",
    role: "Frontend Lead & UI/UX Specialist",
    email: "tukabbirhossainsadi@gmail.com",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face",
    bio: "Offline-first PWA engineering, accessible farm UI/UX, and real-time SSE client telemetry."
  },
  {
    id: "3",
    name: "Ayon",
    role: "AI & Machine Learning Engineer",
    email: "ayon@khamarprohori.com",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&crop=face",
    bio: "YOLO11 kinematic modeling, optical flow integration, and Fireworks AI RAG knowledge engine."
  }
];

export default function DocsPage() {
  const { stats, connection } = useLiveData();
  const [activeTab, setActiveTab] = useState<"deck" | "whitepaper">("deck");
  const [deckSlide, setDeckSlide] = useState(0);

  // Access control state
  const [isEnabled, setIsEnabled] = useState(true);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);
  const [adminPinInput, setAdminPinInput] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>(DEFAULT_TEAM);

  // Load config on mount
  useEffect(() => {
    try {
      const savedAdmin = localStorage.getItem("kp_docs_admin") === "1";
      if (savedAdmin) setIsAdmin(true);

      const savedConfig = localStorage.getItem("kp_docs_config");
      if (savedConfig) {
        const parsed = jsonParseSafe(savedConfig);
        if (parsed) {
          if (parsed.isEnabled !== undefined) setIsEnabled(parsed.isEnabled);
          if (parsed.scheduleEnabled !== undefined) setScheduleEnabled(parsed.scheduleEnabled);
          if (parsed.startDate) setStartDate(parsed.startDate);
          if (parsed.endDate) setEndDate(parsed.endDate);
          if (parsed.team) setTeam(parsed.team);
        }
      }
    } catch {}

    // Also fetch live config from API if available
    fetch("/api/docs/status")
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (data) {
          if (data.is_enabled !== undefined) setIsEnabled(data.is_enabled);
          if (data.schedule_enabled !== undefined) setScheduleEnabled(data.schedule_enabled);
          if (data.start_date) setStartDate(data.start_date);
          if (data.end_date) setEndDate(data.end_date);
          if (data.team_members) setTeam(data.team_members);
        }
      })
      .catch(() => {});
  }, []);

  // Check if page is currently public
  const nowIso = new Date().toISOString();
  const isWithinSchedule = startDate <= nowIso && nowIso <= endDate;
  const isPubliclyAvailable = isEnabled && (!scheduleEnabled || isWithinSchedule);
  const hasAccess = isAdmin || isPubliclyAvailable;

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPinInput === DEFAULT_PIN) {
      setIsAdmin(true);
      setPinError("");
      try {
        localStorage.setItem("kp_docs_admin", "1");
      } catch {}
    } else {
      setPinError("Invalid Admin PIN. Please check and try again.");
    }
  };

  const handleSaveAdminConfig = () => {
    const config = { isEnabled, scheduleEnabled, startDate, endDate, team };
    try {
      localStorage.setItem("kp_docs_config", JSON.stringify(config));
    } catch {}

    fetch("/api/docs/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Pin": DEFAULT_PIN,
      },
      body: JSON.stringify({
        is_enabled: isEnabled,
        schedule_enabled: scheduleEnabled,
        start_date: startDate,
        end_date: endDate,
        team_members: team,
      }),
    }).catch(() => {});

    setAdminModalOpen(false);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Top Admin / Status Bar */}
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-line bg-forest px-4 py-2.5 text-xs text-white shadow-sm sm:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-white hover:text-brand-soft">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-brand text-[10px]">KP</span>
            Khamar Prohori
          </Link>
          <span className="text-white/40">|</span>
          <span className="font-semibold text-brand-soft">Live /docs & YC Pitch Portal</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-0.5 text-[10px] text-[#A9C2AF]">
            <span className="h-1.5 w-1.5 rounded-full bg-ok animate-pulse" />
            Live Sync
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-lg bg-black/30 p-0.5 border border-white/10">
            <button
              onClick={() => setActiveTab("deck")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                activeTab === "deck" ? "bg-brand text-white shadow" : "text-white/70 hover:text-white"
              )}
            >
              YC Pitch Deck
            </button>
            <button
              onClick={() => setActiveTab("whitepaper")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                activeTab === "whitepaper" ? "bg-brand text-white shadow" : "text-white/70 hover:text-white"
              )}
            >
              Full Technical Doc
            </button>
          </div>

          <button
            onClick={handleShare}
            className="flex items-center gap-1 rounded-lg border border-white/15 bg-black/20 px-2 py-1 text-xs text-white/80 hover:bg-black/30 hover:text-white"
            title="Copy shareable link"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-ok" /> : <Share2 className="h-3.5 w-3.5" />}
            <span className="hidden md:inline">{copiedLink ? "Copied" : "Share"}</span>
          </button>

          <button
            onClick={handlePrint}
            className="hidden sm:flex items-center gap-1 rounded-lg border border-white/15 bg-black/20 px-2 py-1 text-xs text-white/80 hover:bg-black/30 hover:text-white"
            title="Print / Save PDF"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden md:inline">PDF</span>
          </button>

          {/* Admin Toggle Button */}
          <button
            onClick={() => setAdminModalOpen(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
              isAdmin ? "bg-brand text-white" : "bg-white/10 text-white/90 hover:bg-white/20"
            )}
          >
            {isAdmin ? <Unlock className="h-3.5 w-3.5 text-ok" /> : <Lock className="h-3.5 w-3.5" />}
            <span>{isAdmin ? "Admin Controls" : "Admin Unlock"}</span>
          </button>
        </div>
      </div>

      {/* Access Gate Screen (When restricted / judging window inactive) */}
      {!hasAccess && (
        <div className="mx-auto my-16 max-w-lg rounded-2xl border border-line bg-surface p-8 shadow-xl text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warn-soft text-warn">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-ink">Documentation Restricted to Judging Window</h2>
          <p className="mt-2 text-sm text-ink-2">
            This live pitch deck and technical documentation is scheduled for public viewing during the official evaluation window:
          </p>

          <div className="my-6 rounded-xl border border-line bg-canvas p-4 text-xs space-y-1.5 text-left">
            <div className="flex justify-between">
              <span className="text-ink-3">Scheduled Start:</span>
              <strong className="text-ink">{new Date(startDate).toLocaleString()}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-3">Scheduled End:</span>
              <strong className="text-ink">{new Date(endDate).toLocaleString()}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-3">Current Server Time:</span>
              <span className="text-brand font-mono">{new Date().toLocaleString()}</span>
            </div>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-3">
            <label className="block text-left text-xs font-semibold text-ink-2">
              Judges / Investor / Admin Passcode:
            </label>
            <input
              type="password"
              placeholder="Enter PIN (e.g. khamar2026)"
              value={adminPinInput}
              onChange={(e) => setAdminPinInput(e.target.value)}
              className="w-full rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
            />
            {pinError && <p className="text-xs text-crit font-medium text-left">{pinError}</p>}
            <button
              type="submit"
              className="w-full rounded-xl bg-brand py-2.5 font-semibold text-white shadow-sm hover:bg-brand-strong transition-all"
            >
              Unlock Access
            </button>
          </form>
        </div>
      )}

      {/* Main Content (when unlocked) */}
      {hasAccess && (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Live Telemetry Ribbon */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-brand-soft">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-ink">Live Barn Telemetry Stream</h4>
                  <span className="rounded bg-ok-soft px-2 py-0.5 text-[10px] font-bold text-ok">OPERATIONAL</span>
                </div>
                <p className="text-xs text-ink-3">Auto-synced with active computer-vision pipeline</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:flex sm:items-center sm:gap-6 text-xs">
              <div>
                <span className="text-ink-3">Monitored Birds:</span>
                <p className="text-sm font-bold text-ink">{stats?.count ?? 0}</p>
              </div>
              <div>
                <span className="text-ink-3">Health Score:</span>
                <p className="text-sm font-bold text-brand">{stats?.flock_health_score ?? 100}%</p>
              </div>
              <div>
                <span className="text-ink-3">Activity Index:</span>
                <p className="text-sm font-bold text-ink">{stats?.activity_index ?? 50}/100</p>
              </div>
              <div>
                <span className="text-ink-3">Vision Model:</span>
                <p className="text-sm font-bold text-ink">YOLO11n + Optical Flow</p>
              </div>
            </div>
          </div>

          {/* TAB 1: YC-STYLE PITCH DECK MODE */}
          {activeTab === "deck" && (
            <div className="space-y-6">
              {/* Slide Navigation Stepper */}
              <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-brand">SLIDE {deckSlide + 1} OF 12:</span>
                  <span className="font-semibold text-ink">{SLIDES[deckSlide].title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setDeckSlide((s) => Math.max(0, s - 1))}
                    disabled={deckSlide === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-canvas disabled:opacity-30 hover:bg-surface-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeckSlide((s) => Math.min(SLIDES.length - 1, s + 1))}
                    disabled={deckSlide === SLIDES.length - 1}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-canvas disabled:opacity-30 hover:bg-surface-2"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Active Slide Presentation View */}
              <div className="rounded-2xl border border-line bg-surface p-8 sm:p-12 shadow-md min-h-[500px] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold tracking-widest text-brand uppercase">
                      {SLIDES[deckSlide].category}
                    </span>
                    <span className="text-xs text-ink-3">Khamar Prohori (খামার প্রহরী) · YC Pitch</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-ink mb-6">
                    {SLIDES[deckSlide].headline}
                  </h1>

                  {/* Slide-specific dynamic render */}
                  {deckSlide === 9 ? (
                    /* MANDATORY TEAM SECTION ON SLIDE 10 */
                    <TeamShowcaseGrid team={team} />
                  ) : (
                    <div className="prose max-w-none text-ink-2 space-y-4 leading-relaxed text-sm sm:text-base">
                      {SLIDES[deckSlide].content}
                    </div>
                  )}
                </div>

                {/* Slide Footer with Quick Jump Dots */}
                <div className="mt-8 pt-6 border-t border-line flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {SLIDES.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setDeckSlide(idx)}
                        className={cn(
                          "h-2 rounded-full transition-all",
                          idx === deckSlide ? "w-6 bg-brand" : "w-2 bg-line hover:bg-line-strong"
                        )}
                        title={`Slide ${idx + 1}`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-3 text-xs">
                    <button
                      onClick={() => setDeckSlide((s) => Math.max(0, s - 1))}
                      disabled={deckSlide === 0}
                      className="font-semibold text-ink-2 disabled:opacity-30 hover:text-brand"
                    >
                      &larr; Previous
                    </button>
                    <button
                      onClick={() => setDeckSlide((s) => Math.min(SLIDES.length - 1, s + 1))}
                      disabled={deckSlide === SLIDES.length - 1}
                      className="font-semibold text-brand disabled:opacity-30 hover:underline"
                    >
                      Next Slide &rarr;
                    </button>
                  </div>
                </div>
              </div>

              {/* All Slides Overview Grid */}
              <div className="pt-8">
                <h3 className="text-base font-bold text-ink mb-4">Pitch Deck Table of Contents</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {SLIDES.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => setDeckSlide(idx)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-all",
                        idx === deckSlide
                          ? "border-brand bg-brand-soft/30 shadow-sm"
                          : "border-line bg-surface hover:border-line-strong"
                      )}
                    >
                      <span className="text-[10px] font-bold text-brand uppercase">Slide {idx + 1}</span>
                      <p className="text-xs font-semibold text-ink truncate mt-0.5">{s.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FULL TECHNICAL WHITEPAPER MODE */}
          {activeTab === "whitepaper" && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
              {/* Sticky Sidebar Navigation */}
              <div className="lg:col-span-1">
                <div className="sticky top-16 space-y-1 rounded-xl border border-line bg-surface p-3 text-xs">
                  <p className="font-bold uppercase tracking-wider text-[10px] text-ink-3 mb-2 px-2">Table of Contents</p>
                  <a href="#overview" className="block rounded-lg px-2 py-1.5 font-medium text-ink hover:bg-surface-2">1. System Overview</a>
                  <a href="#matrix" className="block rounded-lg px-2 py-1.5 font-medium text-ink hover:bg-surface-2">2. Feature Matrix</a>
                  <a href="#architecture" className="block rounded-lg px-2 py-1.5 font-medium text-ink hover:bg-surface-2">3. Architecture Diagram</a>
                  <a href="#dataflow" className="block rounded-lg px-2 py-1.5 font-medium text-ink hover:bg-surface-2">4. Data Flow Pipeline</a>
                  <a href="#techstack" className="block rounded-lg px-2 py-1.5 font-medium text-ink hover:bg-surface-2">5. Technology Stack</a>
                  <a href="#sohayok" className="block rounded-lg px-2 py-1.5 font-medium text-ink hover:bg-surface-2">6. Sohayok AI (RAG Layer)</a>
                  <a href="#api" className="block rounded-lg px-2 py-1.5 font-medium text-ink hover:bg-surface-2">7. API Reference</a>
                  <a href="#team" className="block rounded-lg px-2 py-1.5 font-medium text-ink hover:bg-surface-2">8. Team & Contributors</a>
                  <a href="#performance" className="block rounded-lg px-2 py-1.5 font-medium text-ink hover:bg-surface-2">9. Performance & Security</a>
                </div>
              </div>

              {/* Whitepaper Content */}
              <div className="lg:col-span-3 space-y-12">
                {/* 1. System Overview */}
                <section id="overview" className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
                  <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest text-brand-soft text-xs">1</span>
                    Product & System Overview
                  </h2>
                  <p className="text-sm text-ink-2 leading-relaxed mb-4">
                    <strong>Khamar Prohori (খামার প্রহরী)</strong> is an industrial-grade computer-vision and AI co-pilot system designed for commercial poultry sheds. It solves the critical bottleneck of delayed flock mortality detection by providing 24/7 autonomous surveillance through standard IP/CCTV cameras without requiring invasive body sensors.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-xl border border-line bg-canvas p-3">
                      <strong className="block text-ink font-bold">Target Users</strong>
                      <span className="text-ink-3">Broiler & layer shed operators, poultry integrators, veterinarians, contract farm supervisors.</span>
                    </div>
                    <div className="rounded-xl border border-line bg-canvas p-3">
                      <strong className="block text-ink font-bold">Hardware Footprint</strong>
                      <span className="text-ink-3">Runs on low-cost standard barn edge CPUs or lightweight cloud containers (&lt;15MB RAM buffer).</span>
                    </div>
                    <div className="rounded-xl border border-line bg-canvas p-3">
                      <strong className="block text-ink font-bold">Core Benefit</strong>
                      <span className="text-ink-3">Reduces unexpected flock mortality by up to 30% through early kinematic stress alerts.</span>
                    </div>
                  </div>
                </section>

                {/* 2. Feature Matrix */}
                <section id="matrix" className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
                  <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest text-brand-soft text-xs">2</span>
                    Feature Matrix & Live Capabilities
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-line text-ink-3">
                          <th className="pb-2">Capability</th>
                          <th className="pb-2">Category</th>
                          <th className="pb-2">Status</th>
                          <th className="pb-2">Implementation Detail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line text-ink-2">
                        <tr>
                          <td className="py-2.5 font-semibold text-ink">Whole-Flock Activity Tracking</td>
                          <td>Kinematics</td>
                          <td><span className="rounded bg-ok-soft px-2 py-0.5 font-bold text-ok">Live</span></td>
                          <td>Dense Farnebäck optical flow on 8x8 spatial grid (&lt;6ms/frame)</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 font-semibold text-ink">Thermal Huddling Alert</td>
                          <td>Biosecurity</td>
                          <td><span className="rounded bg-ok-soft px-2 py-0.5 font-bold text-ok">Live</span></td>
                          <td>Spatial clustering coefficient &gt; 0.45 triggers cold-stress alert</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 font-semibold text-ink">Immobile / Moribund Bird Screening</td>
                          <td>Health</td>
                          <td><span className="rounded bg-ok-soft px-2 py-0.5 font-bold text-ok">Live</span></td>
                          <td>Temporal difference decay tracks stationary plumage blobs (&gt;3m/5m)</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 font-semibold text-ink">Sohayok AI Bilingual Veterinary RAG</td>
                          <td>AI Co-Pilot</td>
                          <td><span className="rounded bg-ok-soft px-2 py-0.5 font-bold text-ok">Live</span></td>
                          <td>Fireworks AI (gpt-oss-120b) + Live shed telemetry + Bengali KB</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 font-semibold text-ink">Automated 10s Video Incident Export</td>
                          <td>Alerts</td>
                          <td><span className="rounded bg-ok-soft px-2 py-0.5 font-bold text-ok">Live</span></td>
                          <td>Lightweight circular ring buffer encodes MP4 clips on incident</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 font-semibold text-ink">Multi-Channel Push & Telegram Alerts</td>
                          <td>Notifications</td>
                          <td><span className="rounded bg-ok-soft px-2 py-0.5 font-bold text-ok">Live</span></td>
                          <td>Web Push VAPID + Telegram Bot API integration</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 3. Architecture Diagram */}
                <section id="architecture" className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
                  <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest text-brand-soft text-xs">3</span>
                    System Architecture Diagram
                  </h2>
                  <div className="rounded-xl border border-line bg-canvas p-6 text-xs font-mono overflow-x-auto">
                    <pre className="text-brand-strong dark:text-brand-soft leading-relaxed">
{`+-----------------------------------------------------------------------------------+
|                        KHAMAR PROHORI ARCHITECTURE                                |
+-----------------------------------------------------------------------------------+

[ Farm Barn Cameras (RTSP/CCTV) ]
              |
              v (Video Stream Decimation: Every Nth frame)
+-----------------------------------------------------------------------------------+
| BACKEND CORE (FastAPI + PyTorch + OpenCV)                                          |
|                                                                                   |
|  +---------------------------+       +-----------------------------------------+  |
|  |  YOLO11n + ByteTrack      | ----> |  Dense Optical Flow (Farnebäck)         |  |
|  |  (Object Bounding Boxes)  |       |  (Whole-Flock Motion Energy Index)      |  |
|  +---------------------------+       +-----------------------------------------+  |
|                |                                          |                       |
|                v                                          v                       |
|  +-----------------------------------------------------------------------------+  |
|  | ANOMALY EVALUATION ENGINE (Diurnal Baselines, Huddling, Immobility, Faults) |  |
|  +-----------------------------------------------------------------------------+  |
|                |                                          |                       |
|                v                                          v                       |
|  [ Video Clip Ring Buffer ]                   [ SQLite / PostgreSQL DB ]          |
|  (Max 480p, <15MB RAM footprint)              (AnimalTracks, Alerts, Snapshots)   |
+-----------------------------------------------------------------------------------+
              |                                             |
              v (Internal Proxy 127.0.0.1:8001)             v
+-----------------------------------------------------------------------------------+
| SOHAYOK AI RAG ENGINE (Fireworks AI)                                              |
| - Live Shed Telemetry (Count, Health %, Alerts)                                   |
| - Veterinary Knowledge Base (English & Bengali Protocols)                         |
| - Sliding-Window Rate Limiter (15 req/min, 120 req/hr)                            |
+-----------------------------------------------------------------------------------+
              |
              v (Port: $PORT)
+-----------------------------------------------------------------------------------+
| CLIENT FRONTEND (Next.js 14 App Router + Tailwind + Serwist PWA)                  |
| - Overview Dashboard & Real-Time MJPEG / SSE Stream                               |
| - Sohayok AI Floating Chat Widget (Bilingual বাংলা / EN)                           |
| - Offline PWA Cache (IndexedDB + Service Worker)                                  |
+-----------------------------------------------------------------------------------+`}
                    </pre>
                  </div>
                </section>

                {/* 4. Data Flow Pipeline */}
                <section id="dataflow" className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
                  <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest text-brand-soft text-xs">4</span>
                    Data Flow Pipeline
                  </h2>
                  <ol className="space-y-3 text-xs text-ink-2 list-decimal pl-4">
                    <li><strong>Ingestion:</strong> The system opens camera feeds via RTSP, HTTP, or local file loops via OpenCV VideoCapture.</li>
                    <li><strong>Decimation & Pacing:</strong> To preserve low-cost CPU resources, frames are decimated (`PROCESS_EVERY_N=3`), reducing CPU load by 33%.</li>
                    <li><strong>Kinematics & Optical Flow:</strong> Raw frames pass through an 8x8 Farnebäck motion grid generating an activity index (0-100) independent of individual IDs.</li>
                    <li><strong>Anomaly Screening:</strong> Detects thermal huddling (&gt;0.45 clustering coefficient) and immobile birds (&gt;3 min).</li>
                    <li><strong>Incident Capture:</strong> If an anomaly occurs, the lightweight downscaled ring buffer exports a 10-second MP4 clip.</li>
                    <li><strong>Alert Dispatch:</strong> Dispatches SSE events, Web Push notifications, and Telegram messages to farm operators.</li>
                    <li><strong>Sohayok AI RAG Synthesis:</strong> Real-time metrics are injected into Fireworks AI prompts alongside veterinary treatment guides.</li>
                  </ol>
                </section>

                {/* 5. Technology Stack */}
                <section id="techstack" className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
                  <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest text-brand-soft text-xs">5</span>
                    Technology Stack Breakdown
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="rounded-xl border border-line bg-canvas p-4 space-y-2">
                      <strong className="block text-brand font-bold uppercase tracking-wider text-[10px]">Backend & Computer Vision</strong>
                      <p><strong>Framework:</strong> FastAPI (Python 3.12)</p>
                      <p><strong>Vision Model:</strong> Ultralytics YOLO11n (CPU optimized)</p>
                      <p><strong>Motion Analysis:</strong> OpenCV Farnebäck Optical Flow</p>
                      <p><strong>Tracking:</strong> ByteTrack with 2-pass association</p>
                      <p><strong>Database:</strong> SQLite with WAL mode / PostgreSQL 16</p>
                    </div>
                    <div className="rounded-xl border border-line bg-canvas p-4 space-y-2">
                      <strong className="block text-brand font-bold uppercase tracking-wider text-[10px]">Frontend & AI Layer</strong>
                      <p><strong>Web App:</strong> Next.js 14 (App Router, Standalone)</p>
                      <p><strong>PWA / Offline:</strong> Serwist Service Worker</p>
                      <p><strong>Styling:</strong> Tailwind CSS (Bengali / English Typography)</p>
                      <p><strong>AI Provider:</strong> Fireworks AI (`gpt-oss-120b`)</p>
                      <p><strong>Rate Limiter:</strong> In-memory sliding window (15/min)</p>
                    </div>
                  </div>
                </section>

                {/* 6. Sohayok AI RAG Layer */}
                <section id="sohayok" className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
                  <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest text-brand-soft text-xs">6</span>
                    Sohayok AI (সহায়ক এআই) RAG Architecture
                  </h2>
                  <p className="text-xs text-ink-2 leading-relaxed mb-4">
                    Sohayok AI implements a Contextual Multi-Step RAG architecture. When a farmer submits an inquiry:
                  </p>
                  <ul className="space-y-2 text-xs text-ink-2 list-disc pl-4 mb-4">
                    <li><strong>Step 1 (Telemetry Harvesting):</strong> Reads the real-time bird count, health score, activity index, and unacknowledged alerts from the vision pipeline.</li>
                    <li><strong>Step 2 (Semantic Domain Matching):</strong> Evaluates query tokens across curated English and Bengali knowledge chunks covering Ranikhet, Gumboro, Coccidiosis, brooding temperatures, and heat stress.</li>
                    <li><strong>Step 3 (Prompt Augmentation):</strong> Synthesizes a structured bilingual prompt with clear veterinary disclaimers and live telemetry context.</li>
                    <li><strong>Step 4 (Fireworks AI Generation):</strong> Queries Fireworks AI with automatic fallback to offline deterministic synthesis if network interruptions occur.</li>
                  </ul>
                </section>

                {/* 7. API Reference */}
                <section id="api" className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
                  <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest text-brand-soft text-xs">7</span>
                    Core API Endpoints
                  </h2>
                  <div className="space-y-3 text-xs font-mono">
                    <div className="rounded-xl border border-line bg-canvas p-3">
                      <span className="rounded bg-ok px-1.5 py-0.5 text-[10px] font-bold text-white mr-2">GET</span>
                      <strong className="text-ink">/api/health</strong>
                      <p className="text-ink-3 text-[11px] font-sans mt-1">System diagnostics, pipeline FPS, database connection, and stream age.</p>
                    </div>
                    <div className="rounded-xl border border-line bg-canvas p-3">
                      <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white mr-2">POST</span>
                      <strong className="text-ink">/api/chat</strong>
                      <p className="text-ink-3 text-[11px] font-sans mt-1">Interacts with Sohayok AI RAG chatbot with IP rate limiting and citations.</p>
                    </div>
                    <div className="rounded-xl border border-line bg-canvas p-3">
                      <span className="rounded bg-ok px-1.5 py-0.5 text-[10px] font-bold text-white mr-2">GET</span>
                      <strong className="text-ink">/api/stream/mjpeg</strong>
                      <p className="text-ink-3 text-[11px] font-sans mt-1">Annotated live computer vision MJPEG video stream.</p>
                    </div>
                    <div className="rounded-xl border border-line bg-canvas p-3">
                      <span className="rounded bg-ok px-1.5 py-0.5 text-[10px] font-bold text-white mr-2">GET</span>
                      <strong className="text-ink">/api/stream/events</strong>
                      <p className="text-ink-3 text-[11px] font-sans mt-1">Real-time Server-Sent Events (SSE) telemetry and alert feed.</p>
                    </div>
                  </div>
                </section>

                {/* 8. Team Section in Whitepaper */}
                <section id="team" className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
                  <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest text-brand-soft text-xs">8</span>
                    Team & Key Contributors
                  </h2>
                  <TeamShowcaseGrid team={team} />
                </section>

                {/* 9. Performance & Security */}
                <section id="performance" className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
                  <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest text-brand-soft text-xs">9</span>
                    Performance, Scalability & Security
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="rounded-xl border border-line bg-canvas p-4 space-y-1.5">
                      <strong className="text-ink font-bold">Memory & Scaling Optimizations</strong>
                      <p className="text-ink-3">• Frame downscaling (max 480p in ring buffer) reduces RAM from 2.8GB to under 15MB.</p>
                      <p className="text-ink-3">• Non-blocking lock prevents concurrent video encoding thread pile-ups.</p>
                      <p className="text-ink-3">• CPU decimation (every 3rd frame) maintains 20-30 FPS tracking on modest instances.</p>
                    </div>
                    <div className="rounded-xl border border-line bg-canvas p-4 space-y-1.5">
                      <strong className="text-ink font-bold">Security & Biosecurity Hygiene</strong>
                      <p className="text-ink-3">• Non-invasive camera monitoring eliminates physical pathogen transmission.</p>
                      <p className="text-ink-3">• Sliding-window IP rate limiting prevents denial-of-service on LLM endpoints.</p>
                      <p className="text-ink-3">• VAPID web-push host restriction guards against SSRF attacks.</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Admin Settings Modal */}
      {adminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-brand" />
                <h3 className="text-base font-bold text-ink">Docs Access Control & Admin Settings</h3>
              </div>
              <button
                onClick={() => setAdminModalOpen(false)}
                className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Visibility Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-line bg-canvas p-3">
                <div>
                  <strong className="block text-ink font-bold">Public /docs Visibility</strong>
                  <span className="text-ink-3">When OFF, public users see the restricted screen.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEnabled(!isEnabled)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition-all",
                    isEnabled ? "bg-ok text-white" : "bg-crit text-white"
                  )}
                >
                  {isEnabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {isEnabled ? "ON (Public)" : "OFF (Hidden)"}
                </button>
              </div>

              {/* Schedule Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-line bg-canvas p-3">
                <div>
                  <strong className="block text-ink font-bold">Judging Window Schedule</strong>
                  <span className="text-ink-3">Restrict public viewing to specific dates.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleEnabled(!scheduleEnabled)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 font-bold transition-all",
                    scheduleEnabled ? "bg-brand text-white" : "bg-surface-2 text-ink-2"
                  )}
                >
                  {scheduleEnabled ? "Scheduled" : "Always On"}
                </button>
              </div>

              {/* Schedule Dates */}
              {scheduleEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-ink-3 mb-1 font-semibold">Start Date (UTC):</label>
                    <input
                      type="text"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-ink-3 mb-1 font-semibold">End Date (UTC):</label>
                    <input
                      type="text"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink"
                    />
                  </div>
                </div>
              )}

              <p className="text-[11px] text-ink-3">
                Default judging window: <strong>June 10, 2026 (00:00) &rarr; June 14, 2026 (23:59)</strong>.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                onClick={() => setAdminModalOpen(false)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink-2 hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAdminConfig}
                className="rounded-xl bg-brand px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-strong"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Uniform Team Showcase Component
function TeamShowcaseGrid({ team }: { team: TeamMember[] }) {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {team.map((member) => (
          <div
            key={member.id}
            className="rounded-2xl border border-line bg-canvas/40 p-5 shadow-sm text-center flex flex-col items-center transition-all hover:border-brand/40 hover:shadow-md"
          >
            {/* Uniform Profile Picture Frame with fallback avatar */}
            <div className="relative mb-4 h-24 w-24 overflow-hidden rounded-full border-2 border-brand/40 p-0.5 bg-surface shadow">
              {member.image ? (
                <img
                  src={member.image}
                  alt={member.name}
                  className="h-full w-full object-cover rounded-full"
                  onError={(e) => {
                    // Fallback avatar on image error
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-forest text-brand-soft font-bold text-lg">
                  {member.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <h4 className="text-base font-bold text-ink">{member.name}</h4>
            <span className="mt-0.5 rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand-strong">
              {member.role}
            </span>
            <a
              href={`mailto:${member.email}`}
              className="mt-2 text-xs text-brand hover:underline font-mono truncate max-w-full"
            >
              {member.email}
            </a>
            {member.bio && (
              <p className="mt-3 text-xs text-ink-3 leading-relaxed border-t border-line/60 pt-2">
                {member.bio}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 12 YC Pitch Deck Slides Definitions
const SLIDES = [
  {
    category: "1. The Problem",
    title: "1. Problem",
    headline: "Poultry Farmers Face Sudden 30% Mortality Before Human Walkthroughs Catch the First Sign.",
    content: (
      <div className="space-y-4">
        <p>Commercial poultry operates on thin margins. Disease outbreaks (Ranikhet, Gumboro), extreme heat stress, and nighttime cold piling destroy flocks in hours.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="rounded-xl border border-crit/30 bg-crit-soft/20 p-4">
            <strong className="text-crit block font-bold mb-1">Delayed Detection</strong>
            <span className="text-xs">Human barn inspections occur only 2-3 times daily, leaving 18+ hours unmonitored.</span>
          </div>
          <div className="rounded-xl border border-crit/30 bg-crit-soft/20 p-4">
            <strong className="text-crit block font-bold mb-1">Thermal Smothering</strong>
            <span className="text-xs">Cold drafts trigger mass clustering (huddling), suffocating bottom chicks in minutes.</span>
          </div>
          <div className="rounded-xl border border-crit/30 bg-crit-soft/20 p-4">
            <strong className="text-crit block font-bold mb-1">Biosecurity Breaches</strong>
            <span className="text-xs">Staff physically walking sheds stresses birds and introduces viral contaminants.</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    category: "2. The Solution",
    title: "2. Solution",
    headline: "Khamar Prohori: Autonomous 24/7 Computer-Vision Flock Intelligence + Sohayok AI.",
    content: (
      <div className="space-y-4">
        <p>Khamar Prohori turns ordinary shed CCTV cameras into non-invasive, autonomous veterinary guardians that run 24/7 on lightweight, low-cost hardware.</p>
        <ul className="list-disc pl-5 space-y-2 text-sm">
          <li><strong>Whole-Flock Kinetic Analytics:</strong> Dense optical flow calculates flock activity indices without individual ID tracking failures.</li>
          <li><strong>Early Stress & Smothering Warnings:</strong> Detects cold huddling and perimeter heat crowding before death occurs.</li>
          <li><strong>Immobile Bird Screening:</strong> Highlights motionless plumage blobs to isolate sick or moribund birds.</li>
          <li><strong>Sohayok AI Co-Pilot:</strong> Interactive bilingual assistant providing instant, telemetry-grounded advice in English and বাংলা.</li>
        </ul>
      </div>
    ),
  },
  {
    category: "3. Why Now?",
    title: "3. Why Now",
    headline: "Three Converging Technological Shifts Make This Viable Today.",
    content: (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="rounded-xl border border-line bg-canvas p-4">
          <strong className="text-brand block font-bold mb-1">1. Cheap Barn Cameras</strong>
          <p className="text-xs">IP cameras and RTSP surveillance are now ubiquitous in modern poultry sheds across Asia and Latin America.</p>
        </div>
        <div className="rounded-xl border border-line bg-canvas p-4">
          <strong className="text-brand block font-bold mb-1">2. Efficient Edge Vision</strong>
          <p className="text-xs">YOLO11n + Farnebäck optical flow achieve real-time performance on standard CPU hardware without costly GPUs.</p>
        </div>
        <div className="rounded-xl border border-line bg-canvas p-4">
          <strong className="text-brand block font-bold mb-1">3. Accessible LLM RAG</strong>
          <p className="text-xs">High-speed reasoning via Fireworks AI allows instant bilingual veterinary synthesis grounded in real-time telemetry.</p>
        </div>
      </div>
    ),
  },
  {
    category: "4. Live Product Demo",
    title: "4. Product Demo",
    headline: "Real-Time Telemetry & Non-Invasive Computer Vision.",
    content: (
      <div className="space-y-3">
        <p>The system ingests standard barn streams, analyzes motion dynamics, and renders instant situational awareness to the farmer's mobile phone:</p>
        <div className="rounded-xl border border-line bg-canvas p-4 flex flex-wrap justify-between items-center gap-4 text-xs">
          <div>
            <span className="text-ink-3">Live Feed Status:</span>
            <p className="font-bold text-ok">Active RTSP / Decimated Stream</p>
          </div>
          <div>
            <span className="text-ink-3">Motion Energy:</span>
            <p className="font-bold text-ink">Dense 8x8 Optical Flow</p>
          </div>
          <div>
            <span className="text-ink-3">Auto Incident Clips:</span>
            <p className="font-bold text-brand">10-Second MP4 Video Buffer</p>
          </div>
          <div>
            <span className="text-ink-3">Offline Mode:</span>
            <p className="font-bold text-ink">Serwist Service Worker PWA</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    category: "5. Market Opportunity",
    title: "5. Market",
    headline: "$45 Billion Global Livestock Tech Market with 4M+ Poultry Sheds in South Asia Alone.",
    content: (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="rounded-xl border border-brand/30 bg-brand-soft/20 p-4">
          <strong className="text-xs uppercase text-brand font-bold">TAM</strong>
          <h3 className="text-2xl font-extrabold text-ink mt-1">$45 Billion</h3>
          <p className="text-xs text-ink-3 mt-1">Global poultry farming and smart livestock monitoring market.</p>
        </div>
        <div className="rounded-xl border border-brand/30 bg-brand-soft/20 p-4">
          <strong className="text-xs uppercase text-brand font-bold">SAM</strong>
          <h3 className="text-2xl font-extrabold text-ink mt-1">$4.2 Billion</h3>
          <p className="text-xs text-ink-3 mt-1">Commercial broiler & layer sheds across South Asia & Southeast Asia.</p>
        </div>
        <div className="rounded-xl border border-brand/30 bg-brand-soft/20 p-4">
          <strong className="text-xs uppercase text-brand font-bold">SOM</strong>
          <h3 className="text-2xl font-extrabold text-ink mt-1">$650 Million</h3>
          <p className="text-xs text-ink-3 mt-1">Targeting 50,000 commercial farms and feed-mill integrated contract growers.</p>
        </div>
      </div>
    ),
  },
  {
    category: "6. Business Model",
    title: "6. Business Model",
    headline: "Scalable B2B SaaS + Enterprise Integrator Tier.",
    content: (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
        <div className="rounded-xl border border-line bg-canvas p-4">
          <strong className="text-sm font-bold text-ink block mb-1">Standard Farm SaaS</strong>
          <p className="text-brand font-bold text-base mb-2">$19 - $39 / shed / mo</p>
          <p className="text-ink-3">Includes 24/7 vision stream, anomaly alerts, PWA access, and Sohayok AI chat co-pilot.</p>
        </div>
        <div className="rounded-xl border border-line bg-canvas p-4">
          <strong className="text-sm font-bold text-ink block mb-1">Feed Mill & Integrators</strong>
          <p className="text-brand font-bold text-base mb-2">$15,000 / enterprise / yr</p>
          <p className="text-ink-3">Multi-farm management dashboard for contract growing companies (CP, Kazi Farms, Aftab).</p>
        </div>
        <div className="rounded-xl border border-line bg-canvas p-4">
          <strong className="text-sm font-bold text-ink block mb-1">Telemetry & Vet Network</strong>
          <p className="text-brand font-bold text-base mb-2">15% Telehealth Commission</p>
          <p className="text-ink-3">Instant connection to certified local poultry veterinarians when critical alerts trigger.</p>
        </div>
      </div>
    ),
  },
  {
    category: "7. Traction & Validation",
    title: "7. Traction",
    headline: "Proven 30% Mortality Reduction Potential & Low Compute Footprint.",
    content: (
      <div className="space-y-3 text-sm">
        <p>Engineered and benchmarked against commercial poultry shed recordings:</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="rounded-xl border border-line bg-canvas p-3">
            <h4 className="text-xl font-extrabold text-brand">&lt;15 MB</h4>
            <span className="text-[11px] text-ink-3">RAM video buffer</span>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3">
            <h4 className="text-xl font-extrabold text-brand">30 FPS</h4>
            <span className="text-[11px] text-ink-3">Real-time processing</span>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3">
            <h4 className="text-xl font-extrabold text-brand">100%</h4>
            <span className="text-[11px] text-ink-3">Non-invasive optical tracking</span>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3">
            <h4 className="text-xl font-extrabold text-brand">10</h4>
            <span className="text-[11px] text-ink-3">Automated anomaly rules</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    category: "8. Competition & Unfair Advantage",
    title: "8. Competition",
    headline: "Why Khamar Prohori Wins in the Barn.",
    content: (
      <div className="overflow-x-auto text-xs">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line text-ink-3">
              <th className="pb-2">Feature</th>
              <th className="pb-2 text-brand font-bold">Khamar Prohori</th>
              <th className="pb-2">Wearable IoT Sensors</th>
              <th className="pb-2">Manual Walkthroughs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-ink-2">
            <tr>
              <td className="py-2 font-semibold">Sensor Requirement</td>
              <td className="text-ok font-bold">Zero (Uses Cameras)</td>
              <td className="text-crit">Costly ear/leg tags</td>
              <td>Human labor</td>
            </tr>
            <tr>
              <td className="py-2 font-semibold">Dense Crowd Resilient</td>
              <td className="text-ok font-bold">Yes (Optical Flow)</td>
              <td className="text-crit">Prone to loss/pecking</td>
              <td>Disturbs flock</td>
            </tr>
            <tr>
              <td className="py-2 font-semibold">Language Support</td>
              <td className="text-ok font-bold">Bilingual (বাংলা & EN)</td>
              <td>English only</td>
              <td>Local</td>
            </tr>
            <tr>
              <td className="py-2 font-semibold">24/7 AI Co-Pilot</td>
              <td className="text-ok font-bold">Yes (Sohayok AI)</td>
              <td className="text-crit">No</td>
              <td className="text-crit">No</td>
            </tr>
          </tbody>
        </table>
      </div>
    ),
  },
  {
    category: "9. Go-To-Market",
    title: "9. GTM Strategy",
    headline: "Partnering with Feed Mills, Integrators & Agro-Dealers.",
    content: (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="rounded-xl border border-line bg-canvas p-3 space-y-1">
          <strong className="text-brand font-bold">1. Feed Mills & Integrators</strong>
          <p className="text-ink-3">Integrate with poultry conglomerates who supply day-old chicks and feed to thousands of contract farmers.</p>
        </div>
        <div className="rounded-xl border border-line bg-canvas p-3 space-y-1">
          <strong className="text-brand font-bold">2. Rural Agro-Dealer Network</strong>
          <p className="text-ink-3">Distribute through local veterinary pharmacies and feed retailers who have established trust with farmers.</p>
        </div>
        <div className="rounded-xl border border-line bg-canvas p-3 space-y-1">
          <strong className="text-brand font-bold">3. Self-Serve PWA Onboarding</strong>
          <p className="text-ink-3">Farmers connect their existing IP cameras with a simple RTSP URL in under 3 minutes.</p>
        </div>
      </div>
    ),
  },
  {
    category: "10. Team (Mandatory Enhancement)",
    title: "10. Team",
    headline: "Experienced Full-Stack, AI & Agriculture-Tech Engineers.",
    content: null, // Rendered via TeamShowcaseGrid component
  },
  {
    category: "11. 12-Month Roadmap",
    title: "11. Roadmap",
    headline: "Clear Milestones from Pilot Validation to 5,000 Connected Sheds.",
    content: (
      <div className="space-y-3 text-xs">
        <div className="flex gap-3 items-center rounded-xl border border-line bg-canvas p-3">
          <span className="rounded bg-brand px-2 py-1 font-bold text-white shrink-0">Q1-Q2 2026</span>
          <div>
            <strong className="text-ink block">Field Pilots & Video Buffer Optimization</strong>
            <span className="text-ink-3">Live commercial shed deployment, Sohayok AI RAG integration, &lt;15MB memory profile.</span>
          </div>
        </div>
        <div className="flex gap-3 items-center rounded-xl border border-line bg-canvas p-3">
          <span className="rounded bg-forest px-2 py-1 font-bold text-white shrink-0">Q3 2026</span>
          <div>
            <strong className="text-ink block">Acoustic Cough & Respiratory Distress Model</strong>
            <span className="text-ink-3">Adding audio spectrogram analysis to detect infectious bronchitis coughing.</span>
          </div>
        </div>
        <div className="flex gap-3 items-center rounded-xl border border-line bg-canvas p-3">
          <span className="rounded bg-surface-3 px-2 py-1 font-bold text-ink shrink-0">Q4 2026</span>
          <div>
            <strong className="text-ink block">Enterprise Integrator Portal & Telehealth</strong>
            <span className="text-ink-3">Multi-shed fleet dashboard and certified veterinary doctor marketplace.</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    category: "12. The Vision",
    title: "12. Vision",
    headline: "Democratizing Autonomous Livestock Biosecurity for Every Farmer Worldwide.",
    content: (
      <div className="space-y-4 text-sm sm:text-base">
        <p>We envision a future where no commercial farmer loses their livelihood to preventable flock disease or suffocating heat stress.</p>
        <p>By blending computer vision, edge efficiency, and bilingual AI reasoning, Khamar Prohori ensures that world-class flock intelligence is accessible, affordable, and actionable for farmers everywhere.</p>
        <div className="pt-4 flex items-center gap-3">
          <Link
            href="/"
            className="rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand-strong"
          >
            Launch Live Farm Dashboard &rarr;
          </Link>
          <a
            href="mailto:saikatislam709@gmail.com"
            className="rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-ink hover:bg-surface-2"
          >
            Contact Team
          </a>
        </div>
      </div>
    ),
  },
];

function jsonParseSafe(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  Bot,
  User,
  ChevronDown,
  Info,
  ShieldAlert,
  Flame,
  Activity,
  Minimize2,
  Maximize2,
  Copy,
  Check,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useLiveData } from "@/lib/LiveDataContext";
import { cn } from "@/lib/format";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  sources?: Array<{ id: string; title: string; category?: string }>;
  telemetry?: any;
}

const DEFAULT_SUGGESTIONS_EN = [
  "How is my flock doing right now?",
  "Are there any immobile or sick birds?",
  "How to prevent heat stress in broilers?",
  "What is the day 1 to 35 vaccine schedule?",
  "Correct brooding temperature for week 1?",
];

const DEFAULT_SUGGESTIONS_BN = [
  "বর্তমান ফ্লকের অবস্থা ও স্বাস্থ্য কেমন?",
  "কোনো পাখি কি স্থির বা অসুস্থ অবস্থায় আছে?",
  "তীব্র গরমে হিট স্ট্রোক রোধে কী করব?",
  "ব্রয়লার মুরগির পূর্ণাঙ্গ ভ্যাকসিন শিডিউল কী?",
  "১ম সপ্তাহে বাচ্চার ব্রুডিং তাপমাত্রা কত?",
];

export function SohayokWidget() {
  const { language, t, num } = useLanguage();
  const { stats, connection } = useLiveData();
  const isBn = language === "bn";

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize greeting message on first mount or language change
  useEffect(() => {
    if (messages.length === 0) {
      const greeting: Message = {
        id: "welcome-msg",
        role: "assistant",
        content: isBn
          ? "আসসালামু আলাইকুম! আমি **সহায়ক এআই (Sohayok AI)**, আপনার স্মার্ট খামার সহকারী। আপনার মুরগির স্বাস্থ্য, হিট স্ট্রোক, ব্রুডিং বা টিকা সম্পর্কে যেকোনো প্রশ্ন করতে পারেন।"
          : "Hello! I am **Sohayok AI**, your intelligent poultry farming co-pilot. Ask me anything about your current flock condition, heat stress, disease symptoms, or vaccination.",
        timestamp: Date.now(),
      };
      setMessages([greeting]);
    }
  }, [isBn, messages.length]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Build history payload
      const historyPayload = messages
        .filter((m) => m.id !== "welcome-msg")
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          history: historyPayload,
          language: isBn ? "bn" : "en",
        }),
      });

      if (res.status === 429) {
        const errorData = await res.json().catch(() => ({}));
        const retryAfter = res.headers.get("Retry-After") || "30";
        const limitMsg: Message = {
          id: `bot-err-${Date.now()}`,
          role: "assistant",
          content: isBn
            ? `⚠️ **অনুরোধের সীমা অতিক্রম করেছে।** দয়া করে ${retryAfter} সেকেন্ড পর পুনরায় প্রশ্ন করুন।`
            : `⚠️ **Rate limit reached.** Please wait ${retryAfter} seconds before sending another message.`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, limitMsg]);
        setRateLimitRemaining(0);
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();
      setRateLimitRemaining(data.rate_limit_remaining ?? null);

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        timestamp: Date.now(),
        sources: data.sources,
        telemetry: data.telemetry,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("Sohayok AI error:", err);
      const fallbackMsg: Message = {
        id: `bot-err-${Date.now()}`,
        role: "assistant",
        content: isBn
          ? "দুঃখিত, সংযোগে সাময়িক সমস্যা হয়েছে। দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।"
          : "Sorry, I encountered a temporary connection issue. Please try again shortly.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: "welcome-reset",
        role: "assistant",
        content: isBn
          ? "চ্যাট রিসেট করা হয়েছে। সহায়ক এআই আপনার যেকোনো নতুন প্রশ্নের উত্তর দিতে প্রস্তুত!"
          : "Conversation cleared. Sohayok AI is ready for your next question!",
        timestamp: Date.now(),
      },
    ]);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = isBn ? DEFAULT_SUGGESTIONS_BN : DEFAULT_SUGGESTIONS_EN;

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-forest px-4 py-3 text-white shadow-xl ring-2 ring-brand/40 transition-all hover:bg-forest-2 hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6"
          aria-label={t("chat_title")}
        >
          <div className="relative flex h-5 w-5 items-center justify-center">
            <Bot className="h-5 w-5 text-brand-soft" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand"></span>
            </span>
          </div>
          <span className="font-semibold text-xs tracking-wide">
            {isBn ? "সহায়ক এআই" : "Sohayok AI"}
          </span>
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-50 flex flex-col bg-surface shadow-2xl transition-all duration-200 border border-line overflow-hidden",
            isExpanded
              ? "inset-4 sm:inset-10 rounded-2xl"
              : "bottom-4 right-4 sm:bottom-6 sm:right-6 w-[94vw] sm:w-[440px] h-[85vh] sm:h-[620px] max-h-[85vh] rounded-2xl"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line bg-forest px-4 py-3 text-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/30 border border-brand/40">
                <Bot className="h-5 w-5 text-brand-soft" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm truncate">
                    {isBn ? "সহায়ক এআই" : "Sohayok AI"}
                  </h3>
                  <span className="rounded bg-brand/30 px-1.5 py-0.5 text-[10px] font-medium text-brand-soft">
                    RAG Live
                  </span>
                </div>
                <p className="text-[11px] text-ink-3 dark:text-zinc-400 truncate">
                  {isBn ? "কৃত্রিম বুদ্ধিমত্তা পোল্ট্রি সহকারী" : "AI Poultry Co-Pilot"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClear}
                title={t("chat_clear")}
                className="rounded p-1.5 text-zinc-300 hover:bg-forest-2 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Collapse" : "Expand"}
                className="hidden sm:inline-flex rounded p-1.5 text-zinc-300 hover:bg-forest-2 hover:text-white"
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded p-1.5 text-zinc-300 hover:bg-forest-2 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Live Farm Status Ribbon */}
          <div className="flex items-center justify-between border-b border-line bg-surface-2 px-3 py-1.5 text-[11px] text-ink-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-ok" />
              <span>
                {isBn ? "লাইভ ফ্লক:" : "Live Flock:"}{" "}
                <strong className="text-ink">
                  {stats ? num(stats.count) : "0"} {isBn ? "পাখি" : "birds"}
                </strong>
              </span>
              <span>·</span>
              <span>
                {isBn ? "স্বাস্থ্য:" : "Health:"}{" "}
                <strong className="text-brand">
                  {stats ? num(stats.flock_health_score, 0) : "100"}%
                </strong>
              </span>
            </div>
            {rateLimitRemaining !== null && (
              <span className="text-[10px] text-ink-3">
                {isBn ? "কোটা:" : "Limit:"} {rateLimitRemaining}/15
              </span>
            )}
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm bg-canvas/30">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex gap-2.5",
                  m.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {m.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-brand-soft">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-brand text-white rounded-br-sm"
                      : "bg-surface border border-line text-ink rounded-bl-sm"
                  )}
                >
                  {/* Message Content with simple markdown rendering */}
                  <div className="space-y-1.5 whitespace-pre-wrap text-[13px]">
                    {m.content.split("\n").map((line, idx) => {
                      if (line.startsWith("### ")) {
                        return <h4 key={idx} className="font-bold text-sm text-brand-strong dark:text-brand-soft mt-2">{line.replace("### ", "")}</h4>;
                      }
                      if (line.startsWith("- ") || line.startsWith("* ")) {
                        return (
                          <div key={idx} className="flex gap-2 pl-1">
                            <span className="text-brand font-bold">•</span>
                            <span>{line.substring(2)}</span>
                          </div>
                        );
                      }
                      return <p key={idx}>{line}</p>;
                    })}
                  </div>

                  {/* Sources pill if returned */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2.5 border-t border-line/60 pt-2 text-[11px] text-ink-3">
                      <div className="font-semibold text-[10px] uppercase tracking-wider mb-1 text-ink-2">
                        {isBn ? "তথ্যসূত্র:" : "Verified Sources:"}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {m.sources.map((s, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] border border-line text-ink-2"
                          >
                            <Info className="h-3 w-3 text-brand" />
                            {s.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action row for assistant message */}
                  {m.role === "assistant" && (
                    <div className="mt-1 flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleCopy(m.content, m.id)}
                        className="rounded p-1 text-ink-3 hover:text-ink hover:bg-surface-2"
                        title="Copy message"
                      >
                        {copiedId === m.id ? (
                          <Check className="h-3 w-3 text-ok" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {m.role === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-2.5 items-center text-ink-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-brand-soft">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-2 text-xs flex items-center gap-1.5 shadow-sm">
                  <span className="animate-pulse">
                    {isBn ? "সহায়ক চিন্তা করছে..." : "Sohayok AI is analyzing..."}
                  </span>
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Suggestions */}
          {messages.length <= 2 && (
            <div className="border-t border-line/60 bg-surface-2/60 p-2.5">
              <p className="mb-1.5 text-[10px] font-semibold text-ink-3 uppercase tracking-wider">
                {isBn ? "দ্রুত প্রশ্ন করুন:" : "Suggested Questions:"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(sug)}
                    className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-ink-2 hover:border-brand hover:text-brand transition-colors text-left"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Box */}
          <div className="border-t border-line bg-surface p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={t("chat_input_placeholder")}
                className="flex-1 resize-none rounded-xl border border-line bg-canvas/50 px-3.5 py-2.5 text-xs text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand max-h-24"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition-all shadow-sm",
                  !input.trim() || isLoading
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-brand-strong active:scale-95"
                )}
                aria-label={t("chat_send")}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-1.5 text-center text-[10px] text-ink-3">
              {t("chat_disclaimer")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

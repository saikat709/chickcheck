"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Language, translations, TranslationKey } from "./translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  /** Translate a key; `vars` fills `{name}` placeholders. */
  t: (key: TranslationKey, fallback?: string, vars?: Record<string, string | number>) => string;
  /** Locale-aware number: Bengali digits (০–৯) in Bangla, Latin in English. */
  num: (value: number | null | undefined, digits?: number) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => key,
  num: (v, d = 0) => (v ?? 0).toFixed(d),
});

const STORAGE_KEY = "chickcheck_language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    let initial: Language = "en";
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (saved === "en" || saved === "bn") {
        initial = saved;
      } else {
        // Auto-detect Bangladesh region (timezone or browser locale)
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        const browserLang = navigator.language || "";
        initial = tz.includes("Dhaka") || browserLang.toLowerCase().startsWith("bn") ? "bn" : "en";
        localStorage.setItem(STORAGE_KEY, initial);
      }
    } catch {
      initial = "en";
    }
    setLanguageState(initial);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "bn" : "en");
  }, [language, setLanguage]);

  const numFmt = useCallback(
    (value: number | null | undefined, digits = 0): string => {
      const v = Number.isFinite(value as number) ? (value as number) : 0;
      return v.toLocaleString(language === "bn" ? "bn-BD" : "en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        useGrouping: Math.abs(v) >= 10000,
      });
    },
    [language]
  );

  const t = useCallback(
    (key: TranslationKey, fallback?: string, vars?: Record<string, string | number>): string => {
      let s = translations[language]?.[key] ?? translations.en[key] ?? fallback ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, typeof v === "number" ? numFmt(v, 0) : v);
      }
      return s;
    },
    [language, numFmt]
  );


  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t, num: numFmt }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

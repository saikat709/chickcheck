"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Language, translations, TranslationKey } from "./translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chickcheck_language") as Language | null;
      if (saved && (saved === "en" || saved === "bn")) {
        setLanguageState(saved);
      } else {
        // Auto-detect if user's region is Bangladesh
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
          const browserLang = navigator.language || "";
          const isBangladesh = tz.includes("Dhaka") || browserLang.toLowerCase().startsWith("bn");
          const detected: Language = isBangladesh ? "bn" : "en";
          setLanguageState(detected);
          localStorage.setItem("chickcheck_language", detected);
        } catch {
          setLanguageState("en");
        }
      }
      setIsInitialized(true);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("chickcheck_language", lang);
    }
  };

  const toggleLanguage = () => {
    const nextLang: Language = language === "en" ? "bn" : "en";
    setLanguage(nextLang);
  };

  const t = (key: TranslationKey, fallback?: string): string => {
    const dict = translations[language];
    if (dict && key in dict) {
      return dict[key];
    }
    const enDict = translations.en;
    if (enDict && key in enDict) {
      return enDict[key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

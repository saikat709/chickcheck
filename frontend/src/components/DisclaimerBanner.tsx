"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export function DisclaimerBanner() {
  const { t } = useLanguage();

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-center gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
      <span>
        {t("disclaimer_notice", "Screening Signal Only: Movement-based computer vision analytics only. Not a veterinary diagnostic instrument.")}
      </span>
    </div>
  );
}


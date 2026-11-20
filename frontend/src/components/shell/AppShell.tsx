"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarContent } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileTabBar } from "./MobileTabBar";
import { ConnectivityBanner, UpdateBar, InstallPrompt } from "@/components/pwa/PwaBanners";
import { Drawer } from "@/components/ui/Overlay";
import { SohayokWidget } from "@/components/chat/SohayokWidget";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/format";

const COLLAPSE_KEY = "chickcheck_sidebar_collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useLanguage();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  return (
    <div className="min-h-screen" style={{ ["--sidebar-w" as string]: collapsed ? "72px" : "248px" }}>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 hidden transition-[width] duration-200 lg:block",
          collapsed ? "w-[72px]" : "w-[248px]"
        )}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </aside>

      {/* Mobile drawer */}
      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} side="left" className="w-[288px] max-w-[85vw]">
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </Drawer>

      <div className={cn("relative flex min-h-screen flex-col transition-[padding] duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-[248px]")}>
        {/* Farm signature texture, fades out before the data starts */}
        <div className="bg-field-texture pointer-events-none absolute inset-x-0 top-0 h-[360px]" aria-hidden />
        <Topbar />
        <UpdateBar />
        <ConnectivityBanner />
        <main className="relative mx-auto w-full max-w-[1440px] flex-1 px-3 py-4 min-[375px]:px-4 sm:px-6 sm:py-7 lg:px-8">{children}</main>
        {/* Bottom padding clears the mobile tab bar + home indicator */}
        <footer className="relative mx-auto w-full max-w-[1440px] px-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))] text-[11px] text-ink-3 sm:px-6 lg:px-8 lg:pb-6">
          <div className="border-t border-line pt-4">{t("disclaimer_notice")}</div>
        </footer>
      </div>

      <MobileTabBar onMore={() => setMobileOpen(true)} moreActive={mobileOpen || pathname.startsWith("/reports") || pathname.startsWith("/settings")} />
      <InstallPrompt />
      <SohayokWidget />
    </div>
  );
}

import { LayoutDashboard, Video, LineChart, BellRing, FileText, Settings } from "lucide-react";
import type { TranslationKey } from "@/lib/translations";

export interface NavItem {
  href: string;
  key: TranslationKey;
  icon: typeof LayoutDashboard;
  badge?: "alerts";
}

export interface NavGroup {
  key: TranslationKey;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    key: "nav_group_monitor",
    items: [
      { href: "/", key: "nav_dashboard", icon: LayoutDashboard },
      { href: "/live", key: "nav_live", icon: Video },
    ],
  },
  {
    key: "nav_group_insights",
    items: [
      { href: "/analytics", key: "nav_analytics", icon: LineChart },
      { href: "/events", key: "nav_events", icon: BellRing, badge: "alerts" },
      { href: "/reports", key: "nav_reports", icon: FileText },
    ],
  },
  {
    key: "nav_group_system",
    items: [{ href: "/settings", key: "nav_settings", icon: Settings }],
  },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function titleKeyFor(pathname: string): TranslationKey {
  for (const g of NAV) for (const i of g.items) if (isActive(pathname, i.href)) return i.key;
  return "nav_dashboard";
}

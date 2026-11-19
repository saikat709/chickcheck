import type { Metadata, Viewport } from "next";
import { Inter, Hind_Siliguri, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/LanguageContext";
import { ThemeProvider, themeInitScript } from "@/lib/ThemeContext";
import { LiveDataProvider } from "@/lib/LiveDataContext";
import { PwaProvider } from "@/lib/PwaContext";
import { ToastProvider } from "@/components/ui/Toast";
import { AppShell } from "@/components/shell/AppShell";

/*
 * Typography stack — resolved per glyph, so mixed Bangla/English sentences just work:
 *   Inter            → Latin letters, Latin digits, punctuation
 *   Hind Siliguri    → Bengali script, Bengali digits (০–৯), ৳, danda (।)
 *   Noto Sans Bengali→ fallback for any Bengali glyph Hind lacks
 * Only the `bengali` subset of the Bengali faces is loaded (no duplicate Latin bytes).
 */
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter", display: "swap" });
const hind = Hind_Siliguri({ subsets: ["bengali"], weight: ["400", "500", "600", "700"], variable: "--font-hind", display: "swap" });
const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-bn",
  display: "swap",
  preload: false, // fallback only — fetched if Hind lacks a glyph
});

export const metadata: Metadata = {
  title: "ChickCheck — Poultry Flock Intelligence",
  description: "Computer-vision behavioural monitoring for commercial poultry sheds: flock activity, thermal huddling, immobile-bird screening and alerts.",
  applicationName: "ChickCheck",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // iOS home-screen app: full-screen, status bar over our own safe-area padding
  appleWebApp: { capable: true, title: "ChickCheck", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF6EC" },
    { media: "(prefers-color-scheme: dark)", color: "#0C130F" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${hind.variable} ${notoBengali.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>
              <PwaProvider>
                <LiveDataProvider>
                  <AppShell>{children}</AppShell>
                </LiveDataProvider>
              </PwaProvider>
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

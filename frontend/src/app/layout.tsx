import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/LanguageContext";
import { ThemeProvider, themeInitScript } from "@/lib/ThemeContext";
import { LiveDataProvider } from "@/lib/LiveDataContext";
import { PwaProvider } from "@/lib/PwaContext";
import { ToastProvider } from "@/components/ui/Toast";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: "Khamar Prohori — Poultry Flock Intelligence",
  description: "Computer-vision behavioural monitoring for commercial poultry sheds: flock activity, thermal huddling, immobile-bird screening, and Sohayok AI co-pilot.",
  applicationName: "Khamar Prohori",
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
    <html lang="en" suppressHydrationWarning>
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

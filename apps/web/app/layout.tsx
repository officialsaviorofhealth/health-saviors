import type { Metadata } from "next";
import { AppProvider } from "./providers";
import { Navbar } from "@/components/ui/Navbar";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PullToRefresh } from "@/components/PullToRefresh";
import { AppFooter } from "@/components/AppFooter";
import { Onboarding } from "@/components/Onboarding";
import "./globals.css";

export const metadata: Metadata = {
  title: "Health Saviors — AI Healthcare Ecosystem",
  description: "Four AI agents integrated with your daily health logs. Track, analyze, and improve your wellness.",
  applicationName: "Health Saviors",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Health Saviors",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#10B981",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="noise">
        <AppProvider>
          <div className="min-h-[100dvh] flex flex-col relative">
            <Navbar />
            {/* Reserve space for the fixed navbar (64/80px) + device safe-area on PWA. See globals.css `.app-main`. */}
            <main className="flex-1 app-main">{children}</main>
            <AppFooter />
          </div>
          <ServiceWorkerRegistrar />
          <InstallPrompt />
          <PullToRefresh />
          <Onboarding />
        </AppProvider>
      </body>
    </html>
  );
}

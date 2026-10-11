import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { DarkModeHandler } from "@/components/layout/DarkModeHandler";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const montserrat = Montserrat({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TOPAS",
  description: "Manage and track SAP translation projects",
  // SVG for modern browsers; PNG/ICO fallbacks (generated from public/icon.svg) for the rest.
  // Bump ?v= when the logo changes: browsers cache favicons separately and ignore reloads.
  icons: {
    icon: [
      { url: "/icon.svg?v=2", type: "image/svg+xml" },
      { url: "/favicon.ico?v=2", sizes: "16x16 32x32 48x48" },
    ],
    apple: "/apple-touch-icon.png?v=2",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${montserrat.className} bg-gray-50 dark:bg-gray-900 transition-colors duration-200`}
      >
        <QueryProvider>
          <DarkModeHandler />
          {children}
          <Toaster richColors position="top-center" />
          <Analytics />
          <SpeedInsights />
        </QueryProvider>
      </body>
    </html>
  );
}

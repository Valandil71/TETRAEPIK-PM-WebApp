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
  title: "SAP Project Management",
  description: "Manage and track SAP translation projects",
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

"use client";

import { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { ImportReportNotifier } from "@/components/sap/ImportReportNotifier";
import { PushNotificationGate } from "@/components/notifications/PushNotificationGate";

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  return (
    <RealtimeProvider>
      <AppShell>{children}</AppShell>
      <ImportReportNotifier />
      <PushNotificationGate />
    </RealtimeProvider>
  );
}

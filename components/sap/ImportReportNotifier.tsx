"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/hooks/user/useUser";
import { useImportReports } from "@/hooks/sap/useImportReports";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { ImportReportModal } from "./ImportReportModal";

export function ImportReportNotifier() {
  const { user } = useUser();
  const isPmOrAdmin = user?.role === "admin" || user?.role === "pm";
  const { onImportReport } = useRealtime();
  const { reports, hasUnacknowledged, isLoading, acknowledgeAll } = useImportReports(
    isPmOrAdmin ? user?.id ?? null : null
  );
  const [showModal, setShowModal] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  // Show modal on mount if there are unacknowledged reports
  // Wait until loading is complete before deciding — otherwise the empty initial
  // state marks initialCheckDone=true and we never show existing reports.
  useEffect(() => {
    if (isLoading || !isPmOrAdmin) return;

    if (!initialCheckDone && hasUnacknowledged) {
      const timeout = setTimeout(() => {
        setShowModal(true);
        setInitialCheckDone(true);
      }, 0);
      return () => clearTimeout(timeout);
    } else if (!initialCheckDone) {
      const timeout = setTimeout(() => {
        setInitialCheckDone(true);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [hasUnacknowledged, isPmOrAdmin, initialCheckDone, isLoading]);

  // Show modal on realtime import report events
  useEffect(() => {
    if (!isPmOrAdmin) return;

    const unsubscribe = onImportReport(() => {
      setShowModal(true);
    });

    return unsubscribe;
  }, [isPmOrAdmin, onImportReport]);

  const handleDismiss = () => {
    setShowModal(false);
    if (hasUnacknowledged) {
      acknowledgeAll();
    }
  };

  if (!showModal || !isPmOrAdmin || reports.length === 0) return null;

  return <ImportReportModal reports={reports} onDismiss={handleDismiss} />;
}

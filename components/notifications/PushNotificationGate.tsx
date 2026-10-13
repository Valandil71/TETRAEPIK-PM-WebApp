"use client";

import { useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/user/useUser";
import { usePushSubscription } from "@/hooks/notifications/usePushSubscription";

/**
 * Desktop notifications are mandatory. Keeps this browser subscribed and, until permission is
 * granted, shows a banner. The "required" banner cannot be dismissed; the "blocked" one can be
 * closed, but only until the next page reload (the state lives in this always-mounted gate).
 */
export function PushNotificationGate() {
  const { user } = useUser();
  const { status, enable } = usePushSubscription(user?.id);
  const [blockedDismissed, setBlockedDismissed] = useState(false);

  if (!user || (status !== "default" && status !== "denied")) return null;
  if (status === "denied" && blockedDismissed) return null;

  return (
    <div
      role="alert"
      data-push-banner
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 shadow-lg px-5 py-4 flex items-center gap-4"
    >
      {status === "default" ? (
        <>
          <Bell className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 text-sm text-amber-900 dark:text-amber-100">
            <p className="font-semibold">Desktop notifications are required</p>
            <p>You&apos;ll be notified when projects are assigned to you or completed.</p>
          </div>
          <Button
            size="sm"
            onClick={enable}
            className="bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
          >
            Enable
          </Button>
        </>
      ) : (
        <>
          <BellOff className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 text-sm text-amber-900 dark:text-amber-100">
            <p className="font-semibold">Notifications are blocked</p>
            <p>
              Click the icon to the left of the address bar, set Notifications to
              &quot;Allow&quot; and reload the page.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBlockedDismissed(true)}
            className="shrink-0 self-start p-1 rounded-md text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 cursor-pointer transition-colors"
            aria-label="Close notifications warning"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}

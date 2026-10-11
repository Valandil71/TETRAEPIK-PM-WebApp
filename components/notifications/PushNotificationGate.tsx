"use client";

import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/user/useUser";
import { usePushSubscription } from "@/hooks/notifications/usePushSubscription";

/**
 * Desktop notifications are mandatory. Keeps this browser subscribed and, until permission is
 * granted, shows a banner that cannot be dismissed.
 */
export function PushNotificationGate() {
  const { user } = useUser();
  const { status, enable } = usePushSubscription(user?.id);

  if (!user || (status !== "default" && status !== "denied")) return null;

  return (
    <div
      role="alert"
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
        </>
      )}
    </div>
  );
}

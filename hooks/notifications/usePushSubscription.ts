"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useSupabase } from "@/hooks/core/useSupabase";
import { isPushSupported, syncPushSubscription } from "@/lib/notifications/pushClient";

export type PushStatus = "loading" | "unsupported" | NotificationPermission;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);

  // Follow changes made in the browser's site settings while the app is open.
  let permissionStatus: PermissionStatus | null = null;
  navigator.permissions
    ?.query({ name: "notifications" })
    .then((result) => {
      permissionStatus = result;
      result.addEventListener("change", notify);
    })
    .catch(() => {});

  return () => {
    listeners.delete(listener);
    permissionStatus?.removeEventListener("change", notify);
  };
}

function getSnapshot(): PushStatus {
  return isPushSupported() ? Notification.permission : "unsupported";
}

function getServerSnapshot(): PushStatus {
  return "loading";
}

/**
 * Notifications are mandatory: whenever permission is granted, this browser's subscription is
 * (re)saved for the signed-in user. `enable` must be called from a click (browsers only show
 * the permission prompt in response to a user gesture).
 */
export function usePushSubscription(userId: string | null | undefined) {
  const supabase = useSupabase();
  const status = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (status !== "granted" || !userId) return;
    syncPushSubscription(supabase).catch((error) =>
      console.warn("Push subscription failed:", error)
    );
  }, [status, userId, supabase]);

  const enable = useCallback(async () => {
    await Notification.requestPermission();
    notify();
  }, []);

  return { status, enable };
}

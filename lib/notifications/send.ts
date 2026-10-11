import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushPayload } from "@/lib/notifications/recipients";
import { isAllowedPushEndpoint } from "@/lib/notifications/endpoints";

interface SubscriptionRow {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error("Missing VAPID env vars (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT).");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

/** Notification type preferences (project types) per user. Missing user = no filter. */
export async function loadPreferences(
  admin: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (userIds.length === 0) return result;

  const { data, error } = await admin
    .from("notification_preferences")
    .select("user_id, project_types")
    .in("user_id", userIds);
  if (error) throw new Error(`Failed to load notification preferences: ${error.message}`);

  (data ?? []).forEach((row: { user_id: string; project_types: string[] | null }) =>
    result.set(row.user_id, row.project_types ?? [])
  );
  return result;
}

/**
 * Sends one notification per user to every browser they are subscribed on. Subscriptions
 * the push service reports as gone (404/410) are deleted. Returns how many pushes went out.
 */
export async function sendPushToUsers(
  admin: SupabaseClient,
  payloads: Map<string, PushPayload>
): Promise<number> {
  if (payloads.size === 0) return 0;
  configureVapid();

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", [...payloads.keys()]);
  if (error) throw new Error(`Failed to load push subscriptions: ${error.message}`);

  const subscriptions = ((data ?? []) as SubscriptionRow[]).filter((sub) => {
    if (isAllowedPushEndpoint(sub.endpoint)) return true;
    console.warn("Skipping push subscription with a non push-service endpoint:", sub.id);
    return false;
  });
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payloads.get(sub.user_id)),
        { TTL: 60 * 60 * 24 }
      )
    )
  );

  const expiredIds: number[] = [];
  let sent = 0;
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      sent++;
      return;
    }
    const statusCode = (result.reason as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      expiredIds.push(subscriptions[i].id);
    } else {
      console.error("Push send failed:", statusCode, (result.reason as Error)?.message);
    }
  });

  if (expiredIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", expiredIds);
  }

  return sent;
}

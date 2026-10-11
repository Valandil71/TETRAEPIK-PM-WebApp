// Browser push services. The server only ever sends to these hosts (no SSRF via a stored URL).
// Keep in sync with save_push_subscription (supabase/migrations/20261011_restrict_push_endpoints.sql).
const EXACT_HOSTS = ["fcm.googleapis.com", "updates.push.services.mozilla.com"];
const SUFFIX_HOSTS = ["notify.windows.com", "push.apple.com"];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) return false;

  const host = url.hostname.toLowerCase();
  return (
    EXACT_HOSTS.includes(host) ||
    SUFFIX_HOSTS.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
  );
}

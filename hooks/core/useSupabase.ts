"use client";

import { createBrowserClient } from "@supabase/ssr";

// Module-level singleton — stable reference across all hook calls and renders.
// Prevents useEffect re-runs in RealtimeProvider that depend on this client.
let cachedClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Shared hook for creating Supabase browser client.
 * Centralizes Supabase client creation logic used across all hooks.
 *
 * @returns Supabase client instance (singleton)
 * @throws Error if required environment variables are missing
 */
export function useSupabase() {
  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  cachedClient = createBrowserClient(supabaseUrl, supabaseKey);
  return cachedClient;
}

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const config = getSupabaseConfig();
  if (!config) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(config.url, config.anonKey);
  }
  return browserClient;
}

export function createBrowserSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createBrowserClient(url, anonKey);
}

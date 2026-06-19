import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@proven-power/shared-types";

export type { Database } from "@proven-power/shared-types";
export type ProvenPowerSupabaseClient = SupabaseClient<Database>;

interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * For React Native (Expo). Web/Next.js apps use @supabase/ssr directly
 * (browser/server/proxy clients) since cookie handling is App Router-specific —
 * see apps/web/lib/supabase and apps/admin/lib/supabase.
 */
export function createMobileSupabaseClient(
  url: string,
  publishableKey: string,
  storage: AsyncStorageLike
): ProvenPowerSupabaseClient {
  return createClient<Database>(url, publishableKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

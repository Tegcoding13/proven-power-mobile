import { createClient } from "@supabase/supabase-js";
import type { Database } from "@proven-power/shared-types";

// Service-role client — bypasses RLS. Only for trusted server contexts with
// no logged-in user, like the scheduled inventory sync cron job. Never
// import this from a client component or expose SUPABASE_SECRET_KEY publicly.
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY environment variables.");
  }
  return createClient<Database>(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

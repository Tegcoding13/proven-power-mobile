import { createClient } from "@supabase/supabase-js";
import type { Database } from "@proven-power/shared-types";

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variables.");
}

// Service-role client — bypasses RLS. Never expose this key or this client to any frontend.
export const supabaseAdmin = createClient<Database>(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

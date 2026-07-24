import { createClient } from "@supabase/supabase-js";
import type { Database } from "@proven-power/shared-types";

// Service-role client — server-side only. Never import this from client components.
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

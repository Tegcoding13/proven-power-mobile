"use server";

import { revalidatePath } from "next/cache";
import { syncWordPressPosts, type WordPressSyncResult } from "../../lib/wordpress-sync";
import { createServiceRoleClient } from "../../lib/supabase/service-role";

export async function syncWordPress(): Promise<WordPressSyncResult> {
  const supabase = createServiceRoleClient();
  const result = await syncWordPressPosts(supabase);
  revalidatePath("/promotions");
  return result;
}

import { createClient } from "./supabase/client";

export function getPublicInventoryPhotoUrl(storagePath: string): string {
  const supabase = createClient();
  return supabase.storage.from("inventory-photos").getPublicUrl(storagePath).data.publicUrl;
}

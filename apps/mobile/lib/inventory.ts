import { supabase } from "./supabase";

export function getPublicInventoryPhotoUrl(storagePath: string): string {
  return supabase.storage.from("inventory-photos").getPublicUrl(storagePath).data.publicUrl;
}

import { createClient } from "./supabase/client";

export function getPublicInventoryPhotoUrl(photo: { storage_path: string | null; external_url?: string | null }): string {
  if (photo.external_url) return photo.external_url;
  const supabase = createClient();
  return supabase.storage.from("inventory-photos").getPublicUrl(photo.storage_path ?? "").data.publicUrl;
}

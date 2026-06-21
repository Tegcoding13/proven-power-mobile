import { createClient } from "./supabase/client";

export function getPublicInventoryPhotoUrl(photo: { storage_path: string | null; external_url?: string | null }): string {
  if (photo.external_url) return photo.external_url;
  const supabase = createClient();
  return supabase.storage.from("inventory-photos").getPublicUrl(photo.storage_path ?? "").data.publicUrl;
}

export async function uploadInventoryPhoto(listingId: string, file: File) {
  const supabase = createClient();
  const path = `${listingId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("inventory-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (uploadError) throw uploadError;

  const { data: photoRow, error: insertError } = await supabase
    .from("inventory_listing_photos")
    .insert({ listing_id: listingId, storage_path: path })
    .select("*")
    .single();
  if (insertError) throw insertError;
  return photoRow;
}

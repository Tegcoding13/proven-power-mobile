import imageCompression from "browser-image-compression";
import { createClient } from "./supabase/client";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

async function compressImage(file: File): Promise<File> {
  return imageCompression(file, { maxWidthOrHeight: 1920, maxSizeMB: 1, useWebWorker: true });
}

export async function uploadEquipmentPhoto(params: {
  businessAccountId: string;
  equipmentId: string;
  file: File;
  uploadedByProfileId: string;
  caption?: string;
}) {
  const supabase = createClient();
  const compressed = await compressImage(params.file);
  const path = `${params.businessAccountId}/${params.equipmentId}/${Date.now()}-${params.file.name}`;

  const { error: uploadError } = await supabase.storage.from("equipment-photos").upload(path, compressed, {
    contentType: compressed.type || "image/jpeg",
  });
  if (uploadError) throw uploadError;

  const { data: photoRow, error: insertError } = await supabase
    .from("equipment_photos")
    .insert({
      equipment_id: params.equipmentId,
      storage_path: path,
      caption: params.caption ?? null,
      uploaded_by_profile_id: params.uploadedByProfileId,
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return photoRow;
}

export async function getSignedPhotoUrl(storagePath: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.storage.from("equipment-photos").createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

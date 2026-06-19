import imageCompression from "browser-image-compression";
import { createClient } from "./supabase/client";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function uploadPartsRequestMedia(params: {
  businessAccountId: string;
  partsRequestId: string;
  file: File;
  uploadedByProfileId: string;
}) {
  const supabase = createClient();
  const compressed = await imageCompression(params.file, { maxWidthOrHeight: 1920, maxSizeMB: 1, useWebWorker: true });
  const path = `${params.businessAccountId}/${params.partsRequestId}/${Date.now()}-${params.file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("parts-request-media")
    .upload(path, compressed, { contentType: compressed.type || "image/jpeg" });
  if (uploadError) throw uploadError;

  const { data: mediaRow, error: insertError } = await supabase
    .from("parts_request_media")
    .insert({
      parts_request_id: params.partsRequestId,
      storage_path: path,
      uploaded_by_profile_id: params.uploadedByProfileId,
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return mediaRow;
}

export async function getSignedPartsRequestMediaUrl(storagePath: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.storage.from("parts-request-media").createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";
import { compressImage } from "./equipment-photos";
import { supabase } from "./supabase";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function uploadPartsRequestMedia(params: {
  businessAccountId: string;
  partsRequestId: string;
  localUri: string;
  uploadedByProfileId: string;
}) {
  const compressedUri = await compressImage(params.localUri);
  const fileBase64 = await FileSystem.readAsStringAsync(compressedUri, { encoding: FileSystem.EncodingType.Base64 });
  const path = `${params.businessAccountId}/${params.partsRequestId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("parts-request-media")
    .upload(path, decode(fileBase64), { contentType: "image/jpeg" });
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
  const { data } = await supabase.storage.from("parts-request-media").createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

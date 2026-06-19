import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";
import { supabase } from "./supabase";

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.7;
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/** Resize/compress before upload to keep queued uploads small on poor rural connections. */
export async function compressImage(localUri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: MAX_DIMENSION } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export async function uploadEquipmentPhoto(params: {
  businessAccountId: string;
  equipmentId: string;
  localUri: string;
  uploadedByProfileId: string;
  caption?: string;
}) {
  const compressedUri = await compressImage(params.localUri);
  const fileBase64 = await FileSystem.readAsStringAsync(compressedUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const path = `${params.businessAccountId}/${params.equipmentId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("equipment-photos")
    .upload(path, decode(fileBase64), { contentType: "image/jpeg" });

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
  const { data } = await supabase.storage
    .from("equipment-photos")
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

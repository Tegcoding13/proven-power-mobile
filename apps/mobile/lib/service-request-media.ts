import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";
import type { ServiceRequestMediaType } from "@proven-power/shared-types";
import { compressImage } from "./equipment-photos";
import { supabase } from "./supabase";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function uploadServiceRequestMedia(params: {
  businessAccountId: string;
  serviceRequestId: string;
  localUri: string;
  mediaType: ServiceRequestMediaType;
  uploadedByProfileId: string;
}) {
  const uploadUri = params.mediaType === "photo" ? await compressImage(params.localUri) : params.localUri;
  const fileBase64 = await FileSystem.readAsStringAsync(uploadUri, { encoding: FileSystem.EncodingType.Base64 });
  const extension = params.mediaType === "photo" ? "jpg" : "mov";
  const contentType = params.mediaType === "photo" ? "image/jpeg" : "video/quicktime";

  const path = `${params.businessAccountId}/${params.serviceRequestId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("service-request-media")
    .upload(path, decode(fileBase64), { contentType });
  if (uploadError) throw uploadError;

  const { data: mediaRow, error: insertError } = await supabase
    .from("service_request_media")
    .insert({
      service_request_id: params.serviceRequestId,
      media_type: params.mediaType,
      storage_path: path,
      uploaded_by_profile_id: params.uploadedByProfileId,
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return mediaRow;
}

export async function getSignedServiceRequestMediaUrl(storagePath: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("service-request-media")
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

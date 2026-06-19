import imageCompression from "browser-image-compression";
import type { ServiceRequestMediaType } from "@proven-power/shared-types";
import { createClient } from "./supabase/client";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function uploadServiceRequestMedia(params: {
  businessAccountId: string;
  serviceRequestId: string;
  file: File;
  mediaType: ServiceRequestMediaType;
  uploadedByProfileId: string;
}) {
  const supabase = createClient();
  const uploadFile =
    params.mediaType === "photo"
      ? await imageCompression(params.file, { maxWidthOrHeight: 1920, maxSizeMB: 1, useWebWorker: true })
      : params.file;

  const path = `${params.businessAccountId}/${params.serviceRequestId}/${Date.now()}-${params.file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("service-request-media")
    .upload(path, uploadFile, { contentType: uploadFile.type || "application/octet-stream" });
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
  const supabase = createClient();
  const { data } = await supabase.storage
    .from("service-request-media")
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

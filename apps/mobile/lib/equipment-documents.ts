import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";
import type { EquipmentDocType } from "@proven-power/shared-types";
import { supabase } from "./supabase";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function uploadEquipmentDocument(params: {
  businessAccountId: string;
  equipmentId: string;
  localUri: string;
  fileName: string;
  mimeType: string;
  docType: EquipmentDocType;
  uploadedByProfileId: string;
}) {
  const fileBase64 = await FileSystem.readAsStringAsync(params.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const path = `${params.businessAccountId}/${params.equipmentId}/${Date.now()}-${params.fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("equipment-documents")
    .upload(path, decode(fileBase64), { contentType: params.mimeType });

  if (uploadError) throw uploadError;

  const { data: documentRow, error: insertError } = await supabase
    .from("equipment_documents")
    .insert({
      equipment_id: params.equipmentId,
      doc_type: params.docType,
      storage_path: path,
      file_name: params.fileName,
      uploaded_by_profile_id: params.uploadedByProfileId,
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return documentRow;
}

export async function getSignedDocumentUrl(storagePath: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("equipment-documents")
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

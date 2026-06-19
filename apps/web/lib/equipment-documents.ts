import type { EquipmentDocType } from "@proven-power/shared-types";
import { createClient } from "./supabase/client";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function uploadEquipmentDocument(params: {
  businessAccountId: string;
  equipmentId: string;
  file: File;
  docType: EquipmentDocType;
  uploadedByProfileId: string;
}) {
  const supabase = createClient();
  const path = `${params.businessAccountId}/${params.equipmentId}/${Date.now()}-${params.file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("equipment-documents")
    .upload(path, params.file, { contentType: params.file.type || "application/octet-stream" });
  if (uploadError) throw uploadError;

  const { data: documentRow, error: insertError } = await supabase
    .from("equipment_documents")
    .insert({
      equipment_id: params.equipmentId,
      doc_type: params.docType,
      storage_path: path,
      file_name: params.file.name,
      uploaded_by_profile_id: params.uploadedByProfileId,
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return documentRow;
}

export async function getSignedDocumentUrl(storagePath: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.storage.from("equipment-documents").createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

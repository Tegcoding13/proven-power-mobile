import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";
import type { MessageAttachmentType } from "@proven-power/shared-types";
import { compressImage } from "./equipment-photos";
import { supabase } from "./supabase";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function uploadMessageAttachment(params: {
  businessAccountId: string;
  threadId: string;
  messageId: string;
  localUri: string;
  fileName: string;
  mediaType: MessageAttachmentType;
  mimeType: string;
}) {
  const uploadUri = params.mediaType === "photo" ? await compressImage(params.localUri) : params.localUri;
  const fileBase64 = await FileSystem.readAsStringAsync(uploadUri, { encoding: FileSystem.EncodingType.Base64 });
  const path = `${params.businessAccountId}/${params.threadId}/${Date.now()}-${params.fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("message-attachments")
    .upload(path, decode(fileBase64), { contentType: params.mimeType });
  if (uploadError) throw uploadError;

  const { data: attachmentRow, error: insertError } = await supabase
    .from("message_attachments")
    .insert({
      message_id: params.messageId,
      storage_path: path,
      file_name: params.fileName,
      media_type: params.mediaType,
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return attachmentRow;
}

export async function getSignedMessageAttachmentUrl(storagePath: string): Promise<string | null> {
  const { data } = await supabase.storage.from("message-attachments").createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

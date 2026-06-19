import type { MessageAttachmentType } from "@proven-power/shared-types";
import { createClient } from "./supabase/client";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function uploadMessageAttachment(params: {
  businessAccountId: string;
  threadId: string;
  messageId: string;
  file: File;
  mediaType: MessageAttachmentType;
}) {
  const supabase = createClient();
  const path = `${params.businessAccountId}/${params.threadId}/${Date.now()}-${params.file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("message-attachments")
    .upload(path, params.file, { contentType: params.file.type || "application/octet-stream" });
  if (uploadError) throw uploadError;

  const { data: attachmentRow, error: insertError } = await supabase
    .from("message_attachments")
    .insert({
      message_id: params.messageId,
      storage_path: path,
      file_name: params.file.name,
      media_type: params.mediaType,
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return attachmentRow;
}

export async function getSignedMessageAttachmentUrl(storagePath: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.storage.from("message-attachments").createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

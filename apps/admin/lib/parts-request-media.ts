import { createClient } from "./supabase/client";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function getSignedPartsRequestMediaUrl(storagePath: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.storage.from("parts-request-media").createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

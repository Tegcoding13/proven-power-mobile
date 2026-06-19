"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Message, MessageAttachment } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { useBusinessAccount } from "../../../lib/business-account";
import { uploadMessageAttachment, getSignedMessageAttachmentUrl } from "../../../lib/message-attachments";

type MessageWithAttachments = Message & { attachments: { id: string; url: string }[] };

async function fetchThreadMessages(threadId: string): Promise<MessageWithAttachments[]> {
  const supabase = createClient();
  const { data: messageRows } = await supabase.from("messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: true });
  const messageIds = (messageRows ?? []).map((m) => m.id);
  const { data: attachmentRows } = messageIds.length
    ? await supabase.from("message_attachments").select("*").in("message_id", messageIds)
    : { data: [] as MessageAttachment[] };

  const attachmentsByMessage = new Map<string, MessageAttachment[]>();
  for (const att of attachmentRows ?? []) {
    const list = attachmentsByMessage.get(att.message_id) ?? [];
    list.push(att);
    attachmentsByMessage.set(att.message_id, list);
  }

  return Promise.all(
    (messageRows ?? []).map(async (m) => ({
      ...m,
      attachments: (
        await Promise.all(
          (attachmentsByMessage.get(m.id) ?? []).map(async (a) => ({ id: a.id, url: await getSignedMessageAttachmentUrl(a.storage_path) }))
        )
      ).filter((a): a is { id: string; url: string } => Boolean(a.url)),
    }))
  );
}

async function markUnreadAsRead(threadId: string, messages: MessageWithAttachments[]) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const unread = messages.filter((m) => m.sender_profile_id !== userData.user!.id);
  if (unread.length > 0) {
    await supabase
      .from("message_read_receipts")
      .upsert(
        unread.map((m) => ({ message_id: m.id, profile_id: userData.user!.id })),
        { onConflict: "message_id,profile_id", ignoreDuplicates: true }
      );
  }
}

export default function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { businessAccount } = useBusinessAccount();
  const [messages, setMessages] = useState<MessageWithAttachments[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    fetchThreadMessages(id).then((enriched) => {
      if (!isCurrent) return;
      setMessages(enriched);
      setIsLoading(false);
      markUnreadAsRead(id, enriched);
    });
    return () => {
      isCurrent = false;
    };
  }, [id]);

  async function reload() {
    const enriched = await fetchThreadMessages(id);
    setMessages(enriched);
  }

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    setIsSending(true);
    await supabase.from("messages").insert({
      thread_id: id,
      sender_profile_id: userData.user.id,
      sender_type: "customer",
      body: body.trim(),
    });
    setBody("");
    setIsSending(false);
    reload();
  }

  async function handleAttach(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !businessAccount) return;
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: message } = await supabase
      .from("messages")
      .insert({ thread_id: id, sender_profile_id: userData.user.id, sender_type: "customer", body: null })
      .select("*")
      .single();

    if (message) {
      await uploadMessageAttachment({
        businessAccountId: businessAccount.id,
        threadId: id,
        messageId: message.id,
        file,
        mediaType: file.type.startsWith("image") ? "photo" : file.type.startsWith("video") ? "video" : "document",
      });
    }
    event.target.value = "";
    reload();
  }

  if (isLoading) {
    return <p className="px-4 py-8 text-gray-700">Loading...</p>;
  }

  return (
    <div className="flex flex-1 flex-col max-w-2xl mx-auto w-full px-4 py-8">
      <Link href="/messages" className="text-sm text-green-700 mb-4">
        ← Back to Messages
      </Link>
      <div className="flex flex-1 flex-col gap-3 mb-4">
        {messages.map((m) => {
          const isMine = m.sender_type === "customer";
          return (
            <div key={m.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  m.is_quote ? "bg-amber-100" : isMine ? "bg-green-600 text-white" : "bg-gray-100 text-black"
                }`}
              >
                {m.is_quote ? <p className="text-xs font-bold text-amber-800 mb-1">QUOTE</p> : null}
                {m.body ? <p>{m.body}</p> : null}
                {m.attachments.map((a) => (
                  <Image key={a.id} src={a.url} alt="Attachment" width={160} height={160} className="rounded mt-1 object-cover" />
                ))}
              </div>
              <span className="text-xs text-gray-500 mt-1">
                {new Date(m.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 items-center border-t border-gray-100 pt-4">
        <label className="cursor-pointer text-2xl">
          📎
          <input type="file" accept="image/*,video/*,application/pdf" onChange={handleAttach} className="hidden" />
        </label>
        <input
          placeholder="Message..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="flex-1 min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
        />
        <button type="submit" disabled={!body.trim() || isSending} className="min-h-12 rounded-lg bg-green-600 px-6 font-semibold text-white disabled:opacity-70">
          Send
        </button>
      </form>
    </div>
  );
}

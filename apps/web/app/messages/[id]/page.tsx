"use client";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Message, MessageAttachment } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { useBusinessAccount } from "../../../lib/business-account";
import { uploadMessageAttachment, getSignedMessageAttachmentUrl } from "../../../lib/message-attachments";
import { PageHeader } from "../../../components/PageHeader";

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

  return Promise.all((messageRows ?? []).map(async (m) => ({
    ...m,
    attachments: (await Promise.all(
      (attachmentsByMessage.get(m.id) ?? []).map(async (a) => ({ id: a.id, url: await getSignedMessageAttachmentUrl(a.storage_path) }))
    )).filter((a): a is { id: string; url: string } => Boolean(a.url)),
  })));
}

async function markUnreadAsRead(threadId: string, messages: MessageWithAttachments[]) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  const unread = messages.filter((m) => m.sender_profile_id !== userData.user!.id);
  if (unread.length > 0) {
    await supabase.from("message_read_receipts").upsert(
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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCurrent = true;
    fetchThreadMessages(id).then((enriched) => {
      if (!isCurrent) return;
      setMessages(enriched);
      setIsLoading(false);
      markUnreadAsRead(id, enriched);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
    return () => { isCurrent = false; };
  }, [id]);

  async function reload() {
    const enriched = await fetchThreadMessages(id);
    setMessages(enriched);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setIsSending(true);
    await supabase.from("messages").insert({ thread_id: id, sender_profile_id: userData.user.id, sender_type: "customer", body: body.trim() });
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
    const { data: message } = await supabase.from("messages")
      .insert({ thread_id: id, sender_profile_id: userData.user.id, sender_type: "customer", body: null })
      .select("*").single();
    if (message) {
      await uploadMessageAttachment({ businessAccountId: businessAccount.id, threadId: id, messageId: message.id, file, mediaType: file.type.startsWith("image") ? "photo" : file.type.startsWith("video") ? "video" : "document" });
    }
    event.target.value = "";
    reload();
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Messages" />
        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-3">
          {[1,2,3].map((i) => <div key={i} className={`h-12 bg-white rounded-2xl animate-pulse shadow-sm ${i % 2 === 0 ? "mr-12" : "ml-12"}`} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <PageHeader title="Conversation" />

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full flex flex-col gap-2">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">No messages yet. Say hello!</p>
        )}
        {messages.map((m, i) => {
          const isMine = m.sender_type === "customer";
          const showTime = i === 0 || (new Date(m.created_at).getTime() - new Date(messages[i-1].created_at).getTime()) > 300000;
          return (
            <div key={m.id}>
              {showTime && (
                <p className="text-center text-[10px] text-gray-400 my-2">
                  {new Date(m.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              )}
              <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                {m.is_quote && (
                  <div className="mb-1 mx-1">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Quote from Proven Power</span>
                  </div>
                )}
                <div className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${
                  m.is_quote
                    ? "bg-amber-50 border-2 border-amber-200"
                    : isMine
                    ? "bg-[#1a3d2b] text-white rounded-br-sm"
                    : "bg-white text-gray-900 rounded-bl-sm"
                }`}>
                  {m.body ? <p className={`text-sm leading-relaxed ${isMine && !m.is_quote ? "text-white" : "text-gray-900"}`}>{m.body}</p> : null}
                  {m.attachments.map((a) => (
                    <div key={a.id} className="mt-2 rounded-xl overflow-hidden">
                      <Image src={a.url} alt="Attachment" width={200} height={200} className="object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* input bar */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex items-center gap-2">
          <label className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 cursor-pointer hover:bg-gray-200 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
            <input type="file" accept="image/*,video/*,application/pdf" onChange={handleAttach} className="hidden" />
          </label>
          <input placeholder="Message…" value={body} onChange={(e) => setBody(e.target.value)}
            className="flex-1 h-11 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a3d2b]/30" />
          <button type="submit" disabled={!body.trim() || isSending}
            className="w-10 h-10 rounded-full bg-[#1a3d2b] flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-[#0f2419] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

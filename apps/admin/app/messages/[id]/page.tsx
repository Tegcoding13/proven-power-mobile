"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import type { Message, MessageAttachment, MessageThread, BusinessAccount } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { uploadMessageAttachment, getSignedMessageAttachmentUrl } from "../../../lib/message-attachments";

type MessageWithAttachments = Message & { attachments: { id: string; url: string }[] };

async function fetchThreadData(id: string) {
  const supabase = createClient();
  const { data: threadRow } = await supabase.from("message_threads").select("*").eq("id", id).single();

  if (!threadRow) {
    return { thread: null, account: null, messages: [] as MessageWithAttachments[] };
  }

  const [{ data: accountRow }, { data: messageRows }] = await Promise.all([
    supabase.from("business_accounts").select("*").eq("id", threadRow.business_account_id).single(),
    supabase.from("messages").select("*").eq("thread_id", id).order("created_at", { ascending: true }),
  ]);

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

  const enriched = await Promise.all(
    (messageRows ?? []).map(async (m) => ({
      ...m,
      attachments: (
        await Promise.all(
          (attachmentsByMessage.get(m.id) ?? []).map(async (a) => ({ id: a.id, url: await getSignedMessageAttachmentUrl(a.storage_path) }))
        )
      ).filter((a): a is { id: string; url: string } => Boolean(a.url)),
    }))
  );

  return { thread: threadRow, account: accountRow ?? null, messages: enriched };
}

export default function AdminThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [account, setAccount] = useState<BusinessAccount | null>(null);
  const [messages, setMessages] = useState<MessageWithAttachments[]>([]);
  const [body, setBody] = useState("");
  const [isQuote, setIsQuote] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    fetchThreadData(id).then((result) => {
      if (!isCurrent) return;
      setThread(result.thread);
      setAccount(result.account);
      setMessages(result.messages);
      setIsLoading(false);
    });
    return () => {
      isCurrent = false;
    };
  }, [id]);

  async function reload() {
    const result = await fetchThreadData(id);
    setThread(result.thread);
    setAccount(result.account);
    setMessages(result.messages);
  }

  async function handleReply(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    setIsSending(true);
    await supabase.from("messages").insert({
      thread_id: id,
      sender_profile_id: userData.user.id,
      sender_type: "staff",
      body: body.trim(),
      is_quote: isQuote,
    });
    setBody("");
    setIsQuote(false);
    setIsSending(false);
    reload();
  }

  async function handleAttach(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !thread) return;
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: message } = await supabase
      .from("messages")
      .insert({ thread_id: id, sender_profile_id: userData.user.id, sender_type: "staff", body: null })
      .select("*")
      .single();

    if (message) {
      await uploadMessageAttachment({
        businessAccountId: thread.business_account_id,
        threadId: id,
        messageId: message.id,
        file,
        mediaType: file.type.startsWith("image") ? "photo" : file.type.startsWith("video") ? "video" : "document",
      });
    }
    event.target.value = "";
    reload();
  }

  async function handleAssignToSelf() {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from("message_threads").update({ assigned_staff_profile_id: userData.user.id }).eq("id", id);
    reload();
  }

  async function handleToggleClosed() {
    if (!thread) return;
    const supabase = createClient();
    await supabase.from("message_threads").update({ status: thread.status === "open" ? "closed" : "open" }).eq("id", id);
    reload();
  }

  if (isLoading || !thread) {
    return <p className="px-4 py-8 text-gray-700">Loading...</p>;
  }

  return (
    <div className="flex flex-1 flex-col max-w-2xl mx-auto w-full px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-black">{account?.name ?? "Customer"}</h1>
          <p className="text-sm text-gray-700 capitalize">{thread.department} · {thread.status}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleAssignToSelf} className="min-h-10 rounded-lg border border-green-600 px-3 text-sm font-semibold text-green-700">
            {thread.assigned_staff_profile_id ? "Reassign to me" : "Assign to me"}
          </button>
          <button onClick={handleToggleClosed} className="min-h-10 rounded-lg bg-gray-100 px-3 text-sm font-semibold text-black">
            {thread.status === "open" ? "Close Thread" : "Reopen"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 mb-4">
        {messages.map((m) => {
          const isStaff = m.sender_type === "staff";
          return (
            <div key={m.id} className={`flex flex-col ${isStaff ? "items-end" : "items-start"}`}>
              <div className={`max-w-[80%] rounded-lg p-3 ${m.is_quote ? "bg-amber-100" : isStaff ? "bg-green-600 text-white" : "bg-gray-100 text-black"}`}>
                {m.is_quote ? <p className="text-xs font-bold text-amber-800 mb-1">QUOTE</p> : null}
                {m.body ? <p>{m.body}</p> : null}
                {m.attachments.map((a) => (
                  <Image key={a.id} src={a.url} alt="Attachment" width={160} height={160} className="rounded mt-1 object-cover" />
                ))}
              </div>
              <span className="text-xs text-gray-500 mt-1">{new Date(m.created_at).toLocaleString()}</span>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleReply} className="flex flex-col gap-2 border-t border-gray-100 pt-4">
        <label className="flex items-center gap-2 text-sm text-black">
          <input type="checkbox" checked={isQuote} onChange={(e) => setIsQuote(e.target.checked)} className="accent-green-600" />
          Send as quote/estimate
        </label>
        <div className="flex gap-2 items-center">
          <label className="cursor-pointer text-2xl">
            📎
            <input type="file" accept="image/*,video/*,application/pdf" onChange={handleAttach} className="hidden" />
          </label>
          <input
            placeholder="Reply..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="flex-1 min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
          />
          <button type="submit" disabled={!body.trim() || isSending} className="min-h-12 rounded-lg bg-green-600 px-6 font-semibold text-white disabled:opacity-70">
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

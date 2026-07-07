"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MessageThread } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { useBusinessAccount } from "../../lib/business-account";
import { PageHeader } from "../../components/PageHeader";

const DEPT_LABELS: Record<string, string> = { sales: "Sales", parts: "Parts", service: "Service", office: "Office" };
const DEPT_COLORS: Record<string, string> = {
  service: "bg-purple-100 text-purple-700",
  parts: "bg-blue-100 text-blue-700",
  sales: "bg-green-100 text-green-700",
  office: "bg-gray-100 text-gray-700",
};

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MessagesListPage() {
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!businessAccount) return;
    const supabase = createClient();
    supabase.from("message_threads").select("*")
      .eq("business_account_id", businessAccount.id)
      .order("last_message_at", { ascending: false })
      .then(({ data }) => { setThreads(data ?? []); setIsLoading(false); });
  }, [businessAccount]);

  const open = threads.filter((t) => t.status === "open");
  const closed = threads.filter((t) => t.status !== "open");

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <PageHeader title="Messages" action={{ href: "/messages/new", label: "+ New Message" }} />

      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-6">
        {isLoadingAccount || isLoading ? (
          <div className="flex flex-col gap-3">
            {[1,2].map((i) => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse shadow-sm" />)}
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a3d2b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p className="font-semibold text-gray-900">No messages yet</p>
            <p className="text-sm text-gray-500 mt-1">Start a conversation with our service, parts, or sales team.</p>
            <Link href="/messages/new" className="mt-4 bg-[#1a3d2b] text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-[#0f2419] transition-colors">
              Send a Message
            </Link>
          </div>
        ) : (
          <>
            {open.length > 0 && (
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Open · {open.length}</p>
                <div className="flex flex-col gap-2">
                  {open.map((t) => <ThreadCard key={t.id} t={t} />)}
                </div>
              </section>
            )}
            {closed.length > 0 && (
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Closed · {closed.length}</p>
                <div className="flex flex-col gap-2 opacity-60">
                  {closed.map((t) => <ThreadCard key={t.id} t={t} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <Link href="/messages/new" className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#1a3d2b] text-white flex items-center justify-center text-2xl font-bold shadow-xl hover:bg-[#0f2419] transition-colors z-10">+</Link>
    </div>
  );
}

function ThreadCard({ t }: { t: MessageThread }) {
  return (
    <Link href={`/messages/${t.id}`} className="group bg-white rounded-2xl shadow-sm hover:shadow-md transition-all border border-transparent hover:border-[#1a3d2b]/10 p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-[#1a3d2b] flex items-center justify-center text-white shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900 text-sm">{t.subject || DEPT_LABELS[t.department] || "Message"}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${DEPT_COLORS[t.department] ?? "bg-gray-100 text-gray-600"}`}>
            {DEPT_LABELS[t.department] ?? t.department}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{relativeDate(t.last_message_at)}</p>
      </div>
      <div className={`w-2 h-2 rounded-full shrink-0 ${t.status === "open" ? "bg-green-500" : "bg-gray-300"}`} />
    </Link>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MessageThread } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { useBusinessAccount } from "../../lib/business-account";

const DEPARTMENT_LABELS: Record<string, string> = {
  sales: "Sales",
  parts: "Parts",
  service: "Service",
  office: "Office",
};

export default function MessagesListPage() {
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!businessAccount) return;
    const supabase = createClient();
    supabase
      .from("message_threads")
      .select("*")
      .eq("business_account_id", businessAccount.id)
      .order("last_message_at", { ascending: false })
      .then(({ data }) => {
        setThreads(data ?? []);
        setIsLoading(false);
      });
  }, [businessAccount]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
      <Link href="/" className="text-sm text-green-700">
        ← Back home
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-700">Messages</h1>
        <Link href="/messages/new" className="min-h-12 flex items-center rounded-lg bg-green-600 px-4 font-semibold text-white">
          + New Message
        </Link>
      </div>

      {isLoadingAccount || isLoading ? (
        <p className="text-gray-700">Loading...</p>
      ) : threads.length === 0 ? (
        <p className="text-gray-700">No messages yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link href={`/messages/${thread.id}`} className="flex flex-col gap-1 rounded-lg border border-gray-300 p-4 hover:bg-gray-50">
                <p className="font-semibold text-black">{DEPARTMENT_LABELS[thread.department] ?? thread.department}</p>
                {thread.subject ? <p className="text-sm text-gray-700">{thread.subject}</p> : null}
                <p className="text-xs text-gray-500">
                  {thread.status === "closed" ? "Closed" : "Open"} · {new Date(thread.last_message_at).toLocaleDateString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

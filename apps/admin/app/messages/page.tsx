"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MessageThread, BusinessAccount } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";

type EnrichedThread = MessageThread & { accountName: string };

const DEPARTMENT_LABELS: Record<string, string> = {
  sales: "Sales",
  parts: "Parts",
  service: "Service",
  office: "Office",
};

export default function MessageInboxPage() {
  const [threads, setThreads] = useState<EnrichedThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const { data } = await supabase.from("message_threads").select("*").order("last_message_at", { ascending: false });
      const accountIds = [...new Set((data ?? []).map((t) => t.business_account_id))];
      const { data: accountRows } = accountIds.length
        ? await supabase.from("business_accounts").select("*").in("id", accountIds)
        : { data: [] as BusinessAccount[] };
      const accountById = new Map((accountRows ?? []).map((a) => [a.id, a]));

      setThreads((data ?? []).map((t) => ({ ...t, accountName: accountById.get(t.business_account_id)?.name ?? "Customer" })));
      setIsLoading(false);
    })();
  }, []);

  const visibleThreads = departmentFilter === "all" ? threads : threads.filter((t) => t.department === departmentFilter);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-green-700">Message Inbox</h1>

      <div className="flex gap-2">
        {["all", "sales", "service", "parts", "office"].map((dept) => (
          <button
            key={dept}
            onClick={() => setDepartmentFilter(dept)}
            className={`min-h-10 rounded-full px-3 text-sm font-semibold capitalize ${
              departmentFilter === dept ? "bg-green-600 text-white" : "bg-gray-100 text-black"
            }`}
          >
            {dept}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-700">Loading...</p>
      ) : visibleThreads.length === 0 ? (
        <p className="text-gray-700">No threads.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibleThreads.map((thread) => (
            <li key={thread.id}>
              <Link href={`/messages/${thread.id}`} className="flex items-center justify-between rounded-lg border border-gray-300 p-4 hover:bg-gray-50">
                <div>
                  <p className="font-semibold text-black">{thread.accountName}</p>
                  <p className="text-sm text-gray-700">{DEPARTMENT_LABELS[thread.department] ?? thread.department}</p>
                </div>
                <span className={`text-xs font-semibold ${thread.status === "open" ? "text-green-700" : "text-gray-500"}`}>
                  {thread.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link href="/" className="text-sm text-green-700">
        ← Back home
      </Link>
    </div>
  );
}

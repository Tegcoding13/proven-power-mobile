"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PartsRequest, BusinessAccount } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { StatusBadge } from "../../components/StatusBadge";

type EnrichedRequest = PartsRequest & { accountName: string };

export default function PartsQueuePage() {
  const [requests, setRequests] = useState<EnrichedRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const { data } = await supabase.from("parts_requests").select("*").order("created_at", { ascending: false });
      const accountIds = [...new Set((data ?? []).map((r) => r.business_account_id))];
      const { data: accountRows } = accountIds.length
        ? await supabase.from("business_accounts").select("*").in("id", accountIds)
        : { data: [] as BusinessAccount[] };
      const accountById = new Map((accountRows ?? []).map((a) => [a.id, a]));

      setRequests((data ?? []).map((r) => ({ ...r, accountName: accountById.get(r.business_account_id)?.name ?? "Customer" })));
      setIsLoading(false);
    })();
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-green-700">Parts Queue</h1>

      {isLoading ? (
        <p className="text-gray-700">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="text-gray-700">No parts requests yet.</p>
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-gray-700 border-b border-gray-200">
              <th className="py-2">Customer</th>
              <th className="py-2">Type</th>
              <th className="py-2">Description</th>
              <th className="py-2">Status</th>
              <th className="py-2">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3">
                  <Link href={`/parts/${r.id}`} className="text-green-700 font-semibold">
                    {r.accountName}
                  </Link>
                </td>
                <td className="py-3 text-black capitalize">{r.request_type.replace("_", " ")}</td>
                <td className="py-3 text-black max-w-xs truncate">{r.description}</td>
                <td className="py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="py-3 text-gray-700">{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Link href="/" className="text-sm text-green-700">
        ← Back home
      </Link>
    </div>
  );
}

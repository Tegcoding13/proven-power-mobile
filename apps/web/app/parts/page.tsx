"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PartsRequest } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { useBusinessAccount } from "../../lib/business-account";
import { StatusBadge } from "../../components/StatusBadge";

export default function PartsListPage() {
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [requests, setRequests] = useState<PartsRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!businessAccount) return;
    const supabase = createClient();
    supabase
      .from("parts_requests")
      .select("*")
      .eq("business_account_id", businessAccount.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRequests(data ?? []);
        setIsLoading(false);
      });
  }, [businessAccount]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-700">Parts</h1>
        <Link href="/parts/new" className="min-h-12 flex items-center rounded-lg bg-green-600 px-4 font-semibold text-white">
          + Request Parts
        </Link>
      </div>

      {isLoadingAccount || isLoading ? (
        <p className="text-gray-700">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="text-gray-700">No parts requests yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((item) => (
            <li key={item.id}>
              <Link href={`/parts/${item.id}`} className="flex flex-col gap-1 rounded-lg border border-gray-300 p-4 hover:bg-gray-50">
                <p className="text-sm text-gray-700 line-clamp-2">{item.description}</p>
                <StatusBadge status={item.status} />
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

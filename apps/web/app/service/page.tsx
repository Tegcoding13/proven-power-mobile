"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ServiceRequest, Equipment } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { useBusinessAccount } from "../../lib/business-account";
import { StatusBadge } from "../../components/StatusBadge";

type RequestWithEquipment = ServiceRequest & { equipmentLabel: string };

export default function ServiceListPage() {
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [requests, setRequests] = useState<RequestWithEquipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!businessAccount) return;
    const supabase = createClient();

    (async () => {
      const { data } = await supabase
        .from("service_requests")
        .select("*")
        .eq("business_account_id", businessAccount.id)
        .order("created_at", { ascending: false });

      const equipmentIds = [...new Set((data ?? []).map((r) => r.equipment_id))];
      const { data: equipmentRows } = equipmentIds.length
        ? await supabase.from("equipment").select("*").in("id", equipmentIds)
        : { data: [] as Equipment[] };
      const equipmentById = new Map((equipmentRows ?? []).map((e) => [e.id, e]));

      setRequests(
        (data ?? []).map((r) => ({
          ...r,
          equipmentLabel: equipmentById.get(r.equipment_id)?.nickname || equipmentById.get(r.equipment_id)?.model || "Equipment",
        }))
      );
      setIsLoading(false);
    })();
  }, [businessAccount]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
      <Link href="/" className="text-sm text-green-700">
        ← Back home
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-700">Service</h1>
        <Link href="/service/new" className="min-h-12 flex items-center rounded-lg bg-green-600 px-4 font-semibold text-white">
          + Request Service
        </Link>
      </div>

      {isLoadingAccount || isLoading ? (
        <p className="text-gray-700">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="text-gray-700">No service requests yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((item) => (
            <li key={item.id}>
              <Link href={`/service/${item.id}`} className="flex flex-col gap-1 rounded-lg border border-gray-300 p-4 hover:bg-gray-50">
                <p className="font-semibold text-black">{item.equipmentLabel}</p>
                <p className="text-sm text-gray-700 line-clamp-2">{item.description}</p>
                <StatusBadge status={item.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

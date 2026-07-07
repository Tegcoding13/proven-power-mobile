"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { WinterStorageSignup, Equipment } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { useBusinessAccount } from "../../lib/business-account";

const STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  dropped_off: "Dropped Off",
  stored: "In Storage",
  picked_up: "Picked Up",
  cancelled: "Cancelled",
};

type SignupWithEquipment = WinterStorageSignup & { equipmentLabel: string };

export default function WinterStorageListPage() {
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [signups, setSignups] = useState<SignupWithEquipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!businessAccount) return;
    const supabase = createClient();

    (async () => {
      const { data } = await supabase
        .from("winter_storage_signups")
        .select("*")
        .eq("business_account_id", businessAccount.id)
        .order("created_at", { ascending: false });

      const equipmentIds = [...new Set((data ?? []).map((s) => s.equipment_id).filter((id): id is string => id != null))];
      const { data: equipmentRows } = equipmentIds.length
        ? await supabase.from("equipment").select("*").in("id", equipmentIds)
        : { data: [] as Equipment[] };
      const equipmentById = new Map((equipmentRows ?? []).map((e) => [e.id, e]));

      setSignups(
        (data ?? []).map((s) => ({
          ...s,
          equipmentLabel: (s.equipment_id ? equipmentById.get(s.equipment_id)?.nickname || equipmentById.get(s.equipment_id)?.model : null) || "Equipment",
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
        <h1 className="text-2xl font-bold text-green-700">Winter Storage</h1>
        <Link href="/winter-storage/new" className="min-h-12 flex items-center rounded-lg bg-green-600 px-4 font-semibold text-white">
          + Sign Up
        </Link>
      </div>

      {isLoadingAccount || isLoading ? (
        <p className="text-gray-700">Loading...</p>
      ) : signups.length === 0 ? (
        <p className="text-gray-700">No winter storage sign-ups yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {signups.map((item) => (
            <li key={item.id} className="rounded-lg border border-gray-300 p-4">
              <p className="font-semibold text-black">{item.equipmentLabel}</p>
              <p className="text-sm text-gray-700">{STATUS_LABELS[item.status] ?? item.status}</p>
              {item.requested_dropoff_date ? (
                <p className="text-xs text-gray-500">Drop-off: {new Date(item.requested_dropoff_date).toLocaleDateString()}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

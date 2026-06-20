"use client";

import { useEffect, useState } from "react";
import type { WinterStorageSignup, WinterStorageStatus, BusinessAccount, Equipment } from "@proven-power/shared-types";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";

const STATUSES: WinterStorageStatus[] = ["requested", "confirmed", "dropped_off", "stored", "picked_up", "cancelled"];

type EnrichedSignup = WinterStorageSignup & { accountName: string; equipmentLabel: string };

export default function AdminWinterStorageQueuePage() {
  const [signups, setSignups] = useState<EnrichedSignup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchSignups(): Promise<EnrichedSignup[]> {
    const supabase = createClient();
    const { data } = await supabase.from("winter_storage_signups").select("*").order("created_at", { ascending: false });

    const accountIds = [...new Set((data ?? []).map((s) => s.business_account_id))];
    const equipmentIds = [...new Set((data ?? []).map((s) => s.equipment_id))];

    const [{ data: accountRows }, { data: equipmentRows }] = await Promise.all([
      accountIds.length ? supabase.from("business_accounts").select("*").in("id", accountIds) : Promise.resolve({ data: [] as BusinessAccount[] }),
      equipmentIds.length ? supabase.from("equipment").select("*").in("id", equipmentIds) : Promise.resolve({ data: [] as Equipment[] }),
    ]);
    const accountById = new Map((accountRows ?? []).map((a) => [a.id, a]));
    const equipmentById = new Map((equipmentRows ?? []).map((e) => [e.id, e]));

    return (data ?? []).map((s) => ({
      ...s,
      accountName: accountById.get(s.business_account_id)?.name ?? "Customer",
      equipmentLabel: equipmentById.get(s.equipment_id)?.nickname || equipmentById.get(s.equipment_id)?.model || "Equipment",
    }));
  }

  useEffect(() => {
    let isCurrent = true;
    fetchSignups().then((result) => {
      if (!isCurrent) return;
      setSignups(result);
      setIsLoading(false);
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  async function load() {
    const result = await fetchSignups();
    setSignups(result);
  }

  async function handleStatusChange(id: string, status: WinterStorageStatus) {
    const supabase = createClient();
    await supabase.from("winter_storage_signups").update({ status }).eq("id", id);
    load();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-green-700">Winter Storage Requests</h1>

      {isLoading ? (
        <p className="text-gray-700">Loading...</p>
      ) : signups.length === 0 ? (
        <p className="text-gray-700">No sign-ups yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {signups.map((s) => (
            <li key={s.id} className="rounded-lg border border-gray-300 p-4">
              <p className="font-semibold text-black">
                {s.accountName} — {s.equipmentLabel}
              </p>
              <p className="text-sm text-gray-700">
                {s.agreement_signed_at ? "Agreement signed" : "Agreement not signed"}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {STATUSES.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(s.id, status)}
                    className={`min-h-9 rounded-full px-3 text-xs font-semibold capitalize ${
                      s.status === status ? "bg-green-600 text-white" : "bg-gray-100 text-black"
                    }`}
                  >
                    {status.replace("_", " ")}
                  </button>
                ))}
              </div>
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

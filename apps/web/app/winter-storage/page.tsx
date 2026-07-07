"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { WinterStorageSignup, Equipment } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { useBusinessAccount } from "../../lib/business-account";
import { PageHeader } from "../../components/PageHeader";

const STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  dropped_off: "Dropped Off",
  stored: "In Storage",
  picked_up: "Picked Up",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  requested:   "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  confirmed:   "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  dropped_off: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  stored:      "bg-[#1a3d2b]/10 text-[#1a3d2b] ring-1 ring-[#1a3d2b]/20",
  picked_up:   "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
  cancelled:   "bg-gray-100 text-gray-400 ring-1 ring-gray-200",
};

const STATUS_DOTS: Record<string, string> = {
  requested: "bg-amber-500",
  confirmed: "bg-blue-500",
  dropped_off: "bg-indigo-500",
  stored: "bg-[#1a3d2b]",
  picked_up: "bg-gray-400",
  cancelled: "bg-gray-300",
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
        .from("winter_storage_signups").select("*")
        .eq("business_account_id", businessAccount.id)
        .order("created_at", { ascending: false });

      const equipmentIds = [...new Set((data ?? []).map((s) => s.equipment_id).filter((id): id is string => id != null))];
      const { data: equipmentRows } = equipmentIds.length
        ? await supabase.from("equipment").select("*").in("id", equipmentIds)
        : { data: [] as Equipment[] };
      const equipmentById = new Map((equipmentRows ?? []).map((e) => [e.id, e]));

      setSignups((data ?? []).map((s) => ({
        ...s,
        equipmentLabel: (s.equipment_id ? equipmentById.get(s.equipment_id)?.nickname || equipmentById.get(s.equipment_id)?.model : null) || "Equipment",
      })));
      setIsLoading(false);
    })();
  }, [businessAccount]);

  const active = signups.filter((s) => !["picked_up", "cancelled"].includes(s.status ?? ""));
  const past = signups.filter((s) => ["picked_up", "cancelled"].includes(s.status ?? ""));

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <PageHeader title="Winter Storage" action={{ href: "/winter-storage/new", label: "+ Sign Up" }} />

      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-6">
        {isLoadingAccount || isLoading ? (
          <div className="flex flex-col gap-3">
            {[1,2].map((i) => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse shadow-sm" />)}
          </div>
        ) : signups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4 text-3xl">❄️</div>
            <p className="font-semibold text-gray-900">No storage sign-ups yet</p>
            <p className="text-sm text-gray-500 mt-1 max-w-xs">Protect your equipment from the Wisconsin winter. Sign up for secure indoor storage.</p>
            <Link href="/winter-storage/new" className="mt-4 bg-[#1a3d2b] text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-[#0f2419] transition-colors">
              Sign Up for Storage
            </Link>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Active · {active.length}</p>
                <div className="flex flex-col gap-3">
                  {active.map((item) => <StorageCard key={item.id} item={item} />)}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Past · {past.length}</p>
                <div className="flex flex-col gap-3 opacity-70">
                  {past.map((item) => <StorageCard key={item.id} item={item} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <Link href="/winter-storage/new" className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#1a3d2b] text-white flex items-center justify-center text-2xl font-bold shadow-xl hover:bg-[#0f2419] transition-colors z-10">+</Link>
    </div>
  );
}

function StorageCard({ item }: { item: SignupWithEquipment }) {
  const style = STATUS_STYLES[item.status ?? "requested"] ?? "bg-gray-100 text-gray-600 ring-1 ring-gray-200";
  const dot = STATUS_DOTS[item.status ?? "requested"];
  const label = STATUS_LABELS[item.status ?? "requested"] ?? item.status;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-transparent overflow-hidden flex">
      <div className="w-1 shrink-0 bg-[#1a3d2b]" />
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-gray-900 leading-tight">{item.equipmentLabel}</p>
            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400">
              {item.requested_dropoff_date && (
                <span className="flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Drop-off {new Date(item.requested_dropoff_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              )}
              {item.requested_pickup_date && (
                <span className="flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  Pick-up {new Date(item.requested_pickup_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 ${style}`}>
            {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

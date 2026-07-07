"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Equipment } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { useBusinessAccount } from "../../lib/business-account";
import { PageHeader } from "../../components/PageHeader";

const CATEGORY_ICONS: Record<string, string> = {
  riding_mower: "🚜",
  zero_turn: "🟢",
  tractor: "🚜",
  utility_vehicle: "🛻",
  walk_behind: "🌿",
  snow_equipment: "❄️",
  attachment: "🔩",
  other: "⚙️",
};

export default function GarageListPage() {
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!businessAccount) return;
    const supabase = createClient();
    supabase.from("equipment").select("*")
      .eq("business_account_id", businessAccount.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setEquipment(data ?? []); setIsLoading(false); });
  }, [businessAccount]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return equipment;
    return equipment.filter((e) =>
      [e.nickname, e.make, e.model, e.serial_number].some((f) => f?.toLowerCase().includes(q))
    );
  }, [equipment, query]);

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <PageHeader title="My Garage" action={{ href: "/garage/new", label: "+ Add Equipment" }} />

      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-6">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            placeholder="Search by name, model, or serial number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-11 pl-9 pr-4 rounded-xl bg-white border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a3d2b]/30 shadow-sm"
          />
        </div>

        {isLoadingAccount || isLoading ? (
          <div className="flex flex-col gap-3">
            {[1,2].map((i) => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse shadow-sm" />)}
          </div>
        ) : equipment.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">🚜</div>
            <p className="font-semibold text-gray-900">No equipment yet</p>
            <p className="text-sm text-gray-500 mt-1">Add your first tractor or piece of equipment to get started.</p>
            <Link href="/garage/new" className="mt-4 bg-[#1a3d2b] text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-[#0f2419] transition-colors">
              Add Equipment
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No equipment matches &quot;{query}&quot;.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{filtered.length} piece{filtered.length !== 1 ? "s" : ""} of equipment</p>
            {filtered.map((item) => (
              <Link
                key={item.id}
                href={`/garage/${item.id}`}
                className="group bg-white rounded-2xl shadow-sm hover:shadow-md transition-all border border-transparent hover:border-[#1a3d2b]/10 p-4 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-2xl shrink-0">
                  {CATEGORY_ICONS[item.category ?? ""] ?? "🚜"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-base leading-tight">
                    {item.nickname || `${item.model_year ?? ""} ${item.model}`.trim()}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {[item.make, item.model].filter(Boolean).join(" ")}
                    {item.model_year ? ` · ${item.model_year}` : ""}
                  </p>
                  {item.current_hours != null && (
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {item.current_hours} hrs
                    </p>
                  )}
                </div>
                <svg className="text-gray-300 group-hover:text-[#1a3d2b] transition-colors shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Link href="/garage/new" className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#1a3d2b] text-white flex items-center justify-center text-2xl font-bold shadow-xl hover:bg-[#0f2419] transition-colors z-10">+</Link>
    </div>
  );
}

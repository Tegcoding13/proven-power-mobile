"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Equipment } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { useBusinessAccount } from "../../lib/business-account";

export default function GarageListPage() {
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!businessAccount) return;
    const supabase = createClient();

    supabase
      .from("equipment")
      .select("*")
      .eq("business_account_id", businessAccount.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setEquipment(data ?? []);
        setIsLoading(false);
      });
  }, [businessAccount]);

  const filteredEquipment = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return equipment;
    return equipment.filter((item) =>
      [item.nickname, item.make, item.model, item.serial_number].some((field) => field?.toLowerCase().includes(q))
    );
  }, [equipment, query]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
      <Link href="/" className="text-sm text-green-700">
        ← Back home
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-700">My Garage</h1>
        <Link href="/garage/new" className="min-h-12 flex items-center rounded-lg bg-green-600 px-4 font-semibold text-white">
          + Add Equipment
        </Link>
      </div>

      {equipment.length > 0 ? (
        <input
          placeholder="Search by name, model, or serial number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
        />
      ) : null}

      {isLoadingAccount || isLoading ? (
        <p className="text-gray-700">Loading...</p>
      ) : equipment.length === 0 ? (
        <p className="text-gray-700">No equipment yet. Add your first tractor or piece of equipment.</p>
      ) : filteredEquipment.length === 0 ? (
        <p className="text-gray-700">No equipment matches &quot;{query}&quot;.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filteredEquipment.map((item) => (
            <li key={item.id}>
              <Link
                href={`/garage/${item.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-300 p-4 hover:bg-gray-50"
              >
                <div>
                  <p className="font-semibold text-black">
                    {item.nickname || `${item.model_year ?? ""} ${item.model}`.trim()}
                  </p>
                  <p className="text-sm text-gray-700">
                    {item.make} {item.model}
                    {item.current_hours != null ? ` · ${item.current_hours} hrs` : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MessageThread, BusinessAccount, DealershipLocation } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { useStaffRole } from "../../lib/staff-role";

type EnrichedThread = MessageThread & { accountName: string };

const DEPARTMENT_LABELS: Record<string, string> = {
  sales: "Sales",
  parts: "Parts",
  service: "Service",
  office: "Office",
};

export default function MessageInboxPage() {
  const { staffRole, isLoading: isLoadingStaffRole } = useStaffRole();
  const [threads, setThreads] = useState<EnrichedThread[]>([]);
  const [locations, setLocations] = useState<DealershipLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const [{ data }, { data: locationRows }] = await Promise.all([
        supabase.from("message_threads").select("*").order("last_message_at", { ascending: false }),
        supabase.from("dealership_locations").select("*").order("name", { ascending: true }),
      ]);
      setLocations(locationRows ?? []);

      const accountIds = [...new Set((data ?? []).map((t) => t.business_account_id))];
      const { data: accountRows } = accountIds.length
        ? await supabase.from("business_accounts").select("*").in("id", accountIds)
        : { data: [] as BusinessAccount[] };
      const accountById = new Map((accountRows ?? []).map((a) => [a.id, a]));

      setThreads((data ?? []).map((t) => ({ ...t, accountName: accountById.get(t.business_account_id)?.name ?? "Customer" })));
      setIsLoading(false);
    })();
  }, []);

  const effectiveLocationFilter = locationFilter ?? (isLoadingStaffRole ? "all" : (staffRole?.dealership_location_id ?? "all"));

  const locationNameById = new Map(locations.map((l) => [l.id, l.name.replace("Proven Power - ", "")]));
  const visibleThreads = threads
    .filter((t) => departmentFilter === "all" || t.department === departmentFilter)
    .filter((t) => effectiveLocationFilter === "all" || t.dealership_location_id === effectiveLocationFilter);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-green-700">Message Inbox</h1>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setLocationFilter("all")}
            className={`min-h-10 rounded-full px-3 text-sm font-semibold ${effectiveLocationFilter === "all" ? "bg-green-700 text-white" : "bg-gray-100 text-black"}`}
          >
            All Stores
          </button>
          {locations.map((location) => (
            <button
              key={location.id}
              onClick={() => setLocationFilter(location.id)}
              className={`min-h-10 rounded-full px-3 text-sm font-semibold ${effectiveLocationFilter === location.id ? "bg-green-700 text-white" : "bg-gray-100 text-black"}`}
            >
              {location.name.replace("Proven Power - ", "")}
            </button>
          ))}
        </div>
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
                  <p className="text-sm text-gray-700">
                    {DEPARTMENT_LABELS[thread.department] ?? thread.department}
                    {thread.dealership_location_id ? ` · ${locationNameById.get(thread.dealership_location_id) ?? ""}` : ""}
                  </p>
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

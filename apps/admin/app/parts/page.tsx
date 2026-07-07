"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PartsRequest, BusinessAccount, DealershipLocation } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { useStaffRole } from "../../lib/staff-role";
import { StatusBadge } from "../../components/StatusBadge";

type EnrichedRequest = PartsRequest & { accountName: string };

export default function PartsQueuePage() {
  const router = useRouter();
  const { staffRole, isLoading: isLoadingStaffRole } = useStaffRole();
  const [requests, setRequests] = useState<EnrichedRequest[]>([]);
  const [locations, setLocations] = useState<DealershipLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const [{ data }, { data: locationRows }] = await Promise.all([
        supabase.from("parts_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("dealership_locations").select("*").order("name", { ascending: true }),
      ]);
      setLocations(locationRows ?? []);

      const accountIds = [...new Set((data ?? []).map((r) => r.business_account_id))];
      const { data: accountRows } = accountIds.length
        ? await supabase.from("business_accounts").select("*").in("id", accountIds)
        : { data: [] as BusinessAccount[] };
      const accountById = new Map((accountRows ?? []).map((a) => [a.id, a]));

      setRequests((data ?? []).map((r) => ({ ...r, accountName: accountById.get(r.business_account_id)?.name ?? "Customer" })));
      setIsLoading(false);
    })();
  }, []);

  const effectiveLocationFilter = locationFilter ?? (isLoadingStaffRole ? "all" : (staffRole?.dealership_location_id ?? "all"));

  const locationNameById = new Map(locations.map((l) => [l.id, l.name.replace("Proven Power - ", "")]));
  const visibleRequests =
    effectiveLocationFilter === "all" ? requests : requests.filter((r) => r.dealership_location_id === effectiveLocationFilter);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-green-700">Parts Queue</h1>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setLocationFilter("all")}
          className={`min-h-10 rounded-full px-3 text-sm font-semibold ${effectiveLocationFilter === "all" ? "bg-green-600 text-white" : "bg-gray-100 text-black"}`}
        >
          All Stores
        </button>
        {locations.map((location) => (
          <button
            key={location.id}
            onClick={() => setLocationFilter(location.id)}
            className={`min-h-10 rounded-full px-3 text-sm font-semibold ${effectiveLocationFilter === location.id ? "bg-green-600 text-white" : "bg-gray-100 text-black"}`}
          >
            {location.name.replace("Proven Power - ", "")}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-700">Loading...</p>
      ) : visibleRequests.length === 0 ? (
        <p className="text-gray-700">No parts requests {effectiveLocationFilter === "all" ? "yet" : "for this store"}.</p>
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-gray-700 border-b border-gray-200">
              <th className="py-2">Customer</th>
              <th className="py-2">Type</th>
              <th className="py-2">Description</th>
              <th className="py-2">Store</th>
              <th className="py-2">Status</th>
              <th className="py-2">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {visibleRequests.map((r) => (
              <tr
                key={r.id}
                onClick={() => router.push(`/parts/${r.id}`)}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              >
                <td className="py-3 text-green-700 font-semibold">{r.accountName}</td>
                <td className="py-3 text-black capitalize">{r.request_type.replace("_", " ")}</td>
                <td className="py-3 text-black max-w-xs truncate">{r.description}</td>
                <td className="py-3 text-black">
                  {r.dealership_location_id ? (locationNameById.get(r.dealership_location_id) ?? "—") : "—"}
                </td>
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ServiceRequest, Equipment, BusinessAccount, DealershipLocation } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { useStaffRole } from "../../lib/staff-role";
import { AdminPageHeader } from "../../components/AdminPageHeader";
import { StatusBadge } from "../../components/StatusBadge";

type EnrichedRequest = ServiceRequest & { equipmentLabel: string; accountName: string };
type Tab = "new" | "in_progress" | "completed";

const NEW_STATUSES = ["submitted"];
const IN_PROGRESS_STATUSES = ["acknowledged", "scheduled", "in_progress", "awaiting_approval", "approved"];
const COMPLETED_STATUSES = ["completed", "cancelled"];

const STATUS_ORDER: Record<string, number> = {
  awaiting_approval: 0,
  in_progress: 1,
  scheduled: 2,
  acknowledged: 3,
  approved: 4,
};

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function AgePill({ days }: { days: number }) {
  const color = days >= 7 ? "bg-red-100 text-red-700" : days >= 3 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500";
  return (
    <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${color}`}>
      {days === 0 ? "today" : `${days}d`}
    </span>
  );
}

export default function ServiceQueuePage() {
  const router = useRouter();
  const { staffRole, isLoading: isLoadingStaffRole } = useStaffRole();
  const [requests, setRequests] = useState<EnrichedRequest[]>([]);
  const [locations, setLocations] = useState<DealershipLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("new");

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data }, { data: locationRows }] = await Promise.all([
        supabase.from("service_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("dealership_locations").select("*").order("name", { ascending: true }),
      ]);
      setLocations(locationRows ?? []);

      const equipmentIds = [...new Set((data ?? []).map((r) => r.equipment_id))];
      const accountIds = [...new Set((data ?? []).map((r) => r.business_account_id))];

      const [{ data: equipmentRows }, { data: accountRows }] = await Promise.all([
        equipmentIds.length ? supabase.from("equipment").select("*").in("id", equipmentIds) : Promise.resolve({ data: [] as Equipment[] }),
        accountIds.length ? supabase.from("business_accounts").select("*").in("id", accountIds) : Promise.resolve({ data: [] as BusinessAccount[] }),
      ]);

      const equipmentById = new Map((equipmentRows ?? []).map((e) => [e.id, e]));
      const accountById = new Map((accountRows ?? []).map((a) => [a.id, a]));

      setRequests(
        (data ?? []).map((r) => ({
          ...r,
          equipmentLabel: equipmentById.get(r.equipment_id)?.nickname || equipmentById.get(r.equipment_id)?.model || "Equipment",
          accountName: accountById.get(r.business_account_id)?.name ?? "Customer",
        }))
      );
      setIsLoading(false);
    })();
  }, []);

  const effectiveLocationFilter = locationFilter ?? (isLoadingStaffRole ? "all" : (staffRole?.dealership_location_id ?? "all"));
  const locationNameById = new Map(locations.map((l) => [l.id, l.name.replace("Proven Power - ", "")]));

  const allVisible = effectiveLocationFilter === "all"
    ? requests
    : requests.filter((r) => r.dealership_location_id === effectiveLocationFilter);

  const newRequests = allVisible.filter((r) => NEW_STATUSES.includes(r.status ?? ""));
  const inProgress = allVisible
    .filter((r) => IN_PROGRESS_STATUSES.includes(r.status ?? ""))
    .sort((a, b) => (STATUS_ORDER[a.status ?? ""] ?? 9) - (STATUS_ORDER[b.status ?? ""] ?? 9));
  const completed = allVisible.filter((r) => COMPLETED_STATUSES.includes(r.status ?? ""));

  const tabItems: { id: Tab; label: string; count: number }[] = [
    { id: "new", label: "New Requests", count: newRequests.length },
    { id: "in_progress", label: "In Progress", count: inProgress.length },
    { id: "completed", label: "Completed", count: completed.length },
  ];

  const rows = tab === "new" ? newRequests : tab === "in_progress" ? inProgress : completed;

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <AdminPageHeader title="Service Queue" />
      <div className="max-w-4xl mx-auto w-full px-4 py-6 flex flex-col gap-5">

        {/* Location filter */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setLocationFilter("all")}
            className={`min-h-9 rounded-full px-3 text-sm font-semibold ${effectiveLocationFilter === "all" ? "bg-green-600 text-white" : "bg-gray-100 text-black"}`}>
            All Stores
          </button>
          {locations.map((loc) => (
            <button key={loc.id} onClick={() => setLocationFilter(loc.id)}
              className={`min-h-9 rounded-full px-3 text-sm font-semibold ${effectiveLocationFilter === loc.id ? "bg-green-600 text-white" : "bg-gray-100 text-black"}`}>
              {loc.name.replace("Proven Power - ", "")}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 gap-1">
          {tabItems.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                tab === t.id ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {t.label}
              {t.count > 0 && (
                <span className={`text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center ${
                  tab === t.id
                    ? t.id === "new" ? "bg-red-500 text-white" : "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
            {tab === "new" ? "No new requests — you're all caught up." : tab === "in_progress" ? "Nothing in progress right now." : "No completed requests yet."}
          </div>
        ) : tab === "in_progress" ? (
          /* In Progress — card layout with more context */
          <div className="flex flex-col gap-3">
            {rows.map((r) => {
              const days = daysSince(r.created_at);
              const isAwaitingApproval = r.status === "awaiting_approval";
              return (
                <Link key={r.id} href={`/service/${r.id}`}
                  className={`bg-white rounded-xl border p-4 flex flex-col gap-3 hover:shadow-sm transition-all ${
                    isAwaitingApproval ? "border-amber-300 bg-amber-50/40" : "border-gray-200"
                  }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{r.accountName}</p>
                        {isAwaitingApproval && (
                          <span className="text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded">NEEDS APPROVAL</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{r.equipmentLabel} · <span className="capitalize">{(r.request_type ?? "").replace(/_/g, " ")}</span></p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <AgePill days={days} />
                      <StatusBadge status={r.status ?? ""} />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>Submitted {new Date(r.created_at).toLocaleDateString()}</span>
                    {r.dealership_location_id && <span>{locationNameById.get(r.dealership_location_id)}</span>}
                    {r.estimate_amount != null && (
                      <span className="text-gray-600 font-semibold">${Number(r.estimate_amount).toLocaleString()} estimate</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          /* New + Completed — table layout */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => router.push(`/service/${r.id}`)}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3 font-semibold text-green-700">{r.accountName}</td>
                    <td className="px-4 py-3 text-gray-900">{r.equipmentLabel}</td>
                    <td className="px-4 py-3 text-gray-700 capitalize">{(r.request_type ?? "").replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.dealership_location_id ? (locationNameById.get(r.dealership_location_id) ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status ?? ""} /></td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      <div>{new Date(r.created_at).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-400">{new Date(r.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

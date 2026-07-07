"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ServiceRequest, Equipment } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { useBusinessAccount } from "../../lib/business-account";
import { StatusBadge } from "../../components/StatusBadge";
import { PageHeader } from "../../components/PageHeader";

type RequestWithEquipment = ServiceRequest & { equipmentLabel: string; equipmentMake: string };

const STATUS_ORDER = ["submitted", "acknowledged", "scheduled", "in_progress", "awaiting_approval", "approved", "completed", "cancelled"];

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ServiceListPage() {
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [requests, setRequests] = useState<RequestWithEquipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!businessAccount) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("service_requests").select("*")
        .eq("business_account_id", businessAccount.id)
        .order("created_at", { ascending: false });

      const equipmentIds = [...new Set((data ?? []).map((r) => r.equipment_id).filter((id): id is string => id != null))];
      const { data: equipmentRows } = equipmentIds.length
        ? await supabase.from("equipment").select("*").in("id", equipmentIds)
        : { data: [] as Equipment[] };
      const equipmentById = new Map((equipmentRows ?? []).map((e) => [e.id, e]));

      setRequests((data ?? []).map((r) => {
        const eq = r.equipment_id ? equipmentById.get(r.equipment_id) : null;
        return { ...r, equipmentLabel: eq?.nickname || eq?.model || "Equipment", equipmentMake: eq?.make || "" };
      }));
      setIsLoading(false);
    })();
  }, [businessAccount]);

  const filteredRequests = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) =>
      [r.equipmentLabel, r.description, r.status].some((f) => f?.toLowerCase().includes(q))
    );
  }, [requests, query]);

  const open = filteredRequests.filter((r) => !["completed", "cancelled"].includes(r.status ?? ""));
  const closed = filteredRequests.filter((r) => ["completed", "cancelled"].includes(r.status ?? ""));

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <PageHeader title="Service Requests" action={{ href: "/service/new", label: "+ New Request" }} />

      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-6">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            placeholder="Search equipment, description, or status…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-11 pl-9 pr-4 rounded-xl bg-white border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a3d2b]/30 shadow-sm"
          />
        </div>

        {isLoadingAccount || isLoading ? (
          <div className="flex flex-col gap-3">
            {[1,2,3].map((i) => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse shadow-sm" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a3d2b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
            </div>
            <p className="font-semibold text-gray-900">No service requests yet</p>
            <p className="text-sm text-gray-500 mt-1">Submit a request and we'll get your equipment taken care of.</p>
            <Link href="/service/new" className="mt-4 bg-[#1a3d2b] text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-[#0f2419] transition-colors">
              Request Service
            </Link>
          </div>
        ) : (
          <>
            {open.length > 0 && (
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Active · {open.length}</p>
                <div className="flex flex-col gap-3">
                  {open.map((r) => <ServiceCard key={r.id} r={r} />)}
                </div>
              </section>
            )}
            {closed.length > 0 && (
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">History · {closed.length}</p>
                <div className="flex flex-col gap-3">
                  {closed.map((r) => <ServiceCard key={r.id} r={r} muted />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <Link href="/service/new" className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#1a3d2b] text-white flex items-center justify-center text-2xl font-bold shadow-xl hover:bg-[#0f2419] transition-colors z-10">+</Link>
    </div>
  );
}

function ServiceCard({ r, muted }: { r: RequestWithEquipment; muted?: boolean }) {
  return (
    <Link
      href={`/service/${r.id}`}
      className={`group bg-white rounded-2xl shadow-sm hover:shadow-md transition-all border border-transparent hover:border-[#1a3d2b]/10 overflow-hidden flex ${muted ? "opacity-70" : ""}`}
    >
      <div className={`w-1 shrink-0 ${
        r.status === "submitted" ? "bg-red-500" :
        r.status === "awaiting_approval" ? "bg-amber-500" :
        r.status === "in_progress" ? "bg-purple-500" :
        r.status === "completed" ? "bg-gray-300" :
        r.status === "cancelled" ? "bg-gray-200" :
        "bg-[#1a3d2b]"
      }`} />
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-base leading-tight">{r.equipmentLabel}</p>
            {r.equipmentMake && <p className="text-xs text-gray-400 mt-0.5">{r.equipmentMake}</p>}
          </div>
          <StatusBadge status={r.status ?? "submitted"} />
        </div>
        {r.description && (
          <p className="text-sm text-gray-600 mt-2 line-clamp-2 leading-relaxed">{r.description}</p>
        )}
        <p className="text-xs text-gray-400 mt-3">{relativeDate(r.created_at)}</p>
      </div>
      <div className="flex items-center pr-3 text-gray-300 group-hover:text-[#1a3d2b] transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </Link>
  );
}

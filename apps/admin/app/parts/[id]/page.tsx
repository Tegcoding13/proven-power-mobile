"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import type { PartsRequest, PartsRequestStatus, BusinessAccount, Equipment } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { getSignedPartsRequestMediaUrl } from "../../../lib/parts-request-media";
import { StatusBadge } from "../../../components/StatusBadge";
import { AdminPageHeader } from "../../../components/AdminPageHeader";

const STATUSES: PartsRequestStatus[] = ["submitted", "researching", "in_stock", "ordered", "ready_for_pickup", "fulfilled", "cancelled"];

async function fetchPartsRequestData(id: string) {
  const supabase = createClient();
  const { data: requestRow } = await supabase.from("parts_requests").select("*").eq("id", id).single();

  if (!requestRow) {
    return { request: null, account: null, equipment: null, mediaUrls: [] as { id: string; url: string }[] };
  }

  const [{ data: accountRow }, { data: mediaRows }, { data: equipmentRow }] = await Promise.all([
    supabase.from("business_accounts").select("*").eq("id", requestRow.business_account_id).single(),
    supabase.from("parts_request_media").select("*").eq("parts_request_id", id),
    requestRow.equipment_id
      ? supabase.from("equipment").select("*").eq("id", requestRow.equipment_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const urls = await Promise.all(
    (mediaRows ?? []).map(async (m) => ({ id: m.id, url: await getSignedPartsRequestMediaUrl(m.storage_path) }))
  );

  return {
    request: requestRow,
    account: accountRow ?? null,
    equipment: equipmentRow ?? null,
    mediaUrls: urls.filter((u): u is { id: string; url: string } => Boolean(u.url)),
  };
}

export default function AdminPartsRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [request, setRequest] = useState<PartsRequest | null>(null);
  const [account, setAccount] = useState<BusinessAccount | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [mediaUrls, setMediaUrls] = useState<{ id: string; url: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    fetchPartsRequestData(id).then((result) => {
      if (!isCurrent) return;
      setRequest(result.request);
      setAccount(result.account);
      setEquipment(result.equipment);
      setMediaUrls(result.mediaUrls);
      setIsLoading(false);
    });
    return () => { isCurrent = false; };
  }, [id]);

  async function reload() {
    const result = await fetchPartsRequestData(id);
    setRequest(result.request);
    setAccount(result.account);
    setEquipment(result.equipment);
    setMediaUrls(result.mediaUrls);
  }

  async function handleStatusChange(status: PartsRequestStatus) {
    const supabase = createClient();
    await supabase.from("parts_requests").update({ status }).eq("id", id);
    reload();
  }

  async function handleAssignToSelf() {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from("parts_requests").update({ assigned_staff_profile_id: userData.user.id }).eq("id", id);
    reload();
  }

  if (isLoading || !request) {
    return <p className="px-4 py-8 text-gray-700">Loading...</p>;
  }

  const equipmentLabel = equipment
    ? [equipment.model_year, equipment.make, equipment.model].filter(Boolean).join(" ") + (equipment.serial_number ? ` · S/N ${equipment.serial_number}` : "")
    : null;

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <AdminPageHeader title={account?.name ?? "Parts Request"} backHref="/parts" backLabel="Parts Queue" />
      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-6">

        {/* Header card */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Customer</p>
              <h1 className="text-xl font-bold text-black">{account?.name ?? "Customer"}</h1>
            </div>
            <StatusBadge status={request.status} />
          </div>

          {equipmentLabel && (
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
              <span className="text-sm font-semibold text-gray-700">
                {equipment?.nickname ? `${equipment.nickname} — ` : ""}{equipmentLabel}
              </span>
            </div>
          )}

          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Request</p>
            <p className="text-sm text-gray-800 leading-relaxed">{request.description}</p>
          </div>
        </div>

        {/* Status update */}
        <section className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Update Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                className={`min-h-10 rounded-full px-3 text-sm font-semibold transition-colors ${
                  request.status === status ? "bg-green-600 text-white" : "bg-gray-100 text-black hover:bg-gray-200"
                }`}
              >
                {status.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <button onClick={handleAssignToSelf} className="self-start min-h-10 rounded-lg border border-green-600 px-4 text-sm font-semibold text-green-700 hover:bg-green-50 transition-colors">
            {request.assigned_staff_profile_id ? "Reassign to me" : "Assign to me"}
          </button>
        </section>

        {mediaUrls.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Photos</p>
            <div className="flex flex-wrap gap-2">
              {mediaUrls.map((m) => (
                <Image key={m.id} src={m.url} alt="Parts request media" width={140} height={140} className="rounded-xl object-cover" />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

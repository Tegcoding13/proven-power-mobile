"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type {
  ServiceRequest,
  ServiceRequestStatus,
  ServiceRequestStatusHistory,
  ServiceRequestMediaType,
  Equipment,
  BusinessAccount,
} from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { getSignedServiceRequestMediaUrl } from "../../../lib/service-request-media";
import { StatusBadge } from "../../../components/StatusBadge";

const STATUSES: ServiceRequestStatus[] = [
  "submitted",
  "acknowledged",
  "scheduled",
  "in_progress",
  "awaiting_approval",
  "approved",
  "completed",
  "cancelled",
];

async function fetchServiceRequestData(id: string) {
  const supabase = createClient();
  const { data: requestRow } = await supabase.from("service_requests").select("*").eq("id", id).single();

  if (!requestRow) {
    return {
      request: null,
      equipment: null,
      account: null,
      history: [] as ServiceRequestStatusHistory[],
      mediaUrls: [] as { id: string; url: string; mediaType: ServiceRequestMediaType }[],
    };
  }

  const [{ data: equipmentRow }, { data: accountRow }, { data: historyRows }, { data: mediaRows }] = await Promise.all([
    supabase.from("equipment").select("*").eq("id", requestRow.equipment_id).single(),
    supabase.from("business_accounts").select("*").eq("id", requestRow.business_account_id).single(),
    supabase
      .from("service_request_status_history")
      .select("*")
      .eq("service_request_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("service_request_media").select("*").eq("service_request_id", id),
  ]);

  const urls = await Promise.all(
    (mediaRows ?? []).map(async (m) => ({
      id: m.id,
      url: await getSignedServiceRequestMediaUrl(m.storage_path),
      mediaType: m.media_type,
    }))
  );

  return {
    request: requestRow,
    equipment: equipmentRow ?? null,
    account: accountRow ?? null,
    history: historyRows ?? [],
    mediaUrls: urls.filter((u): u is { id: string; url: string; mediaType: ServiceRequestMediaType } => Boolean(u.url)),
  };
}

export default function AdminServiceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [account, setAccount] = useState<BusinessAccount | null>(null);
  const [history, setHistory] = useState<ServiceRequestStatusHistory[]>([]);
  const [mediaUrls, setMediaUrls] = useState<{ id: string; url: string; mediaType: ServiceRequestMediaType }[]>([]);
  const [estimateInput, setEstimateInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    fetchServiceRequestData(id).then((result) => {
      if (!isCurrent) return;
      setRequest(result.request);
      setEquipment(result.equipment);
      setAccount(result.account);
      setHistory(result.history);
      setMediaUrls(result.mediaUrls);
      setEstimateInput(result.request?.estimate_amount != null ? String(result.request.estimate_amount) : "");
      setIsLoading(false);
    });
    return () => {
      isCurrent = false;
    };
  }, [id]);

  async function reload() {
    const result = await fetchServiceRequestData(id);
    setRequest(result.request);
    setEquipment(result.equipment);
    setAccount(result.account);
    setHistory(result.history);
    setMediaUrls(result.mediaUrls);
  }

  async function handleStatusChange(status: ServiceRequestStatus) {
    const supabase = createClient();
    await supabase.from("service_requests").update({ status }).eq("id", id);
    reload();
  }

  async function handleAssignToSelf() {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from("service_requests").update({ assigned_staff_profile_id: userData.user.id }).eq("id", id);
    reload();
  }

  async function handleSaveEstimate() {
    if (!estimateInput) return;
    const supabase = createClient();
    await supabase
      .from("service_requests")
      .update({ estimate_amount: Number(estimateInput), status: "awaiting_approval" })
      .eq("id", id);
    reload();
  }

  if (isLoading || !request) {
    return <p className="px-4 py-8 text-gray-700">Loading...</p>;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
      <Link href="/service" className="text-sm text-green-700">
        ← Back to Service Queue
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-black">{account?.name ?? "Customer"}</h1>
        <p className="text-gray-700">{equipment?.nickname || equipment?.model}</p>
        <StatusBadge status={request.status} />
        <p className="text-black mt-2">{request.description}</p>
      </div>

      <section className="flex flex-col gap-2">
        <p className="font-semibold text-black">Update Status</p>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              className={`min-h-10 rounded-full px-3 text-sm font-semibold ${
                request.status === status ? "bg-green-600 text-white" : "bg-gray-100 text-black"
              }`}
            >
              {status.replace("_", " ")}
            </button>
          ))}
        </div>
        <button onClick={handleAssignToSelf} className="self-start min-h-10 rounded-lg border border-green-600 px-4 text-sm font-semibold text-green-700">
          {request.assigned_staff_profile_id ? "Reassign to me" : "Assign to me"}
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <p className="font-semibold text-black">Estimate</p>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.01"
            value={estimateInput}
            onChange={(e) => setEstimateInput(e.target.value)}
            placeholder="Amount"
            className="min-h-10 w-32 rounded-lg border border-gray-300 px-3 text-black"
          />
          <button onClick={handleSaveEstimate} className="min-h-10 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white">
            Send Estimate
          </button>
        </div>
        {request.estimate_amount != null ? (
          <p className="text-sm text-gray-700">
            Current: ${request.estimate_amount} {request.estimate_approved_at ? "(approved by customer)" : "(pending approval)"}
          </p>
        ) : null}
      </section>

      {mediaUrls.length > 0 ? (
        <section>
          <h2 className="text-lg font-bold text-black mb-2">Photos/Video</h2>
          <div className="flex flex-wrap gap-2">
            {mediaUrls.map((m) =>
              m.mediaType === "photo" ? (
                <Image key={m.id} src={m.url} alt="Service request media" width={120} height={120} className="rounded-lg object-cover" />
              ) : (
                <video key={m.id} src={m.url} controls className="w-[200px] rounded-lg" />
              )
            )}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-bold text-black mb-2">Status History</h2>
        <ul className="flex flex-col">
          {history.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between border-b border-gray-100 py-2">
              <StatusBadge status={entry.status} />
              <span className="text-xs text-gray-700">{new Date(entry.created_at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

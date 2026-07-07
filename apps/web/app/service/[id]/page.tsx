"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import type { ServiceRequest, ServiceRequestStatusHistory, Equipment, ServiceRequestMediaType } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { getSignedServiceRequestMediaUrl } from "../../../lib/service-request-media";
import { StatusBadge } from "../../../components/StatusBadge";
import { PageHeader } from "../../../components/PageHeader";

const STATUS_ORDER = ["submitted","acknowledged","scheduled","in_progress","awaiting_approval","approved","completed","cancelled"];

function relativeDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ServiceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [history, setHistory] = useState<ServiceRequestStatusHistory[]>([]);
  const [mediaUrls, setMediaUrls] = useState<{ id: string; url: string; mediaType: ServiceRequestMediaType }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const supabase = createClient();
    (async () => {
      const { data: requestRow } = await supabase.from("service_requests").select("*").eq("id", id).single();
      if (!isCurrent) return;
      setRequest(requestRow ?? null);
      if (requestRow) {
        const [{ data: eq }, { data: hist }, { data: media }] = await Promise.all([
          supabase.from("equipment").select("*").eq("id", requestRow.equipment_id).single(),
          supabase.from("service_request_status_history").select("*").eq("service_request_id", id).order("created_at", { ascending: false }),
          supabase.from("service_request_media").select("*").eq("service_request_id", id),
        ]);
        if (!isCurrent) return;
        setEquipment(eq ?? null);
        setHistory(hist ?? []);
        const urls = await Promise.all((media ?? []).map(async (m) => ({ id: m.id, url: await getSignedServiceRequestMediaUrl(m.storage_path), mediaType: m.media_type })));
        if (!isCurrent) return;
        setMediaUrls(urls.filter((u): u is { id: string; url: string; mediaType: ServiceRequestMediaType } => Boolean(u.url)));
      }
      setIsLoading(false);
    })();
    return () => { isCurrent = false; };
  }, [id]);

  async function handleApproveEstimate() {
    setIsApproving(true); setErrorMessage(null);
    const { data: updated, error } = await createClient().rpc("approve_service_estimate", { p_service_request_id: id });
    if (error) setErrorMessage(error.message); else if (updated) setRequest(updated);
    setIsApproving(false);
  }

  async function handleCancel() {
    if (!confirm("Cancel this service request?")) return;
    setIsCancelling(true); setErrorMessage(null);
    const { data: updated, error } = await createClient().rpc("cancel_service_request", { p_service_request_id: id });
    if (error) setErrorMessage(error.message); else if (updated) setRequest(updated);
    setIsCancelling(false);
  }

  if (isLoading || !request) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Service Request" />
        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
          {[1,2,3].map((i) => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse shadow-sm" />)}
        </div>
      </div>
    );
  }

  const equipmentName = equipment?.nickname || equipment?.model || "Service Request";
  const progressIndex = STATUS_ORDER.indexOf(request.status ?? "submitted");

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <PageHeader title={equipmentName} />

      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-4">
        {errorMessage && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{errorMessage}</p>}

        {/* hero card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#1a3d2b] px-5 py-4">
            <p className="text-white font-bold text-lg leading-tight">{equipmentName}</p>
            {equipment?.make && <p className="text-white/60 text-sm mt-0.5">{equipment.make}</p>}
          </div>
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <StatusBadge status={request.status ?? "submitted"} />
            <span className="text-xs text-gray-400">{relativeDate(request.created_at)}</span>
          </div>
          {request.description && (
            <div className="px-5 pb-5 border-t border-gray-50">
              <p className="text-sm text-gray-700 leading-relaxed pt-4 whitespace-pre-line">{request.description}</p>
            </div>
          )}
        </div>

        {/* estimate approval */}
        {request.estimate_amount != null && (
          <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-amber-400">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Estimate</p>
                <p className="text-2xl font-bold text-gray-900">${request.estimate_amount.toLocaleString()}</p>
                {request.estimate_notes && <p className="text-sm text-gray-600 mt-1">{request.estimate_notes}</p>}
              </div>
              {request.estimate_approved_at ? (
                <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 rounded-full px-3 py-1.5 text-xs font-bold shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  Approved
                </span>
              ) : null}
            </div>
            {!request.estimate_approved_at && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-3">Work won't begin until you approve this estimate.</p>
                <button onClick={handleApproveEstimate} disabled={isApproving}
                  className="w-full h-12 rounded-xl bg-[#1a3d2b] text-white font-bold text-sm disabled:opacity-50 hover:bg-[#0f2419] transition-colors">
                  {isApproving ? "Approving…" : "Approve Estimate"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* status timeline */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Status Timeline</p>
            <div className="flex flex-col gap-0">
              {history.map((entry, i) => (
                <div key={entry.id} className="flex gap-3 items-start">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${i === 0 ? "bg-[#1a3d2b]" : "bg-gray-300"}`} />
                    {i < history.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1 mb-1 min-h-[20px]" />}
                  </div>
                  <div className="pb-4 min-w-0">
                    <StatusBadge status={entry.status} />
                    <p className="text-xs text-gray-400 mt-1">{new Date(entry.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* media */}
        {mediaUrls.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Attached Media</p>
            <div className="grid grid-cols-3 gap-2">
              {mediaUrls.map((m) =>
                m.mediaType === "photo" ? (
                  <div key={m.id} className="aspect-square rounded-xl overflow-hidden">
                    <Image src={m.url} alt="Service media" width={160} height={160} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <video key={m.id} src={m.url} controls className="aspect-square rounded-xl object-cover" />
                )
              )}
            </div>
          </div>
        )}

        {/* cancel */}
        {request.status === "submitted" && (
          <button onClick={handleCancel} disabled={isCancelling}
            className="w-full h-12 rounded-xl border-2 border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors disabled:opacity-50">
            {isCancelling ? "Cancelling…" : "Cancel Request"}
          </button>
        )}
      </div>
    </div>
  );
}

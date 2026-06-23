"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ServiceRequest, ServiceRequestStatusHistory, Equipment, ServiceRequestMediaType } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { getSignedServiceRequestMediaUrl } from "../../../lib/service-request-media";
import { StatusBadge } from "../../../components/StatusBadge";

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
        const [{ data: equipmentRow }, { data: historyRows }, { data: mediaRows }] = await Promise.all([
          supabase.from("equipment").select("*").eq("id", requestRow.equipment_id).single(),
          supabase
            .from("service_request_status_history")
            .select("*")
            .eq("service_request_id", id)
            .order("created_at", { ascending: false }),
          supabase.from("service_request_media").select("*").eq("service_request_id", id),
        ]);
        if (!isCurrent) return;
        setEquipment(equipmentRow ?? null);
        setHistory(historyRows ?? []);

        const urls = await Promise.all(
          (mediaRows ?? []).map(async (m) => ({
            id: m.id,
            url: await getSignedServiceRequestMediaUrl(m.storage_path),
            mediaType: m.media_type,
          }))
        );
        if (!isCurrent) return;
        setMediaUrls(urls.filter((u): u is { id: string; url: string; mediaType: ServiceRequestMediaType } => Boolean(u.url)));
      }
      setIsLoading(false);
    })();

    return () => {
      isCurrent = false;
    };
  }, [id]);

  async function handleApproveEstimate() {
    setIsApproving(true);
    setErrorMessage(null);
    const supabase = createClient();
    const { data: updated, error } = await supabase.rpc("approve_service_estimate", { p_service_request_id: id });
    if (error) {
      setErrorMessage(error.message);
    } else if (updated) {
      setRequest(updated);
    }
    setIsApproving(false);
  }

  async function handleCancel() {
    if (!confirm("Cancel this service request?")) return;
    setIsCancelling(true);
    setErrorMessage(null);
    const supabase = createClient();
    const { data: updated, error } = await supabase.rpc("cancel_service_request", { p_service_request_id: id });
    if (error) {
      setErrorMessage(error.message);
    } else if (updated) {
      setRequest(updated);
    }
    setIsCancelling(false);
  }

  if (isLoading || !request) {
    return <p className="px-4 py-8 text-gray-700">Loading...</p>;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
      <Link href="/service" className="text-sm text-green-700">
        ← Back to Service
      </Link>
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-black">{equipment?.nickname || equipment?.model || "Service Request"}</h1>
        <StatusBadge status={request.status} />
        <p className="text-gray-700 mt-2">{request.description}</p>

        {request.status === "submitted" ? (
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="self-start mt-1 min-h-9 rounded-lg border border-red-600 px-3 text-sm font-semibold text-red-600 disabled:opacity-70"
          >
            {isCancelling ? "Cancelling..." : "Cancel Request"}
          </button>
        ) : null}

        {request.estimate_amount != null ? (
          <div className="mt-2 bg-amber-50 rounded-lg p-4 flex flex-col gap-2">
            <p className="font-semibold text-black">Estimate: ${request.estimate_amount.toLocaleString()}</p>
            {request.estimate_notes ? <p className="text-sm text-gray-700">{request.estimate_notes}</p> : null}
            {request.estimate_approved_at ? (
              <p className="text-sm text-green-700 font-semibold">✓ Approved {new Date(request.estimate_approved_at).toLocaleDateString()}</p>
            ) : (
              <>
                <p className="text-sm text-gray-700">Work won&apos;t begin until you approve this estimate.</p>
                <button
                  onClick={handleApproveEstimate}
                  disabled={isApproving}
                  className="self-start min-h-11 rounded-lg bg-green-600 px-5 font-semibold text-white disabled:opacity-70"
                >
                  {isApproving ? "Approving..." : "Approve Estimate"}
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

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

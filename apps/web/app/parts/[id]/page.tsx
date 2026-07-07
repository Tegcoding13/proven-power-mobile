"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import type { PartsRequest } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { getSignedPartsRequestMediaUrl } from "../../../lib/parts-request-media";
import { StatusBadge } from "../../../components/StatusBadge";
import { PageHeader } from "../../../components/PageHeader";

const TYPE_LABELS: Record<string, string> = {
  stock_check: "Stock Check",
  part_order: "Part Order",
  broken_part_id: "Part Identification",
};

export default function PartsRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [request, setRequest] = useState<PartsRequest | null>(null);
  const [mediaUrls, setMediaUrls] = useState<{ id: string; url: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const supabase = createClient();
    (async () => {
      const { data: requestRow } = await supabase.from("parts_requests").select("*").eq("id", id).single();
      if (!isCurrent) return;
      setRequest(requestRow ?? null);
      const { data: mediaRows } = await supabase.from("parts_request_media").select("*").eq("parts_request_id", id);
      const urls = await Promise.all((mediaRows ?? []).map(async (m) => ({ id: m.id, url: await getSignedPartsRequestMediaUrl(m.storage_path) })));
      if (!isCurrent) return;
      setMediaUrls(urls.filter((u): u is { id: string; url: string } => Boolean(u.url)));
      setIsLoading(false);
    })();
    return () => { isCurrent = false; };
  }, [id]);

  async function handleCancel() {
    if (!confirm("Cancel this parts request?")) return;
    setIsCancelling(true); setErrorMessage(null);
    const { data: updated, error } = await createClient().rpc("cancel_parts_request", { p_parts_request_id: id });
    if (error) setErrorMessage(error.message); else if (updated) setRequest(updated);
    setIsCancelling(false);
  }

  if (isLoading || !request) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Parts Request" />
        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
          {[1,2].map((i) => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse shadow-sm" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <PageHeader title={TYPE_LABELS[request.request_type ?? ""] ?? "Parts Request"} />

      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-4">
        {errorMessage && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{errorMessage}</p>}

        {/* hero */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#1a3d2b] px-5 py-4">
            <p className="text-white/60 text-xs font-bold uppercase tracking-widest">{TYPE_LABELS[request.request_type ?? ""] ?? request.request_type}</p>
            <p className="text-white font-bold text-base mt-1 leading-snug">{request.description}</p>
          </div>
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <StatusBadge status={request.status ?? "submitted"} />
            <span className="text-xs text-gray-400">{new Date(request.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        </div>

        {/* photos */}
        {mediaUrls.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Attached Photos</p>
            <div className="grid grid-cols-3 gap-2">
              {mediaUrls.map((m) => (
                <div key={m.id} className="aspect-square rounded-xl overflow-hidden">
                  <Image src={m.url} alt="Parts request media" width={160} height={160} className="w-full h-full object-cover" />
                </div>
              ))}
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

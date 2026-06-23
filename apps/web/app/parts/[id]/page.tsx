"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { PartsRequest } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { getSignedPartsRequestMediaUrl } from "../../../lib/parts-request-media";
import { StatusBadge } from "../../../components/StatusBadge";

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
      const urls = await Promise.all(
        (mediaRows ?? []).map(async (m) => ({ id: m.id, url: await getSignedPartsRequestMediaUrl(m.storage_path) }))
      );
      if (!isCurrent) return;
      setMediaUrls(urls.filter((u): u is { id: string; url: string } => Boolean(u.url)));
      setIsLoading(false);
    })();

    return () => {
      isCurrent = false;
    };
  }, [id]);

  async function handleCancel() {
    if (!confirm("Cancel this parts request?")) return;
    setIsCancelling(true);
    setErrorMessage(null);
    const supabase = createClient();
    const { data: updated, error } = await supabase.rpc("cancel_parts_request", { p_parts_request_id: id });
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
      <Link href="/parts" className="text-sm text-green-700">
        ← Back to Parts
      </Link>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <div className="flex flex-col gap-1">
        <StatusBadge status={request.status} />
        <p className="text-lg text-black mt-2">{request.description}</p>
        {request.status === "submitted" ? (
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="self-start mt-1 min-h-9 rounded-lg border border-red-600 px-3 text-sm font-semibold text-red-600 disabled:opacity-70"
          >
            {isCancelling ? "Cancelling..." : "Cancel Request"}
          </button>
        ) : null}
      </div>

      {mediaUrls.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {mediaUrls.map((m) => (
            <Image key={m.id} src={m.url} alt="Parts request media" width={140} height={140} className="rounded-lg object-cover" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

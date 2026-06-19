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

  if (isLoading || !request) {
    return <p className="px-4 py-8 text-gray-700">Loading...</p>;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
      <Link href="/parts" className="text-sm text-green-700">
        ← Back to Parts
      </Link>
      <div className="flex flex-col gap-1">
        <StatusBadge status={request.status} />
        <p className="text-lg text-black mt-2">{request.description}</p>
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

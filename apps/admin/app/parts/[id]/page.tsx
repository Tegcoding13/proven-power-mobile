"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { PartsRequest, PartsRequestStatus, BusinessAccount } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { getSignedPartsRequestMediaUrl } from "../../../lib/parts-request-media";
import { StatusBadge } from "../../../components/StatusBadge";

const STATUSES: PartsRequestStatus[] = ["submitted", "researching", "in_stock", "ordered", "ready_for_pickup", "fulfilled", "cancelled"];

async function fetchPartsRequestData(id: string) {
  const supabase = createClient();
  const { data: requestRow } = await supabase.from("parts_requests").select("*").eq("id", id).single();

  if (!requestRow) {
    return { request: null, account: null, mediaUrls: [] as { id: string; url: string }[] };
  }

  const [{ data: accountRow }, { data: mediaRows }] = await Promise.all([
    supabase.from("business_accounts").select("*").eq("id", requestRow.business_account_id).single(),
    supabase.from("parts_request_media").select("*").eq("parts_request_id", id),
  ]);
  const urls = await Promise.all(
    (mediaRows ?? []).map(async (m) => ({ id: m.id, url: await getSignedPartsRequestMediaUrl(m.storage_path) }))
  );

  return {
    request: requestRow,
    account: accountRow ?? null,
    mediaUrls: urls.filter((u): u is { id: string; url: string } => Boolean(u.url)),
  };
}

export default function AdminPartsRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [request, setRequest] = useState<PartsRequest | null>(null);
  const [account, setAccount] = useState<BusinessAccount | null>(null);
  const [mediaUrls, setMediaUrls] = useState<{ id: string; url: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    fetchPartsRequestData(id).then((result) => {
      if (!isCurrent) return;
      setRequest(result.request);
      setAccount(result.account);
      setMediaUrls(result.mediaUrls);
      setIsLoading(false);
    });
    return () => {
      isCurrent = false;
    };
  }, [id]);

  async function reload() {
    const result = await fetchPartsRequestData(id);
    setRequest(result.request);
    setAccount(result.account);
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

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
      <Link href="/parts" className="text-sm text-green-700">
        ← Back to Parts Queue
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-black">{account?.name ?? "Customer"}</h1>
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

      {mediaUrls.length > 0 ? (
        <section>
          <h2 className="text-lg font-bold text-black mb-2">Photo</h2>
          <div className="flex flex-wrap gap-2">
            {mediaUrls.map((m) => (
              <Image key={m.id} src={m.url} alt="Parts request media" width={140} height={140} className="rounded-lg object-cover" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

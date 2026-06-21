"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { InventoryListing } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { getPublicInventoryPhotoUrl } from "../../../lib/inventory";

export default function InventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [listing, setListing] = useState<InventoryListing | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    const supabase = createClient();

    (async () => {
      const { data: listingRow } = await supabase.from("inventory_listings").select("*").eq("id", id).single();
      if (!isCurrent) return;
      setListing(listingRow ?? null);

      const { data: photoRows } = await supabase.from("inventory_listing_photos").select("*").eq("listing_id", id);
      if (!isCurrent) return;
      setPhotoUrls((photoRows ?? []).map((p) => getPublicInventoryPhotoUrl(p)));
      setIsLoading(false);
    })();

    return () => {
      isCurrent = false;
    };
  }, [id]);

  if (isLoading || !listing) {
    return <p className="px-4 py-8 text-gray-700">Loading...</p>;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-8 max-w-2xl mx-auto w-full">
      <Link href="/inventory" className="text-sm text-green-700">
        ← Back to Inventory
      </Link>

      {photoUrls.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {photoUrls.map((url) => (
            <Image key={url} src={url} alt={listing.title} width={260} height={200} className="rounded-lg object-cover" />
          ))}
        </div>
      ) : null}

      <h1 className="text-2xl font-bold text-black">{listing.title}</h1>
      <p className="text-lg font-semibold text-green-700">
        {listing.price != null ? `$${listing.price.toLocaleString()}` : "Call for price"}
      </p>
      <p className="text-sm text-gray-700">
        {listing.condition === "new" ? "New" : "Used"} {listing.make} {listing.model}
        {listing.model_year ? ` (${listing.model_year})` : ""}
        {listing.stock_number ? ` · Stock #${listing.stock_number}` : ""}
      </p>
      {listing.description ? <p className="text-black mt-2">{listing.description}</p> : null}
    </div>
  );
}

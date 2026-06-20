"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { InventoryListing } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { getPublicInventoryPhotoUrl } from "../../lib/inventory";

type ListingWithPhoto = InventoryListing & { photoUrl: string | null };

export default function InventoryListPage() {
  const [listings, setListings] = useState<ListingWithPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const { data } = await supabase.from("inventory_listings").select("*").eq("status", "available").order("created_at", { ascending: false });
      const listingIds = (data ?? []).map((l) => l.id);
      const { data: photoRows } = listingIds.length
        ? await supabase.from("inventory_listing_photos").select("*").in("listing_id", listingIds)
        : { data: [] as { listing_id: string; storage_path: string }[] };
      const photoByListing = new Map<string, string>();
      for (const photo of photoRows ?? []) {
        if (!photoByListing.has(photo.listing_id)) {
          photoByListing.set(photo.listing_id, getPublicInventoryPhotoUrl(photo.storage_path));
        }
      }

      setListings((data ?? []).map((l) => ({ ...l, photoUrl: photoByListing.get(l.id) ?? null })));
      setIsLoading(false);
    })();
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
      <Link href="/" className="text-sm text-green-700">
        ← Back home
      </Link>
      <h1 className="text-2xl font-bold text-green-700">Inventory</h1>

      {isLoading ? (
        <p className="text-gray-700">Loading...</p>
      ) : listings.length === 0 ? (
        <p className="text-gray-700">No inventory listed right now.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {listings.map((item) => (
            <li key={item.id}>
              <Link href={`/inventory/${item.id}`} className="flex items-center gap-4 rounded-lg border border-gray-300 p-4 hover:bg-gray-50">
                {item.photoUrl ? (
                  <Image src={item.photoUrl} alt={item.title} width={72} height={72} className="rounded object-cover" />
                ) : (
                  <div className="w-[72px] h-[72px] rounded bg-green-50 flex items-center justify-center text-2xl">🚜</div>
                )}
                <div>
                  <p className="font-semibold text-black">{item.title}</p>
                  <p className="text-sm text-gray-700">
                    {item.condition === "new" ? "New" : "Used"} · {item.price != null ? `$${item.price.toLocaleString()}` : "Call for price"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

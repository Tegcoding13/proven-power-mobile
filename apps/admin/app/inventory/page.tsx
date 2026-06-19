"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { InventoryListing } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";

export default function AdminInventoryListPage() {
  const [listings, setListings] = useState<InventoryListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("inventory_listings")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setListings(data ?? []);
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-700">Inventory</h1>
        <Link href="/inventory/new" className="min-h-12 flex items-center rounded-lg bg-green-600 px-4 font-semibold text-white">
          + Add Listing
        </Link>
      </div>

      {isLoading ? (
        <p className="text-gray-700">Loading...</p>
      ) : listings.length === 0 ? (
        <p className="text-gray-700">No inventory listed yet.</p>
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-gray-700 border-b border-gray-200">
              <th className="py-2">Title</th>
              <th className="py-2">Price</th>
              <th className="py-2">Condition</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => (
              <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3">
                  <Link href={`/inventory/${l.id}`} className="text-green-700 font-semibold">
                    {l.title}
                  </Link>
                </td>
                <td className="py-3 text-black">{l.price != null ? `$${l.price.toLocaleString()}` : "Call for price"}</td>
                <td className="py-3 text-black capitalize">{l.condition}</td>
                <td className="py-3 text-black capitalize">{l.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Link href="/" className="text-sm text-green-700">
        ← Back home
      </Link>
    </div>
  );
}

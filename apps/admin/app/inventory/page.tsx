"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { InventoryListing } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { syncMachineFinder } from "./actions";
import { AdminPageHeader } from "../../components/AdminPageHeader";

export default function AdminInventoryListPage() {
  const [listings, setListings] = useState<InventoryListing[]>([]);
  const [locationNameById, setLocationNameById] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function fetchListings(): Promise<{ listings: InventoryListing[]; locationNameById: Map<string, string> }> {
    const supabase = createClient();
    const [{ data }, { data: locationRows }] = await Promise.all([
      supabase.from("inventory_listings").select("*").order("created_at", { ascending: false }),
      supabase.from("dealership_locations").select("id, name"),
    ]);
    return {
      listings: data ?? [],
      locationNameById: new Map((locationRows ?? []).map((l) => [l.id, l.name.replace("Proven Power - ", "")])),
    };
  }

  async function loadListings() {
    const result = await fetchListings();
    setListings(result.listings);
    setLocationNameById(result.locationNameById);
    setIsLoading(false);
  }

  useEffect(() => {
    fetchListings().then((result) => {
      setListings(result.listings);
      setLocationNameById(result.locationNameById);
      setIsLoading(false);
    });
  }, []);

  async function handleSync() {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const result = await syncMachineFinder();
      const parts = [`Fetched: ${result.fetched} · Synced: ${result.upserted}`];
      if (result.errors.length > 0) parts.push(`Errors: ${result.errors[0]}`);
      if (result.diagnostic) parts.push(`ℹ ${result.diagnostic}`);
      setSyncMessage(parts.join(" — "));
      await loadListings();
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Sync failed.");
    }
    setIsSyncing(false);
  }

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <AdminPageHeader title="Inventory" />
      <div className="max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="min-h-12 flex items-center rounded-lg border border-green-600 px-4 font-semibold text-green-700 disabled:opacity-60"
          >
            {isSyncing ? "Syncing..." : "Sync Used Inventory"}
          </button>
          <Link href="/inventory/new" className="min-h-12 flex items-center rounded-lg bg-green-600 px-4 font-semibold text-white">
            + Add Listing
          </Link>
        </div>
      </div>

      {syncMessage ? <p className="text-sm text-gray-700">{syncMessage}</p> : null}

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
              <th className="py-2">Store</th>
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
                <td className="py-3 text-black">{l.dealership_location_id ? (locationNameById.get(l.dealership_location_id) ?? "—") : "—"}</td>
                <td className="py-3 text-black capitalize">{l.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      </div>
    </div>
  );
}

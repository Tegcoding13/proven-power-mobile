"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { AdminPageHeader } from "../../../components/AdminPageHeader";
import type { InventoryListing, InventoryStatus, DealershipLocation } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { getPublicInventoryPhotoUrl, uploadInventoryPhoto } from "../../../lib/inventory";

const STATUSES: InventoryStatus[] = ["available", "pending", "sold"];

async function fetchListingData(id: string) {
  const supabase = createClient();
  const [{ data: listing }, { data: photoRows }, { data: locationRows }] = await Promise.all([
    supabase.from("inventory_listings").select("*").eq("id", id).single(),
    supabase.from("inventory_listing_photos").select("*").eq("listing_id", id),
    supabase.from("dealership_locations").select("*").order("name", { ascending: true }),
  ]);
  return {
    listing: listing ?? null,
    photos: (photoRows ?? []).map((p) => ({ id: p.id, url: getPublicInventoryPhotoUrl(p) })),
    locations: locationRows ?? [],
  };
}

export default function AdminInventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [listing, setListing] = useState<InventoryListing | null>(null);
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
  const [locations, setLocations] = useState<DealershipLocation[]>([]);
  const [priceInput, setPriceInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    fetchListingData(id).then((result) => {
      if (!isCurrent) return;
      setListing(result.listing);
      setPhotos(result.photos);
      setLocations(result.locations);
      setPriceInput(result.listing?.price != null ? String(result.listing.price) : "");
      setDescriptionInput(result.listing?.description ?? "");
      setIsLoading(false);
    });
    return () => {
      isCurrent = false;
    };
  }, [id]);

  async function reload() {
    const result = await fetchListingData(id);
    setListing(result.listing);
    setPhotos(result.photos);
    setLocations(result.locations);
  }

  async function handleStatusChange(status: InventoryStatus) {
    const supabase = createClient();
    await supabase.from("inventory_listings").update({ status }).eq("id", id);
    reload();
  }

  async function handleLocationChange(locationId: string) {
    const supabase = createClient();
    await supabase.from("inventory_listings").update({ dealership_location_id: locationId || null }).eq("id", id);
    reload();
  }

  async function handleSaveDetails() {
    const supabase = createClient();
    await supabase
      .from("inventory_listings")
      .update({ price: priceInput ? Number(priceInput) : null, description: descriptionInput.trim() || null })
      .eq("id", id);
    reload();
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await uploadInventoryPhoto(id, file);
    } finally {
      setIsUploading(false);
      event.target.value = "";
      reload();
    }
  }

  if (isLoading || !listing) {
    return <p className="px-4 py-8 text-gray-700">Loading...</p>;
  }

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <AdminPageHeader title={listing.title} backHref="/inventory" backLabel="Inventory" />
      <div className="flex flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">

      <div>
        <h1 className="text-2xl font-bold text-black">{listing.title}</h1>
        <p className="text-gray-700">
          {listing.make} {listing.model}
          {listing.model_year ? ` (${listing.model_year})` : ""}
          {listing.stock_number ? ` · Stock #${listing.stock_number}` : ""}
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <p className="font-semibold text-black">Status</p>
        <div className="flex gap-2">
          {STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              className={`min-h-10 rounded-full px-3 text-sm font-semibold capitalize ${
                listing.status === status ? "bg-green-600 text-white" : "bg-gray-100 text-black"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <p className="font-semibold text-black">Store</p>
        <select
          value={listing.dealership_location_id ?? ""}
          onChange={(e) => handleLocationChange(e.target.value)}
          className="min-h-12 rounded-lg border border-gray-300 px-4 text-black"
        >
          <option value="">Unassigned</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name.replace("Proven Power - ", "")}
            </option>
          ))}
        </select>
      </section>

      <section className="flex flex-col gap-2">
        <p className="font-semibold text-black">Price &amp; Description</p>
        <input
          type="number"
          step="0.01"
          placeholder="Price (blank = call for price)"
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          className="min-h-12 rounded-lg border border-gray-300 px-4 text-black"
        />
        <textarea
          placeholder="Description"
          value={descriptionInput}
          onChange={(e) => setDescriptionInput(e.target.value)}
          rows={4}
          className="rounded-lg border border-gray-300 p-4 text-black"
        />
        <button onClick={handleSaveDetails} className="self-start min-h-10 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white">
          Save Changes
        </button>
      </section>

      <section>
        <h2 className="text-lg font-bold text-black mb-2">Photos</h2>
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <Image key={p.id} src={p.url} alt={listing.title} width={120} height={120} className="rounded-lg object-cover" />
          ))}
          <label className="w-[120px] h-[120px] rounded-lg border border-gray-300 flex items-center justify-center cursor-pointer text-green-700 font-semibold">
            {isUploading ? "..." : "+ Add"}
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </label>
        </div>
      </section>
      </div>
    </div>
  );
}

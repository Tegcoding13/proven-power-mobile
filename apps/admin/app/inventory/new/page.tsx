"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EquipmentCategory } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";

const CATEGORIES: { value: EquipmentCategory; label: string }[] = [
  { value: "tractor", label: "Tractor" },
  { value: "mower", label: "Mower" },
  { value: "utility_vehicle", label: "Utility Vehicle" },
  { value: "attachment", label: "Attachment" },
  { value: "other", label: "Other" },
];

export default function NewInventoryListingPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [model, setModel] = useState("");
  const [modelYear, setModelYear] = useState("");
  const [category, setCategory] = useState<EquipmentCategory>("tractor");
  const [condition, setCondition] = useState<"new" | "used">("new");
  const [price, setPrice] = useState("");
  const [stockNumber, setStockNumber] = useState("");
  const [description, setDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    const { data: created, error } = await supabase
      .from("inventory_listings")
      .insert({
        title: title.trim(),
        model: model.trim(),
        model_year: modelYear ? Number(modelYear) : null,
        category,
        condition,
        price: price ? Number(price) : null,
        stock_number: stockNumber.trim() || null,
        description: description.trim() || null,
        created_by_profile_id: userData.user?.id,
      })
      .select("*")
      .single();

    if (error || !created) {
      setErrorMessage(error?.message ?? "Failed to create listing.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    router.replace(`/inventory/${created.id}`);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-8 max-w-md mx-auto w-full">
      <Link href="/inventory" className="text-sm text-green-700">
        ← Back to Inventory
      </Link>
      <h1 className="text-2xl font-bold text-green-700">Add Inventory Listing</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          placeholder="Listing title (e.g. 2024 1025R Compact Tractor)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
        />

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => setCategory(option.value)}
              className={`min-h-12 rounded-full px-4 font-semibold ${category === option.value ? "bg-green-600 text-white" : "bg-gray-100 text-black"}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCondition("new")}
            className={`flex-1 min-h-12 rounded-lg font-semibold ${condition === "new" ? "bg-green-600 text-white" : "bg-gray-100 text-black"}`}
          >
            New
          </button>
          <button
            type="button"
            onClick={() => setCondition("used")}
            className={`flex-1 min-h-12 rounded-lg font-semibold ${condition === "used" ? "bg-green-600 text-white" : "bg-gray-100 text-black"}`}
          >
            Used
          </button>
        </div>

        <input
          placeholder="Model (e.g. 1025R)"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          required
          className="min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
        />
        <input
          placeholder="Model year"
          type="number"
          value={modelYear}
          onChange={(e) => setModelYear(e.target.value)}
          className="min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
        />
        <input
          placeholder="Price (leave blank for 'Call for price')"
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
        />
        <input
          placeholder="Stock number"
          value={stockNumber}
          onChange={(e) => setStockNumber(e.target.value)}
          className="min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="rounded-lg border border-gray-300 bg-gray-50 p-4 text-base text-black"
        />

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

        <button
          type="submit"
          disabled={!title.trim() || !model.trim() || isSubmitting}
          className="min-h-12 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-70"
        >
          {isSubmitting ? "Saving..." : "Save Listing"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EquipmentCategory } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { useBusinessAccount } from "../../../lib/business-account";
import { uploadEquipmentPhoto } from "../../../lib/equipment-photos";

const CATEGORIES: { value: EquipmentCategory; label: string }[] = [
  { value: "tractor", label: "Tractor" },
  { value: "mower", label: "Mower" },
  { value: "utility_vehicle", label: "Utility Vehicle" },
  { value: "attachment", label: "Attachment" },
  { value: "other", label: "Other" },
];

export default function AddEquipmentPage() {
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();

  const [model, setModel] = useState("");
  const [modelYear, setModelYear] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [nickname, setNickname] = useState("");
  const [category, setCategory] = useState<EquipmentCategory>("tractor");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!businessAccount) {
      setErrorMessage("Still loading your account — try again in a moment.");
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setIsSubmitting(false);
      return;
    }

    const { data: created, error } = await supabase
      .from("equipment")
      .insert({
        business_account_id: businessAccount.id,
        added_by_profile_id: userData.user.id,
        model: model.trim(),
        model_year: modelYear ? Number(modelYear) : null,
        serial_number: serialNumber.trim() || null,
        nickname: nickname.trim() || null,
        category,
      })
      .select("*")
      .single();

    if (error || !created) {
      setErrorMessage(error?.message ?? "Failed to add equipment.");
      setIsSubmitting(false);
      return;
    }

    if (photoFile) {
      try {
        await uploadEquipmentPhoto({
          businessAccountId: businessAccount.id,
          equipmentId: created.id,
          file: photoFile,
          uploadedByProfileId: userData.user.id,
        });
      } catch {
        // Best-effort on web; no offline outbox here (desktop browsers assumed online).
      }
    }

    setIsSubmitting(false);
    router.replace(`/garage/${created.id}`);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-8 max-w-md mx-auto w-full">
      <Link href="/garage" className="text-sm text-green-700">
        ← Back to My Garage
      </Link>
      <h1 className="text-2xl font-bold text-green-700">Add Equipment</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          className="text-sm text-black"
        />

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => setCategory(option.value)}
              className={`min-h-12 rounded-full px-4 font-semibold ${
                category === option.value ? "bg-green-600 text-white" : "bg-gray-100 text-black"
              }`}
            >
              {option.label}
            </button>
          ))}
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
          placeholder="Serial number"
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
          className="min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
        />
        <input
          placeholder="Nickname (optional)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
        />

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

        <button
          type="submit"
          disabled={!model.trim() || isSubmitting || isLoadingAccount}
          className="min-h-12 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-70"
        >
          {isSubmitting ? "Saving..." : isLoadingAccount ? "Loading your account..." : "Save Equipment"}
        </button>
      </form>
    </div>
  );
}

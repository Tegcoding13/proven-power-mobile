"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Equipment, PartsRequestType } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { useBusinessAccount } from "../../../lib/business-account";
import { uploadPartsRequestMedia } from "../../../lib/parts-request-media";

const REQUEST_TYPES: { value: PartsRequestType; label: string }[] = [
  { value: "stock_check", label: "Is it in stock?" },
  { value: "part_order", label: "Order a Part" },
  { value: "broken_part_id", label: "Identify a Broken Part" },
];

export default function NewPartsRequestPage() {
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [requestType, setRequestType] = useState<PartsRequestType>("part_order");
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!businessAccount) return;
    const supabase = createClient();
    supabase
      .from("equipment")
      .select("*")
      .eq("business_account_id", businessAccount.id)
      .is("deleted_at", null)
      .then(({ data }) => setEquipmentList(data ?? []));
  }, [businessAccount]);

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
      .from("parts_requests")
      .insert({
        business_account_id: businessAccount.id,
        equipment_id: equipmentId || null,
        requested_by_profile_id: userData.user.id,
        request_type: requestType,
        description: description.trim(),
      })
      .select("*")
      .single();

    if (error || !created) {
      setErrorMessage(error?.message ?? "Failed to submit request.");
      setIsSubmitting(false);
      return;
    }

    if (photoFile) {
      try {
        await uploadPartsRequestMedia({
          businessAccountId: businessAccount.id,
          partsRequestId: created.id,
          file: photoFile,
          uploadedByProfileId: userData.user.id,
        });
      } catch {
        // Best-effort
      }
    }

    setIsSubmitting(false);
    router.replace(`/parts/${created.id}`);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-8 max-w-md mx-auto w-full">
      <h1 className="text-2xl font-bold text-green-700">Request Parts</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <p className="font-semibold text-black mb-2">Request Type</p>
          <div className="flex flex-wrap gap-2">
            {REQUEST_TYPES.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => setRequestType(option.value)}
                className={`min-h-12 rounded-full px-4 font-semibold ${requestType === option.value ? "bg-green-600 text-white" : "bg-gray-100 text-black"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {equipmentList.length > 0 ? (
          <div>
            <p className="font-semibold text-black mb-2">Equipment (optional)</p>
            <div className="flex flex-wrap gap-2">
              {equipmentList.map((eq) => (
                <button
                  type="button"
                  key={eq.id}
                  onClick={() => setEquipmentId(equipmentId === eq.id ? "" : eq.id)}
                  className={`min-h-12 rounded-full px-4 font-semibold ${equipmentId === eq.id ? "bg-green-600 text-white" : "bg-gray-100 text-black"}`}
                >
                  {eq.nickname || eq.model}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <textarea
          placeholder="What part do you need?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="rounded-lg border border-gray-300 bg-gray-50 p-4 text-base text-black"
        />

        <div>
          <p className="font-semibold text-black mb-2">Photo</p>
          <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} className="text-sm text-black" />
        </div>

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

        <button
          type="submit"
          disabled={!description.trim() || isSubmitting || isLoadingAccount}
          className="min-h-12 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-70"
        >
          {isSubmitting ? "Submitting..." : isLoadingAccount ? "Loading your account..." : "Submit Request"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Equipment, ServiceRequestType } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { useBusinessAccount } from "../../../lib/business-account";
import { uploadServiceRequestMedia } from "../../../lib/service-request-media";

const REQUEST_TYPES: { value: ServiceRequestType; label: string }[] = [
  { value: "drop_off", label: "Drop Off" },
  { value: "pickup_delivery", label: "Pickup & Delivery" },
];

const COMMON_SERVICES = [
  "Oil & Filter Change",
  "Annual Tune-Up",
  "Blade Sharpening / Replacement",
  "Belt Replacement",
  "Battery Replacement",
  "Air Filter Service",
  "Tire Repair / Flat",
  "Engine Won't Start",
  "Hydraulic Issue",
  "Fuel System Issue",
];

export default function NewServiceRequestPage() {
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [requestType, setRequestType] = useState<ServiceRequestType>("drop_off");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
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
      .then(({ data }) => {
        setEquipmentList(data ?? []);
        if (data && data.length > 0) setEquipmentId(data[0].id);
      });
  }, [businessAccount]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!businessAccount) {
      setErrorMessage("Still loading your account — try again in a moment.");
      return;
    }
    if (!equipmentId) {
      setErrorMessage("Select which piece of equipment this is for.");
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

    const fullDescription = [
      selectedServices.length > 0 ? `Services needed: ${selectedServices.join(", ")}` : null,
      description.trim() || null,
    ].filter(Boolean).join("\n\n");

    const { data: created, error } = await supabase
      .from("service_requests")
      .insert({
        business_account_id: businessAccount.id,
        equipment_id: equipmentId,
        requested_by_profile_id: userData.user.id,
        request_type: requestType,
        description: fullDescription,
      })
      .select("*")
      .single();

    if (error || !created) {
      setErrorMessage(error?.message ?? "Failed to submit request.");
      setIsSubmitting(false);
      return;
    }

    for (const file of mediaFiles) {
      try {
        await uploadServiceRequestMedia({
          businessAccountId: businessAccount.id,
          serviceRequestId: created.id,
          file,
          mediaType: file.type.startsWith("video") ? "video" : "photo",
          uploadedByProfileId: userData.user.id,
        });
      } catch {
        // Best-effort — request itself already saved.
      }
    }

    setIsSubmitting(false);
    router.replace(`/service/${created.id}`);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-8 max-w-md mx-auto w-full">
      <Link href="/service" className="text-sm text-green-700">
        ← Back to Service
      </Link>
      <h1 className="text-2xl font-bold text-green-700">Request Service</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <p className="font-semibold text-black mb-2">Equipment</p>
          <div className="flex flex-wrap gap-2">
            {equipmentList.map((eq) => (
              <button
                type="button"
                key={eq.id}
                onClick={() => setEquipmentId(eq.id)}
                className={`min-h-12 rounded-full px-4 font-semibold ${equipmentId === eq.id ? "bg-green-600 text-white" : "bg-gray-100 text-black"}`}
              >
                {eq.nickname || eq.model}
              </button>
            ))}
          </div>
        </div>

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

        <div>
          <p className="font-semibold text-black mb-2">Common Services</p>
          <div className="flex flex-wrap gap-2">
            {COMMON_SERVICES.map((service) => {
              const isSelected = selectedServices.includes(service);
              return (
                <button
                  type="button"
                  key={service}
                  onClick={() =>
                    setSelectedServices((prev) =>
                      isSelected ? prev.filter((s) => s !== service) : [...prev, service]
                    )
                  }
                  className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                    isSelected
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-gray-700 border-gray-300 hover:border-green-400"
                  }`}
                >
                  {isSelected ? "✓ " : ""}{service}
                </button>
              );
            })}
          </div>
        </div>

        <textarea
          placeholder="Describe the issue"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="rounded-lg border border-gray-300 bg-gray-50 p-4 text-base text-black"
        />

        <div>
          <p className="font-semibold text-black mb-2">Photos/Video</p>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => setMediaFiles(Array.from(e.target.files ?? []))}
            className="text-sm text-black"
          />
        </div>

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

        <button
          type="submit"
          disabled={(!description.trim() && selectedServices.length === 0) || !equipmentId || isSubmitting || isLoadingAccount}
          className="min-h-12 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-70"
        >
          {isSubmitting ? "Submitting..." : isLoadingAccount ? "Loading your account..." : "Submit Request"}
        </button>
      </form>
    </div>
  );
}

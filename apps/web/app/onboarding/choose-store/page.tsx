"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DealershipLocation } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { useBusinessAccount } from "../../../lib/business-account";

export default function ChooseStorePage() {
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [locations, setLocations] = useState<DealershipLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("dealership_locations")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .then(({ data }) => {
        setLocations(data ?? []);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!isLoadingAccount && businessAccount?.primary_location_id) {
      router.replace("/");
    }
  }, [isLoadingAccount, businessAccount, router]);

  async function handleChoose(locationId: string) {
    if (!businessAccount) return;
    setIsSaving(true);
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("business_accounts")
      .update({ primary_location_id: locationId })
      .eq("id", businessAccount.id);

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }
    router.replace("/");
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-12 max-w-md mx-auto w-full">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-green-700">Welcome to Proven Power</h1>
        <p className="text-gray-700 mt-2">Which store is your home location?</p>
      </div>

      {errorMessage ? <p className="text-sm text-red-600 text-center">{errorMessage}</p> : null}

      {isLoading || isLoadingAccount ? (
        <p className="text-gray-700 text-center">Loading...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {locations.map((location) => (
            <button
              key={location.id}
              onClick={() => handleChoose(location.id)}
              disabled={isSaving}
              className="text-left rounded-2xl border-2 border-gray-200 p-5 hover:border-green-600 disabled:opacity-70"
            >
              <p className="font-bold text-black text-lg">{location.name.replace("Proven Power - ", "")}</p>
              <p className="text-sm text-gray-700 mt-1">
                {location.address}, {location.city}, {location.state} {location.zip}
              </p>
              {location.phone ? <p className="text-sm text-gray-700">{location.phone}</p> : null}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 text-center">
        Your parts, service, and sales requests will go to this store. You can ask us to change it anytime.
      </p>
    </div>
  );
}

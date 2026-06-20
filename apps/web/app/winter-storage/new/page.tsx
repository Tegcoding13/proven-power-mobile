"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Equipment, StorageSeasonWindow } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { useBusinessAccount } from "../../../lib/business-account";

export default function NewWinterStorageSignupPage() {
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [zip, setZip] = useState("");
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [seasonWindows, setSeasonWindows] = useState<StorageSeasonWindow[]>([]);
  const [seasonWindowId, setSeasonWindowId] = useState<string>("");
  const [isLookingUpZone, setIsLookingUpZone] = useState(false);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [bundleAdded, setBundleAdded] = useState(false);
  const [agreed, setAgreed] = useState(false);
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

  async function handleLookupZone() {
    if (!zip.trim()) return;
    setIsLookingUpZone(true);
    setZoneError(null);
    setSeasonWindows([]);
    setSeasonWindowId("");

    const supabase = createClient();
    const { data: foundZoneId } = await supabase.rpc("zone_for_zip", { target_zip: zip.trim() });

    if (!foundZoneId) {
      setZoneError("We don't have storage zones set up for that zip code yet — contact the dealership directly.");
      setIsLookingUpZone(false);
      return;
    }

    setZoneId(foundZoneId);
    const { data: windows } = await supabase
      .from("storage_season_windows")
      .select("*")
      .eq("zone_id", foundZoneId)
      .eq("is_active", true)
      .order("dropoff_window_start", { ascending: true });

    setSeasonWindows(windows ?? []);
    if (windows && windows.length > 0) setSeasonWindowId(windows[0].id);
    if (!windows || windows.length === 0) {
      setZoneError("No open storage season for your zone right now — check back later.");
    }
    setIsLookingUpZone(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!businessAccount || !equipmentId || !seasonWindowId) {
      setErrorMessage("Pick equipment and a storage window before submitting.");
      return;
    }
    if (!agreed) {
      setErrorMessage("You must agree to the storage terms to continue.");
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

    const { error } = await supabase.from("winter_storage_signups").insert({
      business_account_id: businessAccount.id,
      equipment_id: equipmentId,
      zone_id: zoneId,
      season_window_id: seasonWindowId,
      winterization_bundle_added: bundleAdded,
      agreement_signed_at: new Date().toISOString(),
      requested_by_profile_id: userData.user.id,
    });

    setIsSubmitting(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    router.replace("/winter-storage");
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-8 max-w-md mx-auto w-full">
      <Link href="/winter-storage" className="text-sm text-green-700">
        ← Back to Winter Storage
      </Link>
      <h1 className="text-2xl font-bold text-green-700">Winter Storage Sign-Up</h1>

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
          <p className="font-semibold text-black mb-2">Your Zip Code</p>
          <div className="flex gap-2">
            <input
              placeholder="Zip code"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className="flex-1 min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
            />
            <button
              type="button"
              onClick={handleLookupZone}
              disabled={!zip.trim() || isLookingUpZone}
              className="min-h-12 rounded-lg bg-green-600 px-4 font-semibold text-white disabled:opacity-70"
            >
              {isLookingUpZone ? "Looking up..." : "Find Dates"}
            </button>
          </div>
          {zoneError ? <p className="text-sm text-red-600 mt-2">{zoneError}</p> : null}
        </div>

        {seasonWindows.length > 0 ? (
          <div>
            <p className="font-semibold text-black mb-2">Available Storage Window</p>
            <div className="flex flex-col gap-2">
              {seasonWindows.map((w) => (
                <button
                  type="button"
                  key={w.id}
                  onClick={() => setSeasonWindowId(w.id)}
                  className={`text-left rounded-lg border-2 p-3 ${seasonWindowId === w.id ? "border-green-600 bg-green-50" : "border-gray-300"}`}
                >
                  <p className="font-semibold text-black">{w.season_label}</p>
                  <p className="text-sm text-gray-700">
                    Drop-off: {new Date(w.dropoff_window_start).toLocaleDateString()} – {new Date(w.dropoff_window_end).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-700">
                    Pickup: {new Date(w.pickup_window_start).toLocaleDateString()} – {new Date(w.pickup_window_end).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-black">
          <input type="checkbox" checked={bundleAdded} onChange={(e) => setBundleAdded(e.target.checked)} className="accent-green-600 w-5 h-5" />
          Add winterization service bundle
        </label>

        <label className="flex items-start gap-2 text-black text-sm">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="accent-green-600 w-5 h-5 mt-0.5" />
          I agree to the winter storage terms and conditions.
        </label>

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

        <button
          type="submit"
          disabled={!equipmentId || !seasonWindowId || !agreed || isSubmitting || isLoadingAccount}
          className="min-h-12 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-70"
        >
          {isSubmitting ? "Submitting..." : "Sign Up"}
        </button>
      </form>
    </div>
  );
}

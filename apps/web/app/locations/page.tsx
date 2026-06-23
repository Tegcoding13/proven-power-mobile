"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DealershipLocation, DealershipHours } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { useBusinessAccount } from "../../lib/business-account";

const DAY_LABELS: { key: keyof DealershipHours; label: string }[] = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

function formatTime12Hour(time24: string): string {
  const [hourStr, minute] = time24.split(":");
  const hour = Number(hourStr);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${period}`;
}

export default function LocationsPage() {
  const { businessAccount, refresh } = useBusinessAccount();
  const [locations, setLocations] = useState<DealershipLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("dealership_locations")
      .select("*")
      .eq("is_active", true)
      .then(({ data }) => {
        setLocations(data ?? []);
        setIsLoading(false);
      });
  }, []);

  async function handleMakeHomeStore(locationId: string) {
    if (!businessAccount) return;
    setSavingId(locationId);
    const supabase = createClient();
    await supabase.from("business_accounts").update({ primary_location_id: locationId }).eq("id", businessAccount.id);
    await refresh();
    setSavingId(null);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
      <Link href="/" className="text-sm text-green-700">
        ← Back home
      </Link>
      <h1 className="text-2xl font-bold text-green-700">Locations &amp; Contact</h1>

      {isLoading ? (
        <p className="text-gray-700">Loading...</p>
      ) : (
        <div className="flex flex-col gap-4">
          {locations.map((loc) => {
            const isHomeStore = businessAccount?.primary_location_id === loc.id;
            return (
            <div key={loc.id} className="rounded-lg border border-gray-300 p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-black">{loc.name}</h2>
                {isHomeStore ? (
                  <span className="text-xs font-semibold text-green-700 bg-green-50 rounded-full px-3 py-1 shrink-0">
                    Your Home Store
                  </span>
                ) : null}
              </div>

              {loc.address ? (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(`${loc.address}, ${loc.city}, ${loc.state} ${loc.zip}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-700"
                >
                  {loc.address}, {loc.city}, {loc.state} {loc.zip}
                </a>
              ) : null}

              {loc.phone ? (
                <a href={`tel:${loc.phone}`} className="text-green-700 font-semibold">
                  📞 {loc.phone}
                </a>
              ) : null}

              {loc.after_hours_phone ? (
                <a href={`tel:${loc.after_hours_phone}`} className="text-amber-700 text-sm font-semibold">
                  🚨 After-hours / breakdown: {loc.after_hours_phone}
                </a>
              ) : null}

              {loc.hours ? (
                <div className="mt-1">
                  {DAY_LABELS.map(({ key, label }) => {
                    const day = loc.hours?.[key];
                    return (
                      <div key={key} className="flex justify-between text-xs text-gray-700">
                        <span>{label}</span>
                        <span>{day ? `${formatTime12Hour(day.open)} – ${formatTime12Hour(day.close)}` : "Closed"}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {businessAccount && !isHomeStore ? (
                <button
                  onClick={() => handleMakeHomeStore(loc.id)}
                  disabled={savingId === loc.id}
                  className="self-start mt-1 min-h-10 rounded-lg border border-green-600 px-4 text-sm font-semibold text-green-700 disabled:opacity-70"
                >
                  {savingId === loc.id ? "Saving..." : "Make this my home store"}
                </button>
              ) : null}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

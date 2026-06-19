"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DealershipLocation, DealershipHours } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";

const DAY_LABELS: { key: keyof DealershipHours; label: string }[] = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

export default function LocationsPage() {
  const [locations, setLocations] = useState<DealershipLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-green-700">Locations &amp; Contact</h1>

      {isLoading ? (
        <p className="text-gray-700">Loading...</p>
      ) : (
        <div className="flex flex-col gap-4">
          {locations.map((loc) => (
            <div key={loc.id} className="rounded-lg border border-gray-300 p-4 flex flex-col gap-2">
              <h2 className="text-lg font-bold text-black">{loc.name}</h2>

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
                        <span>{day ? `${day.open} – ${day.close}` : "Closed"}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Link href="/" className="text-sm text-green-700">
        ← Back home
      </Link>
    </div>
  );
}

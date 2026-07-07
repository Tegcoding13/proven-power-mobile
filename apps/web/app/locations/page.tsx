"use client";

import { useEffect, useState } from "react";
import type { DealershipLocation, DealershipHours } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";
import { useBusinessAccount } from "../../lib/business-account";
import { PageHeader } from "../../components/PageHeader";

const DAY_LABELS: { key: keyof DealershipHours; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

function formatTime12Hour(time24: string): string {
  const [hourStr, minute] = time24.split(":");
  const hour = Number(hourStr);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${period}`;
}

function todayKey(): keyof DealershipHours {
  const days: (keyof DealershipHours)[] = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  return days[new Date().getDay()];
}

export default function LocationsPage() {
  const { businessAccount, refresh } = useBusinessAccount();
  const [locations, setLocations] = useState<DealershipLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedHours, setExpandedHours] = useState<Record<string, boolean>>({});
  const today = todayKey();

  useEffect(() => {
    const supabase = createClient();
    supabase.from("dealership_locations").select("*").eq("is_active", true)
      .then(({ data }) => { setLocations(data ?? []); setIsLoading(false); });
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
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <PageHeader title="Locations & Contact" />

      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-5">
        {isLoading ? (
          <div className="flex flex-col gap-4">
            {[1,2].map((i) => <div key={i} className="h-48 bg-white rounded-2xl animate-pulse shadow-sm" />)}
          </div>
        ) : locations.map((loc) => {
          const isHome = businessAccount?.primary_location_id === loc.id;
          const todayHours = loc.hours?.[today];
          const hoursExpanded = expandedHours[loc.id];
          const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent([loc.address, loc.city, loc.state, loc.zip].filter(Boolean).join(", "))}`;

          return (
            <div key={loc.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-transparent">
              {/* green accent bar + name */}
              <div className="bg-[#1a3d2b] px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-base leading-tight">{loc.name}</p>
                  {todayHours ? (
                    <p className="text-white/60 text-xs mt-0.5">Open today · {formatTime12Hour(todayHours.open)} – {formatTime12Hour(todayHours.close)}</p>
                  ) : (
                    <p className="text-white/60 text-xs mt-0.5">Closed today</p>
                  )}
                </div>
                {isHome && (
                  <span className="shrink-0 bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">Home Store</span>
                )}
              </div>

              <div className="px-5 py-4 flex flex-col gap-4">
                {/* address */}
                {loc.address && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-3 group">
                    <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-green-100 transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a3d2b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 group-hover:text-[#1a3d2b] transition-colors">{loc.address}</p>
                      <p className="text-xs text-gray-400">{[loc.city, loc.state, loc.zip].filter(Boolean).join(", ")} · Get directions</p>
                    </div>
                  </a>
                )}

                {/* phone */}
                {loc.phone && (
                  <a href={`tel:${loc.phone}`} className="flex items-center gap-3 group">
                    <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0 group-hover:bg-green-100 transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a3d2b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.71 3.53 2 2 0 0 1 3.68 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.69a16 16 0 0 0 6 6l1.06-1.06a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 group-hover:text-[#1a3d2b] transition-colors">{loc.phone}</p>
                      <p className="text-xs text-gray-400">Tap to call</p>
                    </div>
                  </a>
                )}

                {/* after-hours */}
                {loc.after_hours_phone && (
                  <a href={`tel:${loc.after_hours_phone}`} className="flex items-center gap-3 group">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-amber-700">{loc.after_hours_phone}</p>
                      <p className="text-xs text-amber-500">After hours / breakdown</p>
                    </div>
                  </a>
                )}

                {/* hours toggle */}
                {loc.hours && (
                  <button
                    onClick={() => setExpandedHours((prev) => ({ ...prev, [loc.id]: !prev[loc.id] }))}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <span className="text-sm font-semibold text-gray-700">Store Hours</span>
                    <svg className={`text-gray-400 transition-transform ${hoursExpanded ? "rotate-180" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </button>
                )}

                {loc.hours && hoursExpanded && (
                  <div className="rounded-xl bg-gray-50 overflow-hidden divide-y divide-gray-100">
                    {DAY_LABELS.map(({ key, label }) => {
                      const day = loc.hours?.[key];
                      const isToday = key === today;
                      return (
                        <div key={key} className={`flex justify-between px-4 py-2.5 text-sm ${isToday ? "bg-[#1a3d2b]/5" : ""}`}>
                          <span className={`font-medium ${isToday ? "text-[#1a3d2b] font-bold" : "text-gray-600"}`}>{label}</span>
                          <span className={`${isToday ? "text-[#1a3d2b] font-bold" : "text-gray-500"}`}>
                            {day ? `${formatTime12Hour(day.open)} – ${formatTime12Hour(day.close)}` : "Closed"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {businessAccount && !isHome && (
                  <button
                    onClick={() => handleMakeHomeStore(loc.id)}
                    disabled={savingId === loc.id}
                    className="w-full h-11 rounded-xl border-2 border-[#1a3d2b] text-[#1a3d2b] text-sm font-bold hover:bg-[#1a3d2b] hover:text-white transition-colors disabled:opacity-50"
                  >
                    {savingId === loc.id ? "Saving…" : "Make this my home store"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import type {
  WinterStorageSignup,
  WinterStorageStatus,
  BusinessAccount,
  Equipment,
  StorageCalendarDay,
  StorageZone,
} from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";

type EnrichedSignup = WinterStorageSignup & { accountName: string; equipmentLabel: string };

type DayAvailability = StorageCalendarDay & { bookedSlots: number; isFull: boolean };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_MINI = ["S", "M", "T", "W", "T", "F", "S"];
const STATUSES: WinterStorageStatus[] = ["requested", "confirmed", "dropped_off", "stored", "picked_up", "cancelled"];

const STATUS_STYLES: Record<WinterStorageStatus, string> = {
  requested: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  dropped_off: "bg-blue-100 text-blue-800",
  stored: "bg-purple-100 text-purple-800",
  picked_up: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700 line-through",
};

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getCalendarGrid(year: number, month: number): (Date | null)[] {
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (Date | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function getMiniCalendarGrid(year: number, month: number): (number | null)[] {
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

export default function AdminWinterStoragePage() {
  const today = useMemo(() => new Date(), []);

  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [zoneFilter, setZoneFilter] = useState<string>("all");

  const [calendarDays, setCalendarDays] = useState<DayAvailability[]>([]);
  const [signups, setSignups] = useState<EnrichedSignup[]>([]);
  const [zones, setZones] = useState<StorageZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add-day modal state
  const [addDayModal, setAddDayModal] = useState<{ date: Date; dayType: "dropoff" | "pickup" } | null>(null);
  const [addDaySlots, setAddDaySlots] = useState(10);
  const [isSavingDay, setIsSavingDay] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: calRows }, { data: signupRows }, { data: zoneRows }] = await Promise.all([
      supabase.from("storage_calendar_days").select("*").order("date", { ascending: true }),
      supabase.from("winter_storage_signups").select("*").order("created_at", { ascending: false }),
      supabase.from("storage_zones").select("*").order("name", { ascending: true }),
    ]);

    setZones(zoneRows ?? []);

    const accountIds = [...new Set((signupRows ?? []).map((s) => s.business_account_id))];
    const equipmentIds = [...new Set((signupRows ?? []).map((s) => s.equipment_id))];
    const [{ data: accountRows }, { data: equipmentRows }] = await Promise.all([
      accountIds.length
        ? supabase.from("business_accounts").select("*").in("id", accountIds)
        : Promise.resolve({ data: [] as BusinessAccount[] }),
      equipmentIds.length
        ? supabase.from("equipment").select("*").in("id", equipmentIds)
        : Promise.resolve({ data: [] as Equipment[] }),
    ]);
    const accountById = new Map((accountRows ?? []).map((a) => [a.id, a]));
    const equipmentById = new Map((equipmentRows ?? []).map((e) => [e.id, e]));

    const enrichedSignups: EnrichedSignup[] = (signupRows ?? []).map((s) => ({
      ...s,
      accountName: accountById.get(s.business_account_id)?.name ?? "Customer",
      equipmentLabel: equipmentById.get(s.equipment_id)?.nickname || equipmentById.get(s.equipment_id)?.model || "Equipment",
    }));
    setSignups(enrichedSignups);

    // Compute booked slots per calendar day
    const enrichedDays: DayAvailability[] = (calRows ?? []).map((d) => {
      const booked = enrichedSignups.filter((s) => {
        if (s.status === "cancelled") return false;
        if (d.day_type === "dropoff") return s.dropoff_calendar_day_id === d.id;
        return s.pickup_calendar_day_id === d.id;
      }).length;
      return { ...d, bookedSlots: booked, isFull: d.is_manually_full || booked >= d.max_slots };
    });
    setCalendarDays(enrichedDays);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grid = useMemo(
    () => getCalendarGrid(currentMonth.getFullYear(), currentMonth.getMonth()),
    [currentMonth]
  );

  const miniGrid = useMemo(
    () => getMiniCalendarGrid(currentMonth.getFullYear(), currentMonth.getMonth()),
    [currentMonth]
  );

  const calendarDayMap = useMemo(() => {
    const map = new Map<string, DayAvailability[]>();
    for (const d of calendarDays) {
      if (zoneFilter !== "all" && d.zone_id !== zoneFilter) continue;
      const existing = map.get(d.date) ?? [];
      existing.push(d);
      map.set(d.date, existing);
    }
    return map;
  }, [calendarDays, zoneFilter]);

  function signupsForDay(date: Date): { dropoffs: EnrichedSignup[]; pickups: EnrichedSignup[] } {
    const dateStr = toDateStr(date);
    const dropoffs = signups.filter((s) => s.requested_dropoff_date === dateStr);
    const pickups = signups.filter((s) => s.requested_pickup_date === dateStr);
    return { dropoffs, pickups };
  }

  async function handleToggleFull(dayId: string, currentValue: boolean) {
    const supabase = createClient();
    await supabase.from("storage_calendar_days").update({ is_manually_full: !currentValue }).eq("id", dayId);
    await load();
  }

  async function handleStatusChange(signupId: string, status: WinterStorageStatus) {
    const supabase = createClient();
    await supabase.from("winter_storage_signups").update({ status }).eq("id", signupId);
    await load();
  }

  async function handleAddDay() {
    if (!addDayModal) return;
    setIsSavingDay(true);
    const supabase = createClient();
    await supabase.from("storage_calendar_days").upsert(
      {
        zone_id: zoneFilter !== "all" ? zoneFilter : null,
        date: toDateStr(addDayModal.date),
        day_type: addDayModal.dayType,
        max_slots: addDaySlots,
        is_manually_full: false,
      },
      { onConflict: "zone_id,date,day_type", ignoreDuplicates: false }
    );
    setAddDayModal(null);
    setIsSavingDay(false);
    await load();
  }

  async function handleRemoveDay(dayId: string) {
    const supabase = createClient();
    await supabase.from("storage_calendar_days").delete().eq("id", dayId);
    await load();
  }

  function prevMonth() {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    setSelectedDay(null);
  }
  function nextMonth() {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    setSelectedDay(null);
  }
  function goToday() {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(today);
  }

  const selectedDaySignups = selectedDay ? signupsForDay(selectedDay) : null;
  const selectedDateStr = selectedDay ? toDateStr(selectedDay) : null;
  const selectedCalDays = selectedDateStr ? (calendarDayMap.get(selectedDateStr) ?? []) : [];

  const allSignupsForList = [...signups].sort((a, b) => {
    const dateA = a.requested_dropoff_date ?? a.created_at;
    const dateB = b.requested_dropoff_date ?? b.created_at;
    return dateA < dateB ? -1 : 1;
  });

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-green-700">← Home</Link>
          <h1 className="text-xl font-bold text-gray-900">Winter Storage</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="min-h-9 rounded-lg border border-gray-300 px-3 text-sm text-black bg-white"
          >
            <option value="all">All Zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            <button
              onClick={() => setView("calendar")}
              className={`min-h-9 px-4 font-semibold ${view === "calendar" ? "bg-green-600 text-white" : "bg-white text-black"}`}
            >
              Calendar
            </button>
            <button
              onClick={() => setView("list")}
              className={`min-h-9 px-4 font-semibold border-l border-gray-300 ${view === "list" ? "bg-green-600 text-white" : "bg-white text-black"}`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="p-8 text-gray-600">Loading...</p>
      ) : view === "list" ? (
        /* ── LIST VIEW ── */
        <div className="max-w-4xl mx-auto w-full px-4 py-6 flex flex-col gap-3">
          {allSignupsForList.length === 0 ? (
            <p className="text-gray-600">No sign-ups yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {allSignupsForList.map((s) => (
                <li key={s.id} className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold text-black">{s.accountName}</p>
                      <p className="text-sm text-gray-600">{s.equipmentLabel}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_STYLES[s.status]}`}>
                      {s.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  {(s.requested_dropoff_date || s.requested_pickup_date) && (
                    <p className="text-sm text-gray-600">
                      {s.requested_dropoff_date ? `Drop-off: ${new Date(s.requested_dropoff_date + "T12:00:00").toLocaleDateString()}` : ""}
                      {s.requested_dropoff_date && s.requested_pickup_date ? "  ·  " : ""}
                      {s.requested_pickup_date ? `Pick-up: ${new Date(s.requested_pickup_date + "T12:00:00").toLocaleDateString()}` : ""}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {STATUSES.map((st) => (
                      <button
                        key={st}
                        onClick={() => handleStatusChange(s.id, st)}
                        className={`min-h-8 rounded-full px-3 text-xs font-semibold capitalize ${
                          s.status === st ? "bg-green-600 text-white" : "bg-gray-100 text-black"
                        }`}
                      >
                        {st.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        /* ── CALENDAR VIEW ── */
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="hidden lg:flex flex-col w-56 bg-white border-r border-gray-200 p-4 gap-4 shrink-0">
            {/* Mini calendar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">
                  {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </span>
                <div className="flex gap-1">
                  <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-600 text-xs">‹</button>
                  <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-600 text-xs">›</button>
                </div>
              </div>
              <div className="grid grid-cols-7 text-center">
                {WEEKDAYS_MINI.map((d, i) => (
                  <span key={i} className="text-[10px] text-gray-400 font-semibold pb-1">{d}</span>
                ))}
                {miniGrid.map((day, i) => {
                  if (day === null) return <span key={i} />;
                  const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                  const isToday = isSameDay(date, today);
                  const isSelected = selectedDay ? isSameDay(date, selectedDay) : false;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(date)}
                      className={`text-[11px] w-6 h-6 mx-auto rounded-full flex items-center justify-center
                        ${isSelected ? "bg-green-600 text-white" : isToday ? "bg-green-100 text-green-800 font-bold" : "text-gray-700 hover:bg-gray-100"}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Legend</p>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-green-500 shrink-0" />
                <span className="text-xs text-gray-700">Drop-offs</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-blue-500 shrink-0" />
                <span className="text-xs text-gray-700">Pick-ups</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-red-400 shrink-0" />
                <span className="text-xs text-gray-700">Full day</span>
              </div>
            </div>

            {/* Add available day */}
            {selectedDay && (
              <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add Slots</p>
                <button
                  onClick={() => { setAddDaySlots(10); setAddDayModal({ date: selectedDay, dayType: "dropoff" }); }}
                  className="min-h-8 rounded-lg border border-green-600 px-3 text-xs font-semibold text-green-700 text-left"
                >
                  + Drop-off Day
                </button>
                <button
                  onClick={() => { setAddDaySlots(10); setAddDayModal({ date: selectedDay, dayType: "pickup" }); }}
                  className="min-h-8 rounded-lg border border-blue-600 px-3 text-xs font-semibold text-blue-700 text-left"
                >
                  + Pick-up Day
                </button>
              </div>
            )}
          </div>

          {/* Main calendar area */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
              <button
                onClick={goToday}
                className="min-h-9 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-black hover:bg-gray-50"
              >
                Today
              </button>
              <div className="flex items-center gap-1">
                <button onClick={prevMonth} className="p-2 rounded-full hover:bg-gray-100 text-gray-600">‹</button>
                <button onClick={nextMonth} className="p-2 rounded-full hover:bg-gray-100 text-gray-600">›</button>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h2>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Calendar grid */}
              <div className="flex-1 overflow-auto">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 border-b border-gray-200 bg-white">
                  {WEEKDAYS_SHORT.map((d) => (
                    <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 flex-1">
                  {grid.map((date, i) => {
                    if (!date) {
                      return <div key={i} className="min-h-28 border-r border-b border-gray-100 bg-gray-50" />;
                    }

                    const isToday = isSameDay(date, today);
                    const isSelected = selectedDay ? isSameDay(date, selectedDay) : false;
                    const dateStr = toDateStr(date);
                    const dayEvents = calendarDayMap.get(dateStr) ?? [];
                    const { dropoffs, pickups } = signupsForDay(date);
                    const dropoffDay = dayEvents.find((d) => d.day_type === "dropoff");
                    const pickupDay = dayEvents.find((d) => d.day_type === "pickup");

                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedDay(isSelected ? null : date)}
                        className={`min-h-28 border-r border-b border-gray-100 p-1.5 cursor-pointer transition-colors
                          ${isSelected ? "bg-green-50 border-green-200" : "bg-white hover:bg-gray-50"}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full
                              ${isToday ? "bg-green-600 text-white" : "text-gray-700"}`}
                          >
                            {date.getDate()}
                          </span>
                        </div>

                        <div className="flex flex-col gap-0.5">
                          {/* Drop-off events */}
                          {dropoffs.length > 0 && (
                            <div className={`text-xs px-1.5 py-0.5 rounded font-medium ${dropoffDay?.isFull ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800"}`}>
                              {dropoffs.length} drop-off{dropoffs.length !== 1 ? "s" : ""}
                              {dropoffDay ? ` (${dropoffDay.bookedSlots}/${dropoffDay.max_slots})` : ""}
                              {dropoffDay?.isFull ? " FULL" : ""}
                            </div>
                          )}
                          {dropoffs.length === 0 && dropoffDay && (
                            <div className="text-xs px-1.5 py-0.5 rounded font-medium bg-green-50 text-green-700 border border-green-200">
                              Drop-offs open ({dropoffDay.max_slots} slots)
                            </div>
                          )}

                          {/* Pick-up events */}
                          {pickups.length > 0 && (
                            <div className={`text-xs px-1.5 py-0.5 rounded font-medium ${pickupDay?.isFull ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-800"}`}>
                              {pickups.length} pick-up{pickups.length !== 1 ? "s" : ""}
                              {pickupDay ? ` (${pickupDay.bookedSlots}/${pickupDay.max_slots})` : ""}
                              {pickupDay?.isFull ? " FULL" : ""}
                            </div>
                          )}
                          {pickups.length === 0 && pickupDay && (
                            <div className="text-xs px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              Pick-ups open ({pickupDay.max_slots} slots)
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Day detail panel */}
              {selectedDay && (
                <div className="w-80 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">
                      {selectedDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                    </h3>
                    <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                    {/* Calendar day controls */}
                    {selectedCalDays.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {selectedCalDays.map((cd) => (
                          <div key={cd.id} className={`rounded-lg p-3 text-sm ${cd.day_type === "dropoff" ? "bg-green-50 border border-green-200" : "bg-blue-50 border border-blue-200"}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold capitalize text-gray-800">{cd.day_type.replace("_", "-")}</span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleFull(cd.id, cd.is_manually_full)}
                                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cd.is_manually_full ? "bg-red-600 text-white" : "bg-gray-100 text-gray-700"}`}
                                >
                                  {cd.is_manually_full ? "Mark Open" : "Mark Full"}
                                </button>
                                <button
                                  onClick={() => handleRemoveDay(cd.id)}
                                  className="text-xs text-red-600 hover:text-red-800"
                                  title="Remove this day"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                            <p className="text-gray-600 text-xs mt-1">{cd.bookedSlots} of {cd.max_slots} slots booked{cd.isFull ? " · FULL" : ""}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No slots configured for this day.</p>
                    )}

                    {/* Add slot buttons (mobile-friendly) */}
                    <div className="flex gap-2 lg:hidden">
                      <button
                        onClick={() => { setAddDaySlots(10); setAddDayModal({ date: selectedDay, dayType: "dropoff" }); }}
                        className="flex-1 min-h-9 rounded-lg border border-green-600 text-xs font-semibold text-green-700"
                      >
                        + Drop-offs
                      </button>
                      <button
                        onClick={() => { setAddDaySlots(10); setAddDayModal({ date: selectedDay, dayType: "pickup" }); }}
                        className="flex-1 min-h-9 rounded-lg border border-blue-600 text-xs font-semibold text-blue-700"
                      >
                        + Pick-ups
                      </button>
                    </div>

                    {/* Drop-offs for this day */}
                    {selectedDaySignups && selectedDaySignups.dropoffs.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-2">
                          Drop-offs ({selectedDaySignups.dropoffs.length})
                        </p>
                        <div className="flex flex-col gap-2">
                          {selectedDaySignups.dropoffs.map((s) => (
                            <SignupCard key={s.id} signup={s} statuses={STATUSES} statusStyles={STATUS_STYLES} onStatusChange={handleStatusChange} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pick-ups for this day */}
                    {selectedDaySignups && selectedDaySignups.pickups.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">
                          Pick-ups ({selectedDaySignups.pickups.length})
                        </p>
                        <div className="flex flex-col gap-2">
                          {selectedDaySignups.pickups.map((s) => (
                            <SignupCard key={s.id} signup={s} statuses={STATUSES} statusStyles={STATUS_STYLES} onStatusChange={handleStatusChange} />
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedDaySignups &&
                      selectedDaySignups.dropoffs.length === 0 &&
                      selectedDaySignups.pickups.length === 0 && (
                        <p className="text-sm text-gray-500 italic">No bookings for this day.</p>
                      )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Day Modal */}
      {addDayModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">
              Add {addDayModal.dayType === "dropoff" ? "Drop-off" : "Pick-up"} Day
            </h2>
            <p className="text-sm text-gray-600">
              {addDayModal.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1 block">Max slots (capacity)</label>
              <input
                type="number"
                min={1}
                value={addDaySlots}
                onChange={(e) => setAddDaySlots(Number(e.target.value))}
                className="w-full min-h-10 rounded-lg border border-gray-300 px-3 text-black"
              />
            </div>
            {zoneFilter !== "all" && (
              <p className="text-xs text-gray-500">Zone: {zones.find((z) => z.id === zoneFilter)?.name ?? "Selected zone"}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setAddDayModal(null)}
                className="flex-1 min-h-10 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDay}
                disabled={isSavingDay || addDaySlots < 1}
                className="flex-1 min-h-10 rounded-lg bg-green-600 text-white text-sm font-semibold disabled:opacity-70"
              >
                {isSavingDay ? "Saving..." : "Add Day"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SignupCard({
  signup,
  statuses,
  statusStyles,
  onStatusChange,
}: {
  signup: EnrichedSignup;
  statuses: WinterStorageStatus[];
  statusStyles: Record<WinterStorageStatus, string>;
  onStatusChange: (id: string, status: WinterStorageStatus) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 flex flex-col gap-2 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{signup.accountName}</p>
          <p className="text-xs text-gray-500">{signup.equipmentLabel}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusStyles[signup.status]}`}>
          {signup.status.replace(/_/g, " ")}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {statuses.map((st) => (
          <button
            key={st}
            onClick={() => onStatusChange(signup.id, st)}
            className={`min-h-6 rounded-full px-2 text-[10px] font-semibold capitalize ${
              signup.status === st ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {st.replace(/_/g, " ")}
          </button>
        ))}
      </div>
    </div>
  );
}

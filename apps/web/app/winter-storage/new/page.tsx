"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Equipment, StorageCalendarDay } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { useBusinessAccount } from "../../../lib/business-account";

type DayOption = StorageCalendarDay & { bookedSlots: number; isFull: boolean };

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function buildCalendarGrid(year: number, month: number, options: DayOption[]): (Date | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function DayPicker({
  label,
  dayType,
  options,
  selectedDate,
  onSelect,
}: {
  label: string;
  dayType: "dropoff" | "pickup";
  options: DayOption[];
  selectedDate: string | null;
  onSelect: (date: string, dayId: string) => void;
}) {
  const today = new Date();
  const firstAvailable = options.find((o) => !o.isFull);
  const initMonth = firstAvailable
    ? new Date(firstAvailable.date + "T12:00:00")
    : today;
  const [calMonth, setCalMonth] = useState(new Date(initMonth.getFullYear(), initMonth.getMonth(), 1));

  const optionsByDate = new Map(options.map((o) => [o.date, o]));
  const grid = buildCalendarGrid(calMonth.getFullYear(), calMonth.getMonth(), options);

  const prevMonth = () => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const accentColor = dayType === "dropoff" ? "green" : "blue";
  const accentBg = dayType === "dropoff" ? "bg-green-600" : "bg-blue-600";
  const accentBorder = dayType === "dropoff" ? "border-green-600" : "border-blue-600";
  const accentText = dayType === "dropoff" ? "text-green-700" : "text-blue-700";

  return (
    <div>
      <p className="font-semibold text-black mb-2">{label}</p>
      {selectedDate && (
        <p className={`text-sm font-semibold mb-2 ${accentText}`}>
          Selected: {formatDate(selectedDate)}
        </p>
      )}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-200 text-gray-600">‹</button>
          <span className="text-sm font-semibold text-gray-800">
            {MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}
          </span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-200 text-gray-600">›</button>
        </div>
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1 text-center text-xs text-gray-400 font-semibold">{d}</div>
          ))}
        </div>
        {/* Day grid */}
        <div className="grid grid-cols-7 p-2 gap-1">
          {grid.map((date, i) => {
            if (!date) return <div key={i} />;
            const dateStr = toDateStr(date);
            const option = optionsByDate.get(dateStr);
            const isSelected = dateStr === selectedDate;
            const isAvailable = !!option && !option.isFull;
            const isFull = option?.isFull ?? false;

            return (
              <button
                key={i}
                type="button"
                disabled={!isAvailable}
                onClick={() => isAvailable && option && onSelect(dateStr, option.id)}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-semibold transition-colors
                  ${isSelected ? `${accentBg} text-white` : ""}
                  ${isAvailable && !isSelected ? `border ${accentBorder} ${accentText} hover:${accentBg.replace("bg-", "bg-").replace("600", "50")} cursor-pointer` : ""}
                  ${isFull ? "bg-red-50 text-red-400 border border-red-200 cursor-not-allowed" : ""}
                  ${!option ? "text-gray-300 cursor-default" : ""}
                `}
                title={isFull ? "This day is full" : isAvailable ? `${option.max_slots - option.bookedSlots} slots available` : undefined}
              >
                <span>{date.getDate()}</span>
                {isFull && <span className="text-[8px] leading-none">FULL</span>}
                {isAvailable && !isSelected && (
                  <span className="w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: dayType === "dropoff" ? "#16a34a" : "#2563eb" }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
      {options.length === 0 && (
        <p className="text-sm text-gray-500 mt-2">No dates available yet — contact the dealership.</p>
      )}
    </div>
  );
}

export default function NewWinterStorageSignupPage() {
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [zip, setZip] = useState("");
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [dropoffOptions, setDropoffOptions] = useState<DayOption[]>([]);
  const [pickupOptions, setPickupOptions] = useState<DayOption[]>([]);
  const [selectedDropoffDate, setSelectedDropoffDate] = useState<string | null>(null);
  const [selectedDropoffDayId, setSelectedDropoffDayId] = useState<string | null>(null);
  const [selectedPickupDate, setSelectedPickupDate] = useState<string | null>(null);
  const [selectedPickupDayId, setSelectedPickupDayId] = useState<string | null>(null);
  const [isLookingUpZone, setIsLookingUpZone] = useState(false);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load equipment
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

    // Auto-populate zip from business account
    if (businessAccount.zip) {
      setZip(businessAccount.zip);
    }
  }, [businessAccount]);

  // Auto-lookup zone when zip is populated from profile
  useEffect(() => {
    if (businessAccount?.zip && zip === businessAccount.zip) {
      handleLookupZone(businessAccount.zip);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessAccount?.zip]);

  async function handleLookupZone(zipOverride?: string) {
    const targetZip = (zipOverride ?? zip).trim();
    if (!targetZip) return;
    setIsLookingUpZone(true);
    setZoneError(null);
    setDropoffOptions([]);
    setPickupOptions([]);
    setSelectedDropoffDate(null);
    setSelectedDropoffDayId(null);
    setSelectedPickupDate(null);
    setSelectedPickupDayId(null);

    const supabase = createClient();
    const { data: foundZoneId } = await supabase.rpc("zone_for_zip", { target_zip: targetZip });

    if (!foundZoneId) {
      // No zone mapping — show all open calendar days (fallback)
      const { data: allDays } = await supabase
        .from("storage_calendar_days")
        .select("*")
        .is("zone_id", null)
        .gte("date", new Date().toISOString().slice(0, 10))
        .order("date", { ascending: true });

      if (!allDays || allDays.length === 0) {
        setZoneError("No available dates found for your area — contact the dealership directly.");
        setIsLookingUpZone(false);
        return;
      }
      await enrichAndSetDays(allDays);
    } else {
      setZoneId(foundZoneId);
      const { data: days } = await supabase
        .from("storage_calendar_days")
        .select("*")
        .eq("zone_id", foundZoneId)
        .gte("date", new Date().toISOString().slice(0, 10))
        .order("date", { ascending: true });

      if (!days || days.length === 0) {
        setZoneError("No dates are open for your area yet — check back soon or contact the dealership.");
        setIsLookingUpZone(false);
        return;
      }
      await enrichAndSetDays(days);
    }
    setIsLookingUpZone(false);
  }

  async function enrichAndSetDays(days: StorageCalendarDay[]) {
    const supabase = createClient();
    const dayIds = days.map((d) => d.id);
    const [{ data: dropoffSignups }, { data: pickupSignups }] = await Promise.all([
      supabase
        .from("winter_storage_signups")
        .select("dropoff_calendar_day_id")
        .in("dropoff_calendar_day_id", dayIds)
        .not("status", "eq", "cancelled"),
      supabase
        .from("winter_storage_signups")
        .select("pickup_calendar_day_id")
        .in("pickup_calendar_day_id", dayIds)
        .not("status", "eq", "cancelled"),
    ]);

    const dropoffCounts = new Map<string, number>();
    for (const s of dropoffSignups ?? []) {
      if (s.dropoff_calendar_day_id) {
        dropoffCounts.set(s.dropoff_calendar_day_id, (dropoffCounts.get(s.dropoff_calendar_day_id) ?? 0) + 1);
      }
    }
    const pickupCounts = new Map<string, number>();
    for (const s of pickupSignups ?? []) {
      if (s.pickup_calendar_day_id) {
        pickupCounts.set(s.pickup_calendar_day_id, (pickupCounts.get(s.pickup_calendar_day_id) ?? 0) + 1);
      }
    }

    const enriched = days.map((d) => {
      const count = d.day_type === "dropoff"
        ? (dropoffCounts.get(d.id) ?? 0)
        : (pickupCounts.get(d.id) ?? 0);
      return { ...d, bookedSlots: count, isFull: d.is_manually_full || count >= d.max_slots };
    });

    setDropoffOptions(enriched.filter((d) => d.day_type === "dropoff"));
    setPickupOptions(enriched.filter((d) => d.day_type === "pickup"));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!businessAccount || !equipmentId) {
      setErrorMessage("Pick equipment before submitting.");
      return;
    }
    if (!selectedDropoffDate || !selectedPickupDate) {
      setErrorMessage("Select a drop-off date and a pick-up date.");
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
    if (!userData.user) { setIsSubmitting(false); return; }

    const { error } = await supabase.from("winter_storage_signups").insert({
      business_account_id: businessAccount.id,
      equipment_id: equipmentId,
      zone_id: zoneId,
      requested_dropoff_date: selectedDropoffDate,
      requested_pickup_date: selectedPickupDate,
      dropoff_calendar_day_id: selectedDropoffDayId,
      pickup_calendar_day_id: selectedPickupDayId,
      agreement_signed_at: new Date().toISOString(),
      requested_by_profile_id: userData.user.id,
    });

    // Save zip back to business account for future auto-populate
    if (zip.trim() && !businessAccount.zip) {
      await supabase.from("business_accounts").update({ zip: zip.trim() }).eq("id", businessAccount.id);
    }

    setIsSubmitting(false);
    if (error) { setErrorMessage(error.message); return; }
    router.replace("/winter-storage");
  }

  const hasDates = dropoffOptions.length > 0 || pickupOptions.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-8 max-w-lg mx-auto w-full">
      <Link href="/winter-storage" className="text-sm text-green-700">
        ← Back to Winter Storage
      </Link>
      <h1 className="text-2xl font-bold text-green-700">Winter Storage Sign-Up</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Equipment */}
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

        {/* Your address / zip for zone lookup */}
        <div>
          <p className="font-semibold text-black mb-1">Your Zip Code</p>
          <p className="text-sm text-gray-600 mb-2">
            {businessAccount?.zip ? "Auto-populated from your profile." : "Enter your zip to find available dates."}
          </p>
          <div className="flex gap-2">
            <input
              placeholder="Zip code"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className="flex-1 min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
            />
            <button
              type="button"
              onClick={() => handleLookupZone()}
              disabled={!zip.trim() || isLookingUpZone}
              className="min-h-12 rounded-lg bg-green-600 px-4 font-semibold text-white disabled:opacity-70"
            >
              {isLookingUpZone ? "Loading..." : "Find Dates"}
            </button>
          </div>
          {zoneError && <p className="text-sm text-red-600 mt-2">{zoneError}</p>}
        </div>

        {/* Date pickers */}
        {hasDates && (
          <>
            {dropoffOptions.length > 0 && (
              <DayPicker
                label="Choose Drop-off Date"
                dayType="dropoff"
                options={dropoffOptions}
                selectedDate={selectedDropoffDate}
                onSelect={(date, id) => { setSelectedDropoffDate(date); setSelectedDropoffDayId(id); }}
              />
            )}

            {pickupOptions.length > 0 && (
              <DayPicker
                label="Choose Pick-up Date"
                dayType="pickup"
                options={pickupOptions}
                selectedDate={selectedPickupDate}
                onSelect={(date, id) => { setSelectedPickupDate(date); setSelectedPickupDayId(id); }}
              />
            )}
          </>
        )}

        {/* Terms */}
        <label className="flex items-start gap-2 text-black text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="accent-green-600 w-5 h-5 mt-0.5 shrink-0"
          />
          I agree to the winter storage terms and conditions.
        </label>

        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

        <button
          type="submit"
          disabled={!equipmentId || !selectedDropoffDate || !selectedPickupDate || !agreed || isSubmitting || isLoadingAccount}
          className="min-h-12 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-70"
        >
          {isSubmitting ? "Submitting..." : "Sign Up"}
        </button>
      </form>
    </div>
  );
}

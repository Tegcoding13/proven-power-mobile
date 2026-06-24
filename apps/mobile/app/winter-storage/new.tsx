import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing, radii, typeScale, minTouchTarget } from "@proven-power/ui-tokens";
import type { Equipment, StorageCalendarDay } from "@proven-power/shared-types";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { useBusinessAccount } from "../../lib/business-account";

type DayOption = StorageCalendarDay & { bookedSlots: number; isFull: boolean };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function buildGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function DayCalendar({
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
  const firstAvailable = options.find((o) => !o.isFull);
  const initDate = firstAvailable ? new Date(firstAvailable.date + "T12:00:00") : new Date();
  const [calYear, setCalYear] = useState(initDate.getFullYear());
  const [calMonth, setCalMonth] = useState(initDate.getMonth());

  const optionsByDate = new Map(options.map((o) => [o.date, o]));
  const grid = buildGrid(calYear, calMonth);

  const accent = dayType === "dropoff" ? colors.green[500] : "#2563eb";
  const accentLight = dayType === "dropoff" ? colors.green[50] : "#eff6ff";
  const accentDark = dayType === "dropoff" ? colors.green[700] : "#1d4ed8";

  function prev() {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  }
  function next() {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ fontSize: typeScale.base, fontWeight: "600", color: colors.black }}>{label}</Text>
      {selectedDate ? (
        <Text style={{ fontSize: typeScale.sm, fontWeight: "600", color: accentDark }}>
          Selected: {formatDate(selectedDate)}
        </Text>
      ) : null}

      <View style={{ borderRadius: radii.md, borderWidth: 1, borderColor: colors.gray[300], overflow: "hidden", backgroundColor: colors.white }}>
        {/* Month nav */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.sm, backgroundColor: colors.gray[50], borderBottomWidth: 1, borderBottomColor: colors.gray[100] }}>
          <Pressable onPress={prev} style={{ padding: spacing.xs }}>
            <Text style={{ fontSize: typeScale.lg, color: colors.gray[500] }}>‹</Text>
          </Pressable>
          <Text style={{ fontSize: typeScale.sm, fontWeight: "600", color: colors.gray[700] }}>
            {MONTH_NAMES[calMonth]} {calYear}
          </Text>
          <Pressable onPress={next} style={{ padding: spacing.xs }}>
            <Text style={{ fontSize: typeScale.lg, color: colors.gray[500] }}>›</Text>
          </Pressable>
        </View>

        {/* Weekday headers */}
        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.gray[100] }}>
          {DAY_INITIALS.map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center", paddingVertical: spacing.xs }}>
              <Text style={{ fontSize: 10, color: colors.gray[300], fontWeight: "600" }}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", padding: spacing.xs }}>
          {grid.map((date, i) => {
            if (!date) {
              return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
            }
            const dateStr = toDateStr(date);
            const option = optionsByDate.get(dateStr);
            const isSelected = dateStr === selectedDate;
            const isAvailable = !!option && !option.isFull;
            const isFull = option?.isFull ?? false;

            return (
              <Pressable
                key={i}
                disabled={!isAvailable}
                onPress={() => isAvailable && option && onSelect(dateStr, option.id)}
                style={({ pressed }) => ({
                  width: `${100 / 7}%`,
                  aspectRatio: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radii.sm,
                  backgroundColor: isSelected ? accent : isFull ? "#fef2f2" : isAvailable ? accentLight : "transparent",
                  borderWidth: isAvailable && !isSelected ? 1 : 0,
                  borderColor: accent,
                  opacity: pressed && isAvailable ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: isSelected ? colors.white : isFull ? "#f87171" : isAvailable ? accentDark : colors.gray[300] }}>
                  {date.getDate()}
                </Text>
                {isFull && <Text style={{ fontSize: 7, color: "#f87171", lineHeight: 9 }}>FULL</Text>}
              </Pressable>
            );
          })}
        </View>
      </View>

      {options.length === 0 && (
        <Text style={{ fontSize: typeScale.sm, color: colors.gray[500] }}>No dates available yet — contact the dealership.</Text>
      )}
    </View>
  );
}

export default function NewWinterStorageSignupScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { businessAccount, isLoading: isLoadingAccount, refresh } = useBusinessAccount();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!businessAccount) return;
    supabase
      .from("equipment")
      .select("*")
      .eq("business_account_id", businessAccount.id)
      .is("deleted_at", null)
      .then(({ data }) => {
        setEquipmentList(data ?? []);
        if (data && data.length > 0) setEquipmentId(data[0].id);
      });

    if (businessAccount.zip) {
      setZip(businessAccount.zip);
    }
  }, [businessAccount]);

  // Auto-lookup when zip comes from profile
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

    const { data: foundZoneId } = await supabase.rpc("zone_for_zip", { target_zip: targetZip });
    const today = new Date().toISOString().slice(0, 10);

    let days: StorageCalendarDay[] | null = null;
    if (!foundZoneId) {
      const { data } = await supabase
        .from("storage_calendar_days")
        .select("*")
        .is("zone_id", null)
        .gte("date", today)
        .order("date", { ascending: true });
      days = data;
    } else {
      setZoneId(foundZoneId);
      const { data } = await supabase
        .from("storage_calendar_days")
        .select("*")
        .eq("zone_id", foundZoneId)
        .gte("date", today)
        .order("date", { ascending: true });
      days = data;
    }

    if (!days || days.length === 0) {
      setZoneError("No dates are open for your area yet — check back soon or contact the dealership.");
      setIsLookingUpZone(false);
      return;
    }

    await enrichAndSetDays(days);
    setIsLookingUpZone(false);
  }

  async function enrichAndSetDays(days: StorageCalendarDay[]) {
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

  async function handleSubmit() {
    if (!businessAccount || !session?.user || !equipmentId) {
      setErrorMessage("Pick equipment before submitting.");
      return;
    }
    if (!selectedDropoffDate) {
      setErrorMessage("Select a drop-off date.");
      return;
    }
    if (pickupOptions.length > 0 && !selectedPickupDate) {
      setErrorMessage("Select a pick-up date.");
      return;
    }
    if (!agreed) {
      setErrorMessage("You must agree to the storage terms to continue.");
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);

    const { error } = await supabase.from("winter_storage_signups").insert({
      business_account_id: businessAccount.id,
      equipment_id: equipmentId,
      zone_id: zoneId,
      requested_dropoff_date: selectedDropoffDate,
      requested_pickup_date: selectedPickupDate,
      dropoff_calendar_day_id: selectedDropoffDayId,
      pickup_calendar_day_id: selectedPickupDayId,
      agreement_signed_at: new Date().toISOString(),
      requested_by_profile_id: session.user.id,
    });

    // Save zip back to business account for future auto-populate
    if (zip.trim() && !businessAccount.zip) {
      await supabase.from("business_accounts").update({ zip: zip.trim() }).eq("id", businessAccount.id);
      await refresh();
    }

    setIsSubmitting(false);
    if (error) { setErrorMessage(error.message); return; }
    router.replace("/winter-storage");
  }

  const pickupRequired = pickupOptions.length > 0;
  const canSubmit = !!equipmentId && !!selectedDropoffDate && (!pickupRequired || !!selectedPickupDate) && agreed && !isSubmitting && !isLoadingAccount;
  const hasDates = dropoffOptions.length > 0 || pickupOptions.length > 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.white }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ fontSize: typeScale.xl, fontWeight: "700", color: colors.green[700] }}>Winter Storage Sign-Up</Text>

      {/* Equipment */}
      <View style={{ gap: spacing.sm }}>
        <Text style={{ fontSize: typeScale.base, fontWeight: "600", color: colors.black }}>Equipment</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {equipmentList.map((eq) => (
            <Pressable
              key={eq.id}
              onPress={() => setEquipmentId(eq.id)}
              style={{
                paddingHorizontal: spacing.md,
                minHeight: minTouchTarget,
                justifyContent: "center",
                borderRadius: radii.pill,
                backgroundColor: equipmentId === eq.id ? colors.green[500] : colors.gray[100],
              }}
            >
              <Text style={{ color: equipmentId === eq.id ? colors.white : colors.black, fontWeight: "600" }}>
                {eq.nickname || eq.model}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Zip / zone lookup */}
      <View style={{ gap: spacing.xs }}>
        <Text style={{ fontSize: typeScale.base, fontWeight: "600", color: colors.black }}>Your Zip Code</Text>
        <Text style={{ fontSize: typeScale.sm, color: colors.gray[500] }}>
          {businessAccount?.zip ? "Auto-populated from your profile." : "Enter your zip to find available dates."}
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <TextInput
            placeholder="Zip code"
            placeholderTextColor={colors.gray[500]}
            keyboardType="number-pad"
            value={zip}
            onChangeText={setZip}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.gray[300],
              borderRadius: radii.md,
              paddingHorizontal: spacing.md,
              minHeight: minTouchTarget,
              fontSize: typeScale.base,
              color: colors.black,
              backgroundColor: colors.gray[50],
            }}
          />
          <Pressable
            onPress={() => handleLookupZone()}
            disabled={!zip.trim() || isLookingUpZone}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.lg,
              minHeight: minTouchTarget,
              borderRadius: radii.md,
              backgroundColor: colors.green[500],
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed || !zip.trim() || isLookingUpZone ? 0.7 : 1,
            })}
          >
            {isLookingUpZone
              ? <ActivityIndicator color={colors.white} />
              : <Text style={{ color: colors.white, fontWeight: "600" }}>Find Dates</Text>}
          </Pressable>
        </View>
        {zoneError ? <Text style={{ color: colors.status.danger, fontSize: typeScale.sm }}>{zoneError}</Text> : null}
      </View>

      {/* Day pickers */}
      {hasDates && (
        <>
          {dropoffOptions.length > 0 && (
            <DayCalendar
              label="Choose Drop-off Date"
              dayType="dropoff"
              options={dropoffOptions}
              selectedDate={selectedDropoffDate}
              onSelect={(date, id) => { setSelectedDropoffDate(date); setSelectedDropoffDayId(id); }}
            />
          )}
          {pickupOptions.length > 0 ? (
            <DayCalendar
              label="Choose Pick-up Date"
              dayType="pickup"
              options={pickupOptions}
              selectedDate={selectedPickupDate}
              onSelect={(date, id) => { setSelectedPickupDate(date); setSelectedPickupDayId(id); }}
            />
          ) : (
            <View style={{ backgroundColor: colors.gray[50], borderRadius: radii.md, padding: spacing.md }}>
              <Text style={{ fontSize: typeScale.sm, color: colors.gray[500] }}>
                Pick-up dates haven't been set yet — the dealership will contact you to schedule pick-up.
              </Text>
            </View>
          )}
        </>
      )}

      {/* Terms */}
      <Pressable
        onPress={() => setAgreed((prev) => !prev)}
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
      >
        <View
          style={{
            width: 24, height: 24,
            borderRadius: radii.sm,
            borderWidth: 2,
            borderColor: colors.green[500],
            backgroundColor: agreed ? colors.green[500] : colors.white,
          }}
        />
        <Text style={{ fontSize: typeScale.sm, color: colors.black, flex: 1 }}>
          I agree to the winter storage terms and conditions.
        </Text>
      </Pressable>

      {errorMessage ? <Text style={{ color: colors.status.danger, fontSize: typeScale.sm }}>{errorMessage}</Text> : null}

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => ({
          minHeight: minTouchTarget,
          borderRadius: radii.md,
          backgroundColor: colors.green[500],
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed || !canSubmit ? 0.7 : 1,
          marginBottom: spacing.xl,
          marginTop: spacing.sm,
        })}
      >
        {isSubmitting
          ? <ActivityIndicator color={colors.white} />
          : <Text style={{ color: colors.white, fontSize: typeScale.lg, fontWeight: "600" }}>Sign Up</Text>}
      </Pressable>
    </ScrollView>
  );
}

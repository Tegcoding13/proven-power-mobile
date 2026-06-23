import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Linking, ActivityIndicator } from "react-native";
import { colors, spacing, radii, typeScale } from "@proven-power/ui-tokens";
import type { DealershipLocation, DealershipHours } from "@proven-power/shared-types";
import { supabase } from "../../lib/supabase";
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

export default function LocationsScreen() {
  const { businessAccount, refresh } = useBusinessAccount();
  const [locations, setLocations] = useState<DealershipLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
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
    await supabase.from("business_accounts").update({ primary_location_id: locationId }).eq("id", businessAccount.id);
    await refresh();
    setSavingId(null);
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.green[500]} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.white }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      {locations.map((loc) => {
        const isHomeStore = businessAccount?.primary_location_id === loc.id;
        return (
        <View key={loc.id} style={{ padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.gray[300], gap: spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
            <Text style={{ fontSize: typeScale.lg, fontWeight: "700", color: colors.black }}>{loc.name}</Text>
            {isHomeStore ? (
              <View style={{ backgroundColor: colors.green[50], borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 }}>
                <Text style={{ fontSize: typeScale.xs, color: colors.green[700], fontWeight: "700" }}>Your Home Store</Text>
              </View>
            ) : null}
          </View>

          {loc.address ? (
            <Pressable
              onPress={() => {
                const query = encodeURIComponent(`${loc.address}, ${loc.city}, ${loc.state} ${loc.zip}`);
                Linking.openURL(`https://maps.google.com/?q=${query}`);
              }}
            >
              <Text style={{ fontSize: typeScale.base, color: colors.green[700] }}>
                {loc.address}, {loc.city}, {loc.state} {loc.zip}
              </Text>
            </Pressable>
          ) : null}

          {loc.phone ? (
            <Pressable onPress={() => Linking.openURL(`tel:${loc.phone}`)}>
              <Text style={{ fontSize: typeScale.base, color: colors.green[700], fontWeight: "600" }}>📞 {loc.phone}</Text>
            </Pressable>
          ) : null}

          {loc.after_hours_phone ? (
            <Pressable onPress={() => Linking.openURL(`tel:${loc.after_hours_phone}`)}>
              <Text style={{ fontSize: typeScale.sm, color: colors.status.warning, fontWeight: "600" }}>
                🚨 After-hours / breakdown: {loc.after_hours_phone}
              </Text>
            </Pressable>
          ) : null}

          {loc.hours ? (
            <View style={{ marginTop: spacing.xs }}>
              {DAY_LABELS.map(({ key, label }) => {
                const day = loc.hours?.[key];
                return (
                  <View key={key} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: typeScale.xs, color: colors.gray[700] }}>{label}</Text>
                    <Text style={{ fontSize: typeScale.xs, color: colors.gray[700] }}>
                      {day ? `${formatTime12Hour(day.open)} – ${formatTime12Hour(day.close)}` : "Closed"}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {businessAccount && !isHomeStore ? (
            <Pressable
              onPress={() => handleMakeHomeStore(loc.id)}
              disabled={savingId === loc.id}
              style={({ pressed }) => ({
                alignSelf: "flex-start",
                marginTop: spacing.xs,
                minHeight: 40,
                paddingHorizontal: spacing.md,
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: colors.green[500],
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed || savingId === loc.id ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: typeScale.sm, color: colors.green[700], fontWeight: "600" }}>
                {savingId === loc.id ? "Saving..." : "Make this my home store"}
              </Text>
            </Pressable>
          ) : null}
        </View>
        );
      })}
    </ScrollView>
  );
}

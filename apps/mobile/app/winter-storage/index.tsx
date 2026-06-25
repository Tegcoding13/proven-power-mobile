import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, spacing, radii, typeScale, minTouchTarget } from "@proven-power/ui-tokens";
import type { WinterStorageSignup, Equipment } from "@proven-power/shared-types";
import { supabase } from "../../lib/supabase";
import { useBusinessAccount } from "../../lib/business-account";

const STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  dropped_off: "Dropped Off",
  stored: "In Storage",
  picked_up: "Picked Up",
  cancelled: "Cancelled",
};

type SignupWithEquipment = WinterStorageSignup & { equipmentLabel: string };

export default function WinterStorageListScreen() {
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [signups, setSignups] = useState<SignupWithEquipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!businessAccount) return;
    setIsLoading(true);

    const { data } = await supabase
      .from("winter_storage_signups")
      .select("*")
      .eq("business_account_id", businessAccount.id)
      .order("created_at", { ascending: false });

    const equipmentIds = [...new Set((data ?? []).map((s) => s.equipment_id).filter(Boolean))] as string[];
    const { data: equipmentRows } = equipmentIds.length
      ? await supabase.from("equipment").select("*").in("id", equipmentIds)
      : { data: [] as Equipment[] };
    const equipmentById = new Map((equipmentRows ?? []).map((e) => [e.id, e]));

    setSignups((data ?? []).map((s) => ({ ...s, equipmentLabel: (s.equipment_id ? equipmentById.get(s.equipment_id)?.nickname || equipmentById.get(s.equipment_id)?.model : null) || "Equipment" })));
    setIsLoading(false);
  }, [businessAccount]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (isLoadingAccount || isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.green[500]} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <FlatList
        data={signups}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: spacing.xxl }}>
            <Text style={{ fontSize: typeScale.lg, color: colors.black, textAlign: "center" }}>
              No winter storage sign-ups yet.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.gray[300], gap: spacing.xs }}>
            <Text style={{ fontSize: typeScale.base, fontWeight: "600", color: colors.black }}>{item.equipmentLabel}</Text>
            <Text style={{ fontSize: typeScale.sm, color: colors.gray[700] }}>{STATUS_LABELS[item.status] ?? item.status}</Text>
            {item.requested_dropoff_date ? (
              <Text style={{ fontSize: typeScale.xs, color: colors.gray[500] }}>
                Drop-off: {new Date(item.requested_dropoff_date).toLocaleDateString()}
              </Text>
            ) : null}
          </View>
        )}
      />
      <Pressable
        onPress={() => router.push("/winter-storage/new")}
        style={({ pressed }) => ({
          margin: spacing.lg,
          minHeight: minTouchTarget,
          borderRadius: radii.md,
          backgroundColor: colors.green[500],
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ color: colors.white, fontSize: typeScale.lg, fontWeight: "600" }}>+ Sign Up for Storage</Text>
      </Pressable>
    </View>
  );
}

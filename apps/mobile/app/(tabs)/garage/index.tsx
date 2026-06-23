import { useCallback, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, Image, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, spacing, radii, typeScale, minTouchTarget } from "@proven-power/ui-tokens";
import type { Equipment } from "@proven-power/shared-types";
import { supabase } from "../../../lib/supabase";
import { useBusinessAccount } from "../../../lib/business-account";
import { flushPendingPhotos } from "../../../lib/photo-outbox";

export default function GarageListScreen() {
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const loadEquipment = useCallback(
    async (showSpinner: boolean) => {
      if (!businessAccount) return;
      if (showSpinner) setIsLoading(true);

      await flushPendingPhotos().catch(() => {});

      const { data } = await supabase
        .from("equipment")
        .select("*")
        .eq("business_account_id", businessAccount.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      setEquipment(data ?? []);
      setIsLoading(false);
      setIsRefreshing(false);
    },
    [businessAccount]
  );

  useFocusEffect(
    useCallback(() => {
      loadEquipment(true);
    }, [loadEquipment])
  );

  if (isLoadingAccount || isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.green[500]} />
      </View>
    );
  }

  const filteredEquipment = equipment.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [item.nickname, item.make, item.model, item.serial_number].some((field) => field?.toLowerCase().includes(q));
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <FlatList
        data={filteredEquipment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => {
            setIsRefreshing(true);
            loadEquipment(false);
          }} />
        }
        ListHeaderComponent={
          equipment.length > 0 ? (
            <TextInput
              placeholder="Search by name, model, or serial number"
              placeholderTextColor={colors.gray[500]}
              value={query}
              onChangeText={setQuery}
              style={{
                minHeight: minTouchTarget,
                borderWidth: 1,
                borderColor: colors.gray[300],
                borderRadius: radii.md,
                paddingHorizontal: spacing.md,
                fontSize: typeScale.base,
                color: colors.black,
                backgroundColor: colors.gray[50],
                marginBottom: spacing.md,
              }}
            />
          ) : null
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: spacing.xxl, gap: spacing.sm }}>
            <Text style={{ fontSize: typeScale.lg, color: colors.black, textAlign: "center" }}>
              {equipment.length === 0 ? "No equipment yet." : `No equipment matches "${query}".`}
            </Text>
            {equipment.length === 0 ? (
              <Text style={{ fontSize: typeScale.sm, color: colors.gray[700], textAlign: "center" }}>
                Tap &quot;Add Equipment&quot; below to add your first tractor or piece of equipment.
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/garage/${item.id}`)}
            style={({ pressed }) => ({
              flexDirection: "row",
              gap: spacing.md,
              padding: spacing.md,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.gray[300],
              opacity: pressed ? 0.8 : 1,
              alignItems: "center",
            })}
          >
            {item.primary_photo_url ? (
              <Image source={{ uri: item.primary_photo_url }} style={{ width: 56, height: 56, borderRadius: radii.sm }} />
            ) : (
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: radii.sm,
                  backgroundColor: colors.green[50],
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: typeScale.xl }}>🚜</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: typeScale.base, fontWeight: "600", color: colors.black }}>
                {item.nickname || `${item.model_year ?? ""} ${item.model}`.trim()}
              </Text>
              <Text style={{ fontSize: typeScale.sm, color: colors.gray[700] }}>
                {item.make} {item.model}
                {item.current_hours != null ? ` · ${item.current_hours} hrs` : ""}
              </Text>
            </View>
          </Pressable>
        )}
      />

      <Pressable
        onPress={() => router.push("/garage/new")}
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
        <Text style={{ color: colors.white, fontSize: typeScale.lg, fontWeight: "600" }}>+ Add Equipment</Text>
      </Pressable>
    </View>
  );
}

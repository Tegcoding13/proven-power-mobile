import { useCallback, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, spacing, radii, typeScale, minTouchTarget } from "@proven-power/ui-tokens";
import type { ServiceRequest, Equipment } from "@proven-power/shared-types";
import { supabase } from "../../../lib/supabase";
import { useBusinessAccount } from "../../../lib/business-account";
import { StatusBadge } from "../../../components/StatusBadge";

type RequestWithEquipment = ServiceRequest & { equipmentLabel: string };

export default function ServiceListScreen() {
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [requests, setRequests] = useState<RequestWithEquipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (!businessAccount) return;
      if (showSpinner) setIsLoading(true);

      const { data } = await supabase
        .from("service_requests")
        .select("*")
        .eq("business_account_id", businessAccount.id)
        .order("created_at", { ascending: false });

      const equipmentIds = [...new Set((data ?? []).map((r) => r.equipment_id))];
      const { data: equipmentRows } = equipmentIds.length
        ? await supabase.from("equipment").select("*").in("id", equipmentIds)
        : { data: [] as Equipment[] };
      const equipmentById = new Map((equipmentRows ?? []).map((e) => [e.id, e]));

      setRequests(
        (data ?? []).map((r) => {
          const eq = equipmentById.get(r.equipment_id);
          return { ...r, equipmentLabel: eq ? `${eq.nickname || eq.model}` : "Equipment" };
        })
      );
      setIsLoading(false);
      setIsRefreshing(false);
    },
    [businessAccount]
  );

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load])
  );

  if (isLoadingAccount || isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.green[500]} />
      </View>
    );
  }

  const filteredRequests = requests.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [item.equipmentLabel, item.description, item.status].some((field) => field?.toLowerCase().includes(q));
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              load(false);
            }}
          />
        }
        ListHeaderComponent={
          requests.length > 0 ? (
            <TextInput
              placeholder="Search by equipment, description, or status"
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
              {requests.length === 0 ? "No service requests yet." : `No requests match "${query}".`}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/service/${item.id}`)}
            style={({ pressed }) => ({
              padding: spacing.md,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.gray[300],
              opacity: pressed ? 0.8 : 1,
              gap: spacing.xs,
            })}
          >
            <Text style={{ fontSize: typeScale.base, fontWeight: "600", color: colors.black }}>{item.equipmentLabel}</Text>
            <Text style={{ fontSize: typeScale.sm, color: colors.gray[700] }} numberOfLines={2}>
              {item.description}
            </Text>
            <StatusBadge status={item.status} />
          </Pressable>
        )}
      />

      <Pressable
        onPress={() => router.push("/service/new")}
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
        <Text style={{ color: colors.white, fontSize: typeScale.lg, fontWeight: "600" }}>+ Request Service</Text>
      </Pressable>
    </View>
  );
}

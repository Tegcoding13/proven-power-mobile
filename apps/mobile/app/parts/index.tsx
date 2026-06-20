import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, spacing, radii, typeScale, minTouchTarget } from "@proven-power/ui-tokens";
import type { PartsRequest } from "@proven-power/shared-types";
import { supabase } from "../../lib/supabase";
import { useBusinessAccount } from "../../lib/business-account";
import { StatusBadge } from "../../components/StatusBadge";

export default function PartsListScreen() {
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [requests, setRequests] = useState<PartsRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (!businessAccount) return;
      if (showSpinner) setIsLoading(true);

      const { data } = await supabase
        .from("parts_requests")
        .select("*")
        .eq("business_account_id", businessAccount.id)
        .order("created_at", { ascending: false });

      setRequests(data ?? []);
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <FlatList
        data={requests}
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
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: spacing.xxl }}>
            <Text style={{ fontSize: typeScale.lg, color: colors.black, textAlign: "center" }}>No parts requests yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/parts/${item.id}`)}
            style={({ pressed }) => ({
              padding: spacing.md,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.gray[300],
              opacity: pressed ? 0.8 : 1,
              gap: spacing.xs,
            })}
          >
            <Text style={{ fontSize: typeScale.sm, color: colors.gray[700] }} numberOfLines={2}>
              {item.description}
            </Text>
            <StatusBadge status={item.status} />
          </Pressable>
        )}
      />

      <Pressable
        onPress={() => router.push("/parts/new")}
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
        <Text style={{ color: colors.white, fontSize: typeScale.lg, fontWeight: "600" }}>+ Request Parts</Text>
      </Pressable>
    </View>
  );
}

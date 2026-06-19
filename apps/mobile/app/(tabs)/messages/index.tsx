import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, spacing, radii, typeScale, minTouchTarget } from "@proven-power/ui-tokens";
import type { MessageThread } from "@proven-power/shared-types";
import { supabase } from "../../../lib/supabase";
import { useBusinessAccount } from "../../../lib/business-account";

const DEPARTMENT_LABELS: Record<string, string> = {
  sales: "Sales",
  parts: "Parts",
  service: "Service",
  office: "Office",
};

export default function MessagesListScreen() {
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (!businessAccount) return;
      if (showSpinner) setIsLoading(true);

      const { data } = await supabase
        .from("message_threads")
        .select("*")
        .eq("business_account_id", businessAccount.id)
        .order("last_message_at", { ascending: false });

      setThreads(data ?? []);
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
        data={threads}
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
            <Text style={{ fontSize: typeScale.lg, color: colors.black, textAlign: "center" }}>No messages yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/messages/${item.id}`)}
            style={({ pressed }) => ({
              padding: spacing.md,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.gray[300],
              opacity: pressed ? 0.8 : 1,
              gap: spacing.xs,
            })}
          >
            <Text style={{ fontSize: typeScale.base, fontWeight: "600", color: colors.black }}>
              {DEPARTMENT_LABELS[item.department] ?? item.department}
            </Text>
            {item.subject ? <Text style={{ fontSize: typeScale.sm, color: colors.gray[700] }}>{item.subject}</Text> : null}
            <Text style={{ fontSize: typeScale.xs, color: colors.gray[500] }}>
              {item.status === "closed" ? "Closed" : "Open"} · {new Date(item.last_message_at).toLocaleDateString()}
            </Text>
          </Pressable>
        )}
      />

      <Pressable
        onPress={() => router.push("/messages/new")}
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
        <Text style={{ color: colors.white, fontSize: typeScale.lg, fontWeight: "600" }}>+ New Message</Text>
      </Pressable>
    </View>
  );
}

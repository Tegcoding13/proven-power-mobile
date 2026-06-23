import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, spacing, radii, typeScale } from "@proven-power/ui-tokens";
import type { Notification } from "@proven-power/shared-types";
import { supabase } from "../../lib/supabase";

function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false });
    setNotifications(data ?? []);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handlePress(notification: Notification) {
    if (!notification.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id);
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)));
    }
    if (notification.link) {
      router.push(notification.link as never);
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.green[500]} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.white }}
      data={notifications}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      ListEmptyComponent={
        <View style={{ alignItems: "center", marginTop: spacing.xxl }}>
          <Text style={{ fontSize: typeScale.lg, color: colors.black, textAlign: "center" }}>No notifications yet.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => handlePress(item)}
          style={({ pressed }) => ({
            flexDirection: "row",
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radii.md,
            backgroundColor: item.is_read ? colors.white : colors.green[50],
            borderWidth: 1,
            borderColor: colors.gray[100],
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {!item.is_read ? (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green[500], marginTop: 6 }} />
          ) : (
            <View style={{ width: 8 }} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: typeScale.base, fontWeight: "700", color: colors.black }}>{item.title}</Text>
            {item.body ? (
              <Text style={{ fontSize: typeScale.sm, color: colors.gray[700], marginTop: 2 }} numberOfLines={2}>
                {item.body}
              </Text>
            ) : null}
            <Text style={{ fontSize: typeScale.xs, color: colors.gray[500], marginTop: 4 }}>{timeAgo(item.created_at)}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

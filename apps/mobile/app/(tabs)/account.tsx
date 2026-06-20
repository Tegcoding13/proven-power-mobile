import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, spacing, radii, typeScale, shadows } from "@proven-power/ui-tokens";
import { useAuth } from "../../lib/auth-context";

function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AccountScreen() {
  const { profile, session, signOut } = useAuth();
  const router = useRouter();

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  }

  const settingsRows = [
    { label: "Notification Preferences", onPress: () => Alert.alert("Coming Soon", "Notification preferences are coming soon.") },
    { label: "Payment Methods", onPress: () => Alert.alert("Coming Soon", "Payment methods are coming soon.") },
    { label: "Business Account & Team", onPress: () => Alert.alert("Coming Soon", "Multi-user account management is coming soon.") },
    { label: "Locations & Contact", onPress: () => router.push("/locations") },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.gray[50] }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.green[500],
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.white, fontSize: typeScale.xxl, fontWeight: "700" }}>
              {initials(profile?.full_name)}
            </Text>
          </View>
          <Text style={{ fontSize: typeScale.xl, fontWeight: "700", color: colors.black }}>
            {profile?.full_name ?? "Your Account"}
          </Text>
          <Text style={{ fontSize: typeScale.sm, color: colors.gray[700] }}>{session?.user.email}</Text>
        </View>

        <View style={{ backgroundColor: colors.white, borderRadius: radii.lg, ...shadows.card }}>
          {settingsRows.map((row, index) => (
            <Pressable
              key={row.label}
              onPress={row.onPress}
              style={({ pressed }) => ({
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.gray[100],
                backgroundColor: pressed ? colors.gray[50] : colors.white,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              })}
            >
              <Text style={{ fontSize: typeScale.base, color: colors.black }}>{row.label}</Text>
              <Text style={{ fontSize: typeScale.base, color: colors.gray[500] }}>›</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => ({
            backgroundColor: colors.white,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.status.danger,
            minHeight: 56,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: colors.status.danger, fontSize: typeScale.base, fontWeight: "700" }}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

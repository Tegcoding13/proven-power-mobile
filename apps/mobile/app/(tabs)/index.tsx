import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, spacing, radii, typeScale } from "@proven-power/ui-tokens";
import { useAuth } from "../../lib/auth-context";

const TILES: { href: "/garage" | "/service" | "/parts" | "/messages" | "/inventory" | "/winter-storage" | "/locations"; label: string; icon: string }[] = [
  { href: "/garage", label: "My Garage", icon: "🚜" },
  { href: "/service", label: "Service", icon: "🔧" },
  { href: "/parts", label: "Parts", icon: "⚙️" },
  { href: "/messages", label: "Messages", icon: "💬" },
  { href: "/inventory", label: "Inventory", icon: "📋" },
  { href: "/winter-storage", label: "Winter Storage", icon: "❄️" },
  { href: "/locations", label: "Locations", icon: "📍" },
];

export default function HomeScreen() {
  const { profile, signOut } = useAuth();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View>
          <Text style={{ fontSize: typeScale.xxl, fontWeight: "700", color: colors.green[700] }}>Proven Power</Text>
          <Text style={{ fontSize: typeScale.lg, color: colors.black }}>
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}.
          </Text>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          {TILES.map((tile) => (
            <Pressable
              key={tile.href}
              onPress={() => router.push(tile.href)}
              style={({ pressed }) => ({
                width: "30%",
                aspectRatio: 1,
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: colors.gray[300],
                backgroundColor: pressed ? colors.green[50] : colors.white,
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.xs,
                padding: spacing.sm,
              })}
            >
              <Text style={{ fontSize: typeScale.xxl }}>{tile.icon}</Text>
              <Text style={{ fontSize: typeScale.xs, fontWeight: "600", color: colors.black, textAlign: "center" }}>
                {tile.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={signOut}
          style={({ pressed }) => ({
            backgroundColor: colors.gray[100],
            opacity: pressed ? 0.7 : 1,
            minHeight: 48,
            borderRadius: radii.md,
            alignItems: "center",
            justifyContent: "center",
            marginTop: spacing.lg,
          })}
        >
          <Text style={{ color: colors.black, fontSize: typeScale.base, fontWeight: "600" }}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radii, typeScale, minTouchTarget } from "@proven-power/ui-tokens";
import { useAuth } from "../../lib/auth-context";

export default function HomeScreen() {
  const { profile, signOut } = useAuth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
        <Text style={{ fontSize: typeScale.xxl, fontWeight: "700", color: colors.green[700] }}>
          Proven Power
        </Text>
        <Text style={{ fontSize: typeScale.lg, color: colors.black }}>
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}.
        </Text>
        <Text style={{ fontSize: typeScale.sm, color: colors.gray[700] }}>
          Use the tabs below for My Garage, Service, Parts, and Messages.
        </Text>

        <Pressable
          onPress={signOut}
          style={({ pressed }) => ({
            backgroundColor: colors.gray[100],
            opacity: pressed ? 0.7 : 1,
            minHeight: minTouchTarget,
            borderRadius: radii.md,
            alignItems: "center",
            justifyContent: "center",
            marginTop: spacing.lg,
          })}
        >
          <Text style={{ color: colors.black, fontSize: typeScale.base, fontWeight: "600" }}>Sign Out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { useNetworkStatus } from "../lib/use-network-status";
import { useBusinessAccount } from "../lib/business-account";
import { colors } from "@proven-power/ui-tokens";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  useNetworkStatus();

  if (isLoading || (!!session && isLoadingAccount)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.green[500]} />
      </View>
    );
  }

  const needsStoreSelection = !!session && !!businessAccount && !businessAccount.primary_location_id;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session && !needsStoreSelection}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="parts" options={{ presentation: "card" }} />
        <Stack.Screen name="inventory" options={{ presentation: "card" }} />
        <Stack.Screen name="winter-storage" options={{ presentation: "card" }} />
        <Stack.Screen name="locations" options={{ presentation: "card" }} />
        <Stack.Screen name="deals" options={{ presentation: "card" }} />
        <Stack.Screen name="notifications" options={{ presentation: "card" }} />
      </Stack.Protected>

      <Stack.Protected guard={needsStoreSelection}>
        <Stack.Screen name="onboarding/choose-store" />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

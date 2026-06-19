import { Stack } from "expo-router";
import { colors } from "@proven-power/ui-tokens";

export default function ServiceLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.green[700],
        headerTitleStyle: { color: colors.black },
        headerStyle: { backgroundColor: colors.white },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Service" }} />
      <Stack.Screen name="new" options={{ title: "Request Service", presentation: "modal" }} />
      <Stack.Screen name="[id]" options={{ title: "Service Request" }} />
    </Stack>
  );
}

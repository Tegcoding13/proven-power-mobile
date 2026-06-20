import { Stack } from "expo-router";
import { colors } from "@proven-power/ui-tokens";

export default function PartsLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.green[700],
        headerTitleStyle: { color: colors.black },
        headerStyle: { backgroundColor: colors.white },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Parts" }} />
      <Stack.Screen name="new" options={{ title: "Request Parts", presentation: "modal" }} />
      <Stack.Screen name="[id]" options={{ title: "Parts Request" }} />
    </Stack>
  );
}

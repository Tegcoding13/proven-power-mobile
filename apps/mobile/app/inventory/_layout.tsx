import { Stack } from "expo-router";
import { colors } from "@proven-power/ui-tokens";

export default function InventoryLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.green[700],
        headerTitleStyle: { color: colors.black },
        headerStyle: { backgroundColor: colors.white },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Inventory" }} />
      <Stack.Screen name="[id]" options={{ title: "Unit Details" }} />
    </Stack>
  );
}

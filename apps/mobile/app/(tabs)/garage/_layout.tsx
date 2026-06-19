import { Stack } from "expo-router";
import { colors } from "@proven-power/ui-tokens";

export default function GarageLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.green[700],
        headerTitleStyle: { color: colors.black },
        headerStyle: { backgroundColor: colors.white },
      }}
    >
      <Stack.Screen name="index" options={{ title: "My Garage" }} />
      <Stack.Screen name="new" options={{ title: "Add Equipment", presentation: "modal" }} />
      <Stack.Screen name="[id]" options={{ title: "Equipment" }} />
    </Stack>
  );
}

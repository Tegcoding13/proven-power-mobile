import { Stack } from "expo-router";
import { colors } from "@proven-power/ui-tokens";

export default function LocationsLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.green[700],
        headerTitleStyle: { color: colors.black },
        headerStyle: { backgroundColor: colors.white },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Locations & Contact" }} />
    </Stack>
  );
}

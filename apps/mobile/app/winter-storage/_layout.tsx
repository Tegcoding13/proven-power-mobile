import { Stack } from "expo-router";
import { colors } from "@proven-power/ui-tokens";

export default function WinterStorageLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.green[700],
        headerTitleStyle: { color: colors.black },
        headerStyle: { backgroundColor: colors.white },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Winter Storage" }} />
      <Stack.Screen name="new" options={{ title: "Sign Up", presentation: "modal" }} />
    </Stack>
  );
}

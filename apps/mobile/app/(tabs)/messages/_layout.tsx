import { Stack } from "expo-router";
import { colors } from "@proven-power/ui-tokens";

export default function MessagesLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.green[700],
        headerTitleStyle: { color: colors.black },
        headerStyle: { backgroundColor: colors.white },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Messages" }} />
      <Stack.Screen name="new" options={{ title: "New Message", presentation: "modal" }} />
      <Stack.Screen name="[id]" options={{ title: "Thread" }} />
    </Stack>
  );
}

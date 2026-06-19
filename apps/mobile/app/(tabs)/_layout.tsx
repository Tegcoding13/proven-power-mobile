import { Tabs } from "expo-router";
import { colors } from "@proven-power/ui-tokens";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green[600],
        tabBarInactiveTintColor: colors.gray[500],
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="garage" options={{ title: "My Garage" }} />
    </Tabs>
  );
}

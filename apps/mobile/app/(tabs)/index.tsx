import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, FlatList, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, spacing, radii, typeScale, shadows } from "@proven-power/ui-tokens";
import type { MaintenanceTask, Promotion } from "@proven-power/shared-types";
import { useAuth } from "../../lib/auth-context";
import { useBusinessAccount } from "../../lib/business-account";
import { supabase } from "../../lib/supabase";

type Route =
  | "/garage"
  | "/service"
  | "/service/new"
  | "/parts"
  | "/messages"
  | "/inventory"
  | "/winter-storage"
  | "/locations";

const QUICK_ACTIONS: { href: Route; label: string; subtitle: string; icon: string }[] = [
  { href: "/garage", label: "My Equipment", subtitle: "Manage your garage", icon: "🚜" },
  { href: "/service/new", label: "Schedule Service", subtitle: "Request service", icon: "🔧" },
  { href: "/parts", label: "Parts Store", subtitle: "Order parts", icon: "🛒" },
  { href: "/messages", label: "Messages", subtitle: "Talk to us", icon: "💬" },
  { href: "/service", label: "Service History", subtitle: "Past & active", icon: "📋" },
  { href: "/winter-storage", label: "Winter Storage", subtitle: "Sign up", icon: "❄️" },
  { href: "/locations", label: "Locations", subtitle: "Hours & contact", icon: "📍" },
  { href: "/inventory", label: "Inventory", subtitle: "New & used units", icon: "📦" },
];

function initials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { businessAccount } = useBusinessAccount();

  const [equipmentCount, setEquipmentCount] = useState<number | null>(null);
  const [activeServiceCount, setActiveServiceCount] = useState<number | null>(null);
  const [nextTask, setNextTask] = useState<(MaintenanceTask & { equipmentLabel: string }) | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  const load = useCallback(async () => {
    if (!businessAccount) return;

    const { count: equipCount } = await supabase
      .from("equipment")
      .select("*", { count: "exact", head: true })
      .eq("business_account_id", businessAccount.id)
      .is("deleted_at", null);
    setEquipmentCount(equipCount ?? 0);

    const { count: svcCount } = await supabase
      .from("service_requests")
      .select("*", { count: "exact", head: true })
      .eq("business_account_id", businessAccount.id)
      .not("status", "in", "(completed,cancelled)");
    setActiveServiceCount(svcCount ?? 0);

    const { data: equipmentIds } = await supabase
      .from("equipment")
      .select("id")
      .eq("business_account_id", businessAccount.id)
      .is("deleted_at", null);
    const ids = (equipmentIds ?? []).map((e) => e.id);

    if (ids.length > 0) {
      const { data: taskRows } = await supabase
        .from("maintenance_tasks")
        .select("*")
        .in("equipment_id", ids)
        .in("status", ["upcoming", "due", "overdue"])
        .order("due_at_date", { ascending: true, nullsFirst: false })
        .limit(1);

      if (taskRows && taskRows.length > 0) {
        const task = taskRows[0];
        const { data: equipmentRow } = await supabase.from("equipment").select("*").eq("id", task.equipment_id).single();
        setNextTask({ ...task, equipmentLabel: equipmentRow?.nickname || equipmentRow?.model || "Your equipment" });
      } else {
        setNextTask(null);
      }
    }

    const { data: promoRows } = await supabase.from("promotions").select("*").order("starts_at", { ascending: false }).limit(5);
    setPromotions(promoRows ?? []);
  }, [businessAccount]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray[50] }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient colors={gradients.hero} style={{ paddingBottom: spacing.xl }}>
          <SafeAreaView edges={["top"]}>
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: "rgba(255,255,255,0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.white, fontWeight: "700" }}>{initials(profile?.full_name)}</Text>
                </View>
                <View>
                  <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: typeScale.sm }}>Welcome</Text>
                  <Text style={{ color: colors.white, fontSize: typeScale.xl, fontWeight: "700" }}>
                    {profile?.full_name?.split(" ")[0] ?? "there"} 👋
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => Alert.alert("Notifications", "Push notifications are coming soon.")}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: typeScale.lg }}>🔔</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
              <StatPill label="Equipment" value={equipmentCount != null ? String(equipmentCount) : "–"} />
              <StatPill label="Active Service" value={activeServiceCount != null ? String(activeServiceCount) : "–"} />
              <StatPill label="Rewards" value="Soon" muted />
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={{ padding: spacing.lg, gap: spacing.lg, marginTop: -spacing.lg }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.href}
                onPress={() => router.push(action.href)}
                style={({ pressed }) => ({
                  width: "47%",
                  backgroundColor: colors.white,
                  borderRadius: radii.lg,
                  padding: spacing.md,
                  gap: spacing.xs,
                  opacity: pressed ? 0.85 : 1,
                  ...shadows.card,
                })}
              >
                <Text style={{ fontSize: typeScale.xxl }}>{action.icon}</Text>
                <Text style={{ fontSize: typeScale.base, fontWeight: "700", color: colors.black }}>{action.label}</Text>
                <Text style={{ fontSize: typeScale.xs, color: colors.gray[700] }}>{action.subtitle}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => Alert.alert("Coming Soon", "Invoices and billing are coming soon.")}
              style={({ pressed }) => ({
                width: "47%",
                backgroundColor: colors.white,
                borderRadius: radii.lg,
                padding: spacing.md,
                gap: spacing.xs,
                opacity: pressed ? 0.85 : 1,
                ...shadows.card,
              })}
            >
              <Text style={{ fontSize: typeScale.xxl }}>📄</Text>
              <Text style={{ fontSize: typeScale.base, fontWeight: "700", color: colors.black }}>Invoices</Text>
              <Text style={{ fontSize: typeScale.xs, color: colors.gray[700] }}>Coming soon</Text>
            </Pressable>
          </View>

          {nextTask ? (
            <View>
              <Text style={{ fontSize: typeScale.lg, fontWeight: "700", color: colors.black, marginBottom: spacing.sm }}>
                Upcoming Service
              </Text>
              <View style={{ backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.xs, ...shadows.card }}>
                <Text style={{ fontSize: typeScale.base, fontWeight: "700", color: colors.black }}>{nextTask.equipmentLabel}</Text>
                <Text style={{ fontSize: typeScale.sm, color: colors.gray[700] }}>{nextTask.task_name}</Text>
                <Text style={{ fontSize: typeScale.sm, color: colors.status.warning, fontWeight: "600" }}>
                  {nextTask.due_at_date
                    ? `Due ${new Date(nextTask.due_at_date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`
                    : nextTask.due_at_hours != null
                      ? `Due at ${nextTask.due_at_hours} hrs`
                      : "Due soon"}
                </Text>
                <Pressable
                  onPress={() => router.push("/service/new")}
                  style={({ pressed }) => ({
                    marginTop: spacing.sm,
                    alignSelf: "flex-start",
                    backgroundColor: colors.green[500],
                    borderRadius: radii.md,
                    paddingHorizontal: spacing.lg,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ color: colors.white, fontWeight: "700" }}>Schedule</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {promotions.length > 0 ? (
            <View>
              <Text style={{ fontSize: typeScale.lg, fontWeight: "700", color: colors.black, marginBottom: spacing.sm }}>
                Current Promotions
              </Text>
              <FlatList
                horizontal
                data={promotions}
                keyExtractor={(p) => p.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm }}
                renderItem={({ item }) => (
                  <View style={{ width: 220, backgroundColor: colors.green[50], borderRadius: radii.lg, padding: spacing.md, gap: spacing.xs }}>
                    <Text style={{ fontWeight: "700", color: colors.green[700] }}>{item.title}</Text>
                    {item.body ? <Text style={{ fontSize: typeScale.xs, color: colors.gray[700] }}>{item.body}</Text> : null}
                  </View>
                )}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Pressable
        onPress={() => router.push("/service/new")}
        style={({ pressed }) => ({
          position: "absolute",
          right: spacing.lg,
          bottom: spacing.lg,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: colors.green[500],
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.85 : 1,
          ...shadows.raised,
        })}
      >
        <Text style={{ fontSize: typeScale.xxl, color: colors.white }}>+</Text>
      </Pressable>
    </View>
  );
}

function StatPill({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: radii.md, padding: spacing.sm, alignItems: "center" }}>
      <Text style={{ color: muted ? "rgba(255,255,255,0.6)" : colors.white, fontSize: typeScale.lg, fontWeight: "700" }}>{value}</Text>
      <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: typeScale.xs }}>{label}</Text>
    </View>
  );
}

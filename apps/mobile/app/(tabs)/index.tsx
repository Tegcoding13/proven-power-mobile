import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
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

const QUICK_ACTIONS: { href: Route; label: string; icon: string }[] = [
  { href: "/garage", label: "Equipment", icon: "🚜" },
  { href: "/service/new", label: "Service", icon: "🔧" },
  { href: "/parts", label: "Parts", icon: "🛒" },
  { href: "/messages", label: "Messages", icon: "💬" },
  { href: "/winter-storage", label: "Storage", icon: "❄️" },
  { href: "/locations", label: "Locations", icon: "📍" },
  { href: "/inventory", label: "Inventory", icon: "📦" },
  { href: "/service", label: "History", icon: "📋" },
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

    const { data: promoRows } = await supabase.from("promotions").select("*").order("starts_at", { ascending: false }).limit(3);
    setPromotions(promoRows ?? []);
  }, [businessAccount]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray[50] }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <LinearGradient colors={gradients.hero} style={{ paddingBottom: spacing.md }}>
          <SafeAreaView edges={["top"]}>
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "rgba(255,255,255,0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.white, fontWeight: "700", fontSize: typeScale.sm }}>{initials(profile?.full_name)}</Text>
                </View>
                <Text style={{ color: colors.white, fontSize: typeScale.lg, fontWeight: "700" }}>
                  Hi, {profile?.full_name?.split(" ")[0] ?? "there"} 👋
                </Text>
              </View>
              <Pressable
                onPress={() => Alert.alert("Notifications", "Push notifications are coming soon.")}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: typeScale.base }}>🔔</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
              <StatPill label="Equipment" value={equipmentCount != null ? String(equipmentCount) : "–"} />
              <StatPill label="Active Service" value={activeServiceCount != null ? String(activeServiceCount) : "–"} />
              <StatPill label="Rewards" value="Soon" muted />
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={{ flex: 1, padding: spacing.md, gap: spacing.md }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.href}
                onPress={() => router.push(action.href)}
                style={({ pressed }) => ({
                  width: "23%",
                  aspectRatio: 1,
                  backgroundColor: colors.white,
                  borderRadius: radii.md,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  opacity: pressed ? 0.85 : 1,
                  ...shadows.card,
                })}
              >
                <Text style={{ fontSize: typeScale.lg }}>{action.icon}</Text>
                <Text style={{ fontSize: 10, fontWeight: "700", color: colors.black, textAlign: "center" }}>{action.label}</Text>
              </Pressable>
            ))}
          </View>

          {nextTask ? (
            <Pressable
              onPress={() => router.push("/service/new")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.white,
                borderRadius: radii.md,
                padding: spacing.sm,
                gap: spacing.sm,
                opacity: pressed ? 0.85 : 1,
                ...shadows.card,
              })}
            >
              <Text style={{ fontSize: typeScale.lg }}>🔧</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: typeScale.xs, fontWeight: "700", color: colors.black }} numberOfLines={1}>
                  {nextTask.equipmentLabel} · {nextTask.task_name}
                </Text>
                <Text style={{ fontSize: 10, color: colors.status.warning, fontWeight: "600" }}>
                  {nextTask.due_at_date
                    ? `Due ${new Date(nextTask.due_at_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                    : nextTask.due_at_hours != null
                      ? `Due at ${nextTask.due_at_hours} hrs`
                      : "Due soon"}
                </Text>
              </View>
              <View style={{ backgroundColor: colors.green[500], borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 }}>
                <Text style={{ color: colors.white, fontSize: 10, fontWeight: "700" }}>Schedule</Text>
              </View>
            </Pressable>
          ) : null}

          {promotions.length > 0 ? (
            <View style={{ flexDirection: "row", gap: spacing.xs }}>
              {promotions.map((promo) => (
                <View key={promo.id} style={{ flex: 1, backgroundColor: colors.green[50], borderRadius: radii.sm, padding: spacing.xs }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: colors.green[700] }} numberOfLines={1}>
                    {promo.title}
                  </Text>
                </View>
              ))}
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
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.green[500],
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.85 : 1,
          ...shadows.raised,
        })}
      >
        <Text style={{ fontSize: typeScale.xl, color: colors.white }}>+</Text>
      </Pressable>
    </View>
  );
}

function StatPill({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: radii.sm, paddingVertical: 6, alignItems: "center" }}>
      <Text style={{ color: muted ? "rgba(255,255,255,0.6)" : colors.white, fontSize: typeScale.base, fontWeight: "700" }}>{value}</Text>
      <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 10 }}>{label}</Text>
    </View>
  );
}

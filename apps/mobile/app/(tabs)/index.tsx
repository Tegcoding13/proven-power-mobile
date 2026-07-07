import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, spacing, radii, typeScale, shadows } from "@proven-power/ui-tokens";
import type { MaintenanceTask } from "@proven-power/shared-types";
import { useAuth } from "../../lib/auth-context";
import { useBusinessAccount } from "../../lib/business-account";
import { supabase } from "../../lib/supabase";
import { ProvenPowerLogo } from "../../components/ProvenPowerLogo";

type Route =
  | "/garage"
  | "/service"
  | "/service/new"
  | "/parts"
  | "/messages"
  | "/inventory"
  | "/winter-storage"
  | "/locations"
  | "/deals";

const QUICK_ACTIONS: { href: Route; label: string; icon: string }[] = [
  { href: "/garage", label: "Equipment", icon: "🚜" },
  { href: "/service/new", label: "Service", icon: "🔧" },
  { href: "/parts", label: "Parts", icon: "🛒" },
  { href: "/messages", label: "Messages", icon: "💬" },
  { href: "/winter-storage", label: "Storage", icon: "❄️" },
  { href: "/locations", label: "Locations", icon: "📍" },
  { href: "/inventory", label: "Inventory", icon: "📦" },
  { href: "/service", label: "History", icon: "📋" },
  { href: "/deals", label: "Deals", icon: "🏷️" },
];

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { businessAccount } = useBusinessAccount();

  const [equipmentCount, setEquipmentCount] = useState<number | null>(null);
  const [activeServiceCount, setActiveServiceCount] = useState<number | null>(null);
  const [nextTask, setNextTask] = useState<(MaintenanceTask & { equipmentLabel: string }) | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    const { count: unread } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false);
    setUnreadCount(unread ?? 0);

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
  }, [businessAccount]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray[50] }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header — solid brand green, no gradient */}
        <View style={{ backgroundColor: "#1a3d2b" }}>
          <SafeAreaView edges={["top"]}>
            {/* Top bar: logo + notification */}
            <View style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: spacing.sm,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <ProvenPowerLogo width={148} height={34} />
              <Pressable
                onPress={() => router.push("/notifications")}
                style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 20 }}>🔔</Text>
                {unreadCount > 0 && (
                  <View style={{
                    position: "absolute", top: 0, right: 0,
                    minWidth: 16, height: 16, borderRadius: 8,
                    backgroundColor: colors.status.danger,
                    alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
                  }}>
                    <Text style={{ color: colors.white, fontSize: 9, fontWeight: "700" }}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Greeting */}
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: typeScale.xs, fontWeight: "500", letterSpacing: 0.5, textTransform: "uppercase" }}>
                Welcome back
              </Text>
              <Text style={{ color: colors.white, fontSize: typeScale.xl, fontWeight: "700", marginTop: 2 }}>
                {firstName}
              </Text>
            </View>

            {/* Stat cards — white cards that bleed below the header */}
            <View style={{ flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: -spacing.lg }}>
              <StatCard label="Equipment" value={equipmentCount != null ? String(equipmentCount) : "–"} />
              <StatCard label="Active Service" value={activeServiceCount != null ? String(activeServiceCount) : "–"} />
              <StatCard label="Rewards" value="Soon" muted />
            </View>
          </SafeAreaView>
        </View>

        <View style={{ flex: 1, padding: spacing.md, paddingTop: spacing.lg + spacing.md, gap: spacing.md }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.href}
                onPress={() => router.push(action.href)}
                style={({ pressed }) => ({
                  width: "21%",
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
                <Text style={{ fontSize: typeScale.base }}>{action.icon}</Text>
                <Text style={{ fontSize: 9, fontWeight: "700", color: colors.black, textAlign: "center" }}>{action.label}</Text>
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

function StatCard({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: colors.white,
      borderRadius: radii.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      alignItems: "center",
      ...shadows.card,
    }}>
      <Text style={{ color: muted ? colors.gray[300] : colors.green[500], fontSize: typeScale.lg, fontWeight: "700" }}>{value}</Text>
      <Text style={{ color: colors.gray[500], fontSize: 10, marginTop: 2, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

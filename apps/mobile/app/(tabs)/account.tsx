import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, spacing, radii, typeScale, shadows, minTouchTarget } from "@proven-power/ui-tokens";
import { useAuth } from "../../lib/auth-context";
import { supabase } from "../../lib/supabase";

function initials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function AccountScreen() {
  const { profile, session, signOut, refreshProfile } = useAuth();
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    if (!session?.user) return;
    setIsSaving(true);
    setSaveError(null);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() || null, phone: phone.trim() || null })
      .eq("id", session.user.id);
    if (error) {
      setSaveError(error.message);
    } else {
      await refreshProfile();
      setIsEditing(false);
    }
    setIsSaving(false);
  }

  function handleStartEdit() {
    setName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setSaveError(null);
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    setSaveError(null);
  }

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  }

  const settingsRows = [
    { label: "Locations & Contact", onPress: () => router.push("/locations") },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.gray[50] }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>

        {/* Avatar + name */}
        <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: colors.green[500],
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ color: colors.white, fontSize: typeScale.xxl, fontWeight: "700" }}>
              {initials(profile?.full_name)}
            </Text>
          </View>
          <Text style={{ fontSize: typeScale.xl, fontWeight: "700", color: colors.black }}>
            {profile?.full_name ?? "Your Account"}
          </Text>
          <Text style={{ fontSize: typeScale.sm, color: colors.gray[700] }}>{session?.user.email}</Text>
        </View>

        {/* Edit profile card */}
        <View style={{ backgroundColor: colors.white, borderRadius: radii.lg, ...shadows.card, overflow: "hidden" }}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: typeScale.sm, fontWeight: "700", color: colors.gray[500], textTransform: "uppercase", letterSpacing: 0.8 }}>
              Profile
            </Text>
            {!isEditing && (
              <Pressable onPress={handleStartEdit} hitSlop={8}>
                <Text style={{ fontSize: typeScale.sm, color: colors.green[500], fontWeight: "600" }}>Edit</Text>
              </Pressable>
            )}
          </View>

          {isEditing ? (
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md }}>
              <View style={{ gap: spacing.xs }}>
                <Text style={{ fontSize: typeScale.xs, fontWeight: "600", color: colors.gray[500] }}>Full Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={colors.gray[300]}
                  style={{
                    minHeight: minTouchTarget,
                    borderWidth: 1,
                    borderColor: colors.gray[300],
                    borderRadius: radii.md,
                    paddingHorizontal: spacing.md,
                    fontSize: typeScale.base,
                    color: colors.black,
                  }}
                />
              </View>
              <View style={{ gap: spacing.xs }}>
                <Text style={{ fontSize: typeScale.xs, fontWeight: "600", color: colors.gray[500] }}>Phone Number</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="(262) 555-0100"
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.gray[300]}
                  style={{
                    minHeight: minTouchTarget,
                    borderWidth: 1,
                    borderColor: colors.gray[300],
                    borderRadius: radii.md,
                    paddingHorizontal: spacing.md,
                    fontSize: typeScale.base,
                    color: colors.black,
                  }}
                />
              </View>
              {saveError ? (
                <Text style={{ fontSize: typeScale.sm, color: colors.status.danger }}>{saveError}</Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable
                  onPress={handleSave}
                  disabled={isSaving}
                  style={({ pressed }) => ({
                    flex: 1, minHeight: minTouchTarget, borderRadius: radii.md,
                    backgroundColor: colors.green[500],
                    alignItems: "center", justifyContent: "center",
                    opacity: pressed || isSaving ? 0.7 : 1,
                  })}
                >
                  {isSaving
                    ? <ActivityIndicator color={colors.white} />
                    : <Text style={{ color: colors.white, fontWeight: "700", fontSize: typeScale.base }}>Save</Text>}
                </Pressable>
                <Pressable
                  onPress={handleCancel}
                  disabled={isSaving}
                  style={({ pressed }) => ({
                    flex: 1, minHeight: minTouchTarget, borderRadius: radii.md,
                    borderWidth: 1, borderColor: colors.gray[300],
                    alignItems: "center", justifyContent: "center",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: colors.gray[700], fontWeight: "600", fontSize: typeScale.base }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm }}>
              <View>
                <Text style={{ fontSize: typeScale.xs, color: colors.gray[500] }}>Name</Text>
                <Text style={{ fontSize: typeScale.base, color: colors.black, fontWeight: "500" }}>
                  {profile?.full_name ?? "—"}
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: typeScale.xs, color: colors.gray[500] }}>Email</Text>
                <Text style={{ fontSize: typeScale.base, color: colors.black }}>{session?.user.email ?? "—"}</Text>
              </View>
              <View>
                <Text style={{ fontSize: typeScale.xs, color: colors.gray[500] }}>Phone</Text>
                <Text style={{ fontSize: typeScale.base, color: colors.black }}>
                  {profile?.phone ?? <Text style={{ color: colors.gray[300] }}>Not set</Text>}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Other links */}
        <View style={{ backgroundColor: colors.white, borderRadius: radii.lg, ...shadows.card }}>
          {settingsRows.map((row, index) => (
            <Pressable
              key={row.label}
              onPress={row.onPress}
              style={({ pressed }) => ({
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.gray[100],
                backgroundColor: pressed ? colors.gray[50] : colors.white,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              })}
            >
              <Text style={{ fontSize: typeScale.base, color: colors.black }}>{row.label}</Text>
              <Text style={{ fontSize: typeScale.base, color: colors.gray[500] }}>›</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => ({
            backgroundColor: colors.white,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.status.danger,
            minHeight: 56,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: colors.status.danger, fontSize: typeScale.base, fontWeight: "700" }}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

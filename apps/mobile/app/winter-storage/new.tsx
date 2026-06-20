import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing, radii, typeScale, minTouchTarget } from "@proven-power/ui-tokens";
import type { Equipment, StorageSeasonWindow } from "@proven-power/shared-types";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { useBusinessAccount } from "../../lib/business-account";

export default function NewWinterStorageSignupScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState<string | null>(null);
  const [zip, setZip] = useState("");
  const [seasonWindows, setSeasonWindows] = useState<StorageSeasonWindow[]>([]);
  const [seasonWindowId, setSeasonWindowId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [isLookingUpZone, setIsLookingUpZone] = useState(false);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!businessAccount) return;
    supabase
      .from("equipment")
      .select("*")
      .eq("business_account_id", businessAccount.id)
      .is("deleted_at", null)
      .then(({ data }) => {
        setEquipmentList(data ?? []);
        if (data && data.length > 0) setEquipmentId(data[0].id);
      });
  }, [businessAccount]);

  async function handleLookupZone() {
    if (!zip.trim()) return;
    setIsLookingUpZone(true);
    setZoneError(null);
    setSeasonWindows([]);
    setSeasonWindowId(null);

    const { data: foundZoneId } = await supabase.rpc("zone_for_zip", { target_zip: zip.trim() });

    if (!foundZoneId) {
      setZoneError("We don't have storage zones set up for that zip code yet — contact the dealership directly.");
      setIsLookingUpZone(false);
      return;
    }

    setZoneId(foundZoneId);
    const { data: windows } = await supabase
      .from("storage_season_windows")
      .select("*")
      .eq("zone_id", foundZoneId)
      .eq("is_active", true)
      .order("dropoff_window_start", { ascending: true });

    setSeasonWindows(windows ?? []);
    if (windows && windows.length > 0) setSeasonWindowId(windows[0].id);
    if (!windows || windows.length === 0) {
      setZoneError("No open storage season for your zone right now — check back later.");
    }
    setIsLookingUpZone(false);
  }

  async function handleSubmit() {
    if (!businessAccount || !session?.user || !equipmentId || !seasonWindowId) {
      setErrorMessage("Pick equipment and a storage window before submitting.");
      return;
    }
    if (!agreed) {
      setErrorMessage("You must agree to the storage terms to continue.");
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);

    const { error } = await supabase.from("winter_storage_signups").insert({
      business_account_id: businessAccount.id,
      equipment_id: equipmentId,
      zone_id: zoneId,
      season_window_id: seasonWindowId,
      agreement_signed_at: new Date().toISOString(),
      requested_by_profile_id: session.user.id,
    });

    setIsSubmitting(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    router.replace("/winter-storage");
  }

  const canSubmit = !!equipmentId && !!seasonWindowId && agreed && !isSubmitting && !isLoadingAccount;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.white }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Text style={{ fontSize: typeScale.base, fontWeight: "600", color: colors.black }}>Equipment</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {equipmentList.map((eq) => (
          <Pressable
            key={eq.id}
            onPress={() => setEquipmentId(eq.id)}
            style={{
              paddingHorizontal: spacing.md,
              minHeight: minTouchTarget,
              justifyContent: "center",
              borderRadius: radii.pill,
              backgroundColor: equipmentId === eq.id ? colors.green[500] : colors.gray[100],
            }}
          >
            <Text style={{ color: equipmentId === eq.id ? colors.white : colors.black, fontWeight: "600" }}>
              {eq.nickname || eq.model}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ fontSize: typeScale.base, fontWeight: "600", color: colors.black, marginTop: spacing.sm }}>Your Zip Code</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <TextInput
          placeholder="Zip code"
          placeholderTextColor={colors.gray[500]}
          keyboardType="number-pad"
          value={zip}
          onChangeText={setZip}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.gray[300],
            borderRadius: radii.md,
            paddingHorizontal: spacing.md,
            minHeight: minTouchTarget,
            fontSize: typeScale.base,
            color: colors.black,
            backgroundColor: colors.gray[50],
          }}
        />
        <Pressable
          onPress={handleLookupZone}
          disabled={!zip.trim() || isLookingUpZone}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.lg,
            minHeight: minTouchTarget,
            borderRadius: radii.md,
            backgroundColor: colors.green[500],
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed || !zip.trim() || isLookingUpZone ? 0.7 : 1,
          })}
        >
          {isLookingUpZone ? <ActivityIndicator color={colors.white} /> : <Text style={{ color: colors.white, fontWeight: "600" }}>Find Dates</Text>}
        </Pressable>
      </View>

      {zoneError ? <Text style={{ color: colors.status.danger, fontSize: typeScale.sm }}>{zoneError}</Text> : null}

      {seasonWindows.length > 0 ? (
        <>
          <Text style={{ fontSize: typeScale.base, fontWeight: "600", color: colors.black, marginTop: spacing.sm }}>
            Available Storage Window
          </Text>
          {seasonWindows.map((w) => (
            <Pressable
              key={w.id}
              onPress={() => setSeasonWindowId(w.id)}
              style={{
                padding: spacing.md,
                borderRadius: radii.md,
                borderWidth: 2,
                borderColor: seasonWindowId === w.id ? colors.green[500] : colors.gray[300],
                backgroundColor: seasonWindowId === w.id ? colors.green[50] : colors.white,
              }}
            >
              <Text style={{ fontWeight: "600", color: colors.black }}>{w.season_label}</Text>
              <Text style={{ fontSize: typeScale.sm, color: colors.gray[700] }}>
                Drop-off: {new Date(w.dropoff_window_start).toLocaleDateString()} – {new Date(w.dropoff_window_end).toLocaleDateString()}
              </Text>
              <Text style={{ fontSize: typeScale.sm, color: colors.gray[700] }}>
                Pickup: {new Date(w.pickup_window_start).toLocaleDateString()} – {new Date(w.pickup_window_end).toLocaleDateString()}
              </Text>
            </Pressable>
          ))}
        </>
      ) : null}

      <Pressable
        onPress={() => setAgreed((prev) => !prev)}
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: radii.sm,
            borderWidth: 2,
            borderColor: colors.green[500],
            backgroundColor: agreed ? colors.green[500] : colors.white,
          }}
        />
        <Text style={{ fontSize: typeScale.sm, color: colors.black, flex: 1 }}>
          I agree to the winter storage terms and conditions.
        </Text>
      </Pressable>

      {errorMessage ? <Text style={{ color: colors.status.danger, fontSize: typeScale.sm }}>{errorMessage}</Text> : null}

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => ({
          minHeight: minTouchTarget,
          borderRadius: radii.md,
          backgroundColor: colors.green[500],
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed || !canSubmit ? 0.7 : 1,
          marginBottom: spacing.xl,
          marginTop: spacing.sm,
        })}
      >
        {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={{ color: colors.white, fontSize: typeScale.lg, fontWeight: "600" }}>Sign Up</Text>}
      </Pressable>
    </ScrollView>
  );
}

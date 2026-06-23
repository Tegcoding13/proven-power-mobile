import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, spacing, radii, typeScale } from "@proven-power/ui-tokens";
import type { DealershipLocation } from "@proven-power/shared-types";
import { supabase } from "../../lib/supabase";
import { useBusinessAccount } from "../../lib/business-account";

export default function ChooseStoreScreen() {
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount, refresh } = useBusinessAccount();
  const [locations, setLocations] = useState<DealershipLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("dealership_locations")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .then(({ data }) => {
        setLocations(data ?? []);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!isLoadingAccount && businessAccount?.primary_location_id) {
      router.replace("/");
    }
  }, [isLoadingAccount, businessAccount, router]);

  async function handleChoose(locationId: string) {
    if (!businessAccount) return;
    setIsSaving(true);
    setErrorMessage(null);

    const { error } = await supabase
      .from("business_accounts")
      .update({ primary_location_id: locationId })
      .eq("id", businessAccount.id);

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }
    await refresh();
    router.replace("/");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, flexGrow: 1 }}>
        <View style={{ alignItems: "center", gap: spacing.xs, marginTop: spacing.xl }}>
          <Text style={{ fontSize: typeScale.xxl, fontWeight: "700", color: colors.green[700], textAlign: "center" }}>
            Welcome to Proven Power
          </Text>
          <Text style={{ fontSize: typeScale.base, color: colors.gray[700], textAlign: "center" }}>
            Which store is your home location?
          </Text>
        </View>

        {errorMessage ? (
          <Text style={{ color: colors.status.danger, fontSize: typeScale.sm, textAlign: "center" }}>{errorMessage}</Text>
        ) : null}

        {isLoading || isLoadingAccount ? (
          <ActivityIndicator size="large" color={colors.green[500]} />
        ) : (
          <View style={{ gap: spacing.md }}>
            {locations.map((location) => (
              <Pressable
                key={location.id}
                onPress={() => handleChoose(location.id)}
                disabled={isSaving}
                style={({ pressed }) => ({
                  borderRadius: radii.lg,
                  borderWidth: 2,
                  borderColor: colors.gray[300],
                  padding: spacing.lg,
                  opacity: pressed || isSaving ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: typeScale.lg, fontWeight: "700", color: colors.black }}>
                  {location.name.replace("Proven Power - ", "")}
                </Text>
                <Text style={{ fontSize: typeScale.sm, color: colors.gray[700], marginTop: spacing.xs }}>
                  {location.address}, {location.city}, {location.state} {location.zip}
                </Text>
                {location.phone ? (
                  <Text style={{ fontSize: typeScale.sm, color: colors.gray[700] }}>{location.phone}</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}

        <Text style={{ fontSize: typeScale.xs, color: colors.gray[500], textAlign: "center" }}>
          Your parts, service, and sales requests will go to this store. You can ask us to change it anytime.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

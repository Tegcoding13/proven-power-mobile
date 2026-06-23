import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { colors, spacing, radii, typeScale } from "@proven-power/ui-tokens";
import type { Promotion } from "@proven-power/shared-types";
import { supabase } from "../../lib/supabase";

export default function DealsScreen() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("promotions")
      .select("*")
      .order("starts_at", { ascending: false })
      .then(({ data }) => {
        setPromotions(data ?? []);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.green[500]} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.white }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      {promotions.length === 0 ? (
        <Text style={{ fontSize: typeScale.base, color: colors.gray[700], textAlign: "center", marginTop: spacing.xl }}>
          No current offers right now — check back soon.
        </Text>
      ) : (
        promotions.map((promo) => (
          <View key={promo.id} style={{ backgroundColor: colors.green[50], borderRadius: radii.lg, padding: spacing.lg }}>
            <Text style={{ fontSize: typeScale.lg, fontWeight: "700", color: colors.green[700] }}>{promo.title}</Text>
            {promo.body ? (
              <Text style={{ fontSize: typeScale.sm, color: colors.gray[700], marginTop: spacing.xs }}>{promo.body}</Text>
            ) : null}
            {promo.ends_at ? (
              <Text style={{ fontSize: typeScale.xs, color: colors.gray[500], marginTop: spacing.xs }}>
                Expires {new Date(promo.ends_at).toLocaleDateString()}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

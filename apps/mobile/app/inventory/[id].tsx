import { useCallback, useState } from "react";
import { View, Text, ScrollView, FlatList, Image, ActivityIndicator } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { colors, spacing, radii, typeScale } from "@proven-power/ui-tokens";
import type { InventoryListing } from "@proven-power/shared-types";
import { supabase } from "../../lib/supabase";
import { getPublicInventoryPhotoUrl } from "../../lib/inventory";

export default function InventoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<InventoryListing | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);

    const { data: listingRow } = await supabase.from("inventory_listings").select("*").eq("id", id).single();
    setListing(listingRow ?? null);

    const { data: photoRows } = await supabase.from("inventory_listing_photos").select("*").eq("listing_id", id);
    setPhotoUrls((photoRows ?? []).map((p) => getPublicInventoryPhotoUrl(p.storage_path)));
    setIsLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (isLoading || !listing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.green[500]} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.white }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      {photoUrls.length > 0 ? (
        <FlatList
          horizontal
          data={photoUrls}
          keyExtractor={(url) => url}
          contentContainerStyle={{ gap: spacing.sm }}
          renderItem={({ item }) => <Image source={{ uri: item }} style={{ width: 260, height: 200, borderRadius: radii.md }} />}
        />
      ) : null}

      <Text style={{ fontSize: typeScale.xxl, fontWeight: "700", color: colors.black }}>{listing.title}</Text>
      <Text style={{ fontSize: typeScale.lg, color: colors.green[700], fontWeight: "600" }}>
        {listing.price != null ? `$${listing.price.toLocaleString()}` : "Call for price"}
      </Text>
      <Text style={{ fontSize: typeScale.sm, color: colors.gray[700] }}>
        {listing.condition === "new" ? "New" : "Used"} {listing.make} {listing.model}
        {listing.model_year ? ` (${listing.model_year})` : ""}
        {listing.stock_number ? ` · Stock #${listing.stock_number}` : ""}
      </Text>
      {listing.description ? (
        <Text style={{ fontSize: typeScale.base, color: colors.black, marginTop: spacing.sm }}>{listing.description}</Text>
      ) : null}
    </ScrollView>
  );
}

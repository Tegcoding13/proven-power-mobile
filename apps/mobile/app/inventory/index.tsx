import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, Image, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, spacing, radii, typeScale } from "@proven-power/ui-tokens";
import type { InventoryListing } from "@proven-power/shared-types";
import { supabase } from "../../lib/supabase";
import { getPublicInventoryPhotoUrl } from "../../lib/inventory";

type ListingWithPhoto = InventoryListing & { photoUrl: string | null };

export default function InventoryListScreen() {
  const router = useRouter();
  const [listings, setListings] = useState<ListingWithPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setIsLoading(true);

    const { data } = await supabase
      .from("inventory_listings")
      .select("*")
      .eq("status", "available")
      .order("created_at", { ascending: false });

    const listingIds = (data ?? []).map((l) => l.id);
    const { data: photoRows } = listingIds.length
      ? await supabase.from("inventory_listing_photos").select("*").in("listing_id", listingIds)
      : { data: [] as { listing_id: string; storage_path: string }[] };
    const photoByListing = new Map<string, string>();
    for (const photo of photoRows ?? []) {
      if (!photoByListing.has(photo.listing_id)) {
        photoByListing.set(photo.listing_id, getPublicInventoryPhotoUrl(photo.storage_path));
      }
    }

    setListings((data ?? []).map((l) => ({ ...l, photoUrl: photoByListing.get(l.id) ?? null })));
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load])
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.green[500]} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.white }}
      data={listings}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); load(false); }} />
      }
      ListEmptyComponent={
        <View style={{ alignItems: "center", marginTop: spacing.xxl }}>
          <Text style={{ fontSize: typeScale.lg, color: colors.black, textAlign: "center" }}>No inventory listed right now.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/inventory/${item.id}`)}
          style={({ pressed }) => ({
            flexDirection: "row",
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.gray[300],
            opacity: pressed ? 0.8 : 1,
            alignItems: "center",
          })}
        >
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={{ width: 72, height: 72, borderRadius: radii.sm }} />
          ) : (
            <View style={{ width: 72, height: 72, borderRadius: radii.sm, backgroundColor: colors.green[50], alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: typeScale.xl }}>🚜</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: typeScale.base, fontWeight: "600", color: colors.black }}>{item.title}</Text>
            <Text style={{ fontSize: typeScale.sm, color: colors.gray[700] }}>
              {item.condition === "new" ? "New" : "Used"} · {item.price != null ? `$${item.price.toLocaleString()}` : "Call for price"}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}

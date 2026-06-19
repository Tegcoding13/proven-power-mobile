import { useCallback, useState } from "react";
import { View, Text, ScrollView, Image, FlatList, ActivityIndicator } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { colors, spacing, radii, typeScale } from "@proven-power/ui-tokens";
import type { PartsRequest } from "@proven-power/shared-types";
import { supabase } from "../../../lib/supabase";
import { getSignedPartsRequestMediaUrl } from "../../../lib/parts-request-media";
import { StatusBadge } from "../../../components/StatusBadge";

export default function PartsRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [request, setRequest] = useState<PartsRequest | null>(null);
  const [mediaUrls, setMediaUrls] = useState<{ id: string; url: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);

    const { data: requestRow } = await supabase.from("parts_requests").select("*").eq("id", id).single();
    setRequest(requestRow ?? null);

    const { data: mediaRows } = await supabase.from("parts_request_media").select("*").eq("parts_request_id", id);
    const urls = await Promise.all(
      (mediaRows ?? []).map(async (m) => ({ id: m.id, url: await getSignedPartsRequestMediaUrl(m.storage_path) }))
    );
    setMediaUrls(urls.filter((u): u is { id: string; url: string } => Boolean(u.url)));
    setIsLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (isLoading || !request) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.green[500]} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.white }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <StatusBadge status={request.status} />
        <Text style={{ fontSize: typeScale.lg, color: colors.black, marginTop: spacing.xs }}>{request.description}</Text>
      </View>

      {mediaUrls.length > 0 ? (
        <FlatList
          horizontal
          data={mediaUrls}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ gap: spacing.sm }}
          renderItem={({ item }) => (
            <Image source={{ uri: item.url }} style={{ width: 140, height: 140, borderRadius: radii.md }} />
          )}
        />
      ) : null}
    </ScrollView>
  );
}

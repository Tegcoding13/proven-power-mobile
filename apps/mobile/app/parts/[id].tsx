import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, Image, FlatList, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { colors, spacing, radii, typeScale } from "@proven-power/ui-tokens";
import type { PartsRequest } from "@proven-power/shared-types";
import { supabase } from "../../lib/supabase";
import { getSignedPartsRequestMediaUrl } from "../../lib/parts-request-media";
import { StatusBadge } from "../../components/StatusBadge";

export default function PartsRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [request, setRequest] = useState<PartsRequest | null>(null);
  const [mediaUrls, setMediaUrls] = useState<{ id: string; url: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  function handleCancel() {
    if (!id) return;
    Alert.alert("Cancel Request", "Are you sure you want to cancel this parts request?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          setIsCancelling(true);
          setErrorMessage(null);
          const { data: updated, error } = await supabase.rpc("cancel_parts_request", { p_parts_request_id: id });
          if (error) {
            setErrorMessage(error.message);
          } else if (updated) {
            setRequest(updated);
          }
          setIsCancelling(false);
        },
      },
    ]);
  }

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

        {errorMessage ? <Text style={{ color: colors.status.danger, fontSize: typeScale.sm }}>{errorMessage}</Text> : null}

        {request.status === "submitted" ? (
          <Pressable
            onPress={handleCancel}
            disabled={isCancelling}
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              marginTop: spacing.xs,
              minHeight: 36,
              paddingHorizontal: spacing.md,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.status.danger,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed || isCancelling ? 0.7 : 1,
            })}
          >
            <Text style={{ color: colors.status.danger, fontWeight: "600", fontSize: typeScale.sm }}>
              {isCancelling ? "Cancelling..." : "Cancel Request"}
            </Text>
          </Pressable>
        ) : null}
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

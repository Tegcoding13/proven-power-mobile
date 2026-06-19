import { useCallback, useState } from "react";
import { View, Text, ScrollView, Image, FlatList, ActivityIndicator } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { colors, spacing, radii, typeScale } from "@proven-power/ui-tokens";
import type { ServiceRequest, ServiceRequestStatusHistory, Equipment, ServiceRequestMediaType } from "@proven-power/shared-types";
import { supabase } from "../../../lib/supabase";
import { getSignedServiceRequestMediaUrl } from "../../../lib/service-request-media";
import { StatusBadge } from "../../../components/StatusBadge";

export default function ServiceRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [history, setHistory] = useState<ServiceRequestStatusHistory[]>([]);
  const [mediaUrls, setMediaUrls] = useState<{ id: string; url: string; mediaType: ServiceRequestMediaType }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);

    const { data: requestRow } = await supabase.from("service_requests").select("*").eq("id", id).single();
    setRequest(requestRow ?? null);

    if (requestRow) {
      const [{ data: equipmentRow }, { data: historyRows }, { data: mediaRows }] = await Promise.all([
        supabase.from("equipment").select("*").eq("id", requestRow.equipment_id).single(),
        supabase
          .from("service_request_status_history")
          .select("*")
          .eq("service_request_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("service_request_media").select("*").eq("service_request_id", id),
      ]);
      setEquipment(equipmentRow ?? null);
      setHistory(historyRows ?? []);

      const urls = await Promise.all(
        (mediaRows ?? []).map(async (m) => ({
          id: m.id,
          url: await getSignedServiceRequestMediaUrl(m.storage_path),
          mediaType: m.media_type,
        }))
      );
      setMediaUrls(urls.filter((u): u is { id: string; url: string; mediaType: ServiceRequestMediaType } => Boolean(u.url)));
    }
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
        <Text style={{ fontSize: typeScale.xxl, fontWeight: "700", color: colors.black }}>
          {equipment?.nickname || equipment?.model || "Service Request"}
        </Text>
        <StatusBadge status={request.status} />
        <Text style={{ fontSize: typeScale.base, color: colors.gray[700], marginTop: spacing.xs }}>{request.description}</Text>
        {request.estimate_amount != null ? (
          <Text style={{ fontSize: typeScale.base, color: colors.black, fontWeight: "600" }}>
            Estimate: ${request.estimate_amount}
            {request.estimate_approved_at ? " (approved)" : " — awaiting your approval"}
          </Text>
        ) : null}
      </View>

      {mediaUrls.length > 0 ? (
        <View>
          <Text style={{ fontSize: typeScale.lg, fontWeight: "700", color: colors.black, marginBottom: spacing.sm }}>Photos/Video</Text>
          <FlatList
            horizontal
            data={mediaUrls}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ gap: spacing.sm }}
            renderItem={({ item }) =>
              item.mediaType === "photo" ? (
                <Image source={{ uri: item.url }} style={{ width: 120, height: 120, borderRadius: radii.md }} />
              ) : (
                <View
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: radii.md,
                    backgroundColor: colors.gray[100],
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text>🎥 Video</Text>
                </View>
              )
            }
          />
        </View>
      ) : null}

      <View>
        <Text style={{ fontSize: typeScale.lg, fontWeight: "700", color: colors.black, marginBottom: spacing.sm }}>Status History</Text>
        {history.map((entry) => (
          <View key={entry.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.gray[100] }}>
            <StatusBadge status={entry.status} />
            <Text style={{ fontSize: typeScale.xs, color: colors.gray[700] }}>
              {new Date(entry.created_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

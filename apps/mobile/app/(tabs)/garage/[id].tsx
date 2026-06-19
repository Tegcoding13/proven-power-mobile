import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, Image, TextInput, ActivityIndicator, FlatList, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { colors, spacing, radii, typeScale, minTouchTarget } from "@proven-power/ui-tokens";
import type { Equipment, EquipmentHourReading, EquipmentPhoto, EquipmentDocument, MaintenanceTask } from "@proven-power/shared-types";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import { useBusinessAccount } from "../../../lib/business-account";
import { uploadEquipmentPhoto, getSignedPhotoUrl } from "../../../lib/equipment-photos";
import { uploadEquipmentDocument, getSignedDocumentUrl } from "../../../lib/equipment-documents";
import { enqueuePendingPhoto, getPendingPhotosForEquipment, type PendingPhoto } from "../../../lib/photo-outbox";
import { HoursChart } from "../../../components/HoursChart";

export default function EquipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();

  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [readings, setReadings] = useState<EquipmentHourReading[]>([]);
  const [photoUrls, setPhotoUrls] = useState<{ id: string; url: string }[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [documents, setDocuments] = useState<EquipmentDocument[]>([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newHours, setNewHours] = useState("");
  const [isLoggingHours, setIsLoggingHours] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);

    const [{ data: equipmentRow }, { data: readingRows }, { data: photoRows }, { data: documentRows }, { data: taskRows }, pending] =
      await Promise.all([
        supabase.from("equipment").select("*").eq("id", id).single(),
        supabase.from("equipment_hour_readings").select("*").eq("equipment_id", id).order("recorded_at", { ascending: false }),
        supabase.from("equipment_photos").select("*").eq("equipment_id", id).order("created_at", { ascending: false }),
        supabase.from("equipment_documents").select("*").eq("equipment_id", id).order("created_at", { ascending: false }),
        supabase
          .from("maintenance_tasks")
          .select("*")
          .eq("equipment_id", id)
          .in("status", ["upcoming", "due", "overdue"])
          .order("due_at_hours", { ascending: true }),
        getPendingPhotosForEquipment(id),
      ]);

    setEquipment(equipmentRow ?? null);
    setReadings(readingRows ?? []);
    setDocuments(documentRows ?? []);
    setMaintenanceTasks(taskRows ?? []);
    setPendingPhotos(pending);

    const urls = await Promise.all(
      (photoRows ?? []).map(async (photo: EquipmentPhoto) => ({
        id: photo.id,
        url: await getSignedPhotoUrl(photo.storage_path),
      }))
    );
    setPhotoUrls(urls.filter((p): p is { id: string; url: string } => Boolean(p.url)));
    setIsLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleLogHours() {
    if (!id || !session?.user || !newHours) return;
    setIsLoggingHours(true);
    await supabase.from("equipment_hour_readings").insert({
      equipment_id: id,
      hours: Number(newHours),
      recorded_by_profile_id: session.user.id,
    });
    setNewHours("");
    setIsLoggingHours(false);
    load();
  }

  async function handleAddPhoto() {
    if (!id) return;
    if (!businessAccount || !session?.user) {
      setUploadError("Still loading your account — try again in a moment.");
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;

    setUploadError(null);
    setIsUploadingPhoto(true);
    try {
      await uploadEquipmentPhoto({
        businessAccountId: businessAccount.id,
        equipmentId: id,
        localUri: result.assets[0].uri,
        uploadedByProfileId: session.user.id,
      });
    } catch {
      await enqueuePendingPhoto({
        businessAccountId: businessAccount.id,
        equipmentId: id,
        localUri: result.assets[0].uri,
        uploadedByProfileId: session.user.id,
      });
    }
    setIsUploadingPhoto(false);
    load();
  }

  async function handleAddDocument() {
    if (!id) return;
    if (!businessAccount || !session?.user) {
      setUploadError("Still loading your account — try again in a moment.");
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;

    setUploadError(null);
    const asset = result.assets[0];
    await uploadEquipmentDocument({
      businessAccountId: businessAccount.id,
      equipmentId: id,
      localUri: asset.uri,
      fileName: asset.name,
      mimeType: asset.mimeType ?? "application/octet-stream",
      docType: "other",
      uploadedByProfileId: session.user.id,
    });
    load();
  }

  async function handleOpenDocument(doc: EquipmentDocument) {
    const url = await getSignedDocumentUrl(doc.storage_path);
    if (url) Linking.openURL(url);
  }

  if (isLoading || !equipment) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.green[500]} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.white }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <View>
        <Text style={{ fontSize: typeScale.xxl, fontWeight: "700", color: colors.black }}>
          {equipment.nickname || `${equipment.model_year ?? ""} ${equipment.model}`.trim()}
        </Text>
        <Text style={{ fontSize: typeScale.base, color: colors.gray[700] }}>
          {equipment.make} {equipment.model}
          {equipment.serial_number ? ` · S/N ${equipment.serial_number}` : ""}
        </Text>
      </View>

      {(equipment.warranty_expires_at || equipment.powergard_expires_at || maintenanceTasks.length > 0) ? (
        <Section title="Maintenance">
          {equipment.warranty_expires_at ? (
            <Text style={{ fontSize: typeScale.sm, color: colors.gray[700] }}>
              Warranty expires {formatDate(equipment.warranty_expires_at)}
            </Text>
          ) : null}
          {equipment.powergard_expires_at ? (
            <Text style={{ fontSize: typeScale.sm, color: colors.gray[700] }}>
              {equipment.powergard_plan_name ?? "PowerGard"} expires {formatDate(equipment.powergard_expires_at)}
            </Text>
          ) : null}

          {maintenanceTasks.length > 0 ? (
            <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
              <Text style={{ fontSize: typeScale.base, fontWeight: "600", color: colors.black }}>What&apos;s due next</Text>
              {maintenanceTasks.map((task) => (
                <View
                  key={task.id}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: spacing.xs,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.gray[100],
                  }}
                >
                  <Text style={{ fontSize: typeScale.sm, color: colors.black, flex: 1 }}>{task.task_name}</Text>
                  <Text
                    style={{
                      fontSize: typeScale.xs,
                      fontWeight: "600",
                      color: task.status === "due" || task.status === "overdue" ? colors.status.warning : colors.gray[700],
                    }}
                  >
                    {task.due_at_hours != null ? `${task.due_at_hours} hrs` : ""}
                    {task.due_at_hours != null && task.due_at_date ? " / " : ""}
                    {task.due_at_date ? formatDate(task.due_at_date) : ""}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Section>
      ) : null}

      <Section title="Photos">
        {uploadError ? (
          <Text style={{ fontSize: typeScale.xs, color: colors.status.danger, marginBottom: spacing.xs }}>{uploadError}</Text>
        ) : null}
        <FlatList
          horizontal
          data={photoUrls}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ gap: spacing.sm }}
          renderItem={({ item }) => (
            <Image source={{ uri: item.url }} style={{ width: 120, height: 120, borderRadius: radii.md }} />
          )}
          ListFooterComponent={
            <Pressable
              onPress={handleAddPhoto}
              disabled={isUploadingPhoto || isLoadingAccount}
              style={{
                width: 120,
                height: 120,
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: colors.gray[300],
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isUploadingPhoto ? (
                <ActivityIndicator color={colors.green[500]} />
              ) : (
                <Text style={{ color: colors.green[700], fontWeight: "600" }}>+ Add</Text>
              )}
            </Pressable>
          }
        />
        {pendingPhotos.length > 0 ? (
          <Text style={{ fontSize: typeScale.xs, color: colors.status.warning, marginTop: spacing.xs }}>
            {pendingPhotos.length} photo(s) queued — will upload when you&apos;re back online.
          </Text>
        ) : null}
      </Section>

      <Section title="Hours">
        <Text style={{ fontSize: typeScale.lg, color: colors.black, marginBottom: spacing.sm }}>
          {equipment.current_hours != null ? `${equipment.current_hours} hrs` : "No readings yet"}
        </Text>
        <HoursChart readings={readings} />
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
          <TextInput
            placeholder="Log new hours"
            placeholderTextColor={colors.gray[500]}
            keyboardType="decimal-pad"
            value={newHours}
            onChangeText={setNewHours}
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
            onPress={handleLogHours}
            disabled={!newHours || isLoggingHours}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.lg,
              minHeight: minTouchTarget,
              borderRadius: radii.md,
              backgroundColor: colors.green[500],
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed || !newHours || isLoggingHours ? 0.7 : 1,
            })}
          >
            <Text style={{ color: colors.white, fontWeight: "600" }}>Log</Text>
          </Pressable>
        </View>
      </Section>

      <Section title="Documents">
        {documents.map((doc) => (
          <Pressable key={doc.id} onPress={() => handleOpenDocument(doc)} style={{ paddingVertical: spacing.sm }}>
            <Text style={{ color: colors.green[700], fontSize: typeScale.base }}>{doc.file_name}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={handleAddDocument}
          style={({ pressed }) => ({
            minHeight: minTouchTarget,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.green[500],
            alignItems: "center",
            justifyContent: "center",
            marginTop: spacing.sm,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: colors.green[700], fontWeight: "600" }}>+ Add Document</Text>
        </Pressable>
      </Section>
    </ScrollView>
  );
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ fontSize: typeScale.lg, fontWeight: "700", color: colors.black, marginBottom: spacing.sm }}>{title}</Text>
      {children}
    </View>
  );
}

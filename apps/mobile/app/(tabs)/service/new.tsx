import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { colors, spacing, radii, typeScale, minTouchTarget } from "@proven-power/ui-tokens";
import type { Equipment, ServiceRequestType } from "@proven-power/shared-types";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import { useBusinessAccount } from "../../../lib/business-account";
import { uploadServiceRequestMedia } from "../../../lib/service-request-media";

const REQUEST_TYPES: { value: ServiceRequestType; label: string }[] = [
  { value: "drop_off", label: "Drop Off" },
  { value: "pickup_delivery", label: "Pickup & Delivery" },
];

const COMMON_SERVICES = [
  "Oil & Filter Change",
  "Annual Tune-Up",
  "Blade Sharpening / Replacement",
  "Belt Replacement",
  "Battery Replacement",
  "Air Filter Service",
  "Tire Repair / Flat",
  "Engine Won't Start",
  "Hydraulic Issue",
  "Fuel System Issue",
];

export default function NewServiceRequestScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<ServiceRequestType>("drop_off");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [mediaUris, setMediaUris] = useState<string[]>([]);
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

  async function pickMedia() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], quality: 0.9 });
    if (!result.canceled && result.assets[0]) {
      setMediaUris((prev) => [...prev, result.assets[0].uri]);
    }
  }

  async function handleSubmit() {
    if (!businessAccount || !session?.user) {
      setErrorMessage("Still loading your account — try again in a moment.");
      return;
    }
    if (!equipmentId) {
      setErrorMessage("Select which piece of equipment this is for.");
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);

    const fullDescription = [
      selectedServices.length > 0 ? `Services needed: ${selectedServices.join(", ")}` : null,
      description.trim() || null,
    ].filter(Boolean).join("\n\n");

    const { data: created, error } = await supabase
      .from("service_requests")
      .insert({
        business_account_id: businessAccount.id,
        equipment_id: equipmentId,
        requested_by_profile_id: session.user.id,
        request_type: requestType,
        description: fullDescription,
      })
      .select("*")
      .single();

    if (error || !created) {
      setErrorMessage(error?.message ?? "Failed to submit request.");
      setIsSubmitting(false);
      return;
    }

    for (const uri of mediaUris) {
      try {
        await uploadServiceRequestMedia({
          businessAccountId: businessAccount.id,
          serviceRequestId: created.id,
          localUri: uri,
          mediaType: uri.endsWith(".mov") || uri.endsWith(".mp4") ? "video" : "photo",
          uploadedByProfileId: session.user.id,
        });
      } catch {
        // Best-effort — service request itself is already saved.
      }
    }

    setIsSubmitting(false);
    router.replace(`/service/${created.id}`);
  }

  const canSubmit = (description.trim().length > 0 || selectedServices.length > 0) && !!equipmentId && !isSubmitting && !isLoadingAccount;

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

      <Text style={{ fontSize: typeScale.base, fontWeight: "600", color: colors.black, marginTop: spacing.sm }}>
        Request Type
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {REQUEST_TYPES.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setRequestType(option.value)}
            style={{
              paddingHorizontal: spacing.md,
              minHeight: minTouchTarget,
              justifyContent: "center",
              borderRadius: radii.pill,
              backgroundColor: requestType === option.value ? colors.green[500] : colors.gray[100],
            }}
          >
            <Text style={{ color: requestType === option.value ? colors.white : colors.black, fontWeight: "600" }}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ fontSize: typeScale.base, fontWeight: "600", color: colors.black, marginTop: spacing.sm }}>
        Common Services
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
        {COMMON_SERVICES.map((service) => {
          const isSelected = selectedServices.includes(service);
          return (
            <Pressable
              key={service}
              onPress={() =>
                setSelectedServices((prev) =>
                  isSelected ? prev.filter((s) => s !== service) : [...prev, service]
                )
              }
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: 6,
                borderRadius: radii.pill,
                borderWidth: 1,
                borderColor: isSelected ? colors.green[500] : colors.gray[300],
                backgroundColor: isSelected ? colors.green[500] : colors.white,
              }}
            >
              <Text style={{ color: isSelected ? colors.white : colors.gray[700], fontWeight: "500", fontSize: typeScale.sm }}>
                {isSelected ? "✓ " : ""}{service}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        placeholder="Describe the issue"
        placeholderTextColor={colors.gray[500]}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        style={{
          borderWidth: 1,
          borderColor: colors.gray[300],
          borderRadius: radii.md,
          padding: spacing.md,
          fontSize: typeScale.base,
          color: colors.black,
          backgroundColor: colors.gray[50],
          minHeight: 100,
          textAlignVertical: "top",
        }}
      />

      <Pressable
        onPress={pickMedia}
        style={{
          minHeight: minTouchTarget,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.green[500],
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: colors.green[700], fontWeight: "600" }}>
          + Add Photo/Video {mediaUris.length > 0 ? `(${mediaUris.length})` : ""}
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
        })}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={{ color: colors.white, fontSize: typeScale.lg, fontWeight: "600" }}>Submit Request</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

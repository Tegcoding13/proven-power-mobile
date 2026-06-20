import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { colors, spacing, radii, typeScale, minTouchTarget } from "@proven-power/ui-tokens";
import type { Equipment, PartsRequestType } from "@proven-power/shared-types";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { useBusinessAccount } from "../../lib/business-account";
import { uploadPartsRequestMedia } from "../../lib/parts-request-media";

const REQUEST_TYPES: { value: PartsRequestType; label: string }[] = [
  { value: "stock_check", label: "Is it in stock?" },
  { value: "part_order", label: "Order a Part" },
  { value: "broken_part_id", label: "Identify a Broken Part" },
];

export default function NewPartsRequestScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<PartsRequestType>("part_order");
  const [description, setDescription] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!businessAccount) return;
    supabase
      .from("equipment")
      .select("*")
      .eq("business_account_id", businessAccount.id)
      .is("deleted_at", null)
      .then(({ data }) => setEquipmentList(data ?? []));
  }, [businessAccount]);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  }

  async function handleSubmit() {
    if (!businessAccount || !session?.user) {
      setErrorMessage("Still loading your account — try again in a moment.");
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);

    const { data: created, error } = await supabase
      .from("parts_requests")
      .insert({
        business_account_id: businessAccount.id,
        equipment_id: equipmentId,
        requested_by_profile_id: session.user.id,
        request_type: requestType,
        description: description.trim(),
      })
      .select("*")
      .single();

    if (error || !created) {
      setErrorMessage(error?.message ?? "Failed to submit request.");
      setIsSubmitting(false);
      return;
    }

    if (photoUri) {
      try {
        await uploadPartsRequestMedia({
          businessAccountId: businessAccount.id,
          partsRequestId: created.id,
          localUri: photoUri,
          uploadedByProfileId: session.user.id,
        });
      } catch {
        // Best-effort
      }
    }

    setIsSubmitting(false);
    router.replace(`/parts/${created.id}`);
  }

  const canSubmit = description.trim().length > 0 && !isSubmitting && !isLoadingAccount;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.white }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Text style={{ fontSize: typeScale.base, fontWeight: "600", color: colors.black }}>Request Type</Text>
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

      {equipmentList.length > 0 ? (
        <>
          <Text style={{ fontSize: typeScale.base, fontWeight: "600", color: colors.black, marginTop: spacing.sm }}>
            Equipment (optional)
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {equipmentList.map((eq) => (
              <Pressable
                key={eq.id}
                onPress={() => setEquipmentId(equipmentId === eq.id ? null : eq.id)}
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
        </>
      ) : null}

      <TextInput
        placeholder="What part do you need?"
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
        onPress={pickPhoto}
        style={{
          minHeight: minTouchTarget,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.green[500],
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: colors.green[700], fontWeight: "600" }}>{photoUri ? "Photo Added ✓" : "+ Add Photo"}</Text>
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

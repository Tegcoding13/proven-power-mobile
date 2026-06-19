import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { colors, spacing, radii, typeScale, minTouchTarget } from "@proven-power/ui-tokens";
import type { EquipmentCategory } from "@proven-power/shared-types";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import { useBusinessAccount } from "../../../lib/business-account";
import { uploadEquipmentPhoto } from "../../../lib/equipment-photos";
import { enqueuePendingPhoto } from "../../../lib/photo-outbox";

const CATEGORIES: { value: EquipmentCategory; label: string }[] = [
  { value: "tractor", label: "Tractor" },
  { value: "mower", label: "Mower" },
  { value: "utility_vehicle", label: "Utility Vehicle" },
  { value: "attachment", label: "Attachment" },
  { value: "other", label: "Other" },
];

export default function AddEquipmentScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();

  const [model, setModel] = useState("");
  const [modelYear, setModelYear] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [nickname, setNickname] = useState("");
  const [category, setCategory] = useState<EquipmentCategory>("tractor");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function handleSave() {
    if (!businessAccount || !session?.user) {
      setErrorMessage("Still loading your account — try again in a moment.");
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);

    const { data: created, error } = await supabase
      .from("equipment")
      .insert({
        business_account_id: businessAccount.id,
        added_by_profile_id: session.user.id,
        model: model.trim(),
        model_year: modelYear ? Number(modelYear) : null,
        serial_number: serialNumber.trim() || null,
        nickname: nickname.trim() || null,
        category,
      })
      .select("*")
      .single();

    if (error || !created) {
      setErrorMessage(error?.message ?? "Failed to add equipment.");
      setIsSubmitting(false);
      return;
    }

    if (photoUri) {
      try {
        await uploadEquipmentPhoto({
          businessAccountId: businessAccount.id,
          equipmentId: created.id,
          localUri: photoUri,
          uploadedByProfileId: session.user.id,
        });
      } catch {
        await enqueuePendingPhoto({
          businessAccountId: businessAccount.id,
          equipmentId: created.id,
          localUri: photoUri,
          uploadedByProfileId: session.user.id,
        });
      }
    }

    setIsSubmitting(false);
    router.replace(`/garage/${created.id}`);
  }

  const canSave = model.trim().length > 0 && !isSubmitting && !isLoadingAccount;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.white }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Pressable
        onPress={pickPhoto}
        style={{
          height: 160,
          borderRadius: radii.md,
          backgroundColor: colors.gray[50],
          borderWidth: 1,
          borderColor: colors.gray[300],
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={{ width: "100%", height: "100%" }} />
        ) : (
          <Text style={{ color: colors.gray[700], fontSize: typeScale.base }}>Tap to add a photo</Text>
        )}
      </Pressable>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {CATEGORIES.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setCategory(option.value)}
            style={{
              paddingHorizontal: spacing.md,
              minHeight: minTouchTarget,
              justifyContent: "center",
              borderRadius: radii.pill,
              backgroundColor: category === option.value ? colors.green[500] : colors.gray[100],
            }}
          >
            <Text style={{ color: category === option.value ? colors.white : colors.black, fontWeight: "600" }}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        placeholder="Model (e.g. 1025R)"
        placeholderTextColor={colors.gray[500]}
        value={model}
        onChangeText={setModel}
        style={inputStyle}
      />
      <TextInput
        placeholder="Model year"
        placeholderTextColor={colors.gray[500]}
        keyboardType="number-pad"
        value={modelYear}
        onChangeText={setModelYear}
        style={inputStyle}
      />
      <TextInput
        placeholder="Serial number"
        placeholderTextColor={colors.gray[500]}
        autoCapitalize="characters"
        value={serialNumber}
        onChangeText={setSerialNumber}
        style={inputStyle}
      />
      <TextInput
        placeholder="Nickname (optional)"
        placeholderTextColor={colors.gray[500]}
        value={nickname}
        onChangeText={setNickname}
        style={inputStyle}
      />

      {errorMessage ? <Text style={{ color: colors.status.danger, fontSize: typeScale.sm }}>{errorMessage}</Text> : null}

      <Pressable
        onPress={handleSave}
        disabled={!canSave}
        style={({ pressed }) => ({
          minHeight: minTouchTarget,
          borderRadius: radii.md,
          backgroundColor: colors.green[500],
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed || !canSave ? 0.7 : 1,
          marginBottom: spacing.xl,
        })}
      >
        {isSubmitting || isLoadingAccount ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={{ color: colors.white, fontSize: typeScale.lg, fontWeight: "600" }}>Save Equipment</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.gray[300],
  borderRadius: radii.md,
  paddingHorizontal: spacing.md,
  minHeight: minTouchTarget,
  fontSize: typeScale.base,
  color: colors.black,
  backgroundColor: colors.gray[50],
};

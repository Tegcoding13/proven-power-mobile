import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing, radii, typeScale, minTouchTarget } from "@proven-power/ui-tokens";
import type { MessageDepartment } from "@proven-power/shared-types";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import { useBusinessAccount } from "../../../lib/business-account";

const DEPARTMENTS: { value: MessageDepartment; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "service", label: "Service" },
  { value: "parts", label: "Parts" },
  { value: "office", label: "Office" },
];

export default function NewMessageScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();

  const [department, setDepartment] = useState<MessageDepartment>("service");
  const [body, setBody] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!businessAccount || !session?.user) {
      setErrorMessage("Still loading your account — try again in a moment.");
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);

    const { data: thread, error: threadError } = await supabase
      .from("message_threads")
      .insert({ business_account_id: businessAccount.id, department })
      .select("*")
      .single();

    if (threadError || !thread) {
      setErrorMessage(threadError?.message ?? "Failed to start conversation.");
      setIsSubmitting(false);
      return;
    }

    await supabase.from("messages").insert({
      thread_id: thread.id,
      sender_profile_id: session.user.id,
      sender_type: "customer",
      body: body.trim(),
    });

    setIsSubmitting(false);
    router.replace(`/messages/${thread.id}`);
  }

  const canSubmit = body.trim().length > 0 && !isSubmitting && !isLoadingAccount;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.white }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Text style={{ fontSize: typeScale.base, fontWeight: "600", color: colors.black }}>Department</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {DEPARTMENTS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setDepartment(option.value)}
            style={{
              paddingHorizontal: spacing.md,
              minHeight: minTouchTarget,
              justifyContent: "center",
              borderRadius: radii.pill,
              backgroundColor: department === option.value ? colors.green[500] : colors.gray[100],
            }}
          >
            <Text style={{ color: department === option.value ? colors.white : colors.black, fontWeight: "600" }}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        placeholder="What can we help with?"
        placeholderTextColor={colors.gray[500]}
        value={body}
        onChangeText={setBody}
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
        })}
      >
        {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={{ color: colors.white, fontSize: typeScale.lg, fontWeight: "600" }}>Send</Text>}
      </Pressable>
    </ScrollView>
  );
}

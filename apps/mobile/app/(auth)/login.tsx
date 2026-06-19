import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Link } from "expo-router";
import { colors, spacing, radii, typeScale, minTouchTarget } from "@proven-power/ui-tokens";
import { supabase } from "../../lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin() {
    setErrorMessage(null);
    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);
    if (error) setErrorMessage(error.message);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.white }}
    >
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <Text style={{ fontSize: typeScale.display, fontWeight: "700", color: colors.green[700], marginBottom: spacing.sm }}>
          Proven Power
        </Text>
        <Text style={{ fontSize: typeScale.lg, color: colors.black, marginBottom: spacing.md }}>Log in</Text>

        <TextInput
          placeholder="Email"
          placeholderTextColor={colors.gray[500]}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={inputStyle}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor={colors.gray[500]}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={inputStyle}
        />

        {errorMessage ? (
          <Text style={{ color: colors.status.danger, fontSize: typeScale.sm }}>{errorMessage}</Text>
        ) : null}

        <Pressable
          onPress={handleLogin}
          disabled={isSubmitting || !email || !password}
          style={({ pressed }) => ({
            backgroundColor: colors.green[500],
            opacity: pressed || isSubmitting || !email || !password ? 0.7 : 1,
            minHeight: minTouchTarget,
            borderRadius: radii.md,
            alignItems: "center",
            justifyContent: "center",
            marginTop: spacing.sm,
          })}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={{ color: colors.white, fontSize: typeScale.lg, fontWeight: "600" }}>Log In</Text>
          )}
        </Pressable>

        <Link href="/(auth)/signup" style={{ textAlign: "center", marginTop: spacing.md, fontSize: typeScale.base, color: colors.green[600] }}>
          New here? Create an account
        </Link>
      </View>
    </KeyboardAvoidingView>
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

import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { colors, spacing, radii, typeScale, minTouchTarget } from "@proven-power/ui-tokens";
import type { BusinessAccountMember, BusinessAccountRole } from "@proven-power/shared-types";
import { supabase } from "../../lib/supabase";
import { useBusinessAccount } from "../../lib/business-account";

type MemberWithName = BusinessAccountMember & { fullName: string | null };

const ROLES: BusinessAccountRole[] = ["owner", "manager", "operator"];

export default function TeamScreen() {
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();
  const [members, setMembers] = useState<MemberWithName[]>([]);
  const [myRole, setMyRole] = useState<BusinessAccountRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BusinessAccountRole>("operator");
  const [isInviting, setIsInviting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessAccount) return;
    const { data: userData } = await supabase.auth.getUser();

    const { data: memberRows } = await supabase
      .from("business_account_members")
      .select("*")
      .eq("business_account_id", businessAccount.id)
      .order("created_at", { ascending: true });

    const mine = (memberRows ?? []).find((m) => m.profile_id === userData.user?.id);
    setMyRole(mine?.role ?? null);

    const profileIds = (memberRows ?? []).map((m) => m.profile_id).filter((id): id is string => !!id);
    const { data: profileRows } = profileIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameById = new Map((profileRows ?? []).map((p) => [p.id, p.full_name]));

    setMembers((memberRows ?? []).map((m) => ({ ...m, fullName: m.profile_id ? (nameById.get(m.profile_id) ?? null) : null })));
    setIsLoading(false);
  }, [businessAccount]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleInvite() {
    if (!businessAccount || !email.trim()) return;
    setIsInviting(true);
    setErrorMessage(null);

    const { error } = await supabase.rpc("invite_team_member", {
      p_business_account_id: businessAccount.id,
      p_email: email.trim(),
      p_role: role,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsInviting(false);
      return;
    }

    setEmail("");
    setIsInviting(false);
    load();
  }

  function handleRemove(memberId: string) {
    Alert.alert("Remove Team Member", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("business_account_members").delete().eq("id", memberId);
          if (error) setErrorMessage(error.message);
          load();
        },
      },
    ]);
  }

  async function handleRoleChange(memberId: string, newRole: BusinessAccountRole) {
    const { error } = await supabase.from("business_account_members").update({ role: newRole }).eq("id", memberId);
    if (error) setErrorMessage(error.message);
    load();
  }

  const canManage = myRole === "owner";

  if (isLoadingAccount || isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.green[500]} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.white }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      {errorMessage ? <Text style={{ color: colors.status.danger, fontSize: typeScale.sm }}>{errorMessage}</Text> : null}

      {canManage ? (
        <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.gray[100] }}>
          <Text style={{ fontWeight: "700", color: colors.black }}>Invite a Team Member</Text>
          <TextInput
            placeholder="Email address"
            placeholderTextColor={colors.gray[500]}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{
              minHeight: minTouchTarget,
              borderWidth: 1,
              borderColor: colors.gray[300],
              borderRadius: radii.md,
              paddingHorizontal: spacing.md,
              fontSize: typeScale.base,
              color: colors.black,
              backgroundColor: colors.gray[50],
            }}
          />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {ROLES.map((option) => (
              <Pressable
                key={option}
                onPress={() => setRole(option)}
                style={{
                  flex: 1,
                  minHeight: minTouchTarget,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radii.md,
                  backgroundColor: role === option ? colors.green[500] : colors.gray[100],
                }}
              >
                <Text style={{ color: role === option ? colors.white : colors.black, fontWeight: "600", textTransform: "capitalize" }}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={handleInvite}
            disabled={!email.trim() || isInviting}
            style={{
              minHeight: minTouchTarget,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radii.md,
              backgroundColor: colors.green[500],
              opacity: !email.trim() || isInviting ? 0.7 : 1,
            }}
          >
            <Text style={{ color: colors.white, fontWeight: "700" }}>{isInviting ? "Sending..." : "Invite"}</Text>
          </Pressable>
        </View>
      ) : null}

      {members.map((member) => (
        <View
          key={member.id}
          style={{ padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.gray[100], gap: spacing.xs }}
        >
          <Text style={{ fontWeight: "700", color: colors.black }}>
            {member.fullName ?? member.invited_email ?? "Pending"}
            {member.status === "invited" ? <Text style={{ color: colors.status.warning, fontSize: typeScale.xs }}>  · Invite pending</Text> : null}
          </Text>
          <Text style={{ color: colors.gray[700], textTransform: "capitalize" }}>{member.role}</Text>
          {canManage && member.role !== "owner" ? (
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
              {ROLES.filter((r) => r !== "owner").map((option) => (
                <Pressable
                  key={option}
                  onPress={() => handleRoleChange(member.id, option)}
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 6,
                    borderRadius: radii.pill,
                    backgroundColor: member.role === option ? colors.green[500] : colors.gray[100],
                  }}
                >
                  <Text style={{ fontSize: typeScale.xs, color: member.role === option ? colors.white : colors.black, textTransform: "capitalize" }}>
                    {option}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => handleRemove(member.id)}
                style={{ paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.status.danger }}
              >
                <Text style={{ fontSize: typeScale.xs, color: colors.status.danger, fontWeight: "600" }}>Remove</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

import { useCallback, useState } from "react";
import { View, Text, FlatList, TextInput, Pressable, Image, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { colors, spacing, radii, typeScale, minTouchTarget } from "@proven-power/ui-tokens";
import type { Message, MessageAttachment } from "@proven-power/shared-types";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import { useBusinessAccount } from "../../../lib/business-account";
import { uploadMessageAttachment, getSignedMessageAttachmentUrl } from "../../../lib/message-attachments";

type MessageWithAttachments = Message & { attachments: { id: string; url: string }[] };

export default function ThreadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { businessAccount } = useBusinessAccount();

  const [messages, setMessages] = useState<MessageWithAttachments[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const load = useCallback(async () => {
    if (!id || !session?.user) return;
    setIsLoading(true);

    const { data: messageRows } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", id)
      .order("created_at", { ascending: true });

    const messageIds = (messageRows ?? []).map((m) => m.id);
    const { data: attachmentRows } = messageIds.length
      ? await supabase.from("message_attachments").select("*").in("message_id", messageIds)
      : { data: [] as MessageAttachment[] };

    const attachmentsByMessage = new Map<string, MessageAttachment[]>();
    for (const att of attachmentRows ?? []) {
      const list = attachmentsByMessage.get(att.message_id) ?? [];
      list.push(att);
      attachmentsByMessage.set(att.message_id, list);
    }

    const enriched = await Promise.all(
      (messageRows ?? []).map(async (m) => ({
        ...m,
        attachments: (
          await Promise.all(
            (attachmentsByMessage.get(m.id) ?? []).map(async (a) => ({
              id: a.id,
              url: await getSignedMessageAttachmentUrl(a.storage_path),
            }))
          )
        ).filter((a): a is { id: string; url: string } => Boolean(a.url)),
      }))
    );
    setMessages(enriched);
    setIsLoading(false);

    // Mark messages not sent by me as read.
    const unread = (messageRows ?? []).filter((m) => m.sender_profile_id !== session.user.id);
    if (unread.length > 0) {
      await supabase
        .from("message_read_receipts")
        .upsert(
          unread.map((m) => ({ message_id: m.id, profile_id: session.user.id })),
          { onConflict: "message_id,profile_id", ignoreDuplicates: true }
        );
    }
  }, [id, session?.user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleSend() {
    if (!id || !session?.user || !body.trim()) return;
    setIsSending(true);
    await supabase.from("messages").insert({
      thread_id: id,
      sender_profile_id: session.user.id,
      sender_type: "customer",
      body: body.trim(),
    });
    setBody("");
    setIsSending(false);
    load();
  }

  async function handleAttach() {
    if (!id || !businessAccount || !session?.user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;

    const { data: message } = await supabase
      .from("messages")
      .insert({ thread_id: id, sender_profile_id: session.user.id, sender_type: "customer", body: null })
      .select("*")
      .single();

    if (message) {
      await uploadMessageAttachment({
        businessAccountId: businessAccount.id,
        threadId: id,
        messageId: message.id,
        localUri: result.assets[0].uri,
        fileName: `photo-${Date.now()}.jpg`,
        mediaType: "photo",
        mimeType: "image/jpeg",
      });
    }
    load();
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.green[500]} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.white }}
    >
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        renderItem={({ item }) => {
          const isMine = item.sender_type === "customer";
          return (
            <View style={{ alignItems: isMine ? "flex-end" : "flex-start" }}>
              <View
                style={{
                  maxWidth: "80%",
                  backgroundColor: item.is_quote ? "#FCE8CC" : isMine ? colors.green[500] : colors.gray[100],
                  borderRadius: radii.md,
                  padding: spacing.md,
                }}
              >
                {item.is_quote ? <Text style={{ fontSize: typeScale.xs, fontWeight: "700", color: colors.status.warning, marginBottom: spacing.xs }}>QUOTE</Text> : null}
                {item.body ? (
                  <Text style={{ color: isMine && !item.is_quote ? colors.white : colors.black, fontSize: typeScale.base }}>
                    {item.body}
                  </Text>
                ) : null}
                {item.attachments.map((a) => (
                  <Image key={a.id} source={{ uri: a.url }} style={{ width: 160, height: 160, borderRadius: radii.sm, marginTop: spacing.xs }} />
                ))}
              </View>
              <Text style={{ fontSize: typeScale.xs, color: colors.gray[500], marginTop: 2 }}>
                {new Date(item.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </Text>
            </View>
          );
        }}
      />

      <View style={{ flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.gray[100] }}>
        <Pressable onPress={handleAttach} style={{ width: minTouchTarget, height: minTouchTarget, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: typeScale.xl }}>📎</Text>
        </Pressable>
        <TextInput
          placeholder="Message..."
          placeholderTextColor={colors.gray[500]}
          value={body}
          onChangeText={setBody}
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
          onPress={handleSend}
          disabled={!body.trim() || isSending}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.lg,
            minHeight: minTouchTarget,
            borderRadius: radii.md,
            backgroundColor: colors.green[500],
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed || !body.trim() || isSending ? 0.7 : 1,
          })}
        >
          <Text style={{ color: colors.white, fontWeight: "600" }}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

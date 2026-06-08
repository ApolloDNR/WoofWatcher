import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  deriveCareDayStatus,
  deriveCareHandoff,
  deriveHealthWatch,
  normalizeCareEventType,
} from "@workspace/care-domain";
import { useColors } from "@/hooks/useColors";
import { useCare, CareState } from "@/context/CareContext";
import {
  deriveWoofGuideActions,
  type WoofGuideActionCard,
  type WoofGuideActionIcon,
} from "@/lib/woofGuideActions";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const ACTION_ICON: Record<WoofGuideActionIcon, IoniconName> = {
  bowl: "restaurant-outline",
  calendar: "calendar-outline",
  heart: "medkit-outline",
  paw: "paw-outline",
  records: "folder-open-outline",
  spark: "sparkles-outline",
};

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

function buildAssistantContext(state: CareState) {
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  const todayEntries = state.entries.filter((e) => e.occurredAt.startsWith(today));
  const normalizedType = (entry: CareState["entries"][number]) =>
    normalizeCareEventType(entry.type, entry.details);
  const sortedEntries = [...state.entries].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const meals = sortedEntries.filter((e) => normalizedType(e) === "meal");
  const walks = sortedEntries.filter((e) => normalizedType(e) === "walk");
  const lastMeal = meals[0] ?? null;
  const lastWalk = walks[0] ?? null;
  const dayStatus = deriveCareDayStatus(state.entries, state.routines, now);
  const healthWatch = deriveHealthWatch({
    entries: state.entries,
    routines: state.routines,
    now,
  });
  const handoffSummary = deriveCareHandoff({
    entries: state.entries,
    routines: state.routines,
    caregivers: state.caregivers,
    now,
  });

  return {
    profile: {
      name: state.profile.name,
      breed: state.profile.breed,
      background: state.profile.background,
      careFocus: state.profile.careFocus,
      weight: state.profile.weight,
      vetBoundary: state.profile.vetBoundary,
    },
    summary: {
      totalEntries: state.entries.length,
      todayEntries: todayEntries.length,
      meals: dayStatus.counts.meals.done,
      walks: dayStatus.counts.walks.done,
      vomitIncidents: healthWatch.counts.vomit30,
    },
    healthWatch: {
      status: healthWatch.status,
      label: healthWatch.status === "good" ? "No concerns" : healthWatch.summary,
      summary: healthWatch.summary,
      signals: healthWatch.signals.slice(0, 4),
      redFlags: healthWatch.redFlags,
      counts: healthWatch.counts,
      vetBoundary: healthWatch.vetBoundary,
    },
    todayPlan: {
      dateLabel: today,
      completedCount: todayEntries.length,
      totalCount: state.routines.length,
      nextItems: handoffSummary.next
        ? [{
            label: handoffSummary.next.label,
            time: handoffSummary.next.time,
            owner: handoffSummary.next.owner,
            note: handoffSummary.next.note,
          }]
        : [],
    },
    handoff: {
      nextRoutine: handoffSummary.next
        ? {
            label: handoffSummary.next.label,
            time: handoffSummary.next.time,
            owner: handoffSummary.next.owner,
          }
        : null,
      lastMeal,
      lastWalk,
      followUps: state.entries.filter((e) => e.severity === "watch" || e.severity === "urgent").slice(0, 3),
      caregiverLoad: handoffSummary.caregiverLoad,
      sections: handoffSummary.sections,
      message: handoffSummary.message,
    },
    latest: sortedEntries.slice(0, 5),
    dietProfile: state.dietProfile,
  };
}

export default function WoofGuideScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useCare();
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const name = state.profile.name || "your dog";

  const quickQuestions = useMemo(() => [
    `Why does ${name} vomit yellow bile?`,
    `How much should ${name} eat?`,
    "Tips for food anxiety in dogs",
    "How to help a nervous eater",
  ], [name]);

  const actionCards = useMemo(() => deriveWoofGuideActions(state), [state]);

  const sendMessage = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: q };
    setMessages((prev) => [userMsg, ...prev]);
    setInput("");
    setLoading(true);

    try {
      const token = await getToken();
      const context = buildAssistantContext(state);
      const res = await fetch(`${BASE_URL}/api/care-helper`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: q, context }),
      });
      const data = await res.json();
      const answer = data.answer || "No response received.";
      setMessages((prev) => [{ id: `a_${Date.now()}`, role: "assistant", content: answer }, ...prev]);
    } catch {
      setMessages((prev) => [
        { id: `err_${Date.now()}`, role: "assistant", content: "Unable to connect to care assistant. Check that the API server is running." },
        ...prev,
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, state, getToken]);

  const runAction = useCallback((action: WoofGuideActionCard) => {
    Haptics.selectionAsync();
    if (action.route) {
      router.push(action.route);
      return;
    }
    if (action.prompt) {
      void sendMessage(action.prompt);
    }
  }, [router, sendMessage]);

  return (
    <>
      <Stack.Screen options={{ title: "WoofGuide", headerBackTitle: "More" }} />
      <KeyboardAvoidingView
        style={[s.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <FlatList
          data={messages}
          inverted
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: loading ? 8 : 12 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            loading ? (
              <View style={[s.typingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.copper} />
                <Text style={[s.typingText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Thinking…</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={s.emptyArea}>
                <View style={s.emptyIconContainer}>
                  <Image source={require("@/assets/images/phoenix-avatar.png")} style={s.avatar} />
                </View>
                <Text style={[s.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Ask me anything</Text>
                <Text style={[s.emptySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Get help with {name}'s care, diet, anxiety, and more.
                </Text>
                <View style={s.quickRow}>
                  {quickQuestions.map((q) => (
                    <Pressable
                      key={q}
                      onPress={() => sendMessage(q)}
                      style={({pressed}) => [s.quickChip, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Text style={[s.quickText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{q}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={s.actionArea}>
                  <Text style={[s.actionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Suggested actions</Text>
                  {actionCards.map((action) => {
                    const tone =
                      action.urgency === "alert"
                        ? colors.rose
                        : action.urgency === "watch"
                          ? colors.amber
                          : colors.primary;
                    return (
                      <Pressable
                        key={action.id}
                        onPress={() => runAction(action)}
                        style={({ pressed }) => [
                          s.actionCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: action.urgency === "normal" ? colors.border : tone + "66",
                            opacity: pressed ? 0.75 : 1,
                          },
                        ]}
                      >
                        <View style={[s.actionIcon, { backgroundColor: tone + "16" }]}>
                          <Ionicons name={ACTION_ICON[action.icon]} size={17} color={tone} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.actionLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{action.label}</Text>
                          <Text style={[s.actionDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{action.detail}</Text>
                        </View>
                        <Ionicons name={action.route ? "chevron-forward" : "arrow-up"} size={17} color={tone} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={[
              s.bubble,
              item.role === "user"
                ? [s.userBubble, { backgroundColor: colors.copper }]
                : [s.assistantBubble, { backgroundColor: colors.card, borderColor: colors.border }],
            ]}>
              <Text style={[s.bubbleText, { color: item.role === "user" ? "#fff" : colors.foreground, fontFamily: "Inter_400Regular" }]}>
                {item.content}
              </Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
        <View style={[s.inputArea, { borderTopColor: colors.border, paddingBottom: bottomInset + 12, backgroundColor: colors.background }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={`Ask about ${state.profile.name}…`}
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(input)}
            blurOnSubmit
          />
          <Pressable
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={[s.sendBtn, { backgroundColor: input.trim() && !loading ? colors.primary : colors.card, borderColor: colors.border }]}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="arrow-up" size={20} color={input.trim() ? "#fff" : colors.mutedForeground} />
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  emptyArea: { alignItems: "center", paddingTop: 40, gap: 10 },
  emptyIconContainer: { width: 80, height: 80, borderRadius: 40, overflow: "hidden", marginBottom: 8, borderWidth: 4, borderColor: "#fff", shadowColor: "#2E5846", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
  avatar: { width: "100%", height: "100%" },
  emptyTitle: { fontSize: 20 },
  emptySub: { fontSize: 15, textAlign: "center", paddingHorizontal: 24, lineHeight: 22 },
  quickRow: { width: "100%", gap: 10, paddingHorizontal: 12, marginTop: 16 },
  quickChip: { borderRadius: 14, borderWidth: 1, padding: 14, shadowColor: "#2E5846", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
  quickText: { fontSize: 14, lineHeight: 20 },
  actionArea: { width: "100%", gap: 10, paddingHorizontal: 12, marginTop: 14 },
  actionTitle: { fontSize: 15, marginLeft: 2 },
  actionCard: { flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 16, borderWidth: 1, padding: 13, shadowColor: "#2E5846", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
  actionIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 14.5 },
  actionDetail: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  bubble: { maxWidth: "86%", borderRadius: 20, padding: 14, shadowColor: "#2E5846", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  userBubble: { alignSelf: "flex-end", borderBottomRightRadius: 6 },
  assistantBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 6, borderWidth: 1 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  typingBubble: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 20, borderWidth: 1, padding: 12, marginBottom: 8 },
  typingText: { fontSize: 14 },
  inputArea: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 15, maxHeight: 120, minHeight: 48 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});

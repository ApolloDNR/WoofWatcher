import { Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import React, { useCallback, useState } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCare, CareState } from "@/context/CareContext";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

const QUICK_QUESTIONS = [
  "Why does Phoenix vomit yellow bile?",
  "How much should Phoenix eat?",
  "Tips for food anxiety in dogs",
  "How to help a nervous eater",
];

function buildAssistantContext(state: CareState) {
  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = state.entries.filter((e) => e.occurredAt.startsWith(today));
  const meals = state.entries.filter((e) => e.type === "meal");
  const walks = state.entries.filter((e) => e.type === "walk");
  const vomitIncidents = state.entries.filter((e) => e.type === "vomit");
  const lastMeal = meals[0] ?? null;
  const lastWalk = walks[0] ?? null;

  const now = Date.now();
  const nextRoutine = state.routines.find((r) => {
    const [time, period] = r.time.split(" ");
    const [hStr, mStr] = time.split(":");
    let h = parseInt(hStr, 10);
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    const routineMs = new Date().setHours(h, parseInt(mStr || "0", 10), 0, 0);
    return routineMs > now;
  }) ?? state.routines[0];

  const caregiverLoad = state.caregivers.map((c) => ({
    name: c.name,
    role: c.role,
    todayLogs: state.entries.filter((e) => e.caregiver === c.name && e.occurredAt.startsWith(today)).length,
    latestAction: state.entries.find((e) => e.caregiver === c.name)?.title ?? "",
  }));

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
      meals: meals.length,
      walks: walks.length,
      vomitIncidents: vomitIncidents.length,
    },
    healthWatch: {
      status: vomitIncidents.length > 2 ? "watch" : "normal",
      label: vomitIncidents.length > 2 ? "Bile pattern present" : "No concerns",
      signals: vomitIncidents.slice(0, 3).map((e) => e.note ?? e.title),
      redFlags: vomitIncidents.filter((e) => e.severity === "urgent").map((e) => e.title),
    },
    todayPlan: {
      dateLabel: today,
      completedCount: todayEntries.length,
      totalCount: state.routines.length,
      nextItems: nextRoutine ? [{ label: nextRoutine.label, time: nextRoutine.time, owner: nextRoutine.owner, note: nextRoutine.note }] : [],
    },
    handoff: {
      nextRoutine: nextRoutine ? { label: nextRoutine.label, time: nextRoutine.time, owner: nextRoutine.owner } : null,
      lastMeal,
      lastWalk,
      followUps: state.entries.filter((e) => e.severity === "watch" || e.severity === "urgent").slice(0, 3),
      caregiverLoad,
      message: `${caregiverLoad[0]?.todayLogs ?? 0} logs today.`,
    },
    latest: state.entries.slice(0, 5),
  };
}

export default function WoofGuideScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useCare();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const sendMessage = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: q };
    setMessages((prev) => [userMsg, ...prev]);
    setInput("");
    setLoading(true);

    try {
      const context = buildAssistantContext(state);
      const res = await fetch(`${BASE_URL}/api/care-helper`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
  }, [loading, state]);

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
                <View style={[s.emptyIcon, { backgroundColor: colors.copper + "1a" }]}>
                  <Ionicons name="paw" size={28} color={colors.copper} />
                </View>
                <Text style={[s.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Ask me anything</Text>
                <Text style={[s.emptySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Get help with Phoenix's care, diet, anxiety, and more.
                </Text>
                <View style={s.quickRow}>
                  {QUICK_QUESTIONS.map((q) => (
                    <Pressable
                      key={q}
                      onPress={() => sendMessage(q)}
                      style={[s.quickChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <Text style={[s.quickText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{q}</Text>
                    </Pressable>
                  ))}
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
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
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
            style={[s.sendBtn, { backgroundColor: input.trim() && !loading ? colors.copper : colors.card, borderColor: colors.border }]}
          >
            {loading
              ? <ActivityIndicator size="small" color={colors.copper} />
              : <Feather name="arrow-up" size={18} color={input.trim() ? "#fff" : colors.mutedForeground} />
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
  emptyIcon: { width: 60, height: 60, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 18 },
  emptySub: { fontSize: 14, textAlign: "center", paddingHorizontal: 24, lineHeight: 20 },
  quickRow: { width: "100%", gap: 8, paddingHorizontal: 8, marginTop: 8 },
  quickChip: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
  quickText: { fontSize: 13, lineHeight: 18 },
  bubble: { maxWidth: "86%", borderRadius: 16, padding: 12 },
  userBubble: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  assistantBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  typingBubble: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 10, marginBottom: 8 },
  typingText: { fontSize: 13 },
  inputArea: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100, minHeight: 44 },
  sendBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
});

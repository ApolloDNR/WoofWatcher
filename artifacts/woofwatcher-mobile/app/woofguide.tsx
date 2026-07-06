import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useWoofAuth } from "@/lib/auth";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
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
import { BoardCard, BoardPill, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import { SpriteSheetPlayer } from "@/components/SpriteSheetPlayer";
import { CARE_TWIN_SPRITE_MANIFEST } from "@/lib/avatarLifeEngine";
import { CARE_TWIN_ROOM_VARIANT_ASSETS, getCareTwinSpriteAsset } from "@/lib/careTwinAssets";
import {
  getDockedComposerBottomPadding,
  getKeyboardAvoidingVerticalOffset,
  getModalSheetBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import { pixelImageStyle } from "@/lib/pixelRendering";
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

const DISPLAY_SEMI = "Fredoka_600SemiBold";
const WOOFGUIDE_STAGE_ROOM = CARE_TWIN_ROOM_VARIANT_ASSETS.night.source;
const WOOFGUIDE_STAGE_SPRITE = getCareTwinSpriteAsset("idle-breathe");
const WOOFGUIDE_STAGE_TRACK = CARE_TWIN_SPRITE_MANIFEST["idle-breathe"];

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
  const { state, addEntry, updateCareDoc } = useCare();
  const { getToken } = useWoofAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewAction, setReviewAction] = useState<WoofGuideActionCard | null>(null);
  const composerBottomPadding = getDockedComposerBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const modalSheetBottomPadding = getModalSheetBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const keyboardOffset = getKeyboardAvoidingVerticalOffset({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "standalone",
  });
  const name = state.profile.name || "your dog";

  const quickQuestions = useMemo(() => [
    `Why does ${name} vomit yellow bile?`,
    `How much should ${name} eat?`,
    "Tips for food anxiety in dogs",
    "How to help a nervous eater",
  ], [name]);

  const actionCards = useMemo(() => deriveWoofGuideActions(state), [state]);
  const ownerDraftCount = actionCards.filter((action) => action.draft).length;
  const watchActionCount = actionCards.filter(
    (action) => action.urgency === "watch" || action.urgency === "alert",
  ).length;
  const guideSignal = Math.max(1, Math.min(5, actionCards.length || 1));
  const guideSpeech =
    actionCards[0]?.detail ??
    `Ask about ${name}'s care. I can summarize logs and prepare owner-reviewed next steps.`;
  const guideHud = [
    {
      label: "Actions",
      value: String(actionCards.length),
      tone: colors.primary,
    },
    {
      label: "Review",
      value: String(ownerDraftCount),
      tone: ownerDraftCount > 0 ? colors.amber : colors.sage,
    },
    {
      label: "Watch",
      value: String(watchActionCount),
      tone: watchActionCount > 0 ? colors.amber : colors.sage,
    },
    {
      label: "Boundary",
      value: "Vet-safe",
      tone: colors.blueSignal,
    },
  ];

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
    if (action.draft) {
      setReviewAction(action);
      return;
    }
    if (action.route) {
      router.push(action.route);
      return;
    }
    if (action.prompt) {
      void sendMessage(action.prompt);
    }
  }, [router, sendMessage]);

  const applyDraft = useCallback(() => {
    const draft = reviewAction?.draft;
    if (!draft) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (draft.kind === "log_entry" && draft.entry) {
      addEntry(draft.entry);
      setMessages((prev) => [
        { id: `draft_${Date.now()}`, role: "assistant", content: `${draft.title}\n\nAdded reviewed log draft to the household timeline.` },
        ...prev,
      ]);
      setReviewAction(null);
      return;
    }

    if (draft.kind === "reminder" && draft.calendarEvent) {
      const event = {
        id: `woofguide_${Date.now()}`,
        ...draft.calendarEvent,
      };
      updateCareDoc((doc) => ({
        ...doc,
        calendarEvents: [
          event,
          ...doc.calendarEvents.filter((item) => item.id !== event.id),
        ],
      }));
      setMessages((prev) => [
        { id: `draft_${Date.now()}`, role: "assistant", content: `${draft.title}\n\nReminder added to Calendar for review.` },
        ...prev,
      ]);
      setReviewAction(null);
      return;
    }

    if (draft.kind === "vet_note") {
      setMessages((prev) => [
        { id: `draft_${Date.now()}`, role: "assistant", content: draft.body },
        ...prev,
      ]);
      setReviewAction(null);
      return;
    }

    if (draft.kind === "care_pass") {
      setReviewAction(null);
      router.push("/records");
    }
  }, [reviewAction, addEntry, updateCareDoc, router]);

  return (
    <>
      <KeyboardAvoidingView
        style={[s.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardOffset}
      >
        <FlatList
          data={messages}
          inverted={messages.length > 0}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: loading ? 8 : 12 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            loading ? (
              <View style={[s.typingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.copper} />
                <Text style={[s.typingText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Thinking...</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={s.emptyArea}>
                <BoardCard padded={false} style={s.guideStageCard}>
                  <ImageBackground
                    source={WOOFGUIDE_STAGE_ROOM}
                    resizeMode="cover"
                    imageStyle={[s.guideStageImage, pixelImageStyle]}
                    style={s.guideStage}
                    testID="woofguide-pixel-guidance-stage"
                  >
                    <View style={s.guideStageShade} />
                    <View style={s.guideStageScanline} />
                    <View style={s.guideStageTop}>
                      <View style={s.guideBubble}>
                        <Text style={[s.guideKicker, { color: colors.copper, fontFamily: DISPLAY_SEMI }]}>
                          WoofGuide Console
                        </Text>
                        <Text
                          numberOfLines={3}
                          style={[s.guideSpeech, { color: colors.brandNavy, fontFamily: DISPLAY_SEMI }]}
                        >
                          {guideSpeech}
                        </Text>
                        <View style={s.guideBubbleTail} />
                      </View>
                      <View style={[s.guideReviewChip, { backgroundColor: colors.brandNavy + "E8", borderColor: colors.ivory + "55" }]}>
                        <Ionicons name="checkmark-done-circle-outline" size={15} color={colors.amber} />
                        <Text style={[s.guideReviewChipText, { color: colors.ivory, fontFamily: "Inter_800ExtraBold" }]}>
                          Owner review
                        </Text>
                      </View>
                    </View>

                    <View pointerEvents="none" style={s.guideSprite}>
                      <View style={s.guideSpriteShadow} />
                      <SpriteSheetPlayer
                        asset={WOOFGUIDE_STAGE_SPRITE}
                        track={WOOFGUIDE_STAGE_TRACK}
                        width={112}
                        height={112}
                        testID="woofguide-pixel-guidance-sprite"
                      />
                    </View>

                    <View style={[s.guideHud, { backgroundColor: colors.brandNavy + "DF", borderColor: colors.ivory + "44" }]}>
                      {guideHud.map((metric) => (
                        <View key={metric.label} style={s.guideHudCell}>
                          <Text style={[s.guideHudLabel, { color: colors.ivory, fontFamily: DISPLAY_SEMI }]}>
                            {metric.label}
                          </Text>
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            style={[s.guideHudValue, { color: colors.ivory, fontFamily: "Inter_800ExtraBold" }]}
                          >
                            {metric.value}
                          </Text>
                          <View style={s.guideSignalRow}>
                            {[0, 1, 2, 3, 4].map((bar) => (
                              <View
                                key={bar}
                                style={[
                                  s.guideSignalBar,
                                  {
                                    height: 5 + bar * 2,
                                    backgroundColor: bar < guideSignal ? metric.tone : colors.ivory + "2F",
                                  },
                                ]}
                              />
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>

                    <View style={s.guideStageFooter}>
                      <View style={[s.guideBoundaryCard, { backgroundColor: colors.ivory + "E8", borderColor: colors.ivory + "AA" }]}>
                        <Text style={[s.guideBoundaryLabel, { color: colors.copper, fontFamily: "Inter_800ExtraBold" }]}>
                          Not veterinary advice
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[s.guideBoundaryValue, { color: colors.brandNavy, fontFamily: DISPLAY_SEMI }]}
                        >
                          Drafts stay owner-reviewed
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Ask first WoofGuide quick question from guidance console"
                        onPress={() => {
                          void sendMessage(quickQuestions[0]);
                        }}
                        style={({ pressed }) => [
                          s.guideStageAction,
                          { backgroundColor: colors.sage, opacity: pressed ? 0.82 : 1 },
                        ]}
                      >
                        <Text style={[s.guideStageActionText, { fontFamily: "Inter_800ExtraBold" }]}>
                          Ask WoofGuide
                        </Text>
                        <Ionicons name="arrow-forward" size={15} color={colors.ivory} />
                      </Pressable>
                    </View>
                  </ImageBackground>
                </BoardCard>
                <BoardCard style={s.guideIntroCard}>
                  <View style={s.guideIntroRow}>
                    <View style={[s.guideIntroIcon, { backgroundColor: colors.sage + "18", borderColor: colors.sage + "44" }]}>
                      <Ionicons name="chatbubbles-outline" size={21} color={colors.brandNavy} />
                    </View>
                    <View style={s.guideIntroText}>
                      <Text style={[s.guideIntroKicker, { color: colors.copper, fontFamily: "Inter_800ExtraBold" }]}>
                        WoofGuide
                      </Text>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={[s.guideIntroTitle, { color: colors.foreground, fontFamily: "Fredoka_700Bold" }]}
                      >
                        Owner-reviewed guidance
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={[s.guideIntroCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                      >
                        Uses {name}'s logs for owner-reviewed, non-diagnostic next steps.
                      </Text>
                    </View>
                  </View>
                </BoardCard>
                <BoardCard style={s.quickQuestionBoard}>
                  <BoardSectionHeader
                    title="Quick questions"
                    accessory={<BoardPill label="Tap to ask" tone={colors.sage} />}
                  />
                  <View style={s.quickQuestionGrid}>
                    {quickQuestions.map((q) => (
                      <Pressable
                        key={q}
                        onPress={() => sendMessage(q)}
                        accessibilityRole="button"
                        accessibilityLabel={`Ask WoofGuide: ${q}`}
                        style={({pressed}) => [s.quickChip, { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                      >
                        <Text style={[s.quickText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{q}</Text>
                      </Pressable>
                    ))}
                  </View>
                </BoardCard>
                <BoardCard style={s.actionBoard}>
                  <BoardSectionHeader
                    title="Suggested actions"
                    accessory={<BoardPill label="Owner reviewed" tone={colors.amber} />}
                  />
                  <View style={s.guideActionList}>
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
                          accessibilityRole="button"
                          accessibilityLabel={`Review WoofGuide action: ${action.label}. ${action.detail}${action.draft ? ". Owner review required." : ""}`}
                          style={({ pressed }) => [
                            s.actionRow,
                            {
                              backgroundColor: colors.background,
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
                            {action.draft ? (
                              <Text style={[s.actionDraftLabel, { color: tone, fontFamily: "Inter_700Bold" }]}>
                                Owner review required
                              </Text>
                            ) : null}
                          </View>
                          <Ionicons name={action.draft ? "create-outline" : action.route ? "chevron-forward" : "arrow-up"} size={17} color={tone} />
                        </Pressable>
                      );
                    })}
                  </View>
                </BoardCard>
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
        <View style={[s.inputArea, { borderTopColor: colors.border, paddingBottom: composerBottomPadding, backgroundColor: colors.background }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={`Ask about ${state.profile.name}...`}
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
            accessibilityRole="button"
            accessibilityLabel="Send WoofGuide message"
            style={[s.sendBtn, { backgroundColor: input.trim() && !loading ? colors.primary : colors.card, borderColor: colors.border }]}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="arrow-up" size={20} color={input.trim() ? "#fff" : colors.mutedForeground} />
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <Modal visible={reviewAction !== null} transparent animationType="slide" onRequestClose={() => setReviewAction(null)}>
        <Pressable
          style={s.reviewBackdrop}
          onPress={() => setReviewAction(null)}
          accessibilityRole="button"
          accessibilityLabel="Close owner review"
        >
          <Pressable
            style={[s.reviewSheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: modalSheetBottomPadding }]}
            onPress={(event) => event.stopPropagation()}
          >
            {reviewAction?.draft ? (
              <>
                <View style={s.reviewHeader}>
                  <View style={[s.reviewIcon, { backgroundColor: colors.primary + "16" }]}>
                    <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.reviewEyebrow, { color: colors.copper, fontFamily: "Inter_700Bold" }]}>OWNER REVIEW</Text>
                    <Text style={[s.reviewTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{reviewAction.draft.title}</Text>
                  </View>
                  <Pressable
                    onPress={() => setReviewAction(null)}
                    hitSlop={MOBILE_INLINE_HIT_SLOP}
                    accessibilityRole="button"
                    accessibilityLabel="Close owner review"
                  >
                    <Ionicons name="close" size={22} color={colors.mutedForeground} />
                  </Pressable>
                </View>
                <ScrollView style={s.reviewBodyWrap} showsVerticalScrollIndicator={false}>
                  <Text style={[s.reviewBody, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                    {reviewAction.draft.body}
                  </Text>
                  {reviewAction.draft.safety ? (
                    <Text style={[s.reviewSafety, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {reviewAction.draft.safety}
                    </Text>
                  ) : null}
                </ScrollView>
                <View style={s.reviewActions}>
                  <Pressable
                    onPress={() => setReviewAction(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel owner review"
                    style={[s.reviewCancel, { borderColor: colors.border }]}
                  >
                    <Text style={[s.reviewCancelText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={applyDraft}
                    accessibilityRole="button"
                    accessibilityLabel="Apply reviewed WoofGuide draft"
                    style={[s.reviewApply, { backgroundColor: colors.primary }]}
                  >
                    <Text style={[s.reviewApplyText, { fontFamily: "Inter_700Bold" }]}>{reviewAction.draft.cta}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  emptyArea: { alignItems: "center", paddingTop: 20, gap: 10 },
  guideStageCard: { alignSelf: "stretch", marginHorizontal: 12, marginTop: 4, overflow: "hidden" },
  guideStage: { minHeight: 294, overflow: "hidden", justifyContent: "space-between" },
  guideStageImage: { borderRadius: 8 },
  guideStageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,20,36,0.18)",
  },
  guideStageScanline: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  guideStageTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    zIndex: 3,
  },
  guideBubble: {
    flexShrink: 1,
    maxWidth: "64%",
    minHeight: 88,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#142033",
    backgroundColor: "rgba(255,249,239,0.94)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  guideKicker: { fontSize: 7.5, lineHeight: 11, textTransform: "uppercase" },
  guideSpeech: { fontSize: 10.8, lineHeight: 17, marginTop: 5 },
  guideBubbleTail: {
    position: "absolute",
    bottom: -10,
    left: 30,
    width: 18,
    height: 18,
    backgroundColor: "rgba(255,249,239,0.94)",
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#142033",
    transform: [{ rotate: "45deg" }],
  },
  guideReviewChip: {
    flexShrink: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    maxWidth: 108,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 7,
  },
  guideReviewChipText: { flexShrink: 1, fontSize: 10, lineHeight: 12 },
  guideSprite: {
    position: "absolute",
    right: 18,
    bottom: 98,
    width: 112,
    height: 112,
    zIndex: 2,
  },
  guideSpriteShadow: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 5,
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(8,20,36,0.24)",
  },
  guideHud: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 70,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    flexDirection: "row",
    gap: 8,
    zIndex: 3,
  },
  guideHudCell: { flex: 1, minWidth: 0 },
  guideHudLabel: { fontSize: 6.5, lineHeight: 10, textTransform: "uppercase" },
  guideHudValue: { fontSize: 11.5, lineHeight: 14, marginTop: 2 },
  guideSignalRow: {
    height: 17,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    marginTop: 5,
  },
  guideSignalBar: { width: 5, borderRadius: 2 },
  guideStageFooter: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 4,
  },
  guideBoundaryCard: {
    flex: 1,
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  guideBoundaryLabel: { fontSize: 9.2, lineHeight: 12, textTransform: "uppercase" },
  guideBoundaryValue: { fontSize: 9.8, lineHeight: 13, marginTop: 4 },
  guideStageAction: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
  },
  guideStageActionText: { color: "#FFF9EF", fontSize: 11, lineHeight: 14 },
  guideIntroCard: { alignSelf: "stretch", marginHorizontal: 12, marginTop: 8 },
  guideIntroRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  guideIntroIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  guideIntroText: { flex: 1, minWidth: 0 },
  guideIntroKicker: { fontSize: 10, lineHeight: 13, textTransform: "uppercase" },
  guideIntroTitle: { fontSize: 17, lineHeight: 20, marginTop: 1 },
  guideIntroCopy: { fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  quickQuestionBoard: { alignSelf: "stretch", marginHorizontal: 12, marginTop: 6 },
  quickQuestionGrid: { gap: 10 },
  quickChip: { borderRadius: 14, borderWidth: 1, minHeight: MIN_MOBILE_TOUCH_TARGET, padding: 14 },
  quickText: { fontSize: 14, lineHeight: 20 },
  actionBoard: { alignSelf: "stretch", marginHorizontal: 12, marginTop: 8 },
  guideActionList: { gap: 10 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 16, borderWidth: 1, minHeight: MIN_MOBILE_TOUCH_TARGET, padding: 13 },
  actionIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 14.5 },
  actionDetail: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  actionDraftLabel: { fontSize: 11.5, marginTop: 5 },
  bubble: { maxWidth: "86%", borderRadius: 20, padding: 14, shadowColor: "#2E5846", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  userBubble: { alignSelf: "flex-end", borderBottomRightRadius: 6 },
  assistantBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 6, borderWidth: 1 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  typingBubble: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 20, borderWidth: 1, padding: 12, marginBottom: 8 },
  typingText: { fontSize: 14 },
  inputArea: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 14, paddingTop: 8, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 15, maxHeight: 112, minHeight: 48 },
  sendBtn: { width: MIN_MOBILE_TOUCH_TARGET, height: MIN_MOBILE_TOUCH_TARGET, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  reviewBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(10, 16, 24, 0.42)" },
  reviewSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, padding: 18, maxHeight: "78%" },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  reviewIcon: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  reviewEyebrow: { fontSize: 10.5, letterSpacing: 0.7 },
  reviewTitle: { fontSize: 17, marginTop: 2 },
  reviewBodyWrap: { marginTop: 16 },
  reviewBody: { fontSize: 14, lineHeight: 21 },
  reviewSafety: { fontSize: 12, lineHeight: 17, marginTop: 14 },
  reviewActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  reviewCancel: { flex: 1, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", minHeight: MIN_MOBILE_TOUCH_TARGET },
  reviewCancelText: { fontSize: 14 },
  reviewApply: { flex: 1.4, borderRadius: 16, alignItems: "center", justifyContent: "center", minHeight: MIN_MOBILE_TOUCH_TARGET },
  reviewApplyText: { color: "#fff", fontSize: 14 },
});

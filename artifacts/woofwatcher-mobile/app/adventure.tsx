import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  ImageBackground,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildAdventureMemoryDraft,
  deriveAdventureMode,
  deriveWalkRouteTemplates,
  normalizeCareEventType,
  type AdventureMemory,
  type CareEventType,
  type AdventureQuest,
} from "@workspace/care-domain";
import { BoardCard, BoardPill, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import { DayPhaseWash } from "@/components/DayPhaseWash";
import { SpriteSheetPlayer } from "@/components/SpriteSheetPlayer";
import { useCare, type Entry } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { CARE_TWIN_SPRITE_MANIFEST } from "@/lib/avatarLifeEngine";
import { getCareTwinSpriteAsset } from "@/lib/careTwinAssets";
import { notifyDialog } from "@/lib/confirmDialog";
import {
  buildQuickLogEntry,
  findRecentQuickLogDuplicate,
  QUICK_LOG_DEDUPE_WINDOW_MS,
} from "@/lib/quickLogEntry";
import { buildWalkSessionStartEntry, findOpenWalkSession } from "@/lib/walkSession";
import {
  getRouteTopPadding,
  getStandaloneRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import { pixelImageStyle, stageImageFill } from "@/lib/pixelRendering";
import { shareTextPayload } from "@/lib/shareText";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";
const ADVENTURE_STAGE_SCENE = require("@/assets/avatar/rooms/adventure-hero.png");
const ADVENTURE_STAGE_SPRITE = getCareTwinSpriteAsset("walk-loop");
const ADVENTURE_STAGE_TRACK = CARE_TWIN_SPRITE_MANIFEST["walk-loop"];

function questIcon(id: string): keyof typeof Ionicons.glyphMap {
  if (id.includes("walk")) return "map-outline";
  if (id.includes("training")) return "ribbon-outline";
  if (id.includes("play")) return "sparkles-outline";
  return "camera-outline";
}

function isSameLocalDay(iso: string, now: number): boolean {
  const d = new Date(iso);
  const n = new Date(now);
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function questCareType(quest: AdventureQuest): CareEventType | null {
  if (quest.action === "start-walk") return "walk";
  if (quest.action === "log-training") return "training";
  if (quest.action === "log-play") return "play";
  return null;
}

function findQuestProofEntryId(quest: AdventureQuest, entries: Entry[], now: number): string | null {
  const careType = questCareType(quest);
  if (!careType) return null;

  return (
    [...entries]
      .filter((entry) => {
        if (!entry.id || !isSameLocalDay(entry.occurredAt, now)) return false;
        if (entry.details?.householdVisible === false) return false;
        return normalizeCareEventType(entry.type, entry.details) === careType;
      })
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0]?.id ?? null
  );
}

function adventureDetails(quest: AdventureQuest, current?: Record<string, unknown> | null): Record<string, unknown> {
  return {
    ...(current ?? {}),
    householdVisible: current?.householdVisible !== false,
    adventureQuestId: quest.id,
    adventureQuestTitle: quest.title,
    adventureRewardXp: quest.rewardXp,
    careAdventure: true,
  };
}

function formatMemoryDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently saved";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function AdventureScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, addEntry, deleteEntry, updateCareDoc } = useCare();
  const [questFeedback, setQuestFeedback] = useState<{ id: string; title: string } | null>(null);
  const bottomPadding = getStandaloneRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "standalone",
  });
  const petName = state.profile.name && state.profile.name !== "My Dog" ? state.profile.name : "Phoenix";
  const now = Date.now();
  const adventure = useMemo(
    () =>
      deriveAdventureMode({
        petName,
        entries: state.entries,
        memories: state.adventureMemories,
        now,
      }),
    [petName, state.entries, state.adventureMemories, now],
  );

  const trailStops = useMemo(
    () => deriveWalkRouteTemplates({ entries: state.entries, now, limit: 5 }),
    [state.entries, now],
  );

  const openWalkSession = useMemo(() => findOpenWalkSession(state.entries), [state.entries]);
  // A quest walk that has started but not finished. The shared adventure lib
  // grants walk XP from durationMinutes at completion, so an open walk still
  // reads "available" with 0 XP; the board must say "in progress" instead of
  // offering to start a second walk.
  const isWalkQuestInProgress = (quest: AdventureQuest) =>
    quest.action === "start-walk" && quest.status === "available" && Boolean(openWalkSession);

  const availableQuest =
    adventure.quests.find((quest) => quest.status === "available") ?? adventure.quests[0];
  const availableQuestProofEntryId = findQuestProofEntryId(availableQuest, state.entries, now);
  const availableQuestInProgress = isWalkQuestInProgress(availableQuest);
  const primaryQuestActionLabel =
    availableQuest.status === "complete"
      ? "Open proof"
      : availableQuest.status === "locked"
        ? "Locked"
        : availableQuestInProgress
          ? "Finish walk"
          : availableQuest.actionLabel;

  const caregiver = state.caregivers[0]?.name ?? "Care team";
  const caregiverRole = state.caregivers.find((person) => person.name === caregiver)?.role;

  const saveMemory = (quest: AdventureQuest | null | undefined = availableQuest) => {
    if (quest?.action === "save-memory" && quest.status === "locked") {
      notifyDialog("Complete care first", "Log a walk, training win, or play reset before saving this quest memory.");
      return;
    }
    const memory = buildAdventureMemoryDraft({
      petName,
      questId: quest?.id,
      title: quest?.title ?? "Adventure memory",
      note: adventure.summary,
      humans: state.caregivers.map((caregiver) => caregiver.name).slice(0, 3),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateCareDoc((doc) => ({
      ...doc,
      adventureMemories: [
        memory,
        ...(doc.adventureMemories ?? []),
      ],
    }));
    notifyDialog("Memory saved", "Saved as a private household memory on this device. Cloud photo backup isn't available yet.");
  };

  // Double-tap safety, exactly like Home's quick log: the synchronous ref
  // catches a second press in the same tick (React state cannot update
  // between the two), and the shared entry-window check covers slower
  // bounces and cross-surface repeats. A deliberate second log after the
  // 1.5s window still saves normally.
  const recentQuestSave = useRef<{ type: CareEventType; at: number } | null>(
    null,
  );
  const isDuplicateQuestTap = (type: CareEventType): boolean => {
    const prev = recentQuestSave.current;
    return Boolean(
      prev &&
        prev.type === type &&
        Date.now() - prev.at <= QUICK_LOG_DEDUPE_WINDOW_MS,
    );
  };
  const markQuestSave = (type: CareEventType) => {
    recentQuestSave.current = { type, at: Date.now() };
  };

  const startQuest = (quest: AdventureQuest, proofEntryId: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (quest.status === "locked") {
      notifyDialog("Quest locked", quest.evidence);
      return;
    }
    if (quest.status === "complete") {
      if (proofEntryId) {
        router.push(`/log?entry=${encodeURIComponent(proofEntryId)}` as never);
        return;
      }
      router.push("/log" as never);
      return;
    }
    if (quest.action === "save-memory") {
      saveMemory(quest);
      return;
    }
    if (quest.action === "start-walk") {
      if (openWalkSession?.id) {
        setQuestFeedback({ id: openWalkSession.id, title: "Walk already active" });
        // Land on the FINISH form, not the read-only record sheet: the
        // sheet says "In progress" with no way to end the walk.
        router.push("/log?walk=finish" as never);
        return;
      }
      // A rapid second tap lands before the open session exists in state;
      // it is the same intent, already answered by the first tap.
      if (isDuplicateQuestTap("walk")) return;
      markQuestSave("walk");
      const entry = buildWalkSessionStartEntry({ caregiver, now, routineLabel: quest.title });
      const id = addEntry({
        ...entry,
        details: adventureDetails(quest, entry.details),
      } as Omit<Entry, "id">);
      setQuestFeedback({ id, title: "Adventure walk started" });
      return;
    }

    const careType = questCareType(quest);
    if (!careType) return;
    // Dedupe against the same tick (ref) and the saved timeline (shared
    // window): the first tap's entry and feedback already answered this tap.
    if (
      isDuplicateQuestTap(careType) ||
      findRecentQuickLogDuplicate(state.entries, careType, Date.now())
    ) {
      return;
    }
    markQuestSave(careType);
    const entry = buildQuickLogEntry(
      { type: careType, title: quest.title },
      state,
      { caregiver, caregiverRole, now },
    );
    const id = addEntry({
      ...entry,
      ...(careType === "training" ? { durationMinutes: 8 } : careType === "play" ? { durationMinutes: 10 } : {}),
      details: adventureDetails(quest, entry.details),
    });
    setQuestFeedback({ id, title: `${quest.title} logged` });
  };

  const undoQuestFeedback = () => {
    if (!questFeedback) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void deleteEntry(questFeedback.id);
    setQuestFeedback(null);
  };

  const openProofLog = (entryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/log?entry=${encodeURIComponent(entryId)}` as never);
  };

  const shareAdventure = () => {
    const message = [
      `WoofWatcher Adventure Mode - ${adventure.petName}`,
      "",
      adventure.summary,
      `Quest level ${adventure.level} - ${adventure.todayXp} quest XP today`,
      "",
      "Next:",
      adventure.nextStep,
      "",
      adventure.privacyBoundary,
    ].join("\n");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void shareTextPayload({ message, title: `WoofWatcher Adventure - ${adventure.petName}` });
  };

  const shareAdventureMemory = (memory: AdventureMemory) => {
    const humans = memory.humans.length ? memory.humans.join(", ") : "Household";
    const note = memory.note || `${memory.petName}'s care story grew from a real walk, training win, or play reset.`;
    const message = [
      `WoofWatcher Memory - ${memory.petName}`,
      "",
      memory.title,
      note,
      "",
      `Saved: ${formatMemoryDate(memory.createdAt)}`,
      `With: ${humans}`,
      `Quest XP: +${memory.xp}`,
      "",
      `Storage: ${memory.storageStatus}. Media: ${memory.mediaStatus}.`,
      "Photos and memories stay private on this device - cloud backup isn't available yet.",
    ].join("\n");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void shareTextPayload({ message, title: `WoofWatcher Memory - ${memory.petName}` });
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* The hero owns the header row (back chevron left, Private RPG badge
          right), so the navigator's duplicate "Adventure Mode" title bar is
          hidden and the hero title stays the single primary title. */}
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        // 16 matches the tab screens' shared side gutter (Home/Log/Records
        // all use 16), so modal routes stop sitting 4px narrower.
        contentContainerStyle={{ paddingTop: topPadding, paddingHorizontal: 16, paddingBottom: bottomPadding }}
      >
        <ImageBackground
          accessible={false}
          source={ADVENTURE_STAGE_SCENE}
          resizeMode="cover"
          imageStyle={[stageImageFill, s.heroImage, pixelImageStyle]}
          style={s.hero}
        >
          <View style={s.heroShade} />
          {/* Shared painted-stage atmosphere: the park follows the real clock,
              matching the Story Day Trail it links from. */}
          <DayPhaseWash now={now} />
          <View style={s.heroTop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to More"
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/more"))}
              hitSlop={MOBILE_INLINE_HIT_SLOP}
              style={s.heroIcon}
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </Pressable>
            <View style={s.heroBadge}>
              <Text style={[s.heroBadgeText, { fontFamily: "Inter_700Bold" }]}>Private RPG</Text>
            </View>
          </View>
          <View style={s.heroSpeech}>
            <Text style={[s.heroSpeechText, { fontFamily: DISPLAY_SEMI }]}>
              {availableQuest.status === "locked"
                ? "Care first, then memory."
                : availableQuestInProgress
                  ? "Walk in progress!"
                  : "Quest ready!"}
            </Text>
            <Text style={[s.heroSpeechSub, { fontFamily: "Inter_700Bold" }]}>{availableQuest.title}</Text>
            <View style={s.heroSpeechTail} />
          </View>
          <View pointerEvents="none" style={s.heroSpriteStage}>
            <View style={s.heroSpriteShadow} />
            <SpriteSheetPlayer
              asset={ADVENTURE_STAGE_SPRITE}
              track={ADVENTURE_STAGE_TRACK}
              width={172}
              height={172}
              testID="adventure-mode-walk-sprite"
            />
          </View>
          <View style={s.heroCopy}>
            <Text style={[s.kicker, { color: colors.amber, fontFamily: "Inter_700Bold" }]}>REAL CARE ADVENTURE</Text>
            <Text style={[s.title, { fontFamily: DISPLAY }]}>Adventure Mode</Text>
            <Text style={[s.subtitle, { fontFamily: "Inter_700Bold" }]}>
              Real walks become private quests, memories, and quest XP.
            </Text>
          </View>
          {/* Quest track only: these are today's Adventure numbers, labeled
              "Quest level"/"Quest XP" so they never read as the canonical
              care level ("Lv" + title) that Pack, More, and Story show. */}
          <View
            style={s.levelRow}
            accessible
            accessibilityLabel={`Quest level ${adventure.level} today. ${adventure.todayXp} quest XP today. ${adventure.memoriesCount} ${adventure.memoriesCount === 1 ? "memory" : "memories"}. The quest track resets daily and is separate from ${petName}'s lifetime care level.`}
          >
            <View style={s.levelTile}>
              <Text style={[s.levelValue, { fontFamily: DISPLAY }]}>{adventure.level}</Text>
              <Text style={[s.levelLabel, { fontFamily: "Inter_700Bold" }]}>Quest level</Text>
            </View>
            <View style={s.levelTile}>
              <Text style={[s.levelValue, { fontFamily: DISPLAY }]}>{adventure.todayXp}</Text>
              <Text style={[s.levelLabel, { fontFamily: "Inter_700Bold" }]}>Quest XP today</Text>
            </View>
            <View style={s.levelTile}>
              <Text style={[s.levelValue, { fontFamily: DISPLAY }]}>{adventure.memoriesCount}</Text>
              <Text style={[s.levelLabel, { fontFamily: "Inter_700Bold" }]}>Memories</Text>
            </View>
          </View>
        </ImageBackground>

        {/* Honest track note: quest numbers reset each day; the lifetime care
            level ("Lv" + title) lives on Pack, More, and Story badges. */}
        <Text style={[s.trackNote, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
          Quest level and quest XP track today's adventures and reset daily.{" "}
          {petName}'s lifetime care level lives on Pack and More.
        </Text>

        <BoardCard enter={0} style={s.board}>
          <BoardSectionHeader
            title="Next quest"
            accessory={<BoardPill label={adventure.status === "needs-outing" ? "Start simple" : "Ready"} tone={colors.amber} />}
          />
          <Text style={[s.boardTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{adventure.title}</Text>
          <Text style={[s.boardCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {availableQuestInProgress
              ? "A walk is in progress. Finish it from the walk log (or Home) to complete this quest and earn its quest XP."
              : adventure.nextStep}
          </Text>
          <View style={[s.boundary, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name="lock-closed-outline" size={15} color={colors.sage} />
            <Text style={[s.boundaryText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              {adventure.privacyBoundary}
            </Text>
          </View>
          <View style={s.actionRow}>
            <Pressable
              onPress={() => startQuest(availableQuest, availableQuestProofEntryId)}
              accessibilityRole="button"
              accessibilityLabel={`Run next Adventure quest: ${availableQuest.title}. ${primaryQuestActionLabel}`}
              disabled={availableQuest.status === "locked"}
              style={({ pressed }) => [
                s.primaryBtn,
                {
                  backgroundColor: availableQuest.status === "locked" ? colors.mutedForeground : colors.primary,
                  opacity: availableQuest.status === "locked" ? 0.58 : pressed ? 0.82 : 1,
                },
              ]}
            >
              <Ionicons name={questIcon(availableQuest.id)} size={16} color={colors.primaryForeground} />
              <Text style={[s.primaryBtnText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
                {primaryQuestActionLabel}
              </Text>
            </Pressable>
            <Pressable
              onPress={shareAdventure}
              accessibilityRole="button"
              accessibilityLabel="Share Adventure summary"
              style={({ pressed }) => [s.secondaryBtn, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
            >
              <Ionicons name="share-outline" size={16} color={colors.foreground} />
            </Pressable>
          </View>
        </BoardCard>

        <BoardCard enter={1} style={s.board}>
          <BoardSectionHeader
            title="Quest board"
            accessory={<BoardPill label={`${adventure.quests.length} quests`} tone={colors.primary} />}
          />
          <View style={s.questList}>
            {adventure.quests.map((quest) => {
              const proofEntryId = findQuestProofEntryId(quest, state.entries, now);
              return (
                <QuestRow
                  key={quest.id}
                  quest={quest}
                  colors={colors}
                  proofEntryId={proofEntryId}
                  walkInProgress={isWalkQuestInProgress(quest)}
                  onQuestAction={() => startQuest(quest, proofEntryId)}
                />
              );
            })}
          </View>
          {questFeedback ? (
            <View style={[s.questFeedback, { backgroundColor: colors.sage + "12", borderColor: colors.sage + "44" }]}>
              <View style={s.questFeedbackCopy}>
                <Text style={[s.questFeedbackTitle, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
                  {questFeedback.title}
                </Text>
                <Text style={[s.questFeedbackSub, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                  Quest proof saved. Undo it or add details to the exact care log.
                </Text>
              </View>
              <View style={s.questFeedbackActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Undo ${questFeedback.title}`}
                  onPress={undoQuestFeedback}
                  style={({ pressed }) => [
                    s.questFeedbackButton,
                    { backgroundColor: pressed ? colors.secondary : colors.background, borderColor: colors.border },
                  ]}
                >
                  <Text style={[s.questFeedbackButtonText, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                    Undo
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add details to ${questFeedback.title}`}
                  onPress={() => router.push(`/log?entry=${encodeURIComponent(questFeedback.id)}` as never)}
                  style={({ pressed }) => [
                    s.questFeedbackButton,
                    { backgroundColor: pressed ? colors.copper + "DD" : colors.copper, borderColor: colors.copper },
                  ]}
                >
                  <Text style={[s.questFeedbackButtonText, { color: colors.ivory, fontFamily: "Inter_700Bold" }]}>
                    Add details
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </BoardCard>

        <BoardCard enter={2} style={s.board}>
          <BoardSectionHeader
            title="Adventure Trail"
            accessory={
              <BoardPill
                label={
                  trailStops.length > 0
                    ? `${trailStops.length} ${trailStops.length === 1 ? "place" : "places"}`
                    : "Unexplored"
                }
                tone={colors.sage}
              />
            }
          />
          {trailStops.length > 0 ? (
            <View style={s.trailList}>
              {trailStops.map((stop, index) => (
                <Pressable
                  key={stop.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Start a walk at ${stop.name}. Visited ${stop.visits} ${stop.visits === 1 ? "time" : "times"}.`}
                  onPress={() =>
                    router.push(`/log?type=walk&detail=1&intent=${Date.now()}` as never)
                  }
                  style={({ pressed }) => [s.trailRow, { opacity: pressed ? 0.72 : 1 }]}
                >
                  <View
                    style={[
                      s.trailDot,
                      {
                        backgroundColor: index === 0 ? colors.copper : colors.secondary,
                        borderColor: index === 0 ? colors.copper : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.trailDotText,
                        {
                          color: index === 0 ? colors.ivory : colors.foreground,
                          fontFamily: "Inter_800ExtraBold",
                        },
                      ]}
                    >
                      {stop.visits}
                    </Text>
                  </View>
                  <View style={s.trailCopy}>
                    <Text
                      numberOfLines={1}
                      style={[s.trailName, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}
                    >
                      {stop.name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[s.trailMeta, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}
                    >
                      {stop.visits} {stop.visits === 1 ? "visit" : "visits"}
                      {stop.averageMinutes > 0 ? ` · ~${stop.averageMinutes} min` : ""}
                      {stop.dogInteractions > 0 ? ` · ${stop.dogInteractions} dog friends` : ""}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={[s.trailEmpty, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              No places discovered yet. Log a walk with a route or place name and
              it appears on the trail with real visit counts.
            </Text>
          )}
        </BoardCard>

        <BoardCard enter={3} style={s.board}>
          <BoardSectionHeader
            title="Care proof"
            accessory={<BoardPill label={`${adventure.completedProof.length} today`} tone={colors.sage} />}
          />
          {adventure.completedProof.length === 0 ? (
            <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              Log a walk, training win, or play reset to give Adventure Mode real proof.
            </Text>
          ) : (
            <View style={s.proofList}>
              {adventure.completedProof.slice(0, 4).map((proof) => (
                <Pressable
                  key={proof.entryId}
                  accessibilityRole="button"
                  accessibilityLabel={`Open Adventure proof log: ${proof.label}`}
                  accessibilityHint="Opens the exact care log that earned this Adventure proof."
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                  onPress={() => openProofLog(proof.entryId)}
                  style={({ pressed }) => [
                    s.proofRow,
                    {
                      borderColor: pressed ? colors.sage : colors.border,
                      backgroundColor: pressed ? colors.sage + "12" : colors.background,
                    },
                  ]}
                >
                  <Text style={[s.proofLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{proof.label}</Text>
                  <View style={s.proofMeta}>
                    <Text style={[s.proofXp, { color: colors.copperBright, fontFamily: DISPLAY_SEMI }]}>+{proof.xp} quest XP</Text>
                    <Ionicons name="chevron-forward" size={15} color={colors.mutedForeground} />
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </BoardCard>

        <BoardCard enter={4} style={s.board}>
          <BoardSectionHeader
            title="Memory shelf"
            accessory={<BoardPill label={adventure.memories.length ? "Private" : "Empty"} tone={colors.copperBright} />}
          />
          {adventure.memories.length === 0 ? (
            <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              Saved adventure memories will appear here. Photos stay on this device for now - cloud backup isn't available yet.
            </Text>
          ) : (
            <View style={s.memoryList}>
              {adventure.memories.slice(0, 5).map((memory) => (
                <Pressable
                  key={memory.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Share Adventure memory: ${memory.title}`}
                  accessibilityHint="Shares a private text summary of this saved Adventure memory."
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                  onPress={() => shareAdventureMemory(memory)}
                  style={({ pressed }) => [
                    s.memoryRow,
                    {
                      backgroundColor: pressed ? colors.amber + "10" : colors.background,
                      borderColor: pressed ? colors.amber : colors.border,
                    },
                  ]}
                >
                  <View style={[s.memoryIcon, { backgroundColor: colors.amber + "18" }]}>
                    <Ionicons name="images-outline" size={16} color={colors.amber} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.memoryTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{memory.title}</Text>
                    <Text style={[s.memoryMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {memory.storageStatus} - {memory.mediaStatus}
                    </Text>
                  </View>
                  <View style={s.memoryAction}>
                    <Text style={[s.memoryActionText, { color: colors.amber, fontFamily: "Inter_800ExtraBold" }]}>Share</Text>
                    <Ionicons name="share-outline" size={14} color={colors.amber} />
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </BoardCard>
      </ScrollView>
    </View>
  );
}

function QuestRow({
  quest,
  colors,
  proofEntryId,
  walkInProgress,
  onQuestAction,
}: {
  quest: AdventureQuest;
  colors: ReturnType<typeof useColors>;
  proofEntryId: string | null;
  walkInProgress: boolean;
  onQuestAction: () => void;
}) {
  const tone =
    quest.status === "complete"
      ? colors.sage
      : quest.status === "locked"
        ? colors.mutedForeground
        : walkInProgress
          ? colors.amber
          : colors.copperBright;
  const actionLabel = quest.status === "complete" ? "Open proof" : quest.status === "locked" ? "Locked" : walkInProgress ? "Finish walk" : quest.actionLabel;
  const statusLabel = walkInProgress ? "in progress" : quest.status;
  const evidenceLabel = walkInProgress
    ? "Walk in progress - finish it from the walk log or Home to earn this quest XP."
    : quest.evidence;
  return (
    <View style={[s.questRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <View style={[s.questIcon, { backgroundColor: tone + "18" }]}>
        <Ionicons name={questIcon(quest.id)} size={17} color={tone} />
      </View>
      <View style={s.questCopy}>
        <Text style={[s.questTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{quest.title}</Text>
        <Text style={[s.questPrompt, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{quest.prompt}</Text>
        <Text style={[s.questEvidence, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{evidenceLabel}</Text>
      </View>
      <View style={[s.questStatus, { backgroundColor: tone + "16" }]}>
        <Text style={[s.questStatusText, { color: tone, fontFamily: "Inter_700Bold" }]}>{statusLabel}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          quest.status === "complete"
            ? `Open proof for ${quest.title}`
            : quest.status === "locked"
              ? `${quest.title} locked. ${quest.evidence}`
              : walkInProgress
                ? `${quest.title} walk in progress. Open the walk log to finish it.`
                : `Start quest: ${quest.title}. ${quest.actionLabel}`
        }
        disabled={quest.status === "locked"}
        onPress={onQuestAction}
        style={({ pressed }) => [
          s.questActionButton,
          {
            backgroundColor: quest.status === "locked" ? colors.muted : pressed ? tone + "28" : tone + "18",
            borderColor: tone + "55",
            opacity: quest.status === "locked" ? 0.62 : pressed ? 0.78 : 1,
          },
        ]}
      >
        <Text style={[s.questActionText, { color: tone, fontFamily: "Inter_800ExtraBold" }]}>
          {actionLabel}
        </Text>
        {quest.status === "complete" && proofEntryId ? <Ionicons name="chevron-forward" size={13} color={tone} /> : null}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  // Card-stack rhythm: the hero shares the BoardCard radius (20) so it reads
  // as part of the same stack; the pixel frame stays in the 2px border. The
  // image radius is concentric (20 - 2 border).
  hero: { minHeight: 360, borderRadius: 20, padding: 16, marginBottom: 14, overflow: "hidden", borderWidth: 2, borderColor: "rgba(8,26,42,0.48)" },
  heroImage: { borderRadius: 18 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8, 26, 42, 0.22)" },
  heroTop: { position: "relative", zIndex: 5, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  heroIcon: { width: 38, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(8,26,42,0.68)", borderWidth: 1, borderColor: "rgba(255,249,239,0.24)" },
  heroBadge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: "rgba(8,26,42,0.72)", borderWidth: 1, borderColor: "rgba(255,249,239,0.24)" },
  heroBadgeText: { color: "#FFFFFF", fontSize: 11.5 },
  heroSpeech: {
    position: "absolute",
    zIndex: 6,
    top: 66,
    left: 20,
    maxWidth: "56%",
    minHeight: 70,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: "#081A2A",
    backgroundColor: "rgba(255,249,239,0.94)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heroSpeechText: { color: "#081A2A", fontSize: 15, lineHeight: 18 },
  heroSpeechSub: { color: "#C85A2A", fontSize: 11.5, lineHeight: 15, marginTop: 3 },
  heroSpeechTail: {
    position: "absolute",
    right: 28,
    bottom: -9,
    width: 15,
    height: 15,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#081A2A",
    backgroundColor: "rgba(255,249,239,0.94)",
    transform: [{ rotate: "-45deg" }],
  },
  // The walking sprite stays under heroCopy (zIndex 5) and levelRow (zIndex 6),
  // and its bottom edge sits above the Level/XP tile band (tiles top out around
  // 72 from the hero bottom), so paws never dangle over the stat tiles.
  heroSpriteStage: {
    position: "absolute",
    right: -6,
    bottom: 88,
    width: 190,
    height: 172,
    zIndex: 4,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  heroSpriteShadow: {
    // At the feet line and strong enough to read over the busy path art -
    // at bottom:15/0.34 it hid behind the stat band and the trot looked
    // ungrounded.
    position: "absolute",
    bottom: 7,
    width: 132,
    height: 18,
    borderRadius: 999,
    backgroundColor: "rgba(8,26,42,0.45)",
  },
  // Dark scrim panel behind the hero text stack so the eyebrow/title/copy stay
  // readable over bright pixel art; matches the Level/XP chip treatment below.
  heroCopy: {
    position: "relative",
    zIndex: 5,
    marginTop: 96,
    marginBottom: 76,
    maxWidth: "60%",
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,249,239,0.22)",
    backgroundColor: "rgba(8,26,42,0.76)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  kicker: { fontSize: 11, letterSpacing: 0.8 },
  title: { color: "#FFFFFF", fontSize: 31, letterSpacing: 0, marginTop: 4 },
  subtitle: { color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 18, marginTop: 5, textShadowColor: "rgba(8,26,42,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  levelRow: { position: "absolute", zIndex: 6, left: 14, right: 14, bottom: 14, flexDirection: "row", gap: 8 },
  levelTile: { flex: 1, minHeight: 58, borderRadius: 8, backgroundColor: "rgba(8,26,42,0.76)", borderWidth: 1, borderColor: "rgba(255,249,239,0.22)", alignItems: "center", justifyContent: "center", padding: 8 },
  levelValue: { color: "#FFFFFF", fontSize: 23 },
  // Centered so the longer "Quest level"/"Quest XP today" labels stay tidy
  // when they wrap inside the narrow hero tiles on small phones.
  levelLabel: { color: "rgba(255,255,255,0.76)", fontSize: 10.5, marginTop: 2, textAlign: "center" },
  trackNote: { fontSize: 11.5, lineHeight: 16, marginTop: -6, marginBottom: 14, paddingHorizontal: 2 },
  board: { marginBottom: 12 },
  boardTitle: { fontSize: 17 },
  boardCopy: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  // Rows, panels, and buttons inside BoardCards sit on the shared 12 chip
  // radius (the BoardMetricTile norm) instead of the old 8px one-off.
  boundary: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderRadius: 12, borderWidth: 1, padding: 11, marginTop: 12 },
  boundaryText: { flex: 1, fontSize: 11.5, lineHeight: 16 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 13 },
  primaryBtn: { flex: 1, minHeight: MIN_MOBILE_TOUCH_TARGET, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryBtnText: { color: "#FFFFFF", fontSize: 13.5 },
  secondaryBtn: { width: 50, minHeight: MIN_MOBILE_TOUCH_TARGET, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  questList: { gap: 10 },
  trailList: { gap: 4 },
  trailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingVertical: 6,
  },
  trailDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  trailDotText: { fontSize: 12 },
  trailCopy: { flex: 1, minWidth: 0 },
  trailName: { fontSize: 15 },
  trailMeta: { fontSize: 11.5, marginTop: 1 },
  trailEmpty: { fontSize: 12.5, lineHeight: 18 },
  questRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, padding: 11 },
  // Keeps the copy column readable at phone widths: it never shrinks below
  // 160pt, so the status pill and action button wrap to a second line
  // instead of crushing the text into one-character columns.
  questCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 180, minWidth: 160 },
  questIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  questTitle: { fontSize: 13.5 },
  questPrompt: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  questEvidence: { fontSize: 11.2, lineHeight: 15, marginTop: 5 },
  questStatus: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 },
  questStatusText: { fontSize: 10, textTransform: "capitalize" },
  questActionButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginLeft: 44,
    flexGrow: 1,
  },
  questActionText: { fontSize: 11, textTransform: "uppercase" },
  questFeedback: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 12,
    padding: 11,
    gap: 10,
  },
  questFeedbackCopy: { gap: 2 },
  questFeedbackTitle: { fontSize: 13.5 },
  questFeedbackSub: { fontSize: 11.5, lineHeight: 16 },
  questFeedbackActions: { flexDirection: "row", gap: 8 },
  questFeedbackButton: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  questFeedbackButtonText: { fontSize: 12.5 },
  proofList: { gap: 8 },
  proofRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  proofLabel: { flex: 1, fontSize: 12.5 },
  proofMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  proofXp: { fontSize: 13 },
  memoryList: { gap: 8 },
  memoryRow: { minHeight: MIN_MOBILE_TOUCH_TARGET, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 10 },
  memoryIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  memoryTitle: { fontSize: 13 },
  memoryMeta: { fontSize: 11.5, marginTop: 1, textTransform: "capitalize" },
  memoryAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  memoryActionText: { fontSize: 10.5, textTransform: "uppercase" },
  emptyText: { fontSize: 13, lineHeight: 19 },
});

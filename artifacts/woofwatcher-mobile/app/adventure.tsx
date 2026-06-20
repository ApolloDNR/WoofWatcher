import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  Alert,
  Pressable,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildAdventureMemoryDraft,
  deriveAdventureMode,
  type AdventureQuest,
} from "@workspace/care-domain";
import { BoardCard, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { getStandaloneRouteBottomPadding } from "@/lib/mobileLayout";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

function questIcon(id: string): keyof typeof Ionicons.glyphMap {
  if (id.includes("walk")) return "map-outline";
  if (id.includes("training")) return "ribbon-outline";
  if (id.includes("play")) return "sparkles-outline";
  return "camera-outline";
}

export default function AdventureScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, updateCareDoc } = useCare();
  const bottomPadding = getStandaloneRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
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

  const availableQuest =
    adventure.quests.find((quest) => quest.status === "available") ?? adventure.quests[0];

  const saveMemory = () => {
    const memory = buildAdventureMemoryDraft({
      petName,
      questId: availableQuest?.id,
      title: availableQuest?.title ?? "Adventure memory",
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
    Alert.alert("Memory saved", "Saved as a local private household memory. Cloud photo storage is still provider-gated.");
  };

  const shareAdventure = () => {
    const message = [
      `WoofWatcher Adventure Mode - ${adventure.petName}`,
      "",
      adventure.summary,
      `Level ${adventure.level} - ${adventure.todayXp} care XP today`,
      "",
      "Next:",
      adventure.nextStep,
      "",
      adventure.privacyBoundary,
    ].join("\n");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Share.share({ message, title: `WoofWatcher Adventure - ${adventure.petName}` }).catch(() =>
      Alert.alert("Adventure Mode", message),
    );
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Adventure Mode" }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: bottomPadding }}
      >
        <LinearGradient
          colors={[colors.midnight, colors.primary, colors.sage]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <View style={s.heroTop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to More"
              onPress={() => router.back()}
              hitSlop={10}
              style={s.heroIcon}
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </Pressable>
            <View style={s.heroBadge}>
              <Text style={[s.heroBadgeText, { fontFamily: "Inter_700Bold" }]}>Private RPG</Text>
            </View>
          </View>
          <Text style={[s.kicker, { color: colors.amber, fontFamily: "Inter_700Bold" }]}>REAL CARE ADVENTURE</Text>
          <Text style={[s.title, { fontFamily: DISPLAY }]}>Adventure Mode</Text>
          <Text style={[s.subtitle, { fontFamily: "Inter_500Medium" }]}>
            Turn real walks, training wins, play resets, and tiny memories into {petName}'s private care story.
          </Text>
          <View style={s.levelRow}>
            <View style={s.levelTile}>
              <Text style={[s.levelValue, { fontFamily: DISPLAY }]}>{adventure.level}</Text>
              <Text style={[s.levelLabel, { fontFamily: "Inter_700Bold" }]}>Level</Text>
            </View>
            <View style={s.levelTile}>
              <Text style={[s.levelValue, { fontFamily: DISPLAY }]}>{adventure.todayXp}</Text>
              <Text style={[s.levelLabel, { fontFamily: "Inter_700Bold" }]}>XP today</Text>
            </View>
            <View style={s.levelTile}>
              <Text style={[s.levelValue, { fontFamily: DISPLAY }]}>{adventure.memoriesCount}</Text>
              <Text style={[s.levelLabel, { fontFamily: "Inter_700Bold" }]}>Memories</Text>
            </View>
          </View>
        </LinearGradient>

        <BoardCard style={s.board}>
          <BoardSectionHeader title="Next quest" action={adventure.status === "needs-outing" ? "Start simple" : "Ready"} />
          <Text style={[s.boardTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{adventure.title}</Text>
          <Text style={[s.boardCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {adventure.nextStep}
          </Text>
          <View style={[s.boundary, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name="lock-closed-outline" size={15} color={colors.sage} />
            <Text style={[s.boundaryText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              {adventure.privacyBoundary}
            </Text>
          </View>
          <View style={s.actionRow}>
            <Pressable
              onPress={saveMemory}
              accessibilityRole="button"
              accessibilityLabel="Save private adventure memory"
              style={({ pressed }) => [s.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
            >
              <Ionicons name="heart-outline" size={16} color="#FFFFFF" />
              <Text style={[s.primaryBtnText, { fontFamily: "Inter_700Bold" }]}>Save Memory</Text>
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

        <BoardCard style={s.board}>
          <BoardSectionHeader title="Quest board" action={`${adventure.quests.length} quests`} />
          <View style={s.questList}>
            {adventure.quests.map((quest) => (
              <QuestRow key={quest.id} quest={quest} colors={colors} />
            ))}
          </View>
        </BoardCard>

        <BoardCard style={s.board}>
          <BoardSectionHeader title="Care proof" action={`${adventure.completedProof.length} today`} />
          {adventure.completedProof.length === 0 ? (
            <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              Log a walk, training win, or play reset to give Adventure Mode real proof.
            </Text>
          ) : (
            <View style={s.proofList}>
              {adventure.completedProof.slice(0, 4).map((proof) => (
                <View key={proof.entryId} style={[s.proofRow, { borderColor: colors.border }]}>
                  <Text style={[s.proofLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{proof.label}</Text>
                  <Text style={[s.proofXp, { color: colors.copperBright, fontFamily: DISPLAY_SEMI }]}>+{proof.xp} XP</Text>
                </View>
              ))}
            </View>
          )}
        </BoardCard>

        <BoardCard style={s.board}>
          <BoardSectionHeader title="Memory shelf" action={adventure.memories.length ? "Private" : "Empty"} />
          {adventure.memories.length === 0 ? (
            <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              Saved adventure memories will appear here. Photos remain local/provider-gated until storage rules are approved.
            </Text>
          ) : (
            <View style={s.memoryList}>
              {adventure.memories.slice(0, 5).map((memory) => (
                <View key={memory.id} style={[s.memoryRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={[s.memoryIcon, { backgroundColor: colors.amber + "18" }]}>
                    <Ionicons name="images-outline" size={16} color={colors.amber} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.memoryTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{memory.title}</Text>
                    <Text style={[s.memoryMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {memory.storageStatus} - {memory.mediaStatus}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </BoardCard>
      </ScrollView>
    </View>
  );
}

function QuestRow({ quest, colors }: { quest: AdventureQuest; colors: ReturnType<typeof useColors> }) {
  const tone =
    quest.status === "complete"
      ? colors.sage
      : quest.status === "locked"
        ? colors.mutedForeground
        : colors.copperBright;
  return (
    <View style={[s.questRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <View style={[s.questIcon, { backgroundColor: tone + "18" }]}>
        <Ionicons name={questIcon(quest.id)} size={17} color={tone} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.questTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{quest.title}</Text>
        <Text style={[s.questPrompt, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{quest.prompt}</Text>
        <Text style={[s.questEvidence, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{quest.evidence}</Text>
      </View>
      <View style={[s.questStatus, { backgroundColor: tone + "16" }]}>
        <Text style={[s.questStatusText, { color: tone, fontFamily: "Inter_700Bold" }]}>{quest.status}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  hero: { borderRadius: 8, padding: 18, marginBottom: 14, overflow: "hidden" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  heroIcon: { width: 38, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  heroBadge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.14)" },
  heroBadgeText: { color: "#FFFFFF", fontSize: 11.5 },
  kicker: { fontSize: 11, letterSpacing: 0.8 },
  title: { color: "#FFFFFF", fontSize: 31, letterSpacing: 0, marginTop: 4 },
  subtitle: { color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 20, marginTop: 6 },
  levelRow: { flexDirection: "row", gap: 9, marginTop: 16 },
  levelTile: { flex: 1, minHeight: 70, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", padding: 8 },
  levelValue: { color: "#FFFFFF", fontSize: 23 },
  levelLabel: { color: "rgba(255,255,255,0.76)", fontSize: 10.5, marginTop: 2 },
  board: { marginBottom: 12 },
  boardTitle: { fontSize: 17 },
  boardCopy: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  boundary: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderRadius: 8, borderWidth: 1, padding: 11, marginTop: 12 },
  boundaryText: { flex: 1, fontSize: 11.5, lineHeight: 16 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 13 },
  primaryBtn: { flex: 1, minHeight: 47, borderRadius: 8, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryBtnText: { color: "#FFFFFF", fontSize: 13.5 },
  secondaryBtn: { width: 50, minHeight: 47, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  questList: { gap: 10 },
  questRow: { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: 8, padding: 11 },
  questIcon: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  questTitle: { fontSize: 13.5 },
  questPrompt: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  questEvidence: { fontSize: 11.2, lineHeight: 15, marginTop: 5 },
  questStatus: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  questStatusText: { fontSize: 10, textTransform: "capitalize" },
  proofList: { gap: 8 },
  proofRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  proofLabel: { flex: 1, fontSize: 12.5 },
  proofXp: { fontSize: 13 },
  memoryList: { gap: 8 },
  memoryRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 8, borderWidth: 1, padding: 10 },
  memoryIcon: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  memoryTitle: { fontSize: 13 },
  memoryMeta: { fontSize: 11.5, marginTop: 1, textTransform: "capitalize" },
  emptyText: { fontSize: 13, lineHeight: 19 },
});

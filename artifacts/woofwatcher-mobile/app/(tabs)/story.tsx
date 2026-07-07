import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  deriveAdventureMode,
  deriveWalkActivity,
  deriveWalkRouteTemplates,
  normalizeCareEventType,
} from "@workspace/care-domain";

import {
  BoardCard,
  BoardPill,
  BoardRouteHeader,
  BoardSectionHeader,
  CareRow,
} from "@/components/board/BoardPrimitives";
import { PixelIcon } from "@/components/PixelIcon";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { careTitleForLevel, deriveCareCareer, deriveCareStreak } from "@/lib/careCareer";
import { getRouteTopPadding, getTabbedRouteBottomPadding } from "@/lib/mobileLayout";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function formatMemoryDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently saved";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatWalkTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Today";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function StoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useCare();
  const now = Date.now();

  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "tabbed",
  });
  const bottomPadding = getTabbedRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  const petName =
    state.profile.name && state.profile.name !== "My Dog" ? state.profile.name : "Phoenix";

  /* Care career: level, title, XP, and streak from real logged care only. */
  const career = useMemo(() => deriveCareCareer(state.entries, now), [state.entries, now]);
  const careStreak = useMemo(() => deriveCareStreak(state.entries, now), [state.entries, now]);

  /* Adventure preview: same inputs the full Adventure Mode screen derives from. */
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
    () => deriveWalkRouteTemplates({ entries: state.entries, now, limit: 3 }),
    [state.entries, now],
  );
  const questsCompleteToday = useMemo(
    () => adventure.quests.filter((quest) => quest.status === "complete").length,
    [adventure.quests],
  );
  const recentMemories = useMemo(() => adventure.memories.slice(0, 3), [adventure.memories]);

  /* Walk story: today's derived walk activity plus a real trailing-week count. */
  const walkActivity = useMemo(
    () => deriveWalkActivity({ entries: state.entries, now }),
    [state.entries, now],
  );
  const walksThisWeek = useMemo(
    () =>
      state.entries.filter((entry) => {
        if (entry.details?.householdVisible === false) return false;
        const occurred = Date.parse(entry.occurredAt);
        if (!Number.isFinite(occurred) || occurred > now || occurred < now - WEEK_MS) return false;
        return normalizeCareEventType(entry.type, entry.details) === "walk";
      }).length,
    [state.entries, now],
  );

  /*
   * There is no separate badge model yet; the evidence-based ladder the app
   * exposes is the care-title track from deriveCareCareer/careTitleForLevel.
   * Every earned title below is reconstructed from that real model, never
   * invented: walk the levels actually reached and keep each distinct title.
   */
  const earnedTitles = useMemo(() => {
    const ladder: { title: string; unlockedAt: number }[] = [];
    for (let level = 1; level <= career.level; level += 1) {
      const title = careTitleForLevel(level);
      if (!ladder.length || ladder[ladder.length - 1].title !== title) {
        ladder.push({ title, unlockedAt: level });
      }
    }
    return ladder.reverse();
  }, [career.level]);

  const nextTitle = useMemo(() => {
    for (let level = career.level + 1; level <= career.level + 40; level += 1) {
      const title = careTitleForLevel(level);
      if (title !== career.title) return { title, unlocksAt: level };
    }
    return null;
  }, [career.level, career.title]);

  const walkStatusLabel =
    walkActivity.status === "active"
      ? "Active"
      : walkActivity.status === "light"
        ? "Light"
        : "Needs walk";
  const walkStatusTone = walkActivity.status === "needs-walk" ? colors.amber : colors.sage;
  const levelProgressPct = Math.round(career.levelProgress * 100);

  const openAdventure = () => router.push("/adventure" as never);
  const openWalkLog = () =>
    router.push(`/log?type=walk&detail=1&intent=${Date.now()}` as never);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          paddingHorizontal: 16,
        }}
      >
        <BoardRouteHeader
          kicker="Story"
          title="Story"
          subtitle={`${petName}'s real care, told as a living story.`}
          icon="book-outline"
          actionIcon="map-outline"
          actionLabel="Open Adventure Mode"
          onAction={openAdventure}
          plain
        />

        {/* 1. Care career */}
        <BoardCard style={s.board}>
          <BoardSectionHeader
            title="Care career"
            accessory={<BoardPill label={career.levelLabel} tone={colors.amber} />}
          />
          <View style={s.levelStrip}>
            <View style={[s.levelBadge, { backgroundColor: colors.copper + "16", borderColor: colors.copper + "44" }]}>
              <Text style={[s.levelBadgeValue, { color: colors.copper, fontFamily: DISPLAY }]}>
                {career.level}
              </Text>
              <Text style={[s.levelBadgeLabel, { color: colors.copper, fontFamily: "Inter_700Bold" }]}>
                Level
              </Text>
            </View>
            <View style={s.levelCopy}>
              <Text style={[s.levelTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                {career.title}
              </Text>
              <View style={[s.xpTrack, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    s.xpFill,
                    { backgroundColor: colors.copperBright, width: `${Math.max(2, levelProgressPct)}%` },
                  ]}
                />
              </View>
              <Text style={[s.levelMeta, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                {career.levelXp.toLocaleString()} / {career.levelSpanXp.toLocaleString()} XP -{" "}
                {career.xpToNextLevel.toLocaleString()} XP to Lv {career.level + 1}
              </Text>
            </View>
          </View>
          <View style={s.statPairRow}>
            <View style={[s.statPairTile, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <PixelIcon name="energy" size={20} />
              <Text style={[s.statPairValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                {careStreak > 0 ? `${careStreak} day${careStreak === 1 ? "" : "s"}` : "Start today"}
              </Text>
              <Text style={[s.statPairLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                Care streak
              </Text>
            </View>
            <View style={[s.statPairTile, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <PixelIcon name="heart" size={20} />
              <Text style={[s.statPairValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                {career.todayXp} XP
              </Text>
              <Text style={[s.statPairLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                Earned today
              </Text>
            </View>
          </View>
          <CareRow
            icon="note"
            title="Career & Stats"
            detail="Logs this week, active days, and streak on More"
            onPress={() => router.push("/more")}
            accessibilityLabel="Open Career and Stats on the More screen"
          />
        </BoardCard>

        {/* 2. Adventure Trail */}
        <BoardCard style={s.board}>
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
          <Text style={[s.sectionCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {adventure.summary}
          </Text>
          {trailStops.length > 0 ? (
            <View style={s.trailList}>
              {trailStops.map((stop, index) => (
                <Pressable
                  key={stop.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open Adventure Trail: ${stop.name}, ${stop.visits} ${stop.visits === 1 ? "visit" : "visits"}.`}
                  onPress={openAdventure}
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
                      {stop.averageMinutes > 0 ? ` - ~${stop.averageMinutes} min` : ""}
                      {stop.dogInteractions > 0 ? ` - ${stop.dogInteractions} dog friends` : ""}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              No places discovered yet. Log a walk with a route or place name and it appears on the
              trail with real visit counts.
            </Text>
          )}
          <CareRow
            icon="walk"
            title="Open Adventure Mode"
            detail={`${questsCompleteToday} of ${adventure.quests.length} quests complete today`}
            onPress={openAdventure}
            accessibilityLabel={`Open Adventure Mode. ${questsCompleteToday} of ${adventure.quests.length} quests complete today.`}
          />
        </BoardCard>

        {/* 3. Memory shelf */}
        <BoardCard style={s.board}>
          <BoardSectionHeader
            title="Memory shelf"
            accessory={
              <BoardPill
                label={
                  adventure.memoriesCount > 0
                    ? `${adventure.memoriesCount} ${adventure.memoriesCount === 1 ? "memory" : "memories"}`
                    : "Empty"
                }
                tone={colors.copperBright}
              />
            }
          />
          {recentMemories.length > 0 ? (
            <View style={s.memoryList}>
              {recentMemories.map((memory) => (
                <Pressable
                  key={memory.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open Adventure memory: ${memory.title}`}
                  accessibilityHint="Opens Adventure Mode, where memories are saved and shared."
                  onPress={openAdventure}
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
                  <View style={s.memoryCopy}>
                    <Text
                      numberOfLines={1}
                      style={[s.memoryTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                    >
                      {memory.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[s.memoryMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                    >
                      {formatMemoryDate(memory.createdAt)} - +{memory.xp} care XP
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              Saved adventure memories will appear here. Photos remain local/provider-gated until
              storage rules are approved.
            </Text>
          )}
          <CareRow
            icon="happy"
            title="Open the memory shelf"
            detail="Save and share private household memories in Adventure Mode"
            onPress={openAdventure}
            accessibilityLabel="Open the memory shelf in Adventure Mode"
          />
        </BoardCard>

        {/* 4. Walk story */}
        <BoardCard style={s.board}>
          <BoardSectionHeader
            title="Walk story"
            accessory={<BoardPill label={walkStatusLabel} tone={walkStatusTone} />}
          />
          <Text style={[s.sectionCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {walkActivity.summary}
          </Text>
          <View style={s.statPairRow}>
            <View style={[s.statPairTile, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <PixelIcon name="walk" size={20} />
              <Text style={[s.statPairValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                {walkActivity.total}
              </Text>
              <Text style={[s.statPairLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                Walks today
              </Text>
              <Text style={[s.statPairDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {walkActivity.totalMinutes} of {walkActivity.targetMinutes} min target
              </Text>
            </View>
            <View style={[s.statPairTile, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <PixelIcon name="clock" size={20} />
              <Text style={[s.statPairValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                {walksThisWeek}
              </Text>
              <Text style={[s.statPairLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                Walks this week
              </Text>
              <Text style={[s.statPairDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Logged in the last 7 days
              </Text>
            </View>
          </View>
          {walkActivity.last ? (
            <View style={[s.latestWalk, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={[s.latestWalkDot, { backgroundColor: colors.sage }]} />
              <View style={s.latestWalkCopy}>
                <Text
                  numberOfLines={1}
                  style={[s.latestWalkTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                >
                  Latest: {walkActivity.last.label}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[s.latestWalkMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                >
                  {[
                    walkActivity.last.place,
                    walkActivity.last.caregiver,
                    formatWalkTime(walkActivity.last.occurredAt),
                  ]
                    .filter(Boolean)
                    .join(" - ")}
                </Text>
              </View>
            </View>
          ) : null}
          <CareRow
            icon="walk"
            title="Log a walk"
            detail="Open Quick Log with the walk flow ready"
            onPress={openWalkLog}
            accessibilityLabel="Log a walk in Quick Log"
          />
          <CareRow
            icon="note"
            title="Walk records"
            detail="Walk activity and saved routes live in Records"
            onPress={() => router.push("/records")}
            accessibilityLabel="Open walk records"
          />
        </BoardCard>

        {/* 5. Earned title ladder (the evidence-based badge track today) */}
        <BoardCard style={s.board}>
          <BoardSectionHeader
            title="Earned titles"
            accessory={<BoardPill label={`${earnedTitles.length} earned`} tone={colors.copper} />}
          />
          <Text style={[s.sectionCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            Titles are {petName}'s badge ladder. Every one below was unlocked by real logged care -{" "}
            {career.totalXp.toLocaleString()} lifetime care XP so far.
          </Text>
          <View style={s.titleList}>
            {earnedTitles.map((earned) => {
              const current = earned.title === career.title;
              return (
                <View
                  key={earned.title}
                  style={[
                    s.titleRow,
                    {
                      backgroundColor: current ? colors.copper + "10" : colors.background,
                      borderColor: current ? colors.copper + "55" : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      s.titleIcon,
                      { backgroundColor: current ? colors.copper + "18" : colors.secondary },
                    ]}
                  >
                    <Ionicons
                      name={current ? "ribbon" : "ribbon-outline"}
                      size={16}
                      color={current ? colors.copper : colors.mutedForeground}
                    />
                  </View>
                  <View style={s.titleCopy}>
                    <Text
                      numberOfLines={1}
                      style={[s.titleName, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}
                    >
                      {earned.title}
                    </Text>
                    <Text style={[s.titleMeta, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      Unlocked at Lv {earned.unlockedAt}
                    </Text>
                  </View>
                  {current ? <BoardPill label="Current" tone={colors.copper} active /> : null}
                </View>
              );
            })}
          </View>
          <Text style={[s.nextTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
            {nextTitle
              ? `Next: ${nextTitle.title} unlocks at Lv ${nextTitle.unlocksAt}.`
              : "Top of the ladder. Keep the real care going."}
          </Text>
        </BoardCard>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  board: { marginBottom: 12 },
  sectionCopy: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  emptyText: { fontSize: 12.5, lineHeight: 18, marginBottom: 6 },
  levelStrip: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  levelBadge: { width: 58, height: 58, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  levelBadgeValue: { fontSize: 22, lineHeight: 26 },
  levelBadgeLabel: { fontSize: 9, textTransform: "uppercase", letterSpacing: 0.4 },
  levelCopy: { flex: 1, minWidth: 0 },
  levelTitle: { fontSize: 17 },
  xpTrack: { height: 10, borderRadius: 999, marginTop: 7, overflow: "hidden" },
  xpFill: { height: "100%", borderRadius: 999 },
  levelMeta: { fontSize: 11, marginTop: 6 },
  statPairRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  statPairTile: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 11, gap: 3 },
  statPairValue: { fontSize: 16, marginTop: 3 },
  statPairLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0 },
  statPairDetail: { fontSize: 10.5, lineHeight: 14 },
  trailList: { gap: 4, marginBottom: 4 },
  trailRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingVertical: 6 },
  trailDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  trailDotText: { fontSize: 12 },
  trailCopy: { flex: 1, minWidth: 0 },
  trailName: { fontSize: 15 },
  trailMeta: { fontSize: 11.5, marginTop: 1 },
  memoryList: { gap: 8, marginBottom: 6 },
  memoryRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, borderWidth: 1, padding: 10 },
  memoryIcon: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  memoryCopy: { flex: 1, minWidth: 0 },
  memoryTitle: { fontSize: 13 },
  memoryMeta: { fontSize: 11.5, marginTop: 1 },
  latestWalk: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 6 },
  latestWalkDot: { width: 8, height: 8, borderRadius: 4 },
  latestWalkCopy: { flex: 1, minWidth: 0 },
  latestWalkTitle: { fontSize: 12.5 },
  latestWalkMeta: { fontSize: 11.5, marginTop: 1 },
  titleList: { gap: 8 },
  titleRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  titleIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  titleCopy: { flex: 1, minWidth: 0 },
  titleName: { fontSize: 14 },
  titleMeta: { fontSize: 11, marginTop: 1 },
  nextTitle: { fontSize: 11.5, lineHeight: 16, marginTop: 10 },
});

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  deriveAdventureMode,
  deriveWalkActivity,
  deriveWalkRouteTemplates,
  normalizeCareEventType,
} from "@workspace/care-domain";

import {
  BoardActionButton,
  BoardCard,
  BoardPill,
  BoardRouteHeader,
  BoardSectionHeader,
  BoardSegmentTabs,
  BoardStatusPill,
  CareRow,
} from "@/components/board/BoardPrimitives";
import { PixelIcon } from "@/components/PixelIcon";
import { TrailMap } from "@/components/TrailMap";
import { useCare, type Entry } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import {
  careLevelSpanXp,
  careTitleForLevel,
  careXpForEntry,
  deriveCareCareer,
  deriveCareStreak,
} from "@/lib/careCareer";
import {
  MOBILE_INLINE_HIT_SLOP,
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
} from "@/lib/mobileLayout";
import { resolvePetName } from "@/lib/petIdentity";
import {
  formatRouteDistanceMiles,
  parseWalkRoute,
  routeDistanceMeters,
  type WalkRoutePoint,
} from "@/lib/walkRoute";

const DISPLAY_SEMI = "Fredoka_600SemiBold";
// Storybook mockup: serif reserved for the route title, hero copy, and the
// big level number - pixel/serif stays an accent, never body copy.
const TITLE_SERIF = "Fraunces_700Bold";
const HERO_SERIF = "Fraunces_600SemiBold";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type StorySegment = "adventures" | "memories" | "badges";

const STORY_SEGMENTS: readonly { key: StorySegment; label: string }[] = [
  { key: "adventures", label: "Adventures" },
  { key: "memories", label: "Memories" },
  { key: "badges", label: "Badges" },
];

/** How far up the level curve to scan for distinct badge titles. The top
 *  title lands at Lv 20 today; scanning past it keeps the ladder complete if
 *  the shared title table ever grows. */
const MAX_BADGE_LADDER_LEVEL = 40;

// Mock-board pixel art: the adventure map hero and its trail thumbnails are
// decorative game art; every name, date, and count layered on top comes from
// real logged walks only.
const ADVENTURE_MAP_ART = require("@/assets/story/adventure-map.png");
const TRAIL_THUMBS = [
  require("@/assets/story/trail-thumb-1.png"),
  require("@/assets/story/trail-thumb-2.png"),
  require("@/assets/story/trail-thumb-3.png"),
] as const;
const BADGE_ART = [
  require("@/assets/story/badge-1.png"),
  require("@/assets/story/badge-2.png"),
  require("@/assets/story/badge-3.png"),
] as const;
const BADGE_TROPHY_ART = require("@/assets/story/badge-trophy.png");

function formatMemoryDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently saved";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTrailDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

/**
 * Gentle idle pulse for the adventure map's quest-marker card: a 2.5s
 * opacity/scale breathe (1.0 -> 1.01, opacity dips to 0.96) in the
 * LivingPhoenixRoom reanimated style. Only the marker moves - the map art
 * itself stays perfectly still - and the amplitude stays tiny because the
 * app has no reduced-motion setting yet.
 */
function QuestMarkerPulse({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value * 0.04,
    transform: [{ scale: 1 + pulse.value * 0.01 }],
  }));

  return <Animated.View style={[style, pulseStyle]}>{children}</Animated.View>;
}

export default function StoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useCare();
  const now = Date.now();
  const [segment, setSegment] = useState<StorySegment>("adventures");
  /* Adventures hero map style: the drawn storybook world by default, with a
     toggle back to the real raster tiles. Session-only choice (v1). */
  const [heroMapStyle, setHeroMapStyle] = useState<"storybook" | "real">("storybook");

  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "tabbed",
  });
  const bottomPadding = getTabbedRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  const petName = resolvePetName(state.profile.name);

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

  /* Real trail map: the most recent household-visible walk with a recorded
     route. When it exists, the Adventures hero shows the actual map; the
     illustrated map remains the empty state until the first routed walk. */
  const routedWalk = useMemo(() => {
    const routed: { entry: Entry; route: WalkRoutePoint[] }[] = [];
    for (const entry of state.entries) {
      if (entry.details?.householdVisible === false) continue;
      if (normalizeCareEventType(entry.type, entry.details) !== "walk") continue;
      const route = parseWalkRoute(entry.details?.route);
      if (route) routed.push({ entry, route });
    }
    routed.sort((a, b) => Date.parse(b.entry.occurredAt) - Date.parse(a.entry.occurredAt));
    return routed[0] ?? null;
  }, [state.entries]);

  const routedWalkChip = useMemo(() => {
    if (!routedWalk) return "";
    const details = routedWalk.entry.details ?? {};
    const distanceM =
      typeof details.routeDistanceM === "number" && Number.isFinite(details.routeDistanceM)
        ? details.routeDistanceM
        : routeDistanceMeters(routedWalk.route);
    const duration =
      routedWalk.entry.durationMinutes != null && routedWalk.entry.durationMinutes > 0
        ? `${routedWalk.entry.durationMinutes} min`
        : "";
    return ["Latest walk", formatRouteDistanceMiles(distanceM), duration]
      .filter(Boolean)
      .join(" · ");
  }, [routedWalk]);

  /*
   * There is no separate badge model yet; the evidence-based ladder the app
   * exposes is the care-title track from deriveCareCareer/careTitleForLevel.
   * The full ladder is reconstructed from that real model, never invented:
   * walk the level curve, keep each distinct title, and pair it with the
   * real lifetime-XP threshold its unlock level requires.
   */
  const badgeLadder = useMemo(() => {
    const tiers: { title: string; level: number; xpRequired: number }[] = [];
    let cumulativeXp = 0;
    for (let level = 1; level <= MAX_BADGE_LADDER_LEVEL; level += 1) {
      const title = careTitleForLevel(level);
      if (!tiers.length || tiers[tiers.length - 1].title !== title) {
        // Lifetime XP needed to reach `level`: the sum of every level span
        // below it - the same curve deriveCareCareer climbs.
        tiers.push({ title, level, xpRequired: cumulativeXp });
      }
      cumulativeXp += careLevelSpanXp(level);
    }
    return tiers;
  }, []);

  /* Real earn moments: replay the logged care history in order and record the
     entry whose XP pushed the lifetime total across each tier's threshold. */
  const badgeEarnDates = useMemo(() => {
    const ordered = state.entries
      .filter((entry) => {
        const occurred = Date.parse(entry.occurredAt);
        return Number.isFinite(occurred) && occurred <= now;
      })
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
    const earnedAt = new Map<string, string>();
    let cumulativeXp = 0;
    let index = 0;
    for (const tier of badgeLadder) {
      if (tier.xpRequired === 0) {
        // The starter title is held from the first real log.
        if (ordered.length > 0) earnedAt.set(tier.title, ordered[0].occurredAt);
        continue;
      }
      while (index < ordered.length && cumulativeXp < tier.xpRequired) {
        cumulativeXp += careXpForEntry(ordered[index]);
        index += 1;
      }
      if (cumulativeXp >= tier.xpRequired) {
        earnedAt.set(tier.title, ordered[index - 1].occurredAt);
      }
    }
    return earnedAt;
  }, [state.entries, now, badgeLadder]);

  const earnedTitles = useMemo(
    () =>
      badgeLadder
        .filter((tier) => career.level >= tier.level)
        .map((tier) => ({ title: tier.title, unlockedAt: tier.level }))
        .reverse(),
    [badgeLadder, career.level],
  );

  const nextLockedTier = useMemo(
    () => badgeLadder.find((tier) => career.level < tier.level) ?? null,
    [badgeLadder, career.level],
  );

  const walkStatusLabel =
    walkActivity.status === "active"
      ? "Active"
      : walkActivity.status === "light"
        ? "Light"
        : "Needs walk";
  const walkStatusTone = walkActivity.status === "needs-walk" ? "due" : "done";
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
          kicker={`${petName}'s Journey`}
          title="Story"
          subtitle={`${petName}'s real care, told as a living story.`}
          icon="book-outline"
          actionIcon="map-outline"
          actionLabel="Open Adventure Mode"
          onAction={openAdventure}
          plain
        />

        <BoardSegmentTabs segments={STORY_SEGMENTS} active={segment} onChange={setSegment} />

        {segment === "adventures" ? (
          <>
            {routedWalk ? (
              /* Real trail map hero: OSM tiles + the recorded route of the
                 most recent routed walk. Tapping opens that walk's log. */
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Trail map of the latest recorded walk. ${routedWalkChip}. Open the walk log.`}
                onPress={() =>
                  router.push(`/log?entry=${encodeURIComponent(routedWalk.entry.id)}` as never)
                }
                style={({ pressed }) => [s.trailHeroPress, { opacity: pressed ? 0.92 : 1 }]}
              >
                <TrailMap
                  route={routedWalk.route}
                  aspectRatio={5 / 4}
                  mapStyle={heroMapStyle}
                  style={s.trailHeroMap}
                  accessibilityLabel={
                    heroMapStyle === "storybook"
                      ? "Storybook map of the latest recorded walk route"
                      : "Map of the latest recorded walk route"
                  }
                >
                  <View
                    style={[s.trailHeroChip, { backgroundColor: colors.card + "F0", borderColor: colors.border }]}
                  >
                    <View style={[s.trailHeroChipDot, { backgroundColor: colors.sage }]} />
                    <Text
                      numberOfLines={1}
                      style={[s.trailHeroChipText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                    >
                      {routedWalkChip}
                    </Text>
                  </View>
                  {/* Map style toggle: Storybook <-> Real. Nested Pressable
                      claims the touch, so the hero press-through to the walk
                      log never fires when flipping styles. */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      heroMapStyle === "storybook"
                        ? "Map style: Storybook. Switch to Real."
                        : "Map style: Real. Switch to Storybook."
                    }
                    hitSlop={MOBILE_INLINE_HIT_SLOP}
                    onPress={() =>
                      setHeroMapStyle((prev) => (prev === "storybook" ? "real" : "storybook"))
                    }
                    style={({ pressed }) => [
                      s.trailStyleToggle,
                      {
                        backgroundColor: colors.card + "F0",
                        borderColor: colors.border,
                        opacity: pressed ? 0.82 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={heroMapStyle === "storybook" ? "color-palette-outline" : "map-outline"}
                      size={13}
                      color={colors.forest}
                    />
                    <Text
                      style={[s.trailStyleToggleText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                    >
                      {heroMapStyle === "storybook" ? "Storybook" : "Real"}
                    </Text>
                  </Pressable>
                </TrailMap>
              </Pressable>
            ) : (
            /* Adventure map hero (empty state until a walk records a route):
                mock-board pixel map with the latest real trail stop layered
                on top. */
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                trailStops.length > 0
                  ? `Adventure map. Latest discovery: ${trailStops[0].name}, ${formatMemoryDate(trailStops[0].latestAt)}. Open Adventure Mode.`
                  : "Adventure map. No places discovered yet. Open Adventure Mode."
              }
              onPress={openAdventure}
              style={({ pressed }) => [
                s.mapCard,
                { borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
              ]}
            >
              <Image
                source={ADVENTURE_MAP_ART}
                style={s.mapArt}
                resizeMode="cover"
                fadeDuration={0}
              />
              <QuestMarkerPulse
                style={[s.mapOverlayCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                {trailStops.length > 0 ? (
                  <>
                    <View style={s.mapOverlayCopy}>
                      <Text
                        numberOfLines={1}
                        style={[s.mapOverlayTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                      >
                        {trailStops[0].name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[s.mapOverlayMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                      >
                        {formatMemoryDate(trailStops[0].latestAt)}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[s.mapOverlayState, { color: colors.forest, fontFamily: "Inter_600SemiBold" }]}
                      >
                        Discovered
                      </Text>
                    </View>
                    <Image
                      source={TRAIL_THUMBS[0]}
                      style={[s.mapOverlayThumb, { borderColor: colors.border }]}
                      resizeMode="cover"
                    />
                    <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                  </>
                ) : (
                  <View style={s.mapOverlayCopy}>
                    <Text
                      numberOfLines={1}
                      style={[s.mapOverlayTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                    >
                      The trail is waiting
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[s.mapOverlayMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                    >
                      Log a walk with a place name to discover your first spot.
                    </Text>
                  </View>
                )}
              </QuestMarkerPulse>
            </Pressable>
            )}

            {/* Recent adventures: real visited places from logged walks. */}
            <BoardCard style={s.board}>
              <BoardSectionHeader title="Recent Adventures" />
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
                      <Image
                        source={TRAIL_THUMBS[index % TRAIL_THUMBS.length]}
                        style={[s.trailThumb, { borderColor: colors.border }]}
                        resizeMode="cover"
                      />
                      <View style={s.trailCopy}>
                        <Text
                          numberOfLines={1}
                          style={[s.trailName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                        >
                          {stop.name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[s.trailMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                        >
                          {[
                            formatTrailDate(stop.latestAt),
                            stop.averageMinutes > 0 ? `~${stop.averageMinutes} min` : "",
                            `${stop.visits} ${stop.visits === 1 ? "visit" : "visits"}`,
                            stop.dogInteractions > 0 ? `${stop.dogInteractions} dog friends` : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Your first spot lands here once discovered, with real visit counts and average
                  time on the trail.
                </Text>
              )}
              <BoardActionButton
                label="View All Adventures"
                variant="soft"
                icon="map-outline"
                onPress={openAdventure}
                accessibilityLabel={`Open Adventure Mode. ${questsCompleteToday} of ${adventure.quests.length} quests complete today.`}
                style={s.cardButton}
              />
            </BoardCard>

            {/* Walk story: today's activity plus the trailing week, all real. */}
            <BoardCard style={s.board}>
              <BoardSectionHeader
                title="Walk story"
                accessory={<BoardStatusPill label={walkStatusLabel} tone={walkStatusTone} />}
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
              <BoardActionButton
                label="Log a walk"
                icon="walk-outline"
                onPress={openWalkLog}
                accessibilityLabel="Log a walk in Quick Log"
                style={s.cardButton}
              />
              <CareRow
                icon="note"
                title="Walk records"
                detail="Walk activity and saved routes live in Records"
                onPress={() => router.push("/records")}
                accessibilityLabel="Open walk records"
              />
            </BoardCard>
          </>
        ) : null}

        {segment === "memories" ? (
          <BoardCard style={s.board}>
            <BoardSectionHeader
              title="Memory shelf"
              accessory={
                <BoardStatusPill
                  label={
                    adventure.memoriesCount > 0
                      ? `${adventure.memoriesCount} ${adventure.memoriesCount === 1 ? "memory" : "memories"}`
                      : "Empty"
                  }
                  tone={adventure.memoriesCount > 0 ? "done" : "neutral"}
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
                    <View style={[s.memoryIcon, { backgroundColor: colors.amberSoft }]}>
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
              <View style={s.memoryEmpty}>
                <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Saved adventure memories will appear here. Photos stay on this device for now -
                  cloud backup isn't available yet.
                </Text>
                <View style={s.memoryPlaceholderList} accessibilityElementsHidden>
                  {[0, 1, 2].map((slot) => (
                    <View
                      key={`memory-locked-${slot}`}
                      style={[s.memoryPlaceholderRow, { borderColor: colors.border }]}
                    >
                      <View style={[s.memoryPlaceholderIcon, { backgroundColor: colors.muted }]}>
                        <Ionicons name="lock-closed" size={14} color={colors.mutedForeground} />
                      </View>
                      <View style={s.memoryPlaceholderCopy}>
                        <View style={[s.memoryPlaceholderBar, { backgroundColor: colors.muted, width: "62%" }]} />
                        <View style={[s.memoryPlaceholderBar, { backgroundColor: colors.muted, width: "40%" }]} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
            <Text style={[s.footnote, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              Save and share private household memories in Adventure Mode.
            </Text>
            <BoardActionButton
              label="Save a memory in Adventure"
              variant="soft"
              icon="images-outline"
              onPress={openAdventure}
              accessibilityLabel="Save a memory in Adventure Mode"
              style={s.cardButton}
            />
          </BoardCard>
        ) : null}

        {segment === "badges" ? (
          <>
            {/* Care career: level, XP, and streak from real logged care only. */}
            <BoardCard style={s.board}>
              <BoardSectionHeader
                title="Care career"
                accessory={<BoardPill label={career.levelLabel} tone={colors.amber} />}
              />
              <View style={s.levelStrip}>
                <View style={[s.levelBadge, { backgroundColor: colors.amberSoft, borderColor: colors.amber + "55" }]}>
                  <Text style={[s.levelBadgeValue, { color: colors.amber, fontFamily: TITLE_SERIF }]}>
                    {career.level}
                  </Text>
                  <Text style={[s.levelBadgeLabel, { color: colors.amber, fontFamily: "Inter_700Bold" }]}>
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
            </BoardCard>

            {/* Full badge ladder (the evidence-based title track today):
                earned tiers in full color with their real earn dates, locked
                tiers as quiet silhouettes with the real level requirement and
                lifetime-XP progress toward it. */}
            <BoardCard style={s.board}>
              <BoardSectionHeader
                title="Badge ladder"
                accessory={
                  <BoardPill label={`${earnedTitles.length} of ${badgeLadder.length} earned`} tone={colors.copper} />
                }
              />
              <Text style={[s.sectionCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Every badge on {petName}'s ladder is unlocked by real logged care -{" "}
                {career.totalXp.toLocaleString()} lifetime care XP so far.
              </Text>
              {/* Mock-board badge shelf: one pixel emblem per earned title,
                  the trophy marks the current one. Hidden on the single-title
                  first run so the trophy does not read twice above the row. */}
              {earnedTitles.length > 1 ? (
                <View style={s.badgeShelf}>
                  {earnedTitles.slice(0, 4).map((earned, index) => (
                    <Image
                      key={`shelf-${earned.title}`}
                      source={
                        earned.title === career.title
                          ? BADGE_TROPHY_ART
                          : BADGE_ART[index % BADGE_ART.length]
                      }
                      style={s.badgeShelfArt}
                      resizeMode="contain"
                      accessibilityLabel={`${earned.title} badge`}
                    />
                  ))}
                </View>
              ) : null}
              <View style={s.titleList}>
                {badgeLadder.map((tier, tierIndex) => {
                  const earned = career.level >= tier.level;
                  const current = tier.title === career.title;
                  const earnedDate = badgeEarnDates.get(tier.title);

                  if (earned) {
                    return (
                      <View
                        key={tier.title}
                        accessible
                        accessibilityLabel={`${tier.title} badge earned. Unlocked at level ${tier.level}${
                          earnedDate ? ` on ${formatMemoryDate(earnedDate)}` : ""
                        }.${current ? " Current title." : ""}`}
                        style={[
                          s.titleRow,
                          {
                            backgroundColor: current ? colors.sageSoft : colors.background,
                            borderColor: current ? colors.sage + "66" : colors.border,
                          },
                        ]}
                      >
                        <Image
                          source={current ? BADGE_TROPHY_ART : BADGE_ART[tierIndex % BADGE_ART.length]}
                          style={s.titleBadgeArt}
                          resizeMode="contain"
                        />
                        <View style={s.titleCopy}>
                          <Text
                            numberOfLines={1}
                            style={[s.titleName, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}
                          >
                            {tier.title}
                          </Text>
                          <Text style={[s.titleMeta, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                            Unlocked at Lv {tier.level}
                            {earnedDate ? ` - ${formatMemoryDate(earnedDate)}` : ""}
                          </Text>
                        </View>
                        {current ? <BoardStatusPill label="Current" tone="done" /> : null}
                      </View>
                    );
                  }

                  /* Locked: quiet, never alarming - muted silhouette, the real
                     unlock level, and honest lifetime-XP progress toward it. */
                  const progressPct = Math.min(
                    100,
                    Math.round((career.totalXp / tier.xpRequired) * 100),
                  );
                  return (
                    <View
                      key={tier.title}
                      accessible
                      accessibilityLabel={`${tier.title} badge locked. Reach level ${tier.level}. ${career.totalXp.toLocaleString()} of ${tier.xpRequired.toLocaleString()} lifetime care XP so far.`}
                      style={[s.titleRow, s.titleRowLocked, { backgroundColor: colors.background, borderColor: colors.border }]}
                    >
                      <Image
                        source={BADGE_ART[tierIndex % BADGE_ART.length]}
                        style={[s.titleBadgeArt, s.titleBadgeArtLocked, { tintColor: colors.mutedForeground }]}
                        resizeMode="contain"
                      />
                      <View style={s.titleCopy}>
                        <Text
                          numberOfLines={1}
                          style={[s.titleName, { color: colors.mutedForeground, fontFamily: DISPLAY_SEMI }]}
                        >
                          {tier.title}
                        </Text>
                        <Text style={[s.titleMeta, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                          Reach Lv {tier.level} - {career.totalXp.toLocaleString()} of{" "}
                          {tier.xpRequired.toLocaleString()} XP
                        </Text>
                        <View style={[s.tierTrack, { backgroundColor: colors.muted }]}>
                          <View
                            style={[
                              s.tierFill,
                              {
                                backgroundColor: colors.mutedForeground + "73",
                                width: `${progressPct}%`,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
              <Text style={[s.nextTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                {nextLockedTier
                  ? `Next up: ${nextLockedTier.title} at Lv ${nextLockedTier.level} - ${(
                      nextLockedTier.xpRequired - career.totalXp
                    ).toLocaleString()} XP of real care to go.`
                  : "Top of the ladder. Keep the real care going."}
              </Text>
              <CareRow
                icon="note"
                title="Career & Stats"
                detail="Logs this week, active days, and streak on More"
                onPress={() => router.push(`/more?section=career&focus=${Date.now()}` as never)}
                accessibilityLabel="Open Career and Stats on the More screen"
              />
            </BoardCard>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  board: { marginBottom: 12 },
  sectionCopy: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  emptyText: { fontSize: 12.5, lineHeight: 18, marginBottom: 6 },
  footnote: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  cardButton: { marginTop: 10 },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 },
  heroKicker: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8 },
  heroChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  heroChipText: { fontSize: 10.5, letterSpacing: 0.2 },
  heroSummary: { fontSize: 19, lineHeight: 26 },
  heroMeta: { fontSize: 11.5, marginTop: 10 },
  levelStrip: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  levelBadge: { width: 64, height: 64, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  levelBadgeValue: { fontSize: 26, lineHeight: 30 },
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
  mapCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
    aspectRatio: 5 / 4,
  },
  trailHeroPress: { marginBottom: 12 },
  trailHeroMap: { borderRadius: 22 },
  trailHeroChip: {
    position: "absolute",
    left: 12,
    top: 12,
    maxWidth: "86%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  trailHeroChipDot: { width: 8, height: 8, borderRadius: 4 },
  trailHeroChipText: { fontSize: 12, flexShrink: 1 },
  // 28px pill + MOBILE_INLINE_HIT_SLOP (10) per side = a 48px touch target.
  // Bottom-left: clear of the walk chip (top-left) and the OSM attribution
  // (bottom-right).
  trailStyleToggle: {
    position: "absolute",
    left: 12,
    bottom: 12,
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  trailStyleToggleText: { fontSize: 11.5 },
  mapArt: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  mapOverlayCard: {
    position: "absolute",
    right: 12,
    bottom: 12,
    maxWidth: "78%",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mapOverlayCopy: { flexShrink: 1, minWidth: 0 },
  mapOverlayTitle: { fontSize: 13.5 },
  mapOverlayMeta: { fontSize: 11, marginTop: 1 },
  mapOverlayState: { fontSize: 11, marginTop: 3 },
  mapOverlayThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
  },
  trailList: { gap: 4, marginBottom: 2 },
  trailRow: { flexDirection: "row", alignItems: "center", gap: 11, minHeight: 56, paddingVertical: 6 },
  trailThumb: { width: 48, height: 48, borderRadius: 12, borderWidth: 1 },
  badgeShelf: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginBottom: 12,
    paddingVertical: 4,
  },
  badgeShelfArt: { width: 58, height: 58 },
  titleBadgeArt: { width: 34, height: 34 },
  trailIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  trailCopy: { flex: 1, minWidth: 0 },
  trailName: { fontSize: 14 },
  trailMeta: { fontSize: 11.5, marginTop: 2 },
  memoryList: { gap: 8, marginBottom: 6 },
  memoryEmpty: { marginBottom: 6 },
  memoryPlaceholderList: { gap: 8, marginTop: 10, opacity: 0.55 },
  memoryPlaceholderRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 10,
  },
  memoryPlaceholderIcon: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  memoryPlaceholderCopy: { flex: 1, minWidth: 0, gap: 6 },
  memoryPlaceholderBar: { height: 8, borderRadius: 999 },
  memoryRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, borderWidth: 1, padding: 10 },
  memoryIcon: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  memoryCopy: { flex: 1, minWidth: 0 },
  memoryTitle: { fontSize: 13 },
  memoryMeta: { fontSize: 11.5, marginTop: 1 },
  latestWalk: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 2 },
  latestWalkDot: { width: 8, height: 8, borderRadius: 4 },
  latestWalkCopy: { flex: 1, minWidth: 0 },
  latestWalkTitle: { fontSize: 12.5 },
  latestWalkMeta: { fontSize: 11.5, marginTop: 1 },
  titleList: { gap: 8 },
  titleRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  // Locked tiers echo the memory-shelf placeholder language: dashed border,
  // softened contents - waiting, not warning.
  titleRowLocked: { borderStyle: "dashed" },
  titleBadgeArtLocked: { opacity: 0.5 },
  tierTrack: { height: 6, borderRadius: 999, marginTop: 6, overflow: "hidden" },
  tierFill: { height: "100%", borderRadius: 999 },
  titleIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  titleCopy: { flex: 1, minWidth: 0 },
  titleName: { fontSize: 14 },
  titleMeta: { fontSize: 11, marginTop: 1 },
  nextTitle: { fontSize: 11.5, lineHeight: 16, marginTop: 10 },
});

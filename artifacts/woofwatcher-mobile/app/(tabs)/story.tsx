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
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
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
import { enterUp, PressScale, ProgressFill } from "@/components/motion/GameFeel";
import { type DayTrailStop } from "@/components/DayTrailScene";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
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
  MIN_MOBILE_TOUCH_TARGET,
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
  { key: "adventures", label: "Today" },
  { key: "memories", label: "Memories" },
  { key: "badges", label: "Progress" },
];

/** Care-log type -> pixel glyph for the real day timeline. Falls back to a
 *  neutral note glyph so an unmapped type never renders blank. */
const STORY_STOP_ICON: Record<string, PixelIconName> = {
  meal: "meal",
  walk: "walk",
  potty: "pee",
  medication: "medication",
  treat: "treat",
  play: "play",
  training: "training",
  note: "note",
  symptom: "health",
  incident: "health",
  grooming: "heart",
  hydration: "note",
  alone: "clock",
  weight: "energy",
  mood: "happy",
  bile: "bile",
};

/** How far up the level curve to scan for distinct badge titles. The top
 *  title lands at Lv 20 today; scanning past it keeps the ladder complete if
 *  the shared title table ever grows. */
const MAX_BADGE_LADDER_LEVEL = 40;

// Mock-board pixel art: the adventure map hero and its trail thumbnails are
// decorative game art; every name, date, and count layered on top comes from
// real logged walks only.
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

/** Mock-board month header for the memories grid: "May 2026". */
function formatMemoryMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

function entryPhotoUri(details: { [key: string]: unknown } | undefined): string {
  const uri = details?.photoProofAttachmentUri;
  return typeof uri === "string" ? uri.trim() : "";
}

/** One tile in the mock-board memories grid: a real saved adventure memory or
 *  a real care-log proof photo, never a placeholder image. */
type MemoryGridItem = {
  id: string;
  kind: "memory" | "entry";
  title: string;
  dateIso: string;
  photoUri?: string;
  entryId?: string;
};

/** A real walk log with journal-worthy content (note, mood, or photo). */
type WalkJournalStory = {
  id: string;
  occurredAt: string;
  text: string;
  mood?: string;
  photoUri?: string;
};

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
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduced) return; // Reduce Motion: hold the marker steady, no pulsing loop
    pulse.value = withRepeat(
      withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reduced]);

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
  const { width: windowWidth } = useWindowDimensions();
  const { state } = useCare();
  const now = Date.now();
  /* Mock-board memories grid: 3 columns on the parchment background - 16px
     screen gutters and two 8px gaps between rounded tiles. */
  const memoryTile = Math.floor((windowWidth - 32 - 16) / 3);
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

  /* Mock-board memories grid: every tile is a real saved adventure memory or
     a real care-log proof photo, grouped by month, newest first. Memories
     without a photo yet render as quiet note tiles - never stock imagery. */
  const memoryMonths = useMemo(() => {
    const items: MemoryGridItem[] = [];
    for (const memory of adventure.memories) {
      items.push({
        id: `memory-${memory.id}`,
        kind: "memory",
        title: memory.title,
        dateIso: memory.createdAt,
        photoUri: memory.photoUri?.trim() || undefined,
      });
    }
    for (const entry of state.entries) {
      if (entry.details?.householdVisible === false) continue;
      const uri = entryPhotoUri(entry.details);
      if (!uri) continue;
      items.push({
        id: `entry-${entry.id}`,
        kind: "entry",
        title: entry.title || "Care log photo",
        dateIso: entry.occurredAt,
        photoUri: uri,
        entryId: entry.id,
      });
    }
    items.sort((a, b) => (Date.parse(b.dateIso) || 0) - (Date.parse(a.dateIso) || 0));
    const months: { key: string; label: string; items: MemoryGridItem[] }[] = [];
    for (const item of items) {
      const label = formatMemoryMonth(item.dateIso);
      const last = months[months.length - 1];
      if (last && last.label === label) last.items.push(item);
      else months.push({ key: `${label}-${months.length}`, label, items: [item] });
    }
    return months;
  }, [adventure.memories, state.entries]);

  /* Walk journal: real walk logs that carry journal content (a note, a mood,
     or a proof photo), told as mock-board story cards. There is no reaction
     or heart model in the care data, so the cards show no heart counts -
     counts are never invented. */
  const walkJournal = useMemo(() => {
    const stories: WalkJournalStory[] = [];
    for (const entry of state.entries) {
      if (entry.details?.householdVisible === false) continue;
      if (normalizeCareEventType(entry.type, entry.details) !== "walk") continue;
      const occurred = Date.parse(entry.occurredAt);
      if (!Number.isFinite(occurred) || occurred > now) continue;
      const note = (entry.note ?? "").trim();
      const mood = (entry.mood ?? "").trim();
      const photoUri = entryPhotoUri(entry.details);
      if (!note && !mood && !photoUri) continue;
      stories.push({
        id: entry.id,
        occurredAt: entry.occurredAt,
        text: note || entry.title || "Walk",
        mood: mood || undefined,
        photoUri: photoUri || undefined,
      });
    }
    stories.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
    return stories.slice(0, 3);
  }, [state.entries, now]);

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

  /* Day Trail: today's real, household-visible care logs in the order they
     happened - the waypoints of the empty-state hero. The scene draws only
     what was actually logged; it never invents stops. */
  const dayTrailStops = useMemo<DayTrailStop[]>(() => {
    const today = new Date(now);
    const stops: { at: number; stop: DayTrailStop }[] = [];
    for (const entry of state.entries) {
      if (entry.details?.householdVisible === false) continue;
      const occurred = Date.parse(entry.occurredAt);
      if (!Number.isFinite(occurred) || occurred > now) continue;
      const when = new Date(occurred);
      if (
        when.getFullYear() !== today.getFullYear() ||
        when.getMonth() !== today.getMonth() ||
        when.getDate() !== today.getDate()
      ) {
        continue;
      }
      stops.push({
        at: occurred,
        stop: {
          id: entry.id,
          type: normalizeCareEventType(entry.type, entry.details),
          label: entry.title || "Care log",
          timeLabel: when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        },
      });
    }
    stops.sort((a, b) => a.at - b.at);
    return stops.map((item) => item.stop);
  }, [state.entries, now]);

  /* One-line recap that pays off Home's "Today's Story" promise - the same
     real logs, summarized. Empty state is honest, never a fake highlight. */
  const latestTodayStop = dayTrailStops.length > 0 ? dayTrailStops[dayTrailStops.length - 1] : null;
  const todayRecap = latestTodayStop
    ? `${dayTrailStops.length} care moment${dayTrailStops.length === 1 ? "" : "s"} today - latest: ${latestTodayStop.label}.`
    : `${petName}'s story is ready for its first care moment today.`;

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
            {/* Today: the real recap + progress, paying off Home's "Today's
                Story" promise with the same real logs instead of a painting. */}
            <BoardCard style={s.board} enter={0}>
              <Text style={[s.todayRecap, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                {todayRecap}
              </Text>
              <View style={s.levelStrip}>
                <View style={[s.levelBadge, { backgroundColor: colors.sageSoft, borderColor: colors.sage + "55" }]}>
                  <Text style={[s.levelBadgeValue, { color: colors.forest, fontFamily: TITLE_SERIF }]}>
                    {career.level}
                  </Text>
                  <Text style={[s.levelBadgeLabel, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                    Level
                  </Text>
                </View>
                <View style={s.levelCopy}>
                  <Text style={[s.levelTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    {career.title}
                  </Text>
                  <ProgressFill
                    ratio={Math.max(0.02, career.levelProgress)}
                    color={colors.forest}
                    trackColor={colors.muted}
                    height={10}
                    style={s.xpTrack}
                  />
                  <Text style={[s.levelMeta, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    +{career.todayXp} XP today - {careStreak > 0 ? `${careStreak}-day streak` : "start your streak"}
                  </Text>
                </View>
              </View>
            </BoardCard>

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
              /* Real day timeline: today's actual care logs in the order they
                 happened - the honest record, not a painted fantasy trail.
                 Each row opens that log. */
              <BoardCard style={s.board} enter={1}>
                <BoardSectionHeader
                  title="Today's timeline"
                  accessory={
                    dayTrailStops.length > 0 ? (
                      <BoardPill label={`${dayTrailStops.length} logged`} tone={colors.sage} />
                    ) : undefined
                  }
                />
                {dayTrailStops.length > 0 ? (
                  <View style={s.todayTimeline}>
                    {dayTrailStops.map((stop, index) => (
                      <Pressable
                        key={stop.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${stop.label} at ${stop.timeLabel}. Open this log.`}
                        onPress={() => router.push(`/log?entry=${encodeURIComponent(stop.id)}` as never)}
                        style={({ pressed }) => [
                          s.todayStopRow,
                          {
                            borderBottomColor: colors.border,
                            borderBottomWidth: index === dayTrailStops.length - 1 ? 0 : 1,
                            opacity: pressed ? 0.6 : 1,
                          },
                        ]}
                      >
                        <View style={[s.todayStopIcon, { backgroundColor: colors.sageSoft }]}>
                          <PixelIcon name={STORY_STOP_ICON[stop.type] ?? "note"} size={18} />
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[s.todayStopLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
                        >
                          {stop.label}
                        </Text>
                        <Text style={[s.todayStopTime, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                          {stop.timeLabel}
                        </Text>
                        <Ionicons name="chevron-forward" size={15} color={colors.mutedForeground} />
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={[s.todayEmpty, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    Nothing logged yet today. Log a meal, walk, or potty and it shows up here as it happens.
                  </Text>
                )}
              </BoardCard>
            )}

            {/* Recent adventures: real visited places from logged walks. */}
            <BoardCard style={s.board} enter={0}>
              <BoardSectionHeader title="Recent Adventures" />
              {trailStops.length > 0 ? (
                <View style={s.trailList}>
                  {trailStops.map((stop, index) => (
                    <PressScale
                      key={stop.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open Adventure Trail: ${stop.name}, ${stop.visits} ${stop.visits === 1 ? "visit" : "visits"}.`}
                      onPress={openAdventure}
                      scaleTo={0.97}
                      style={s.trailRow}
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
                    </PressScale>
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
            <BoardCard style={s.board} enter={1}>
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

            {/* Walk journal: real walk logs with notes, moods, or proof
                photos as mock-board story cards - date header, story text,
                photo thumb, and soft activity tags. No heart counts: there is
                no reaction model in the care data, and counts are never
                invented. */}
            {walkJournal.length > 0 ? (
              <>
                <Animated.View entering={enterUp(2)}>
                  <Text style={[s.quietLabel, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    Walk journal
                  </Text>
                </Animated.View>
                {walkJournal.map((story, index) => (
                  <BoardCard key={story.id} style={s.board} padded={false} enter={3 + index}>
                    <PressScale
                      accessibilityRole="button"
                      accessibilityLabel={`Open walk story from ${formatMemoryDate(story.occurredAt)}: ${story.text}`}
                      accessibilityHint="Opens this walk in the care log."
                      onPress={() =>
                        router.push(`/log?entry=${encodeURIComponent(story.id)}` as never)
                      }
                      scaleTo={0.97}
                      style={s.journalCard}
                    >
                      <View style={s.journalBody}>
                        <View style={s.journalCopy}>
                          <Text style={[s.journalDate, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                            {formatMemoryDate(story.occurredAt)}
                          </Text>
                          <Text
                            numberOfLines={3}
                            style={[s.journalText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                          >
                            {story.text}
                          </Text>
                          <View style={s.journalChips}>
                            <View style={[s.journalChip, { backgroundColor: colors.sageSoft }]}>
                              <Text style={[s.journalChipText, { color: colors.forest, fontFamily: "Inter_700Bold" }]}>
                                Walk
                              </Text>
                            </View>
                            {story.mood ? (
                              <View style={[s.journalChip, { backgroundColor: colors.amberSoft }]}>
                                <Text style={[s.journalChipText, { color: colors.amber, fontFamily: "Inter_700Bold" }]}>
                                  {sentenceCase(story.mood)}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        {story.photoUri ? (
                          <Image
                            source={{ uri: story.photoUri }}
                            style={[s.journalThumb, { backgroundColor: colors.muted }]}
                            resizeMode="cover"
                            accessibilityIgnoresInvertColors
                          />
                        ) : null}
                      </View>
                    </PressScale>
                  </BoardCard>
                ))}
              </>
            ) : null}
          </>
        ) : null}

        {segment === "memories" ? (
          memoryMonths.length > 0 ? (
            <>
              {/* Mock-board memories grid: quiet month headers over 3-column
                  rounded tiles, straight on the parchment background. Every
                  tile is a real saved memory or care-log proof photo. */}
              {memoryMonths.map((month, monthIndex) => (
                <Animated.View key={month.key} entering={enterUp(monthIndex)} style={s.memoryMonth}>
                  <Text style={[s.quietLabel, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    {month.label}
                  </Text>
                  <View style={s.memoryGrid}>
                    {month.items.map((item) => (
                      <PressScale
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityLabel={
                          item.kind === "memory"
                            ? `Open adventure memory: ${item.title}, ${formatMemoryDate(item.dateIso)}.`
                            : `Open care log photo: ${item.title}, ${formatMemoryDate(item.dateIso)}.`
                        }
                        accessibilityHint={
                          item.kind === "memory"
                            ? "Opens Adventure Mode, where memories are saved and shared."
                            : "Opens the care log this photo belongs to."
                        }
                        onPress={() =>
                          item.kind === "entry" && item.entryId
                            ? router.push(`/log?entry=${encodeURIComponent(item.entryId)}` as never)
                            : openAdventure()
                        }
                        scaleTo={0.95}
                        containerStyle={{ width: memoryTile }}
                      >
                        {item.photoUri ? (
                          <Image
                            source={{ uri: item.photoUri }}
                            style={[
                              s.memoryPhoto,
                              {
                                width: memoryTile,
                                height: Math.round(memoryTile * (4 / 3)),
                                backgroundColor: colors.muted,
                              },
                            ]}
                            resizeMode="cover"
                            accessibilityIgnoresInvertColors
                          />
                        ) : (
                          /* A real memory saved without a photo yet: a quiet
                             note tile, never a stand-in image. */
                          <View
                            style={[
                              s.memoryNoteTile,
                              {
                                width: memoryTile,
                                height: Math.round(memoryTile * (4 / 3)),
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                              },
                            ]}
                          >
                            <View style={[s.memoryNoteIcon, { backgroundColor: colors.sageSoft }]}>
                              <Ionicons name="book-outline" size={14} color={colors.forest} />
                            </View>
                            <Text
                              numberOfLines={3}
                              style={[s.memoryNoteTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                            >
                              {item.title}
                            </Text>
                          </View>
                        )}
                      </PressScale>
                    ))}
                  </View>
                </Animated.View>
              ))}
              <BoardCard style={s.board} enter={Math.min(memoryMonths.length, 8)}>
                <Text style={[s.footnote, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Memories stay private to the household. Photos stay on this device for now -
                  cloud backup isn't available yet.
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
            </>
          ) : (
            /* Honest empty state: no saved memories or proof photos yet. The
                dashed tiles preview the real grid shape (same size and radius
                as filled memory tiles) so the promise is visual, not just
                copy - nothing in them pretends to be data. */
            <BoardCard style={s.board} enter={0}>
              <BoardSectionHeader title="Memories" />
              <View style={s.memoryEmptyRow}>
                {(["walk", "heart", "note"] as const).map((icon) => (
                  <View
                    key={icon}
                    style={[
                      s.memoryEmptyTile,
                      {
                        // Grid tiles are sized for the full-bleed grid; inside
                        // the padded card, size to its inner width instead so
                        // the third tile never clips.
                        width: Math.floor((windowWidth - 32 - 32 - 16) / 3),
                        height: Math.round(((windowWidth - 32 - 32 - 16) / 3) * (4 / 3)),
                        borderColor: colors.border,
                        backgroundColor: colors.accent,
                      },
                    ]}
                  >
                    <View style={s.memoryEmptyIcon}>
                      <PixelIcon name={icon} size={24} />
                    </View>
                  </View>
                ))}
              </View>
              <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Photos from walks and stories land here.
              </Text>
              <Text style={[s.footnote, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Photos stay on this device for now - cloud backup isn't available yet.
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
          )
        ) : null}

        {segment === "badges" ? (
          <>
            {/* Care career: level, XP, and streak from real logged care only. */}
            <BoardCard style={s.board} enter={0}>
              <BoardSectionHeader
                title="Care career"
                accessory={<BoardPill label={career.levelLabel} tone={colors.sage} />}
              />
              <View style={s.levelStrip}>
                <View style={[s.levelBadge, { backgroundColor: colors.sageSoft, borderColor: colors.sage + "55" }]}>
                  <Text style={[s.levelBadgeValue, { color: colors.forest, fontFamily: TITLE_SERIF }]}>
                    {career.level}
                  </Text>
                  <Text style={[s.levelBadgeLabel, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                    Level
                  </Text>
                </View>
                <View style={s.levelCopy}>
                  <Text style={[s.levelTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    {career.title}
                  </Text>
                  <ProgressFill
                    ratio={Math.max(0.02, career.levelProgress)}
                    color={colors.forest}
                    trackColor={colors.muted}
                    height={10}
                    style={s.xpTrack}
                  />
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
            <BoardCard style={s.board} enter={1}>
              <BoardSectionHeader
                title="Badge ladder"
                accessory={
                  <BoardPill label={`${earnedTitles.length} of ${badgeLadder.length} earned`} tone={colors.sage} />
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
                    /* Earned: cream tile, full-color badge art, sage pill. */
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
                            backgroundColor: colors.background,
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
                        <BoardStatusPill label={current ? "Current" : "Earned"} tone="done" />
                      </View>
                    );
                  }

                  /* Locked: quiet, never alarming - muted tile with a lock,
                     the real unlock level, and honest lifetime-XP progress
                     toward it. */
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
                      <View style={[s.titleLockIcon, { backgroundColor: colors.muted }]}>
                        <Ionicons name="lock-closed" size={14} color={colors.mutedForeground} />
                      </View>
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
  todayRecap: { fontSize: 16, lineHeight: 22, marginBottom: 14 },
  todayTimeline: { marginTop: 2 },
  todayStopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
  },
  todayStopIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  todayStopLabel: { flex: 1, fontSize: 14 },
  todayStopTime: { fontSize: 12.5 },
  todayEmpty: { fontSize: 13.5, lineHeight: 19, paddingVertical: 4 },
  sectionCopy: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  emptyText: { fontSize: 12.5, lineHeight: 18, marginBottom: 6 },
  footnote: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  cardButton: { marginTop: 10 },
  levelStrip: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  levelBadge: { width: 64, height: 64, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  levelBadgeValue: { fontSize: 26, lineHeight: 30 },
  levelBadgeLabel: { fontSize: 9, textTransform: "uppercase", letterSpacing: 1.1 },
  levelCopy: { flex: 1, minWidth: 0 },
  levelTitle: { fontSize: 17 },
  xpTrack: { marginTop: 7 },
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
  trailCopy: { flex: 1, minWidth: 0 },
  trailName: { fontSize: 14 },
  trailMeta: { fontSize: 11.5, marginTop: 2 },
  /* Mock-board memories grid: quiet month headers over 3-column rounded
     tiles on the parchment background. */
  quietLabel: { fontSize: 14, marginBottom: 8, marginLeft: 2, marginTop: 2 },
  memoryMonth: { marginBottom: 14 },
  memoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  memoryEmptyRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  memoryEmptyTile: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  memoryEmptyIcon: {
    opacity: 0.5,
  },
  memoryPhoto: { borderRadius: 14 },
  memoryNoteTile: {
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    gap: 6,
  },
  memoryNoteIcon: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  memoryNoteTitle: { fontSize: 10, lineHeight: 13, textAlign: "center" },
  /* Mock-board story cards: date header, story text, photo thumb right,
     soft activity tag chips. */
  journalCard: { padding: 14 },
  journalBody: { flexDirection: "row", gap: 12 },
  journalCopy: { flex: 1, minWidth: 0 },
  journalDate: { fontSize: 11.5 },
  journalText: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  journalChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
  journalChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  journalChipText: { fontSize: 10.5, letterSpacing: 0.2 },
  journalThumb: { width: 72, height: 72, borderRadius: 14 },
  latestWalk: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 2 },
  latestWalkDot: { width: 8, height: 8, borderRadius: 4 },
  latestWalkCopy: { flex: 1, minWidth: 0 },
  latestWalkTitle: { fontSize: 12.5 },
  latestWalkMeta: { fontSize: 11.5, marginTop: 1 },
  titleList: { gap: 8 },
  titleRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  // Locked tiers stay quiet: dashed border, muted lock - waiting, not
  // warning.
  titleRowLocked: { borderStyle: "dashed" },
  titleLockIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tierTrack: { height: 6, borderRadius: 999, marginTop: 6, overflow: "hidden" },
  tierFill: { height: "100%", borderRadius: 999 },
  titleCopy: { flex: 1, minWidth: 0 },
  titleName: { fontSize: 14 },
  titleMeta: { fontSize: 11, marginTop: 1 },
  nextTitle: { fontSize: 11.5, lineHeight: 16, marginTop: 10 },
});

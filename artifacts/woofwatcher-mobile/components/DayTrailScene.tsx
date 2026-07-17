import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { EntryTypeIcon, entryTypeColor } from "@/components/EntryTypeIcon";
import { SpriteSheetPlayer } from "@/components/SpriteSheetPlayer";
import { useColors } from "@/hooks/useColors";
import { CARE_TWIN_SPRITE_MANIFEST } from "@/lib/avatarLifeEngine";
import { getCareTwinSpriteAsset } from "@/lib/careTwinAssets";

/**
 * DayTrailScene - the Story hero before any walk records a real route.
 *
 * Instead of a static painting, the trail is drawn in code and every marker on
 * it is a real care log from today, placed in the order it happened. The care
 * twin stands at the latest stop - literally "where the day is now" - and the
 * sky follows the actual time of day, the same honesty rule as the living
 * room: the scene only ever presents real state, it never invents it.
 */

export interface DayTrailStop {
  id: string;
  /** Normalized care event type (meal, walk, potty, medication, ...). */
  type: string;
  label: string;
  timeLabel: string;
}

interface Props {
  stops: readonly DayTrailStop[];
  petName: string;
  now?: number;
  onPressStop?: (stopId: string) => void;
  style?: StyleProp<ViewStyle>;
}

type DayPhase = "morning" | "day" | "evening" | "night";

/** Scene palette per phase. The scene is its own little world (like the room
 *  art), so these are scene constants, not theme tokens. */
const PHASES: Record<
  DayPhase,
  {
    sky: [string, string];
    orb: string;
    orbGlow: string;
    treeCanopy: string;
    treeTrunk: string;
    meadow: string;
    ground: string;
    pebbleA: string;
    pebbleB: string;
    wash: string;
    stars: boolean;
  }
> = {
  morning: {
    sky: ["#F9DFAE", "#F6EFD8"],
    orb: "#F4C86A",
    orbGlow: "rgba(244, 200, 106, 0.35)",
    treeCanopy: "#4D7A48",
    treeTrunk: "#7A5B3A",
    meadow: "#A9C18F",
    ground: "#D9C29A",
    pebbleA: "#C2A97E",
    pebbleB: "#B39A70",
    wash: "rgba(244, 200, 106, 0.08)",
    stars: false,
  },
  day: {
    sky: ["#BFD9E8", "#EAF2E0"],
    orb: "#F7E3A4",
    orbGlow: "rgba(247, 227, 164, 0.4)",
    treeCanopy: "#4D8A56",
    treeTrunk: "#7A5B3A",
    meadow: "#A9C18F",
    ground: "#DCC7A0",
    pebbleA: "#C2A97E",
    pebbleB: "#B39A70",
    wash: "rgba(255, 255, 255, 0)",
    stars: false,
  },
  evening: {
    sky: ["#EDA96C", "#F3DEB9"],
    orb: "#E8935A",
    orbGlow: "rgba(232, 147, 90, 0.38)",
    treeCanopy: "#3E6B44",
    treeTrunk: "#6E4F33",
    meadow: "#96AD7F",
    ground: "#CBB48D",
    pebbleA: "#B39A70",
    pebbleB: "#A28960",
    wash: "rgba(232, 147, 90, 0.10)",
    stars: false,
  },
  night: {
    sky: ["#0D1D33", "#22364E"],
    orb: "#E8E2CE",
    orbGlow: "rgba(232, 226, 206, 0.28)",
    treeCanopy: "#2C4A3C",
    treeTrunk: "#4A3826",
    meadow: "#4E6650",
    ground: "#6E5F45",
    pebbleA: "#8A785A",
    pebbleB: "#7A6A4E",
    wash: "rgba(13, 29, 51, 0.16)",
    stars: true,
  },
};

function phaseFor(now: number): DayPhase {
  const hour = new Date(now).getHours();
  if (hour < 6 || hour >= 20) return "night";
  if (hour < 11) return "morning";
  if (hour < 17) return "day";
  return "evening";
}

/** Fixed star field (night only) - stable positions, no randomness. */
const STARS: readonly { x: number; y: number; s: number }[] = [
  { x: 0.08, y: 0.06, s: 3 }, { x: 0.22, y: 0.12, s: 2 }, { x: 0.34, y: 0.05, s: 2 },
  { x: 0.52, y: 0.1, s: 3 }, { x: 0.66, y: 0.04, s: 2 }, { x: 0.79, y: 0.13, s: 2 },
  { x: 0.91, y: 0.07, s: 3 }, { x: 0.45, y: 0.17, s: 2 },
];

/** Distant treeline - chunky pixel trees at fixed spots along the horizon. */
const TREES: readonly { x: number; h: number; w: number }[] = [
  { x: 0.02, h: 34, w: 26 }, { x: 0.15, h: 26, w: 20 }, { x: 0.3, h: 38, w: 28 },
  { x: 0.52, h: 24, w: 18 }, { x: 0.66, h: 34, w: 26 }, { x: 0.84, h: 28, w: 22 },
];

/** The trail: a wandering S-curve, bottom-left trailhead to upper-right. */
const ANCHORS: readonly { x: number; y: number }[] = [
  { x: 0.1, y: 0.9 },
  { x: 0.46, y: 0.82 },
  { x: 0.78, y: 0.68 },
  { x: 0.48, y: 0.56 },
  { x: 0.22, y: 0.47 },
  { x: 0.5, y: 0.4 },
  { x: 0.82, y: 0.34 },
];

const SAMPLES_PER_SEGMENT = 10;

/** Sample the anchor chain as smoothed quadratic segments (midpoint spline). */
function samplePath(width: number, height: number): { x: number; y: number }[] {
  const pts = ANCHORS.map((a) => ({ x: a.x * width, y: a.y * height }));
  const out: { x: number; y: number }[] = [pts[0]];
  for (let s = 0; s < pts.length - 2; s++) {
    const p0 = s === 0 ? pts[0] : { x: (pts[s].x + pts[s + 1].x) / 2, y: (pts[s].y + pts[s + 1].y) / 2 };
    const c = pts[s + 1];
    const p1 =
      s === pts.length - 3
        ? pts[s + 2]
        : { x: (pts[s + 1].x + pts[s + 2].x) / 2, y: (pts[s + 1].y + pts[s + 2].y) / 2 };
    for (let k = 1; k <= SAMPLES_PER_SEGMENT; k++) {
      const t = k / SAMPLES_PER_SEGMENT;
      const mt = 1 - t;
      out.push({
        x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
        y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
      });
    }
  }
  return out;
}

const WALK_TRACK = CARE_TWIN_SPRITE_MANIFEST["walk-loop"];
const IDLE_TRACK = CARE_TWIN_SPRITE_MANIFEST["idle-breathe"];
const WALK_SPRITE = getCareTwinSpriteAsset("walk-loop");
const IDLE_SPRITE = getCareTwinSpriteAsset("idle-breathe");

const MAX_STOPS = 6;
const SPRITE_SIZE = 68;

export function DayTrailScene({ stops, petName, now, onPressStop, style }: Props) {
  const colors = useColors();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const phase = phaseFor(now ?? Date.now());
  const palette = PHASES[phase];

  const shown = stops.slice(-MAX_STOPS);

  const layout = useMemo(() => {
    if (!size) return null;
    const path = samplePath(size.width, size.height);
    const last = path.length - 1;
    // Waypoints sit along the walked stretch of the trail; the twin stands
    // one step past the latest stop. An empty day parks the twin at the
    // trailhead with the whole path still ahead.
    const waypoints = shown.map((stop, index) => {
      const t = shown.length === 1 ? 0.18 : 0.08 + (0.62 * index) / (shown.length - 1);
      const p = path[Math.round(t * last)];
      return { stop, x: p.x, y: p.y };
    });
    const twinT = shown.length === 0 ? 0.02 : shown.length === 1 ? 0.3 : 0.08 + 0.62 + 0.1;
    const twinPoint = path[Math.min(last, Math.round(twinT * last))];
    return { path, waypoints, twinPoint };
  }, [size, shown]);

  const summaryLabel =
    shown.length === 0
      ? `Today's trail. No care stops yet - ${petName} is waiting at the trailhead.`
      : `Today's trail. ${shown.length} care ${shown.length === 1 ? "stop" : "stops"} so far. Latest: ${shown[shown.length - 1].label} at ${shown[shown.length - 1].timeLabel}.`;

  const spriteAsset = shown.length > 0 ? WALK_SPRITE : IDLE_SPRITE;
  const spriteTrack = shown.length > 0 ? WALK_TRACK : IDLE_TRACK;

  return (
    <View
      accessibilityLabel={summaryLabel}
      style={[styles.scene, style]}
      onLayout={(event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) setSize({ width, height });
      }}
    >
      {/* Sky */}
      <LinearGradient colors={palette.sky} style={styles.sky} />
      {palette.stars
        ? STARS.map((star, index) => (
            <View
              key={`star-${index}`}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: `${star.x * 100}%`,
                top: `${star.y * 100}%`,
                width: star.s,
                height: star.s,
                backgroundColor: "#F3ECDA",
                opacity: 0.9,
              }}
            />
          ))
        : null}
      {/* Sun / moon */}
      <View pointerEvents="none" style={styles.orbWrap}>
        <View style={[styles.orbGlow, { backgroundColor: palette.orbGlow }]} />
        <View style={[styles.orb, { backgroundColor: palette.orb }]} />
      </View>

      {/* Distant treeline on the horizon */}
      {size
        ? TREES.map((tree, index) => (
            <View
              key={`tree-${index}`}
              pointerEvents="none"
              style={{ position: "absolute", left: tree.x * size.width, top: size.height * 0.42 - tree.h }}
            >
              <View style={{ width: tree.w, height: tree.h * 0.44, backgroundColor: palette.treeCanopy }} />
              <View
                style={{
                  width: tree.w * 0.62,
                  height: tree.h * 0.34,
                  marginTop: -tree.h * 0.1,
                  alignSelf: "center",
                  backgroundColor: palette.treeCanopy,
                }}
              />
              <View
                style={{
                  width: 6,
                  height: tree.h * 0.3,
                  alignSelf: "center",
                  backgroundColor: palette.treeTrunk,
                }}
              />
            </View>
          ))
        : null}

      {/* Meadow and ground */}
      <View style={[styles.meadow, { backgroundColor: palette.meadow }]} />
      <View style={[styles.ground, { backgroundColor: palette.ground }]} />

      {/* Trail pebbles - the day's path, drawn not painted */}
      {layout
        ? layout.path.map((point, index) => {
            if (index % 2 !== 0) return null;
            const depth = 1 - (index / layout.path.length) * 0.45;
            const pebble = 5 * depth;
            return (
              <View
                key={`pebble-${index}`}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: point.x - pebble / 2,
                  top: point.y - pebble / 2,
                  width: pebble + (index % 4 === 0 ? 1.5 : 0),
                  height: pebble,
                  borderRadius: 1.5,
                  backgroundColor: index % 4 === 0 ? palette.pebbleA : palette.pebbleB,
                  opacity: shown.length === 0 ? 0.6 : 0.95,
                }}
              />
            );
          })
        : null}

      {/* Real care stops as waypoints, in the order they happened */}
      {layout
        ? layout.waypoints.map(({ stop, x, y }, index) => (
            <Animated.View
              key={stop.id}
              entering={FadeInDown.delay(Math.min(index, 6) * 70).springify().damping(20).stiffness(240)}
              style={{ position: "absolute", left: x - 17, top: y - 17 }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${stop.label}, ${stop.timeLabel}. Open this log.`}
                hitSlop={6}
                onPress={onPressStop ? () => onPressStop(stop.id) : undefined}
                style={({ pressed }) => [
                  styles.waypoint,
                  {
                    backgroundColor: colors.ivory,
                    borderColor: entryTypeColor(stop.type, colors),
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                  },
                ]}
              >
                <EntryTypeIcon type={stop.type} size={16} />
              </Pressable>
            </Animated.View>
          ))
        : null}

      {/* The care twin, standing where the day is now */}
      {layout && spriteAsset ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: layout.twinPoint.x - SPRITE_SIZE / 2,
            top: layout.twinPoint.y - SPRITE_SIZE + 10,
          }}
        >
          <View style={[styles.twinShadow, { backgroundColor: "rgba(42, 37, 25, 0.22)" }]} />
          <SpriteSheetPlayer
            asset={spriteAsset}
            track={spriteTrack}
            width={SPRITE_SIZE}
            height={SPRITE_SIZE}
            testID="story-day-trail-sprite"
          />
        </View>
      ) : null}

      {/* Phase wash for cohesion */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.wash }]} />

      {/* Day chip: honest stop count */}
      <View style={[styles.dayChip, { backgroundColor: colors.card + "F0", borderColor: colors.border }]}>
        <Text style={[styles.dayChipText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {shown.length === 0
            ? "Today's trail starts here"
            : `Today's trail - ${shown.length} ${shown.length === 1 ? "stop" : "stops"}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  sky: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "46%",
  },
  orbWrap: {
    position: "absolute",
    right: "12%",
    top: "6%",
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  orbGlow: {
    position: "absolute",
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  orb: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  meadow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "42%",
    height: "22%",
  },
  ground: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "60%",
    bottom: 0,
  },
  waypoint: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2A2519",
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  twinShadow: {
    position: "absolute",
    bottom: 2,
    alignSelf: "center",
    width: SPRITE_SIZE * 0.56,
    height: 9,
    borderRadius: 5,
  },
  dayChip: {
    position: "absolute",
    top: 12,
    left: 12,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dayChipText: {
    fontSize: 11.5,
  },
});

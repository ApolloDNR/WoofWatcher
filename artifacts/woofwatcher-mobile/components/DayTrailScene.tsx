import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { DayPhaseWash } from "@/components/DayPhaseWash";
import { EntryTypeIcon, entryTypeColor } from "@/components/EntryTypeIcon";
import { SpriteSheetPlayer } from "@/components/SpriteSheetPlayer";
import { useColors } from "@/hooks/useColors";
import { hapticSelect } from "@/lib/haptics";
import { CARE_TWIN_SPRITE_MANIFEST } from "@/lib/avatarLifeEngine";
import { getCareTwinSpriteAsset } from "@/lib/careTwinAssets";

/**
 * DayTrailScene - the Story hero before any walk records a real route.
 *
 * Same architecture as the living room: the hand-painted pixel world is the
 * stage, and everything alive on it is real state. The painted map's own
 * dashed trail is the path; every marker pinned along it is one of today's
 * actual care logs in the order they happened, the care twin walks the trail
 * to the latest stop, and nightfall washes over the map on the real clock.
 * The scene never invents a stop.
 */

const MAP_ART = require("@/assets/story/adventure-map.png");

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

/**
 * The painted map's own dashed trail, traced as fractions of the artwork.
 * It runs from the trailhead sign at the bottom-left up past the fire sign
 * to the paw badge. The card and the artwork share a 5:4 aspect, so cover
 * cropping is negligible and these fractions map straight onto the card.
 */
const ANCHORS: readonly { x: number; y: number }[] = [
  { x: 0.245, y: 0.8 },
  { x: 0.27, y: 0.66 },
  { x: 0.255, y: 0.56 },
  { x: 0.3, y: 0.47 },
  { x: 0.38, y: 0.425 },
  { x: 0.475, y: 0.37 },
  { x: 0.555, y: 0.335 },
  { x: 0.625, y: 0.28 },
  { x: 0.645, y: 0.245 },
];

const SAMPLES_PER_SEGMENT = 8;

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

export function DayTrailScene({ stops, petName, now, onPressStop, style }: Props) {
  const colors = useColors();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const shown = stops.slice(-MAX_STOPS);

  const layout = useMemo(() => {
    if (!size) return null;
    const path = samplePath(size.width, size.height);
    const last = path.length - 1;
    // Waypoints cover the walked stretch of the painted trail; the twin is a
    // step past the latest stop. An empty day parks the twin a few steps up
    // the trail (t=0.24, not the t=0.01 trailhead): Story's "trail is
    // waiting" guidance card overlays the scene's bottom band on empty days
    // and was covering the twin's paws at the trailhead.
    const waypoints = shown.map((stop, index) => {
      const t = shown.length === 1 ? 0.16 : 0.05 + (0.58 * index) / (shown.length - 1);
      const p = path[Math.round(t * last)];
      return { stop, x: p.x, y: p.y };
    });
    const twinT = shown.length === 0 ? 0.24 : shown.length === 1 ? 0.28 : 0.05 + 0.58 + 0.1;
    const twinPoint = path[Math.min(last, Math.round(twinT * last))];
    return { waypoints, twinPoint };
  }, [size, shown]);

  const summaryLabel =
    shown.length === 0
      ? `Today's trail. No care stops yet - ${petName} is waiting at the trailhead.`
      : `Today's trail. ${shown.length} care ${shown.length === 1 ? "stop" : "stops"} so far. Latest: ${shown[shown.length - 1].label} at ${shown[shown.length - 1].timeLabel}.`;

  const spriteAsset = shown.length > 0 ? WALK_SPRITE : IDLE_SPRITE;
  const spriteTrack = shown.length > 0 ? WALK_TRACK : IDLE_TRACK;
  // The trail climbs "into" the map: the farther along, the smaller the twin.
  const spriteSize = layout ? Math.round(46 + 28 * (layout.twinPoint.y / Math.max(1, size?.height ?? 1))) : 64;

  return (
    <View
      accessibilityLabel={summaryLabel}
      style={[styles.scene, style]}
      onLayout={(event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) setSize({ width, height });
      }}
    >
      {/* The hand-painted world - the same stagecraft as the living room. */}
      <Image source={MAP_ART} style={styles.mapArt} resizeMode="cover" fadeDuration={0} />

      {/* Real care stops pinned along the painted trail, in the order they
          happened. A nested Pressable claims the touch, so tapping a stop
          opens its log without triggering the hero press. */}
      {layout
        ? layout.waypoints.map(({ stop, x, y }, index) => (
            <Animated.View
              key={stop.id}
              entering={FadeInDown.delay(Math.min(index, 6) * 70).springify().damping(20).stiffness(240)}
              style={{ position: "absolute", left: x - 15, top: y - 15 }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${stop.label}, ${stop.timeLabel}. Open this log.`}
                hitSlop={8}
                onPress={
                  onPressStop
                    ? () => {
                        hapticSelect();
                        onPressStop(stop.id);
                      }
                    : undefined
                }
                style={({ pressed }) => [
                  styles.waypoint,
                  {
                    backgroundColor: colors.ivory,
                    borderColor: entryTypeColor(stop.type, colors),
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                  },
                ]}
              >
                <EntryTypeIcon type={stop.type} size={15} />
              </Pressable>
            </Animated.View>
          ))
        : null}

      {/* The care twin, walking the painted trail to where the day is now. */}
      {layout && spriteAsset ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: layout.twinPoint.x - spriteSize / 2,
            top: layout.twinPoint.y - spriteSize + 8,
          }}
        >
          <View
            style={[
              styles.twinShadow,
              { width: spriteSize * 0.52, backgroundColor: "rgba(20, 26, 16, 0.3)" },
            ]}
          />
          <SpriteSheetPlayer
            asset={spriteAsset}
            track={spriteTrack}
            width={spriteSize}
            height={spriteSize}
            testID="story-day-trail-sprite"
          />
        </View>
      ) : null}

      {/* Nightfall / dawn wash over the whole scene - atmosphere, never data. */}
      <DayPhaseWash now={now} />

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
  mapArt: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  waypoint: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#141A10",
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  twinShadow: {
    position: "absolute",
    bottom: 1,
    alignSelf: "center",
    height: 8,
    borderRadius: 4,
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

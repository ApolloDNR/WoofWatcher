import React from "react";
import { StyleSheet, View } from "react-native";

/**
 * DayPhaseWash - the shared time-of-day atmosphere for painted stage scenes
 * (the Story Day Trail, the Adventure hero). A translucent wash keyed to the
 * real clock, plus a starfield after dark. Scenery only: it tints the painted
 * world and never touches data or copy legibility layers placed above it.
 */

export type DayPhase = "morning" | "day" | "evening" | "night";

export function phaseFor(now: number): DayPhase {
  const hour = new Date(now).getHours();
  if (hour < 6 || hour >= 20) return "night";
  if (hour < 11) return "morning";
  if (hour < 17) return "day";
  return "evening";
}

const PHASE_WASH: Record<DayPhase, string> = {
  morning: "rgba(255, 214, 140, 0.10)",
  day: "rgba(255, 255, 255, 0)",
  evening: "rgba(220, 118, 60, 0.16)",
  night: "rgba(8, 20, 36, 0.44)",
};

/** Fixed star field (night only) - stable positions in the upper sky. */
const STARS: readonly { x: number; y: number; s: number }[] = [
  { x: 0.07, y: 0.05, s: 3 }, { x: 0.2, y: 0.1, s: 2 }, { x: 0.33, y: 0.04, s: 2 },
  { x: 0.5, y: 0.08, s: 3 }, { x: 0.63, y: 0.03, s: 2 }, { x: 0.78, y: 0.09, s: 2 },
  { x: 0.9, y: 0.05, s: 3 }, { x: 0.44, y: 0.13, s: 2 },
];

export function DayPhaseWash({ now }: { now?: number }) {
  const phase = phaseFor(now ?? Date.now());
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: PHASE_WASH[phase] }]} />
      {phase === "night"
        ? STARS.map((star, index) => (
            <View
              key={`star-${index}`}
              style={{
                position: "absolute",
                left: `${star.x * 100}%`,
                top: `${star.y * 100}%`,
                width: star.s,
                height: star.s,
                backgroundColor: "#F3ECDA",
                opacity: 0.85,
              }}
            />
          ))
        : null}
    </View>
  );
}

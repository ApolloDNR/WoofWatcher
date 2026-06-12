import React from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";

// Pixel-art icons cropped from the WoofWatcher design board.
const SOURCES = {
  meal: require("@/assets/board/icons/meal.png"),
  walk: require("@/assets/board/icons/walk.png"),
  pee: require("@/assets/board/icons/pee.png"),
  poo: require("@/assets/board/icons/poo.png"),
  training: require("@/assets/board/icons/training.png"),
  treat: require("@/assets/board/icons/treat.png"),
  play: require("@/assets/board/icons/play.png"),
  vomit: require("@/assets/board/icons/vomit.png"),
  medication: require("@/assets/board/icons/medication.png"),
  clock: require("@/assets/board/icons/clock.png"),
  anxious: require("@/assets/board/icons/anxious.png"),
  note: require("@/assets/board/icons/note.png"),
  mood_great: require("@/assets/board/icons/mood_great.png"),
  mood_good: require("@/assets/board/icons/mood_good.png"),
  mood_okay: require("@/assets/board/icons/mood_okay.png"),
  mood_meh: require("@/assets/board/icons/mood_meh.png"),
  mood_rough: require("@/assets/board/icons/mood_rough.png"),
  happy: require("@/assets/board/icons/happy.png"),
  energy: require("@/assets/board/icons/energy.png"),
  hunger: require("@/assets/board/icons/hunger.png"),
  bond: require("@/assets/board/icons/bond.png"),
  health: require("@/assets/board/icons/health.png"),
  bile: require("@/assets/board/icons/bile.png"),
  heart: require("@/assets/board/icons/heart.png"),
} as const;

export type PixelIconName = keyof typeof SOURCES;

export const PIXEL_ICON_NAMES = Object.keys(SOURCES) as PixelIconName[];

export function PixelIcon({
  name,
  size = 28,
  style,
}: {
  name: PixelIconName;
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={SOURCES[name]}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      fadeDuration={0}
    />
  );
}

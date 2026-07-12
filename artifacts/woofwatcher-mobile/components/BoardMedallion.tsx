import React from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";

// Baked button medallions: circle, border, inner shading, and icon drawn as
// ONE asset in the storybook style, so buttons read as crafted game UI
// instead of flat icons pasted onto colored circles. Generated against the
// shipped flat icon set, so both systems share identical iconography.
const SOURCES = {
  meal: require("@/assets/board/buttons/meal.png"),
  pee: require("@/assets/board/buttons/pee.png"),
  walk: require("@/assets/board/buttons/walk.png"),
  medication: require("@/assets/board/buttons/medication.png"),
  bile: require("@/assets/board/buttons/bile.png"),
  note: require("@/assets/board/buttons/note.png"),
  training: require("@/assets/board/buttons/training.png"),
  play: require("@/assets/board/buttons/play.png"),
  treat: require("@/assets/board/buttons/treat.png"),
  clock: require("@/assets/board/buttons/clock.png"),
  health: require("@/assets/board/buttons/health.png"),
  bond: require("@/assets/board/buttons/bond.png"),
  happy: require("@/assets/board/buttons/happy.png"),
  energy: require("@/assets/board/buttons/energy.png"),
  hunger: require("@/assets/board/buttons/hunger.png"),
  heart: require("@/assets/board/buttons/heart.png"),
} as const;

export type MedallionName = keyof typeof SOURCES;

export function hasMedallion(name: string): name is MedallionName {
  return name in SOURCES;
}

export function BoardMedallion({
  name,
  size = 56,
  style,
}: {
  name: MedallionName;
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

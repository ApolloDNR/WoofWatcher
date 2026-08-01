import React from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";

// Storybook avatar portraits for household people. These are stylized stock
// avatars (like any messaging app's default set), assigned deterministically
// per person name so each caregiver keeps the same face everywhere - they
// depict no real person and claim nothing about who the caregiver is.
const PORTRAITS = [
  require("@/assets/board/people/portrait-1.png"),
  require("@/assets/board/people/portrait-2.png"),
  require("@/assets/board/people/portrait-3.png"),
  require("@/assets/board/people/portrait-4.png"),
  require("@/assets/board/people/portrait-5.png"),
  require("@/assets/board/people/portrait-6.png"),
] as const;

export function personPortraitIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % PORTRAITS.length;
}

export function PersonPortrait({
  name,
  size = 40,
  style,
}: {
  name: string;
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      accessible={false}
      source={PORTRAITS[personPortraitIndex(name)]}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      resizeMode="cover"
      fadeDuration={0}
    />
  );
}

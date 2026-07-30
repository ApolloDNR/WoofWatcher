import React from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useColors } from "@/hooks/useColors";

/**
 * The canonical identity mark: Phoenix's painted head portrait in a circle.
 *
 * WoofWatcher renders the dog two deliberate ways:
 * - The LIVING TWIN (SpriteSheetPlayer / getAvatarSource) breathes and
 *   reacts to mood - it belongs in scenes and status surfaces (Home room,
 *   Pack pet card, Profile's tappable portrait, painted stages).
 * - The PORTRAIT (this component) is the still, framed "profile picture" -
 *   it marks identity wherever a face belongs next to a name: the Home
 *   header, up-next rows, the Dog ID card.
 *
 * Keeping the two roles separate is what makes each read intentional; use
 * this component instead of requiring the asset directly so every identity
 * mark shares one crop, ring, and background treatment.
 */

// The asset is pre-composed for circular crops: face optically centered
// (not bbox-centered - the 3/4 pose reads left-shifted otherwise), margin
// above the ears, chest grounding the bottom arc. See the avatar commits
// before changing the framing.
const PORTRAIT = require("@/assets/images/phoenix-avatar.png");

// The portrait's own parchment backdrop, baked into the asset. The frame
// uses it too so the circle reads as one printed token in both themes.
const PORTRAIT_PARCHMENT = "#EBE0C6";

export function PetPortrait({
  size,
  ringColor,
  ringWidth = 1,
  style,
}: {
  size: number;
  /** Defaults to the theme border; pass e.g. colors.gold for a hero ring. */
  ringColor?: string;
  ringWidth?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ringWidth,
          borderColor: ringColor ?? colors.border,
          backgroundColor: PORTRAIT_PARCHMENT,
        },
        style,
      ]}
    >
      <Image
        source={PORTRAIT}
        style={{ width: size - ringWidth * 2, height: size - ringWidth * 2, borderRadius: (size - ringWidth * 2) / 2 }}
        resizeMode="cover"
        fadeDuration={0}
        accessible={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});

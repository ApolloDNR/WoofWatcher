import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import colors from "@/constants/colors";

const NAVY = colors.light.brandNavy;
const COPPER = colors.light.copper;

const HEART = require("@/assets/board/icons/heart.png");

export function WoofWatcherMark({ size = 44 }: { size?: number }) {
  return (
    <Image
      source={HEART}
      style={{ width: size, height: size }}
      resizeMode="contain"
      fadeDuration={0}
    />
  );
}

export function WoofWatcherLogo({
  size = 40,
  layout = "row",
  wordmarkSize,
  navy = NAVY,
  copper = COPPER,
  style,
}: {
  size?: number;
  layout?: "row" | "stacked";
  wordmarkSize?: number;
  navy?: string;
  copper?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const ws = wordmarkSize ?? Math.round(size * 0.62);
  const stacked = layout === "stacked";
  return (
    <View
      style={[
        stacked ? styles.stacked : styles.row,
        stacked ? { gap: 6 } : { gap: Math.round(size * 0.3) },
        style,
      ]}
    >
      <WoofWatcherMark size={size} />
      <View style={styles.wordRow}>
        <Text
          style={[
            styles.word,
            { fontSize: ws, color: navy, fontFamily: "Fraunces_700Bold" },
          ]}
        >
          Woof
        </Text>
        <Text
          style={[
            styles.word,
            { fontSize: ws, color: copper, fontFamily: "Fraunces_700Bold" },
          ]}
        >
          Watcher
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  stacked: { flexDirection: "column", alignItems: "center" },
  wordRow: { flexDirection: "row", alignItems: "baseline" },
  word: { letterSpacing: 0.2, includeFontPadding: false },
});

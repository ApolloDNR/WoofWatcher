import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Svg, { G, Path } from "react-native-svg";

import colors from "@/constants/colors";

const NAVY = colors.light.brandNavy;
const COPPER = colors.light.copper;

const MARK_W = 467.784987;
const MARK_H = 632;
const MARK_VIEWBOX = `0 0 ${MARK_W} ${MARK_H}`;
const DOG_TRANSFORM = "translate(0.000000,475.924602) scale(0.100000,-0.100000)";
const DOG_PATH =
  "M1545 4741 c-50 -18 -54 -22 -137 -138 -15 -21 -57 -74 -93 -118 -36 -44 -78 -97 -93 -118 -15 -22 -42 -57 -61 -78 -19 -22 -46 -57 -60 -78 -14 -22 -59 -83 -100 -138 -41 -54 -93 -123 -115 -153 -22 -30 -53 -69 -69 -87 -16 -17 -46 -54 -66 -81 -20 -27 -52 -71 -71 -97 -19 -27 -63 -84 -97 -127 -35 -44 -63 -85 -63 -91 0 -7 -13 -32 -29 -56 -35 -52 -30 -80 29 -151 20 -25 47 -66 59 -91 21 -42 22 -48 8 -80 -41 -98 -115 -131 -201 -89 -51 24 -59 22 -82 -23 -9 -18 -38 -59 -64 -92 -25 -33 -58 -80 -72 -105 -14 -25 -36 -54 -48 -65 -12 -11 -34 -42 -47 -70 -14 -27 -36 -64 -49 -81 l-24 -31 0 -1001 0 -1002 45 -41 c65 -60 140 -115 178 -130 18 -7 57 -27 87 -45 30 -18 89 -45 130 -60 41 -14 91 -36 110 -49 19 -13 62 -29 95 -36 l60 -12 175 87 c218 109 256 119 430 120 161 0 199 -9 374 -94 107 -51 132 -68 216 -149 l95 -91 218 0 c119 0 217 2 217 4 0 2 -17 42 -38 88 -21 45 -47 108 -57 138 -51 155 -164 356 -254 453 -55 59 -213 170 -295 207 -165 74 -312 217 -356 346 -35 100 -70 269 -70 336 0 91 60 325 92 358 13 14 41 50 61 81 35 53 104 126 188 198 35 29 153 91 175 91 6 0 54 20 107 45 114 53 146 88 211 227 35 74 54 103 88 129 24 19 55 45 69 59 88 86 273 76 386 -23 49 -43 150 -200 168 -262 12 -40 29 -64 83 -116 90 -87 86 -85 199 -125 139 -50 149 -52 338 -64 94 -6 186 -15 205 -21 19 -5 54 -9 78 -9 36 0 48 -6 75 -34 21 -23 45 -36 72 -41 22 -4 61 -22 87 -41 50 -37 55 -47 102 -204 24 -82 28 -88 111 -170 48 -47 93 -97 101 -112 20 -38 18 -145 -4 -185 -121 -221 -218 -311 -421 -389 -176 -68 -251 -79 -541 -78 -245 0 -347 12 -420 48 -25 13 -83 38 -130 56 -47 19 -110 51 -140 72 -95 66 -208 73 -299 17 -28 -17 -31 -23 -31 -73 0 -31 5 -58 13 -64 6 -6 64 -20 127 -32 63 -12 158 -37 210 -57 177 -66 306 -83 778 -102 271 -11 447 19 530 90 18 16 56 41 85 55 69 35 190 150 250 238 27 39 55 78 62 86 8 8 28 53 46 100 18 47 40 96 49 110 22 32 127 269 147 334 11 35 13 68 8 121 l-6 72 -62 61 c-93 92 -141 104 -516 122 -179 8 -184 9 -211 35 -29 28 -32 29 -280 55 -128 13 -201 33 -260 70 -25 15 -63 33 -85 40 -63 20 -111 47 -134 77 -12 14 -37 37 -55 49 -39 27 -49 49 -75 169 -26 123 -91 230 -174 289 -74 52 -198 126 -213 126 -6 0 -73 32 -148 70 -118 60 -145 70 -189 70 -29 0 -65 7 -82 16 -55 30 -89 35 -255 43 -181 8 -224 20 -260 71 -44 61 -44 127 -4 705 18 263 20 512 4 595 -10 52 -53 141 -68 139 -4 0 -29 -8 -57 -18z m-26 -475 c48 -51 53 -96 40 -401 -6 -154 -9 -328 -5 -386 14 -232 -40 -367 -195 -492 -79 -63 -91 -68 -169 -68 -101 0 -165 44 -212 146 -31 68 -32 263 -1 405 30 135 119 313 228 454 46 61 96 133 111 160 26 49 127 183 148 198 18 13 32 9 55 -16z M2317 4223 c-32 -23 -149 -158 -197 -228 -8 -12 -35 -46 -60 -76 -135 -160 -200 -283 -200 -374 0 -59 37 -80 137 -77 64 2 91 -2 112 -14 81 -48 159 31 161 161 0 92 73 317 110 340 15 9 50 133 50 179 0 51 -28 110 -55 114 -11 1 -37 -10 -58 -25z M2456 2576 c-47 -44 -47 -74 -1 -115 44 -38 42 -38 93 0 59 43 55 87 -12 128 -42 26 -38 27 -80 -13z";

// Filled heart (24x24 base) placed at the dog's chin, lower-left.
const HEART_PATH =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

export function WoofWatcherMark({
  size = 44,
  navy = NAVY,
  copper = COPPER,
}: {
  size?: number;
  navy?: string;
  copper?: string;
}) {
  return (
    <Svg
      width={size}
      height={size * (MARK_H / MARK_W)}
      viewBox={MARK_VIEWBOX}
    >
      <G transform={DOG_TRANSFORM} fill={navy}>
        <Path d={DOG_PATH} />
      </G>
      <G transform="translate(24 446) scale(7)">
        <Path d={HEART_PATH} fill={copper} />
      </G>
    </Svg>
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
        stacked ? { gap: 6 } : { gap: Math.round(size * 0.28) },
        style,
      ]}
    >
      <WoofWatcherMark size={size} navy={navy} copper={copper} />
      <View style={styles.wordRow}>
        <Text
          style={[
            styles.word,
            { fontSize: ws, color: navy, fontFamily: "Fraunces_700Bold" },
          ]}
        >
          Woof
        </Text>
        <Text style={{ width: ws * 0.18 }} />
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

import { Platform, useColorScheme } from "react-native";

import colors from "@/constants/colors";

/**
 * Returns the design tokens for the current color scheme.
 *
 * The returned object contains all color tokens for the active palette
 * plus scheme-independent values like `radius`.
 *
 * The web preview intentionally stays on the light reference board so Apollo
 * can compare it against the mockups. Native iOS and Android builds follow the
 * device appearance setting through Expo's automatic userInterfaceStyle.
 */
export function useColors() {
  const scheme = useColorScheme();
  const palette = Platform.OS !== "web" && scheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius, pixelUi: colors.pixelUi };
}

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
 * Set EXPO_PUBLIC_WEB_COLOR_SCHEME=auto at export time to let the web build
 * follow prefers-color-scheme too — used to audit dark mode before release.
 */
const WEB_FOLLOWS_SCHEME = process.env.EXPO_PUBLIC_WEB_COLOR_SCHEME === "auto";

export function useColors() {
  const scheme = useColorScheme();
  const darkAllowed = Platform.OS !== "web" || WEB_FOLLOWS_SCHEME;
  const palette = darkAllowed && scheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius, pixelUi: colors.pixelUi };
}

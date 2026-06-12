import colors from "@/constants/colors";

/**
 * Returns the design tokens for the current color scheme.
 *
 * The returned object contains all color tokens for the active palette
 * plus scheme-independent values like `radius`.
 *
 * Falls back to the light palette when no dark key is defined in
 * constants/colors.ts (the scaffold ships light-only by default).
 * When a sibling web artifact's dark tokens are synced into a `dark`
 * key, this hook will automatically switch palettes based on the
 * device's appearance setting.
 */
export function useColors() {
  // The WoofWatcher board is a light-only design and the baked pixel-art
  // assets (hero scene, icons, heart mark) assume the cream palette, so the
  // mobile app always renders the light theme regardless of device appearance.
  return { ...colors.light, radius: colors.radius };
}

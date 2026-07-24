import { useGlobalSearchParams } from "expo-router";
import { Platform } from "react-native";

import {
  resolveWebQaFontScale,
  type ResolvedWebQaFontScale,
} from "@/lib/mobileLayout";

/**
 * Applies the explicit font-scale query only in the exported web QA build.
 * Native and production builds always preserve the runtime accessibility size.
 */
export function useWebQaFontScale(
  runtimeFontScale: number,
): ResolvedWebQaFontScale {
  const params = useGlobalSearchParams<{
    qaFontScale?: string | string[];
  }>();

  return resolveWebQaFontScale({
    platform: Platform.OS,
    runtimeFontScale,
    qaEnabled:
      process.env.EXPO_PUBLIC_WEB_QA_FONT_SCALE_PROOF === "1",
    qaFontScale: params.qaFontScale,
  });
}

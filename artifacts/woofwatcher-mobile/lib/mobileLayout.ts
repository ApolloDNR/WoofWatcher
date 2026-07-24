export type MobileRuntimePlatform = "android" | "ios" | "web" | string;

export interface MobileLayoutInput {
  platform: MobileRuntimePlatform;
  bottomInset?: number;
  fontScale?: number;
  topInset?: number;
}

export interface WebQaFontScaleInput {
  platform: MobileRuntimePlatform;
  runtimeFontScale?: number;
  qaEnabled?: boolean;
  qaFontScale?: string | string[];
}

export interface ResolvedWebQaFontScale {
  fontScale: number;
  qaFontScale?: number;
}

export type RouteTopPaddingSurface = "tabbed" | "standalone" | "setup" | "auth";

export interface FloatingTabChromeMetrics {
  tabBarBottom: number;
  tabBarHeight: number;
  tabBarHorizontalInset: number;
  tabBarRadius: number;
  centerFabBottom: number;
  centerFabSize: number;
  contentBottomPadding: number;
}

export interface AccessibleLayoutMetrics {
  fontScale: number;
  quickActionColumns: 2 | 3;
  quickActionWidth: "31.5%" | "48.5%";
  quickActionMinHeight: number;
  actionLabelNumberOfLines: 2;
  controlMinHeight: number;
  stackFormFields: boolean;
  stackStatusRows: boolean;
  metadataNumberOfLines: 1 | 2;
}

export const MIN_MOBILE_TOUCH_TARGET = 48;
export const MOBILE_INLINE_HIT_SLOP = 10;

const TAB_BAR_NATIVE_HEIGHT = 72;
const TAB_BAR_WEB_HEIGHT = 72;
const TAB_BAR_NATIVE_BOTTOM = 12;
const TAB_BAR_WEB_BOTTOM = 12;
const TAB_BAR_HORIZONTAL_INSET = 16;
const TAB_BAR_RADIUS = 26;
const CENTER_FAB_SIZE = 56;
const CENTER_FAB_BOTTOM_OFFSET = 18;
const CENTER_FAB_FALLBACK_SAFE_BOTTOM = 8;
const TABBED_ROUTE_MIN_BOTTOM_PADDING = 110;
const TABBED_ROUTE_BOTTOM_GUTTER = 16;
const STANDALONE_ROUTE_MIN_BOTTOM_PADDING = 72;
const STANDALONE_ROUTE_BOTTOM_GUTTER = 40;
const DOCKED_COMPOSER_MIN_BOTTOM_PADDING = 12;
const DOCKED_COMPOSER_WEB_BOTTOM_PADDING = 46;
const DOCKED_COMPOSER_BOTTOM_GUTTER = 12;
const NATIVE_TABBED_TOP_OFFSET = 8;
const NATIVE_STANDALONE_TOP_OFFSET = 12;
const NATIVE_SETUP_TOP_OFFSET = 14;
const NATIVE_AUTH_TOP_OFFSET = 48;
const WEB_TABBED_TOP_INSET = 24;
const WEB_STANDALONE_TOP_INSET = 18;
const WEB_SETUP_TOP_INSET = 24;
const WEB_AUTH_TOP_INSET = 24;
const MODAL_SHEET_MIN_BOTTOM_PADDING = 32;
const MODAL_SHEET_BOTTOM_GUTTER = 20;
const CENTERED_MODAL_HORIZONTAL_PADDING = 28;
const CENTERED_MODAL_EDGE_CLEARANCE = 24;
const CENTERED_MODAL_INSET_GUTTER = 16;
const TABBED_FLOATING_FEEDBACK_OFFSET = 96;
const STANDALONE_FLOATING_FEEDBACK_OFFSET = 22;
const FLOATING_DEBUG_TOP_OFFSET = 16;
const WEB_FLOATING_DEBUG_TOP_INSET = 24;

function isWebPlatform(platform: MobileRuntimePlatform): boolean {
  return platform === "web";
}

function normalizeBottomInset(platform: MobileRuntimePlatform, bottomInset = 0): number {
  if (isWebPlatform(platform)) return 0;
  return Math.max(0, bottomInset);
}

function normalizeTopInset(platform: MobileRuntimePlatform, topInset = 0): number {
  if (isWebPlatform(platform)) return 0;
  return Math.max(0, topInset);
}

function normalizeFontScale(fontScale = 1): number {
  if (!Number.isFinite(fontScale)) return 1;
  return Math.min(2, Math.max(1, fontScale));
}

function interpolateFontScale(
  fontScale: number,
  normal: number,
  large: number,
  accessibility: number,
): number {
  if (fontScale <= 1.4) {
    return normal + ((fontScale - 1) / 0.4) * (large - normal);
  }
  return large + ((fontScale - 1.4) / 0.6) * (accessibility - large);
}

/**
 * Resolves the explicit font-scale query used by exported web QA proof.
 * Native platforms and normal web builds always retain the runtime setting.
 */
export function resolveWebQaFontScale(
  input: WebQaFontScaleInput,
): ResolvedWebQaFontScale {
  const runtimeFontScale = normalizeFontScale(input.runtimeFontScale);
  if (!isWebPlatform(input.platform) || !input.qaEnabled) {
    return { fontScale: runtimeFontScale };
  }

  const rawValue = Array.isArray(input.qaFontScale)
    ? input.qaFontScale[0]
    : input.qaFontScale;
  if (typeof rawValue !== "string" || rawValue.trim() === "") {
    return { fontScale: runtimeFontScale };
  }

  const requestedFontScale = Number(rawValue);
  if (!Number.isFinite(requestedFontScale)) {
    return { fontScale: runtimeFontScale };
  }

  const qaFontScale = normalizeFontScale(requestedFontScale);
  return { fontScale: qaFontScale, qaFontScale };
}

/**
 * Shared reflow contract for the care loop. Font scaling changes layout,
 * instead of forcing enlarged labels into fixed three-column or one-line
 * controls. Values above 2 use the 2x layout while React Native continues
 * scaling the text itself.
 */
export function getAccessibleLayoutMetrics(
  input: MobileLayoutInput,
): AccessibleLayoutMetrics {
  const fontScale = normalizeFontScale(input.fontScale);
  const usesAccessibilityReflow = fontScale >= 1.4;

  return {
    fontScale,
    quickActionColumns: usesAccessibilityReflow ? 2 : 3,
    quickActionWidth: usesAccessibilityReflow ? "48.5%" : "31.5%",
    quickActionMinHeight: Math.round(82 + (fontScale - 1) * 38),
    actionLabelNumberOfLines: 2,
    controlMinHeight: Math.round(
      MIN_MOBILE_TOUCH_TARGET + (fontScale - 1) * 16,
    ),
    stackFormFields: usesAccessibilityReflow,
    stackStatusRows: usesAccessibilityReflow,
    metadataNumberOfLines: fontScale >= 2 ? 1 : 2,
  };
}

/**
 * Encodes branch evidence on `nativeID`, which is supported by React Native
 * and maps to a DOM id on web. Normal/native builds receive `undefined`.
 */
export function createWebQaLayoutMarker(
  qaFontScale: number | undefined,
  layout: AccessibleLayoutMetrics,
): string | undefined {
  if (qaFontScale === undefined) return undefined;
  return [
    `fontScale=${qaFontScale}`,
    `stackStatusRows=${layout.stackStatusRows}`,
    `quickActionColumns=${layout.quickActionColumns}`,
    `controlMinHeight=${layout.controlMinHeight}`,
  ].join(";");
}

export function getFloatingTabChromeMetrics(input: MobileLayoutInput): FloatingTabChromeMetrics {
  const web = isWebPlatform(input.platform);
  const bottomInset = normalizeBottomInset(input.platform, input.bottomInset);
  const fontScale = normalizeFontScale(input.fontScale);
  const tabBarBottom = web ? TAB_BAR_WEB_BOTTOM : TAB_BAR_NATIVE_BOTTOM;
  const baseTabBarHeight = web ? TAB_BAR_WEB_HEIGHT : TAB_BAR_NATIVE_HEIGHT;
  const tabBarHeight = Math.round(
    interpolateFontScale(fontScale, baseTabBarHeight, 82, 96),
  );
  const centerFabSize = Math.round(
    interpolateFontScale(fontScale, CENTER_FAB_SIZE, 62, 72),
  );
  const tabBarHorizontalInset = Math.round(
    interpolateFontScale(fontScale, TAB_BAR_HORIZONTAL_INSET, 14, 10),
  );
  const tabBarRadius = Math.round(
    interpolateFontScale(fontScale, TAB_BAR_RADIUS, 29, 34),
  );
  const centerFabBottom =
    (bottomInset || CENTER_FAB_FALLBACK_SAFE_BOTTOM) + CENTER_FAB_BOTTOM_OFFSET;
  const chromeBottomClearance = Math.max(
    tabBarBottom + tabBarHeight,
    centerFabBottom + centerFabSize,
  );

  return {
    tabBarBottom,
    tabBarHeight,
    tabBarHorizontalInset,
    tabBarRadius,
    centerFabBottom,
    centerFabSize,
    contentBottomPadding: Math.max(
      TABBED_ROUTE_MIN_BOTTOM_PADDING,
      chromeBottomClearance + TABBED_ROUTE_BOTTOM_GUTTER,
    ),
  };
}

export function getTabbedRouteBottomPadding(input: MobileLayoutInput): number {
  return getFloatingTabChromeMetrics(input).contentBottomPadding;
}

export function getRouteTopPadding(
  input: MobileLayoutInput & { surface: RouteTopPaddingSurface },
): number {
  const web = isWebPlatform(input.platform);
  const topInset = normalizeTopInset(input.platform, input.topInset);

  if (input.surface === "auth") {
    return (web ? WEB_AUTH_TOP_INSET : topInset) + NATIVE_AUTH_TOP_OFFSET;
  }

  if (input.surface === "setup") {
    return (web ? WEB_SETUP_TOP_INSET : topInset) + NATIVE_SETUP_TOP_OFFSET;
  }

  if (input.surface === "standalone") {
    return (web ? WEB_STANDALONE_TOP_INSET : topInset) + NATIVE_STANDALONE_TOP_OFFSET;
  }

  return (web ? WEB_TABBED_TOP_INSET : topInset) + NATIVE_TABBED_TOP_OFFSET;
}

export function getStandaloneRouteBottomPadding(input: MobileLayoutInput): number {
  const bottomInset = normalizeBottomInset(input.platform, input.bottomInset);
  return Math.max(STANDALONE_ROUTE_MIN_BOTTOM_PADDING, bottomInset + STANDALONE_ROUTE_BOTTOM_GUTTER);
}

export function getDockedComposerBottomPadding(input: MobileLayoutInput): number {
  if (isWebPlatform(input.platform)) return DOCKED_COMPOSER_WEB_BOTTOM_PADDING;

  const bottomInset = normalizeBottomInset(input.platform, input.bottomInset);
  return Math.max(DOCKED_COMPOSER_MIN_BOTTOM_PADDING, bottomInset + DOCKED_COMPOSER_BOTTOM_GUTTER);
}

export function getModalSheetBottomPadding(input: MobileLayoutInput): number {
  const bottomInset = normalizeBottomInset(input.platform, input.bottomInset);
  return Math.max(MODAL_SHEET_MIN_BOTTOM_PADDING, bottomInset + MODAL_SHEET_BOTTOM_GUTTER);
}

export function getCenteredModalBackdropPadding(input: MobileLayoutInput): {
  paddingHorizontal: number;
  paddingTop: number;
  paddingBottom: number;
} {
  const topInset = normalizeTopInset(input.platform, input.topInset);
  const bottomInset = normalizeBottomInset(input.platform, input.bottomInset);
  return {
    paddingHorizontal: CENTERED_MODAL_HORIZONTAL_PADDING,
    paddingTop: Math.max(CENTERED_MODAL_EDGE_CLEARANCE, topInset + CENTERED_MODAL_INSET_GUTTER),
    paddingBottom: Math.max(CENTERED_MODAL_EDGE_CLEARANCE, bottomInset + CENTERED_MODAL_INSET_GUTTER),
  };
}

export function getFloatingFeedbackBottomOffset(
  input: MobileLayoutInput & { surface: "tabbed" | "standalone" },
): number {
  const effectiveInset = isWebPlatform(input.platform) && input.surface === "standalone"
    ? DOCKED_COMPOSER_WEB_BOTTOM_PADDING - DOCKED_COMPOSER_BOTTOM_GUTTER
    : normalizeBottomInset(input.platform, input.bottomInset);
  const offset = input.surface === "tabbed" ? TABBED_FLOATING_FEEDBACK_OFFSET : STANDALONE_FLOATING_FEEDBACK_OFFSET;
  return effectiveInset + offset;
}

export function getFloatingDebugButtonTopOffset(input: MobileLayoutInput): number {
  const effectiveInset = isWebPlatform(input.platform) ? WEB_FLOATING_DEBUG_TOP_INSET : normalizeTopInset(input.platform, input.topInset);
  return effectiveInset + FLOATING_DEBUG_TOP_OFFSET;
}

export function getKeyboardAvoidingVerticalOffset(
  input: MobileLayoutInput & { surface: Exclude<RouteTopPaddingSurface, "auth"> },
): number {
  if (isWebPlatform(input.platform)) return 0;
  return getRouteTopPadding(input);
}

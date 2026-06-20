export type MobileRuntimePlatform = "android" | "ios" | "web" | string;

export interface MobileLayoutInput {
  platform: MobileRuntimePlatform;
  bottomInset?: number;
}

export interface FloatingTabChromeMetrics {
  tabBarBottom: number;
  tabBarHeight: number;
  tabBarHorizontalInset: number;
  tabBarRadius: number;
  centerFabBottom: number;
  centerFabSize: number;
  contentBottomPadding: number;
}

const TAB_BAR_NATIVE_HEIGHT = 72;
const TAB_BAR_WEB_HEIGHT = 78;
const TAB_BAR_NATIVE_BOTTOM = 8;
const TAB_BAR_WEB_BOTTOM = 12;
const TAB_BAR_HORIZONTAL_INSET = 12;
const TAB_BAR_RADIUS = 28;
const CENTER_FAB_SIZE = 64;
const CENTER_FAB_BOTTOM_OFFSET = 26;
const CENTER_FAB_FALLBACK_SAFE_BOTTOM = 10;
const TABBED_ROUTE_MIN_BOTTOM_PADDING = 130;
const TABBED_ROUTE_BOTTOM_GUTTER = 18;
const STANDALONE_ROUTE_MIN_BOTTOM_PADDING = 72;
const STANDALONE_ROUTE_BOTTOM_GUTTER = 40;

function isWebPlatform(platform: MobileRuntimePlatform): boolean {
  return platform === "web";
}

function normalizeBottomInset(platform: MobileRuntimePlatform, bottomInset = 0): number {
  if (isWebPlatform(platform)) return 0;
  return Math.max(0, bottomInset);
}

export function getFloatingTabChromeMetrics(input: MobileLayoutInput): FloatingTabChromeMetrics {
  const web = isWebPlatform(input.platform);
  const bottomInset = normalizeBottomInset(input.platform, input.bottomInset);
  const tabBarBottom = web ? TAB_BAR_WEB_BOTTOM : TAB_BAR_NATIVE_BOTTOM;
  const tabBarHeight = web ? TAB_BAR_WEB_HEIGHT : TAB_BAR_NATIVE_HEIGHT;
  const centerFabBottom =
    (bottomInset || CENTER_FAB_FALLBACK_SAFE_BOTTOM) + CENTER_FAB_BOTTOM_OFFSET;
  const chromeBottomClearance = Math.max(
    tabBarBottom + tabBarHeight,
    centerFabBottom + CENTER_FAB_SIZE,
  );

  return {
    tabBarBottom,
    tabBarHeight,
    tabBarHorizontalInset: TAB_BAR_HORIZONTAL_INSET,
    tabBarRadius: TAB_BAR_RADIUS,
    centerFabBottom,
    centerFabSize: CENTER_FAB_SIZE,
    contentBottomPadding: Math.max(
      TABBED_ROUTE_MIN_BOTTOM_PADDING,
      chromeBottomClearance + TABBED_ROUTE_BOTTOM_GUTTER,
    ),
  };
}

export function getTabbedRouteBottomPadding(input: MobileLayoutInput): number {
  return getFloatingTabChromeMetrics(input).contentBottomPadding;
}

export function getStandaloneRouteBottomPadding(input: MobileLayoutInput): number {
  const bottomInset = normalizeBottomInset(input.platform, input.bottomInset);
  return Math.max(STANDALONE_ROUTE_MIN_BOTTOM_PADDING, bottomInset + STANDALONE_ROUTE_BOTTOM_GUTTER);
}

export type FloatingTabChromeMetrics = {
  tabBarBottom: number;
  tabBarHeight: number;
  fabBottom: number;
  routeBottomPadding: number;
};

export type RouteTopPaddingSurface = "tabbed" | "standalone" | "setup" | "auth";

export const MIN_MOBILE_TOUCH_TARGET = 48;
export const MOBILE_INLINE_HIT_SLOP = 10;

const NATIVE_TAB_BAR_BOTTOM = 8;
const NATIVE_TAB_BAR_HEIGHT = 72;
const NATIVE_FAB_BOTTOM_OFFSET = 26;
const NATIVE_ROUTE_CLEARANCE = 130;
const NATIVE_TABBED_TOP_OFFSET = 8;
const NATIVE_STANDALONE_TOP_OFFSET = 12;
const NATIVE_SETUP_TOP_OFFSET = 14;
const NATIVE_AUTH_TOP_OFFSET = 48;
const WEB_TAB_BAR_BOTTOM = 12;
const WEB_TAB_BAR_HEIGHT = 78;
const WEB_FAB_BOTTOM_OFFSET = 26;
const WEB_ROUTE_CLEARANCE = 130;
const WEB_TABBED_TOP_INSET = 24;
const WEB_STANDALONE_TOP_INSET = 18;
const WEB_SETUP_TOP_INSET = 24;
const WEB_AUTH_TOP_INSET = 24;
const STANDALONE_ROUTE_CLEARANCE = 88;
const STANDALONE_COMPOSER_CLEARANCE = 24;
const STANDALONE_COMPOSER_INSET_OFFSET = 12;
const WEB_COMPOSER_BOTTOM_INSET = 34;
const MODAL_SHEET_CLEARANCE = 32;
const MODAL_SHEET_INSET_OFFSET = 20;
const CENTERED_MODAL_HORIZONTAL_PADDING = 28;
const CENTERED_MODAL_EDGE_CLEARANCE = 24;
const CENTERED_MODAL_INSET_OFFSET = 16;
const TABBED_FEEDBACK_OFFSET = 96;
const STANDALONE_FEEDBACK_OFFSET = 22;
const FLOATING_DEBUG_TOP_OFFSET = 16;
const WEB_FLOATING_DEBUG_TOP_INSET = 24;

export function getFloatingTabChromeMetrics(bottomInset: number, isWeb: boolean): FloatingTabChromeMetrics {
  if (isWeb) {
    return {
      tabBarBottom: WEB_TAB_BAR_BOTTOM,
      tabBarHeight: WEB_TAB_BAR_HEIGHT,
      fabBottom: bottomInset + WEB_FAB_BOTTOM_OFFSET,
      routeBottomPadding: WEB_ROUTE_CLEARANCE,
    };
  }

  return {
    tabBarBottom: NATIVE_TAB_BAR_BOTTOM,
    tabBarHeight: NATIVE_TAB_BAR_HEIGHT,
    fabBottom: bottomInset + NATIVE_FAB_BOTTOM_OFFSET,
    routeBottomPadding: Math.max(NATIVE_ROUTE_CLEARANCE, bottomInset + 108),
  };
}

export function getTabbedRouteBottomPadding(bottomInset: number, isWeb: boolean): number {
  return getFloatingTabChromeMetrics(bottomInset, isWeb).routeBottomPadding;
}

export function getRouteTopPadding(
  topInset: number,
  surface: RouteTopPaddingSurface,
  isWeb: boolean,
): number {
  if (surface === "auth") {
    return (isWeb ? WEB_AUTH_TOP_INSET : topInset) + NATIVE_AUTH_TOP_OFFSET;
  }

  if (surface === "setup") {
    return (isWeb ? WEB_SETUP_TOP_INSET : topInset) + NATIVE_SETUP_TOP_OFFSET;
  }

  if (surface === "standalone") {
    return (isWeb ? WEB_STANDALONE_TOP_INSET : topInset) + NATIVE_STANDALONE_TOP_OFFSET;
  }

  return (isWeb ? WEB_TABBED_TOP_INSET : topInset) + NATIVE_TABBED_TOP_OFFSET;
}

export function getStandaloneRouteBottomPadding(bottomInset: number): number {
  return Math.max(STANDALONE_ROUTE_CLEARANCE, bottomInset + 54);
}

export function getStandaloneComposerBottomPadding(bottomInset: number, isWeb: boolean): number {
  const effectiveInset = isWeb ? WEB_COMPOSER_BOTTOM_INSET : bottomInset;
  return Math.max(STANDALONE_COMPOSER_CLEARANCE, effectiveInset + STANDALONE_COMPOSER_INSET_OFFSET);
}

export function getModalSheetBottomPadding(bottomInset: number): number {
  return Math.max(MODAL_SHEET_CLEARANCE, bottomInset + MODAL_SHEET_INSET_OFFSET);
}

export function getCenteredModalBackdropPadding(topInset: number, bottomInset: number) {
  return {
    paddingHorizontal: CENTERED_MODAL_HORIZONTAL_PADDING,
    paddingTop: Math.max(CENTERED_MODAL_EDGE_CLEARANCE, topInset + CENTERED_MODAL_INSET_OFFSET),
    paddingBottom: Math.max(CENTERED_MODAL_EDGE_CLEARANCE, bottomInset + CENTERED_MODAL_INSET_OFFSET),
  };
}

export function getFloatingFeedbackBottomOffset(
  bottomInset: number,
  surface: "tabbed" | "standalone",
  isWeb: boolean,
): number {
  const effectiveInset = isWeb && surface === "standalone" ? WEB_COMPOSER_BOTTOM_INSET : bottomInset;
  const offset = surface === "tabbed" ? TABBED_FEEDBACK_OFFSET : STANDALONE_FEEDBACK_OFFSET;
  return effectiveInset + offset;
}

export function getFloatingDebugButtonTopOffset(topInset: number, isWeb: boolean): number {
  const effectiveInset = isWeb ? WEB_FLOATING_DEBUG_TOP_INSET : topInset;
  return effectiveInset + FLOATING_DEBUG_TOP_OFFSET;
}

export function getKeyboardAvoidingVerticalOffset(
  topInset: number,
  surface: Exclude<RouteTopPaddingSurface, "auth">,
  isWeb: boolean,
): number {
  if (isWeb) {
    return 0;
  }

  return getRouteTopPadding(topInset, surface, false);
}

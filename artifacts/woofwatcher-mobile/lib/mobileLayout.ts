export type FloatingTabChromeMetrics = {
  tabBarBottom: number;
  tabBarHeight: number;
  fabBottom: number;
  routeBottomPadding: number;
};

const NATIVE_TAB_BAR_BOTTOM = 8;
const NATIVE_TAB_BAR_HEIGHT = 72;
const NATIVE_FAB_BOTTOM_OFFSET = 26;
const NATIVE_ROUTE_CLEARANCE = 130;
const WEB_TAB_BAR_BOTTOM = 12;
const WEB_TAB_BAR_HEIGHT = 78;
const WEB_FAB_BOTTOM_OFFSET = 26;
const WEB_ROUTE_CLEARANCE = 130;
const STANDALONE_ROUTE_CLEARANCE = 88;
const STANDALONE_COMPOSER_CLEARANCE = 24;
const STANDALONE_COMPOSER_INSET_OFFSET = 12;
const WEB_COMPOSER_BOTTOM_INSET = 34;
const MODAL_SHEET_CLEARANCE = 32;
const MODAL_SHEET_INSET_OFFSET = 20;

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

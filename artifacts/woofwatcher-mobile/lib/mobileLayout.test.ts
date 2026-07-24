import assert from "node:assert/strict";
import { test } from "node:test";

import * as mobileLayoutModule from "./mobileLayout.ts";
import {
  getCenteredModalBackdropPadding,
  getDockedComposerBottomPadding,
  getFloatingDebugButtonTopOffset,
  getFloatingFeedbackBottomOffset,
  getFloatingTabChromeMetrics,
  getAccessibleLayoutMetrics,
  getKeyboardAvoidingVerticalOffset,
  getModalSheetBottomPadding,
  getRouteTopPadding,
  getStandaloneRouteBottomPadding,
  getTabbedRouteBottomPadding,
  MOBILE_INLINE_HIT_SLOP,
  MIN_MOBILE_TOUCH_TARGET,
} from "./mobileLayout.ts";

type ResolveWebQaFontScale = (input: {
  platform: string;
  runtimeFontScale?: number;
  qaEnabled?: boolean;
  qaFontScale?: string | string[];
}) => {
  fontScale: number;
  qaFontScale?: number;
};

test("derives iOS tabbed route padding from the floating paw and safe area", () => {
  const metrics = getFloatingTabChromeMetrics({ platform: "ios", bottomInset: 34 });

  assert.equal(metrics.tabBarHeight, 72);
  assert.equal(metrics.tabBarBottom, 12);
  assert.equal(metrics.centerFabBottom, 52);
  assert.equal(metrics.centerFabSize, 56);
  assert.equal(metrics.contentBottomPadding, 124);
  assert.equal(getTabbedRouteBottomPadding({ platform: "ios", bottomInset: 34 }), 124);
});

test("keeps Android and web tabbed routes clear of the floating nav without wasting space", () => {
  assert.equal(getTabbedRouteBottomPadding({ platform: "android", bottomInset: 0 }), 110);
  assert.equal(getTabbedRouteBottomPadding({ platform: "web", bottomInset: 99 }), 110);

  const webMetrics = getFloatingTabChromeMetrics({ platform: "web", bottomInset: 99 });
  assert.equal(webMetrics.tabBarHeight, 72);
  assert.equal(webMetrics.tabBarBottom, 12);
  assert.equal(webMetrics.centerFabBottom, 26);
});

test("keeps the floating paw chrome compact enough for first-screen command cards", () => {
  for (const platform of ["android", "web"]) {
    const metrics = getFloatingTabChromeMetrics({ platform, bottomInset: 0 });
    const bottomChromeClearance = Math.max(
      metrics.tabBarBottom + metrics.tabBarHeight,
      metrics.centerFabBottom + metrics.centerFabSize,
    );

    assert.ok(bottomChromeClearance <= 86, `${platform} bottom chrome should not eat the route`);
    assert.ok(metrics.centerFabSize >= MIN_MOBILE_TOUCH_TARGET, `${platform} center paw stays tappable`);
    assert.ok(metrics.tabBarHeight >= 72, `${platform} tab bar keeps labels readable`);
  }

  const iosMetrics = getFloatingTabChromeMetrics({ platform: "ios", bottomInset: 34 });
  const iosBottomChromeClearance = Math.max(
    iosMetrics.tabBarBottom + iosMetrics.tabBarHeight,
    iosMetrics.centerFabBottom + iosMetrics.centerFabSize,
  );

  assert.ok(iosBottomChromeClearance <= 110);
  assert.ok(iosMetrics.centerFabSize >= MIN_MOBILE_TOUCH_TARGET);
});

test("grows tab chrome at large text sizes and keeps route content clear", () => {
  const normal = getFloatingTabChromeMetrics({
    platform: "ios",
    bottomInset: 34,
    fontScale: 1,
  });
  const large = getFloatingTabChromeMetrics({
    platform: "ios",
    bottomInset: 34,
    fontScale: 1.4,
  });
  const accessibility = getFloatingTabChromeMetrics({
    platform: "ios",
    bottomInset: 34,
    fontScale: 2,
  });

  assert.deepEqual(
    [normal.tabBarHeight, large.tabBarHeight, accessibility.tabBarHeight],
    [72, 82, 96],
  );
  assert.deepEqual(
    [normal.centerFabSize, large.centerFabSize, accessibility.centerFabSize],
    [56, 62, 72],
  );
  assert.deepEqual(
    [
      normal.contentBottomPadding,
      large.contentBottomPadding,
      accessibility.contentBottomPadding,
    ],
    [124, 130, 140],
  );
});

test("keeps standalone routes independent from the bottom tab chrome", () => {
  assert.equal(getStandaloneRouteBottomPadding({ platform: "ios", bottomInset: 34 }), 74);
  assert.equal(getStandaloneRouteBottomPadding({ platform: "android", bottomInset: 0 }), 72);
  assert.equal(getStandaloneRouteBottomPadding({ platform: "web", bottomInset: 34 }), 72);
});

test("keeps route headers clear of native notches and web chrome", () => {
  assert.equal(getRouteTopPadding({ platform: "ios", topInset: 0, surface: "tabbed" }), 8);
  assert.equal(getRouteTopPadding({ platform: "ios", topInset: 44, surface: "tabbed" }), 52);
  assert.equal(getRouteTopPadding({ platform: "web", topInset: 44, surface: "tabbed" }), 32);
  assert.equal(getRouteTopPadding({ platform: "ios", topInset: 44, surface: "standalone" }), 56);
  assert.equal(getRouteTopPadding({ platform: "web", topInset: 44, surface: "standalone" }), 30);
  assert.equal(getRouteTopPadding({ platform: "ios", topInset: 44, surface: "setup" }), 58);
  assert.equal(getRouteTopPadding({ platform: "web", topInset: 44, surface: "setup" }), 38);
  assert.equal(getRouteTopPadding({ platform: "ios", topInset: 44, surface: "auth" }), 92);
  assert.equal(getRouteTopPadding({ platform: "web", topInset: 44, surface: "auth" }), 72);
});

test("keeps docked composer controls close enough to the thumb zone", () => {
  assert.equal(getDockedComposerBottomPadding({ platform: "ios", bottomInset: 34 }), 46);
  assert.equal(getDockedComposerBottomPadding({ platform: "android", bottomInset: 0 }), 12);
  assert.equal(getDockedComposerBottomPadding({ platform: "web", bottomInset: 99 }), 46);
});

test("keeps modal, feedback, debug, and keyboard offsets on shared contracts", () => {
  assert.equal(getModalSheetBottomPadding({ platform: "ios", bottomInset: 34 }), 54);
  assert.equal(getModalSheetBottomPadding({ platform: "android", bottomInset: 0 }), 32);
  assert.deepEqual(getCenteredModalBackdropPadding({ platform: "ios", topInset: 44, bottomInset: 34 }), {
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 50,
  });
  assert.equal(getFloatingFeedbackBottomOffset({ platform: "ios", bottomInset: 34, surface: "tabbed" }), 130);
  assert.equal(getFloatingFeedbackBottomOffset({ platform: "web", bottomInset: 34, surface: "standalone" }), 56);
  assert.equal(getFloatingDebugButtonTopOffset({ platform: "ios", topInset: 44 }), 60);
  assert.equal(getKeyboardAvoidingVerticalOffset({ platform: "ios", topInset: 44, surface: "setup" }), 58);
  assert.equal(getKeyboardAvoidingVerticalOffset({ platform: "web", topInset: 44, surface: "setup" }), 0);
});

test("keeps mobile touch and inline hit targets release-safe", () => {
  assert.equal(MIN_MOBILE_TOUCH_TARGET, 48);
  assert.equal(MOBILE_INLINE_HIT_SLOP, 10);
});

test("reflows high-frequency care controls at 1.0, 1.4, and 2.0 font scale", () => {
  assert.deepEqual(
    getAccessibleLayoutMetrics({ platform: "ios", fontScale: 1 }),
    {
      fontScale: 1,
      quickActionColumns: 3,
      quickActionWidth: "31.5%",
      quickActionMinHeight: 82,
      actionLabelNumberOfLines: 2,
      controlMinHeight: 48,
      stackFormFields: false,
      stackStatusRows: false,
      metadataNumberOfLines: 2,
    },
  );

  assert.deepEqual(
    getAccessibleLayoutMetrics({ platform: "ios", fontScale: 1.4 }),
    {
      fontScale: 1.4,
      quickActionColumns: 2,
      quickActionWidth: "48.5%",
      quickActionMinHeight: 97,
      actionLabelNumberOfLines: 2,
      controlMinHeight: 54,
      stackFormFields: true,
      stackStatusRows: true,
      metadataNumberOfLines: 2,
    },
  );

  assert.deepEqual(
    getAccessibleLayoutMetrics({ platform: "ios", fontScale: 2 }),
    {
      fontScale: 2,
      quickActionColumns: 2,
      quickActionWidth: "48.5%",
      quickActionMinHeight: 120,
      actionLabelNumberOfLines: 2,
      controlMinHeight: 64,
      stackFormFields: true,
      stackStatusRows: true,
      metadataNumberOfLines: 1,
    },
  );
});

test("normalizes invalid font scale while preserving at least two quick-action columns", () => {
  assert.equal(
    getAccessibleLayoutMetrics({ platform: "android", fontScale: 0.5 }).fontScale,
    1,
  );
  assert.equal(
    getAccessibleLayoutMetrics({ platform: "android", fontScale: 9 }).fontScale,
    2,
  );
  assert.ok(
    getAccessibleLayoutMetrics({ platform: "android", fontScale: 9 })
      .quickActionColumns >= 2,
  );
});

test("resolves a QA font scale only for an explicit enabled web query", () => {
  const candidate = (mobileLayoutModule as Record<string, unknown>)
    .resolveWebQaFontScale;

  assert.equal(
    typeof candidate,
    "function",
    "mobileLayout must expose the web-only QA font-scale resolver",
  );
  if (typeof candidate !== "function") return;
  const resolveWebQaFontScale = candidate as ResolveWebQaFontScale;

  assert.deepEqual(
    resolveWebQaFontScale({
      platform: "web",
      runtimeFontScale: 1,
      qaEnabled: true,
      qaFontScale: "1.4",
    }),
    { fontScale: 1.4, qaFontScale: 1.4 },
  );
  assert.deepEqual(
    resolveWebQaFontScale({
      platform: "web",
      runtimeFontScale: 1,
      qaEnabled: true,
      qaFontScale: ["2", "1.4"],
    }),
    { fontScale: 2, qaFontScale: 2 },
  );
  assert.deepEqual(
    resolveWebQaFontScale({
      platform: "web",
      runtimeFontScale: 1.25,
      qaEnabled: true,
      qaFontScale: "9",
    }),
    { fontScale: 2, qaFontScale: 2 },
    "finite numeric QA values clamp to the supported 1x-2x proof range",
  );

  for (const [input, expectedFontScale] of [
    [
      {
        platform: "ios",
        runtimeFontScale: 1.6,
        qaEnabled: true,
        qaFontScale: "2",
      },
      1.6,
    ],
    [
      {
        platform: "web",
        runtimeFontScale: 1.25,
        qaEnabled: false,
        qaFontScale: "2",
      },
      1.25,
    ],
    [
      {
        platform: "web",
        runtimeFontScale: 1.25,
        qaEnabled: true,
        qaFontScale: "not-a-number",
      },
      1.25,
    ],
    [
      {
        platform: "web",
        runtimeFontScale: 1.25,
        qaEnabled: true,
        qaFontScale: "",
      },
      1.25,
    ],
  ] as const) {
    assert.deepEqual(resolveWebQaFontScale(input), {
      fontScale: expectedFontScale,
    });
  }
});

test("encodes QA layout evidence in a native-safe marker", () => {
  const candidate = (
    mobileLayoutModule as typeof mobileLayoutModule & {
      createWebQaLayoutMarker?: (
        qaFontScale: number | undefined,
        layout: ReturnType<typeof getAccessibleLayoutMetrics>,
      ) => string | undefined;
    }
  ).createWebQaLayoutMarker;
  assert.equal(typeof candidate, "function");
  if (!candidate) return;

  const layout = getAccessibleLayoutMetrics({
    platform: "web",
    fontScale: 1.4,
  });
  assert.equal(candidate(undefined, layout), undefined);
  assert.equal(
    candidate(1.4, layout),
    "fontScale=1.4;stackStatusRows=true;quickActionColumns=2;controlMinHeight=54",
  );
});

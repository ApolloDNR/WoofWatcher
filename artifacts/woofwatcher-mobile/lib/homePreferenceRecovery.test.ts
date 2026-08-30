import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  applyHomeWelcomePreferenceHydration,
  isHomeSceneReady,
  resolveHomeWelcomeDismissed,
  shouldDeferHomeWelcomeAfterReadFailure,
} from "./homeSceneReady.ts";

const HOME_SOURCE = readFileSync(
  join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "(tabs)", "index.tsx"),
  "utf8",
);
const ANNOUNCE_SOURCE = readFileSync(
  join(process.cwd(), "artifacts", "woofwatcher-mobile", "lib", "announce.ts"),
  "utf8",
);

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("Home becomes usable when only its welcome preference read fails", () => {
  assert.equal(isHomeSceneReady(true, null, null, false), false);
  assert.equal(isHomeSceneReady(true, null, null, true), true);
  assert.equal(isHomeSceneReady(false, null, null, true), false);
});

test("Home exposes a truthful, accessible manual retry for the failed preference", () => {
  const warningStart = HOME_SOURCE.indexOf("{welcomePreferenceReadFailed ? (");
  assert.notEqual(warningStart, -1);
  const warningSource = HOME_SOURCE.slice(warningStart, warningStart + 2_800);
  assert.match(warningSource, /accessibilityRole="alert"/);
  assert.match(warningSource, /accessibilityLabel="Retry welcome preference"/);
  assert.match(warningSource, /onPress=\{retryWelcomePreference\}/);
  assert.match(
    warningSource,
    /Home is available,[\s\S]*retrying will not change care data/,
  );
});

test("Home announces the preference failure and retry to screen readers", () => {
  const focusAnnouncement = sourceBetween(
    HOME_SOURCE,
    "useFocusEffect(",
    "  const retryWelcomePreference = () => {",
  );
  assert.match(
    focusAnnouncement,
    /useFocusEffect\([\s\S]{0,120}useCallback\(\(\) => \{[\s\S]{0,220}Platform\.OS !== "ios"[\s\S]{0,120}!welcomePreferenceReadFailed[\s\S]{0,120}!homeSceneReady[\s\S]{0,80}storageWarning/,
  );
  assert.match(
    focusAnnouncement,
    /AppState\.currentState !== "active"[\s\S]{0,180}setTimeout\(\(\) => \{[\s\S]{0,160}AppState\.currentState !== "active"[\s\S]{0,120}announce\([\s\S]{0,160}Retry is available\.[\s\S]{0,120}HOME_PREFERENCE_ANNOUNCEMENT_DELAY_MS/,
  );
  assert.match(
    focusAnnouncement,
    /AppState\.addEventListener\([\s\S]{0,240}nextState === "active"[\s\S]{0,220}appStateSubscription\.remove\(\)/,
  );
  assert.match(
    focusAnnouncement,
    /const clearAnnouncement = \(\) => \{[\s\S]{0,160}clearTimeout\(announcementTimer\);/,
  );
  assert.match(
    focusAnnouncement,
    /return \(\) => \{\s*clearAnnouncement\(\);\s*appStateSubscription\.remove\(\);\s*\};\s*\}, \[homeSceneReady, storageWarning, welcomePreferenceReadFailed\]\),\s*\);\s*$/,
  );
  assert.match(
    HOME_SOURCE,
    /HOME_PREFERENCE_ANNOUNCEMENT_DELAY_MS = 1000/,
  );
  const warningStart = HOME_SOURCE.indexOf("{welcomePreferenceReadFailed ? (");
  const warningSource = HOME_SOURCE.slice(warningStart, warningStart + 2_800);
  assert.match(
    warningSource,
    /accessibilityRole="alert"\s*accessibilityLiveRegion="polite"\s*aria-live="polite"/,
  );
  const nativeAnnouncementBranch = sourceBetween(
    ANNOUNCE_SOURCE,
    'if (Platform.OS === "web") {',
    "  } catch {",
  ).trim();
  assert.match(
    nativeAnnouncementBranch,
    /^if \(Platform\.OS === "web"\) \{[\s\S]*announceOnWeb\(text\);[\s\S]*return;[\s\S]*\}\s*AccessibilityInfo\.announceForAccessibility\(text\);$/,
  );
});

test("successful recovery never inserts a delayed welcome card into an interactive scene", () => {
  assert.equal(shouldDeferHomeWelcomeAfterReadFailure(null), true);
  assert.equal(shouldDeferHomeWelcomeAfterReadFailure(true), true);
  assert.equal(shouldDeferHomeWelcomeAfterReadFailure(false), false);

  for (const interactiveChoice of [null, true] as const) {
    const deferWelcome = shouldDeferHomeWelcomeAfterReadFailure(interactiveChoice);
    assert.equal(resolveHomeWelcomeDismissed(null, deferWelcome), true);
  }
  const alreadyVisibleWelcome = shouldDeferHomeWelcomeAfterReadFailure(false);
  assert.equal(resolveHomeWelcomeDismissed(null, alreadyVisibleWelcome), false);

  for (const scenario of [
    { current: null, raw: null, defer: true, expected: true },
    { current: true, raw: null, defer: true, expected: true },
    { current: false, raw: null, defer: false, expected: false },
    { current: null, raw: "true", defer: false, expected: true },
  ] as const) {
    const preferenceRef: { current: boolean | null } = {
      current: scenario.current,
    };
    const applied: boolean[] = [];
    const result = applyHomeWelcomePreferenceHydration(
      scenario.raw,
      scenario.defer,
      preferenceRef,
      (value) => applied.push(value),
    );
    assert.equal(result, scenario.expected);
    assert.equal(preferenceRef.current, scenario.expected);
    assert.deepEqual(applied, [scenario.expected]);
  }

  assert.equal(resolveHomeWelcomeDismissed(null, true), true);
  assert.equal(resolveHomeWelcomeDismissed("false", true), true);
  assert.equal(resolveHomeWelcomeDismissed("true", true), true);
  assert.equal(resolveHomeWelcomeDismissed(null, false), false);
  assert.equal(resolveHomeWelcomeDismissed("true", false), true);
  const recoveryApply = sourceBetween(
    HOME_SOURCE,
    "apply: (raw) => {",
    "        })",
  );
  assert.match(
    recoveryApply.trim(),
    /^apply: \(raw\) => \{\s*applyHomeWelcomePreferenceHydration\(\s*raw,\s*deferWelcomeForSessionRef\.current,\s*welcomeDismissedRef,\s*setWelcomeDismissed,?\s*\);\s*\},$/,
  );

  const recoveryFailure = sourceBetween(
    HOME_SOURCE,
    ".catch((error) => {",
    "          setWelcomePreferenceReadFailed(true);",
  );
  assert.match(
    recoveryFailure,
    /deferWelcomeForSessionRef\.current \|\|=\s*shouldDeferHomeWelcomeAfterReadFailure\(\s*welcomeDismissedRef\.current,?\s*\);/,
  );
});

test("Home entrance animation resolves immediately under Reduce Motion", () => {
  assert.match(
    HOME_SOURCE,
    /new Animated\.Value\(isWebRoutePreview \|\| reducedMotion \? 1 : 0\)/,
  );
  assert.match(
    HOME_SOURCE,
    /if \(isWebRoutePreview \|\| reducedMotion\) \{[\s\S]{0,120}fade\.setValue\(1\);[\s\S]{0,80}return;/,
  );
});

test("Home feedback toast visibility resolves immediately under Reduce Motion", () => {
  const toastTransition = sourceBetween(
    HOME_SOURCE,
    "  const setToastVisibility = (",
    "  const showToast = (",
  );

  assert.match(toastTransition, /toastOpacity\.stopAnimation\(\)/);
  assert.match(
    toastTransition,
    /if \(reducedMotion\) \{[\s\S]{0,120}toastOpacity\.setValue\(toValue\);[\s\S]{0,80}onComplete\?\.\(\);[\s\S]{0,40}return;/,
  );
  assert.match(
    toastTransition,
    /Animated\.timing\(toastOpacity,[\s\S]{0,160}duration,[\s\S]{0,120}if \(finished\) onComplete\?\.\(\);/,
  );

  const showToast = sourceBetween(
    HOME_SOURCE,
    "  const showToast = (",
    "  useEffect(\n    () => () => {\n      if (toastTimer.current)",
  );
  assert.match(showToast, /setToastVisibility\(1, 160\);/);
  assert.match(
    showToast,
    /setToastVisibility\(0, 240, \(\) => \{[\s\S]{0,180}setQuickFeedback\(null\);[\s\S]{0,40}\}\);/,
  );
});

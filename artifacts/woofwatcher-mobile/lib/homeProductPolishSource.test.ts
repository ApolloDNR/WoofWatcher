import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const MOBILE_DIR = join(process.cwd(), "artifacts", "woofwatcher-mobile");

function readMobileFile(...parts: string[]): string {
  return readFileSync(join(MOBILE_DIR, ...parts), "utf8");
}

test("keeps Phoenix Home focused on the five-second owner promise", () => {
  const home = readMobileFile("app", "(tabs)", "index.tsx");

  assert.match(home, /testID="home-fixed-backdrop"/);
  assert.match(home, /testID="home-fixed-hero"/);
  assert.match(home, /testID="home-scrolling-hero-spacer"/);
  assert.match(home, /fullBleedArt/);
  assert.match(home, /<LinearGradient/);
  assert.match(home, /<LivingPhoenixRoom[\s\S]*transparentScene/);

  const heroIndex = home.indexOf('testID="home-scrolling-hero-spacer"');
  const presenceIndex = home.indexOf("Presence panel: the first-screen");
  const careSenseIndex = home.indexOf(
    "Care Sense stays one scroll below the primary care actions",
  );
  const quickLogIndex = home.indexOf("Mock-board Quick Log card");
  const nextUpIndex = home.indexOf('title="Next Up"');

  for (const [label, index] of [
    ["room", heroIndex],
    ["presence", presenceIndex],
    ["Care Sense", careSenseIndex],
    ["Quick Log", quickLogIndex],
    ["Next Up", nextUpIndex],
  ] as const) {
    assert.notEqual(
      index,
      -1,
      `${label} should stay on the focused Home surface`,
    );
  }
  assert.ok(
    heroIndex < presenceIndex,
    "the living room should lead the owner view",
  );
  assert.ok(
    presenceIndex < quickLogIndex,
    "presence and alone-time truth should lead into the primary actions",
  );
  assert.ok(
    quickLogIndex < nextUpIndex && nextUpIndex < careSenseIndex,
    "Quick Log and Next Up should stay ahead of supporting Care Sense metrics",
  );
});

test("keeps first-run setup compact and secondary Home modules collapsed by default", () => {
  const home = readMobileFile("app", "(tabs)", "index.tsx");

  assert.match(home, /s\.welcomeCompactRow/);
  assert.match(home, /Set up in about a minute/);
  assert.doesNotMatch(home, /welcomeBody/);
  assert.doesNotMatch(home, /Explore first/);
  assert.match(
    home,
    /\{!welcomeShouldShow && !openWalkSession \? \(\s*<Pressable[\s\S]*?s\.presencePanel/,
    "the first-run setup row must replace, not stack above, the presence row so the primary action clears navigation",
  );

  assert.match(
    home,
    /const \[showHomeDetails, setShowHomeDetails\] = useState\(false\)/,
  );
  assert.match(home, /accessibilityState=\{\{ expanded: showHomeDetails \}\}/);
  assert.match(
    home,
    /showHomeDetails \? "Hide more from today" : "Show more from today"/,
  );
  assert.match(home, /\{showHomeDetails \? \(\s*<>[\s\S]*Today's Story/);
});

test("keeps prominent Home actions tappable and owner-facing", () => {
  const home = readMobileFile("app", "(tabs)", "index.tsx");

  const tapStart = home.indexOf("const tapPhoenixRoom =");
  const tapEnd = home.indexOf("const openAvatarStudio =", tapStart);
  const tapHandler = home.slice(tapStart, tapEnd);
  assert.doesNotMatch(tapHandler, /qaHint|spawn a second dog/);

  assert.match(
    home,
    /const HOME_COMPACT_ACTION_HIT_SLOP\s*=\s*\(MIN_MOBILE_TOUCH_TARGET - 16\) \/ 2/,
  );
  assert.ok(
    (home.match(/hitSlop=\{HOME_COMPACT_ACTION_HIT_SLOP\}/g)?.length ?? 0) >= 1,
    "the compact Quick Log header action should expose at least a 48pt hit area",
  );
  assert.match(
    home,
    /nextButton:\s*\{[\s\S]*?minHeight:\s*MIN_MOBILE_TOUCH_TARGET/,
  );
});

test("pauses the Home clock and living scene while the route is inactive or scrolling", () => {
  const home = readMobileFile("app", "(tabs)", "index.tsx");

  assert.match(home, /useFocusEffect/);
  assert.match(home, /if \(!isHomeFocused\) return;/);
  assert.match(home, /setInterval\(\(\) => setNow\(Date\.now\(\)\), 60000\)/);
  assert.match(home, /onScrollBeginDrag=\{holdHomeScrollPause\}/);
  assert.match(home, /scheduleHomeScrollPauseRelease/);
  assert.match(home, /onScrollEndDrag=\{scheduleHomeScrollPauseRelease\}/);
  assert.match(home, /onMomentumScrollBegin=\{holdHomeScrollPause\}/);
  assert.match(home, /onMomentumScrollEnd=\{releaseHomeScrollPause\}/);
  assert.doesNotMatch(
    home,
    /onScrollEndDrag=\{\(\) => setHomeScrolling\(false\)\}/,
  );
  assert.match(home, /active=\{isHomeFocused && !homeScrolling\}/);
  assert.doesNotMatch(
    home,
    /lowMotion=\{Platform\.OS === "web"\}/,
    "the owner preview should exercise the same safe motion path as native Home",
  );
});

test("returns Home to a clean full-phone surface only after the route has blurred", () => {
  const home = readMobileFile("app", "(tabs)", "index.tsx");

  assert.match(
    home,
    /const homeScrollRef = useAnimatedRef<Reanimated\.ScrollView>\(\)/,
  );
  assert.match(home, /const homeHasBlurredRef = useRef\(false\)/);
  assert.match(
    home,
    /if \(homeHasBlurredRef\.current\) \{[\s\S]*?homeScrollRef\.current\?\.scrollTo\(\{ y: 0, animated: false \}\);[\s\S]*?homeHasBlurredRef\.current = false;/,
    "returning from another route should restore the complete Home header before the route is presented",
  );
  assert.match(
    home,
    /return \(\) => \{[\s\S]*?homeHasBlurredRef\.current = true;[\s\S]*?setIsHomeFocused\(false\)/,
    "ordinary Home updates must not reset scroll unless the route actually blurred",
  );
  assert.match(
    home,
    /<Reanimated\.ScrollView[\s\S]*?ref=\{homeScrollRef\}[\s\S]*?contentInsetAdjustmentBehavior="never"[\s\S]*?style=\{s\.container\}/,
    "the scrolling console must stay transparent so the full-phone room remains visible",
  );
  assert.doesNotMatch(
    home,
    /style=\{\[s\.container, \{ backgroundColor: colors\.background \}\]\}/,
  );
  assert.match(
    home,
    /contentContainerStyle=\{\{[\s\S]*?minHeight: homeFirstScreenLayout\.contentMinHeight[\s\S]*?width: "100%"/,
    "the parchment surface should cover the full phone viewport and width",
  );
  assert.doesNotMatch(
    home,
    /const fade = useRef\(new Animated\.Value|<Animated\.View style=\{\{ opacity: fade \}\}/,
    "Home should present immediately instead of fading the entire route through a slow mount animation",
  );
});

test("keeps the Next Up overflow action reachable above floating navigation", () => {
  const home = readMobileFile("app", "(tabs)", "index.tsx");
  const nextHeaderIndex = home.indexOf('title="Next Up"');
  const morePlanActionIndex = home.indexOf(
    "`View ${nextUp.length - 1} more planned",
  );
  const nextPrimaryIndex = home.indexOf("{nextPrimary ? (", nextHeaderIndex);

  assert.ok(nextHeaderIndex >= 0, "Next Up should keep its section header");
  assert.ok(
    morePlanActionIndex > nextHeaderIndex &&
      morePlanActionIndex < nextPrimaryIndex,
    "the overflow action should live in the card header, clear of floating navigation",
  );
  assert.equal(
    home.match(/`View \$\{nextUp\.length - 1\} more planned/g)?.length,
    1,
    "the overflow action should have one stable hit target",
  );
  assert.match(
    home,
    /nextPlanHeaderAction:\s*\{[\s\S]*?position:\s*"absolute"[\s\S]*?minHeight:\s*MIN_MOBILE_TOUCH_TARGET/,
    "the moved action should expose at least a 48pt target without adding first-screen height",
  );
});

test("uses the canonical Home and Plans route names in owner-facing navigation copy", () => {
  const home = readMobileFile("app", "(tabs)", "index.tsx");
  const plans = readMobileFile("app", "(tabs)", "calendar.tsx");
  const setup = readMobileFile("app", "setup.tsx");
  const ownerBoundary = readMobileFile(
    "components",
    "board",
    "OwnerOpsBoundary.tsx",
  );

  assert.match(home, /accessibilityLabel="Loading Home"/);
  assert.match(home, /`Open Plans\./);
  assert.doesNotMatch(home, /Loading Today|Open Plan\./);
  assert.match(plans, /<BoardRouteHeader[\s\S]*title="Plans"/);
  assert.match(setup, /gives Home, Log, Reports, Records, and WoofGuide/);
  assert.match(ownerBoundary, /lives in Home, Log,\s*Plans, Health, and More/);
  assert.match(ownerBoundary, /accessibilityLabel="Back to Home"/);
  assert.match(ownerBoundary, />\s*Back to Home\s*</);
});

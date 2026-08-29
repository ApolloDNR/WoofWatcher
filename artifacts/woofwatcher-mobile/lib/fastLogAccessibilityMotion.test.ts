import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const fastLogSource = readFileSync(
  join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "fastlog.tsx"),
  "utf8",
);
const navigatorSource = readFileSync(
  join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "_layout.tsx"),
  "utf8",
);

function textUsingStyle(source: string, styleName: string): string {
  const markerIndex = source.indexOf(`s.${styleName}`);
  assert.notEqual(markerIndex, -1, `expected Text style: ${styleName}`);
  const start = source.lastIndexOf("<Text", markerIndex);
  const end = source.indexOf("</Text>", markerIndex);
  assert.ok(start >= 0 && end > markerIndex, `expected Text block for: ${styleName}`);
  return source.slice(start, end + "</Text>".length);
}

test("Fast Log resolves reduced motion before its first web paint", () => {
  assert.match(fastLogSource, /import \{ useReducedMotion \} from "react-native-reanimated"/);
  assert.match(fastLogSource, /useLayoutEffect/);
  assert.match(fastLogSource, /const reducedMotion = useReducedMotion\(\)/);
  assert.match(
    fastLogSource,
    /new Animated\.Value\(animatesInternally && !reducedMotion \? 0 : 1\)/,
  );
  assert.match(
    fastLogSource,
    /useLayoutEffect\(\(\) => \{[\s\S]{0,220}if \(!animatesInternally \|\| reducedMotion\) \{[\s\S]{0,140}sheetProgress\.setValue\(1\)/,
  );
  assert.match(fastLogSource, /return \(\) => entrance\.stop\(\)/);
});

test("Fast Log dismisses immediately and never interpolates its background under Reduce Motion", () => {
  assert.match(
    fastLogSource,
    /const close = \(\) => \{[\s\S]{0,120}if \(!animatesInternally \|\| reducedMotion\) \{[\s\S]{0,80}navigateBack\(\)/,
  );
  assert.match(
    fastLogSource,
    /backgroundColor:\s*reducedMotion\s*\?\s*colors\.background\s*:\s*sheetProgress\.interpolate/,
  );
  assert.match(
    fastLogSource,
    /outputRange:\s*\[\s*colors\.isDark \? colors\.shellNavy : colors\.ivory,\s*colors\.background,?\s*\]/,
  );
});

test("Fast Log presentation honors Reduce Motion while web keeps its screen-owned transition", () => {
  assert.match(
    navigatorSource,
    /import \{ useReducedMotion \} from "react-native-reanimated"/,
  );
  assert.match(
    navigatorSource,
    /function RootLayoutNav\(\) \{[\s\S]{0,320}const reducedMotion = useReducedMotion\(\)/,
  );
  assert.doesNotMatch(
    navigatorSource,
    /name="fastlog"[\s\S]{0,560}animation:\s*"slide_from_bottom"/,
  );
  assert.match(
    navigatorSource,
    /animation:\s*reducedMotion\s*\?\s*"none"\s*:\s*"slide_from_bottom"/,
  );
  assert.match(fastLogSource, /const animatesInternally = Platform\.OS === "web"/);
});

test("Fast Log recent title, metadata, and outcome preserve large text without truncation", () => {
  for (const styleName of ["recentName", "recentMeta", "recentOutcome"]) {
    const text = textUsingStyle(fastLogSource, styleName);
    assert.doesNotMatch(text, /numberOfLines=/, `${styleName} must be allowed to wrap`);
    assert.doesNotMatch(
      text,
      /adjustsFontSizeToFit/,
      `${styleName} must preserve the user's requested text size`,
    );
  }

  assert.match(
    fastLogSource,
    /recentRow:\s*\{[\s\S]{0,120}minHeight:\s*MIN_MOBILE_TOUCH_TARGET/,
  );
  assert.match(
    fastLogSource,
    /recentCopy:\s*\{[\s\S]{0,100}flex:\s*1,[\s\S]{0,60}minWidth:\s*0/,
  );
});

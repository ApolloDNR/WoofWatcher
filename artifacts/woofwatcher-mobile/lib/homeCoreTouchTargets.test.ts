import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const HOME_SOURCE = readFileSync(
  join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "(tabs)", "index.tsx"),
  "utf8",
);
const BOARD_SOURCE = readFileSync(
  join(
    process.cwd(),
    "artifacts",
    "woofwatcher-mobile",
    "components",
    "board",
    "BoardPrimitives.tsx",
  ),
  "utf8",
);

function styleBlock(name: string): string {
  const start = HOME_SOURCE.indexOf(`  ${name}: {`);
  assert.notEqual(start, -1, `Missing Home style: ${name}`);
  const end = HOME_SOURCE.indexOf("\n  },", start);
  assert.notEqual(end, -1, `Unterminated Home style: ${name}`);
  return HOME_SOURCE.slice(start, end);
}

test("Home's compact core controls own 48-point touch frames", () => {
  for (const styleName of [
    "identityWrap",
    "welcomePrimary",
    "welcomeGhost",
    "careSenseTrendsLink",
  ]) {
    assert.match(styleBlock(styleName), /minHeight: MIN_MOBILE_TOUCH_TARGET/);
  }

  assert.match(styleBlock("welcomeDismiss"), /width: MIN_MOBILE_TOUCH_TARGET/);
  assert.match(styleBlock("welcomeDismiss"), /height: MIN_MOBILE_TOUCH_TARGET/);
  assert.match(styleBlock("homeInlineIconAction"), /minWidth: MIN_MOBILE_TOUCH_TARGET/);
  assert.match(styleBlock("homeInlineIconAction"), /minHeight: MIN_MOBILE_TOUCH_TARGET/);

  const careSenseHeader = HOME_SOURCE.slice(
    HOME_SOURCE.indexOf("<View style={s.careSenseHeaderActions}>"),
    HOME_SOURCE.indexOf("</View>", HOME_SOURCE.indexOf("<View style={s.careSenseHeaderActions}>")) + 7,
  );
  assert.match(careSenseHeader, /s\.homeInlineIconAction/);

  const quickLogHeader = HOME_SOURCE.slice(
    HOME_SOURCE.indexOf('accessibilityLabel="Open full Quick Log"'),
    HOME_SOURCE.indexOf("</Pressable>", HOME_SOURCE.indexOf('accessibilityLabel="Open full Quick Log"')),
  );
  assert.match(quickLogHeader, /s\.homeInlineIconAction/);
});

test("Home welcome copy reserves the dismiss control's full touch width", () => {
  assert.match(
    styleBlock("welcomeKicker"),
    /paddingRight:\s*MIN_MOBILE_TOUCH_TARGET/,
  );
  assert.match(
    styleBlock("welcomeTitle"),
    /paddingRight:\s*MIN_MOBILE_TOUCH_TARGET/,
  );

  assert.match(HOME_SOURCE, /<Text\s+style=\{\[\s*s\.welcomeKicker,/);
  assert.match(HOME_SOURCE, /<Text\s+style=\{\[\s*s\.welcomeTitle,/);
});

test("Home header siblings use separated frames without overlapping hit slop", () => {
  const header = HOME_SOURCE.slice(
    HOME_SOURCE.indexOf('testID="home-header"'),
    HOME_SOURCE.indexOf("</View>", HOME_SOURCE.indexOf('accessibilityLabel="Open reminders"')),
  );

  assert.equal(
    [...header.matchAll(/<Pressable\b/g)].length,
    3,
    "profile, Care Team, and Reminders are the three header controls",
  );
  assert.doesNotMatch(header, /hitSlop=/);
  assert.match(styleBlock("header"), /gap:\s*4/);
  assert.match(styleBlock("identityWrap"), /minHeight:\s*MIN_MOBILE_TOUCH_TARGET/);
  assert.match(styleBlock("headerButton"), /width:\s*MIN_MOBILE_TOUCH_TARGET/);
  assert.match(styleBlock("headerButton"), /minHeight:\s*MIN_MOBILE_TOUCH_TARGET/);
});

test("Care Sense sibling controls rely on their own frames, not overlapping hit slop", () => {
  const trends = HOME_SOURCE.slice(
    HOME_SOURCE.indexOf('accessibilityLabel="Open Trends and Insights"'),
    HOME_SOURCE.indexOf("</Pressable>", HOME_SOURCE.indexOf('accessibilityLabel="Open Trends and Insights"')),
  );
  const info = HOME_SOURCE.slice(
    HOME_SOURCE.indexOf('accessibilityLabel="How Care Sense works"'),
    HOME_SOURCE.indexOf("</Pressable>", HOME_SOURCE.indexOf('accessibilityLabel="How Care Sense works"')),
  );
  const command = HOME_SOURCE.slice(
    HOME_SOURCE.indexOf("accessibilityLabel={`Today Command."),
    HOME_SOURCE.indexOf("</Pressable>", HOME_SOURCE.indexOf("accessibilityLabel={`Today Command.")),
  );

  assert.doesNotMatch(trends, /hitSlop=/);
  assert.doesNotMatch(info, /hitSlop=/);
  assert.doesNotMatch(command, /hitSlop=/);
  assert.match(styleBlock("careSenseHeaderActions"), /gap:\s*12/);
  assert.match(styleBlock("careSenseTrendsLink"), /minWidth:\s*MIN_MOBILE_TOUCH_TARGET/);
  assert.match(styleBlock("homeInlineIconAction"), /minWidth:\s*MIN_MOBILE_TOUCH_TARGET/);
  assert.match(styleBlock("careSenseHeadlineRow"), /minHeight:\s*MIN_MOBILE_TOUCH_TARGET/);
  assert.match(styleBlock("careSenseMeters"), /gap:\s*2/);

  const statusMeter = BOARD_SOURCE.slice(
    BOARD_SOURCE.indexOf("export function StatusMeter"),
    BOARD_SOURCE.indexOf("export function BoardQuickTile"),
  );
  assert.doesNotMatch(statusMeter, /hitSlop=/);
  assert.match(
    BOARD_SOURCE,
    /meterPressable:\s*\{[\s\S]{0,160}minHeight:\s*MIN_MOBILE_TOUCH_TARGET/,
  );
});

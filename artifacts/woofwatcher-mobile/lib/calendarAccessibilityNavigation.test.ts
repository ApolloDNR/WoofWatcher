import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");
const CALENDAR_PATH = join(MOBILE_ROOT, "app", "(tabs)", "calendar.tsx");
const MONTH_PATH = join(MOBILE_ROOT, "app", "calendar-month.tsx");
const TAB_LAYOUT_PATH = join(MOBILE_ROOT, "app", "(tabs)", "_layout.tsx");

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

function openingTagContaining(
  source: string,
  marker: string,
): { start: number; end: number; text: string } {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `missing opening-tag marker: ${marker}`);
  const start = source.lastIndexOf("<", markerIndex);
  assert.notEqual(start, -1, `missing opening tag for: ${marker}`);
  assert.match(
    source.slice(start, markerIndex),
    /^<(?:Pressable|PressScale)\b/,
  );

  let braceDepth = 0;
  let quote: '"' | "'" | "`" | null = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === "{") {
      braceDepth += 1;
    } else if (char === "}") {
      braceDepth -= 1;
    } else if (char === ">" && braceDepth === 0) {
      return { start, end: index + 1, text: source.slice(start, index + 1) };
    }
  }
  assert.fail(`unterminated opening tag for: ${marker}`);
}

test("Plans gives card entrances one Reduce-Motion-aware owner", () => {
  const calendar = readSource(CALENDAR_PATH);

  assert.match(calendar, /useReducedMotion/);
  assert.match(calendar, /const reducedMotion = useReducedMotion\(\)/);
  assert.match(calendar, /<BoardCard enter=\{0\}/);
  assert.doesNotMatch(calendar, /new Animated\.Value|opacity: fade/);
});

test("Plans presents an empty Reminder mission as an all-clear status, not a dead button", () => {
  const calendar = readSource(CALENDAR_PATH);
  const clearReminderMission = sourceBetween(
    calendar,
    'id: "clear-reminder"',
    "\n        },\n  );",
  );
  const missionBoard = sourceBetween(
    calendar,
    "<View style={s.planMissionList}>",
    "</BoardCard>",
  );
  const statusBranch = sourceBetween(
    missionBoard,
    ") : (\n                  <View\n                    key={mission.id}",
    "\n                );\n              })}",
  );

  assert.match(clearReminderMission, /actionLabel:\s*"All clear"/);
  assert.doesNotMatch(clearReminderMission, /onPress|Haptics/);
  assert.match(calendar, /onPress\?: \(\) => void/);
  assert.match(missionBoard, /mission\.onPress\s*\?/);
  assert.match(
    statusBranch,
    /accessible[\s\S]*accessibilityLabel=\{`\$\{mission\.eyebrow\}: \$\{mission\.title\}\. Status: \$\{mission\.actionLabel\}`\}/,
  );
  assert.doesNotMatch(
    statusBranch,
    /<Pressable|accessibilityRole="button"|onPress=/,
  );
  assert.match(
    missionBoard,
    /\{mission\.onPress\s*\?\s*\(\s*<Ionicons\b[\s\S]*?name="chevron-forward"[\s\S]*?\/>\s*\)\s*:\s*null\}/,
  );
});

test("Plans routine and event sheets disable their slide transition for Reduce Motion", () => {
  const calendar = readSource(CALENDAR_PATH);
  const routineEditor = sourceBetween(
    calendar,
    "{/* Routine editor modal */}",
    "{/* Add-event modal */}",
  );
  const eventEditor = sourceBetween(
    calendar,
    "{/* Add-event modal */}",
    "const s = StyleSheet.create",
  );

  for (const editor of [routineEditor, eventEditor]) {
    assert.match(
      editor,
      /<Modal\b[\s\S]{0,180}animationType=\{reducedMotion \? "none" : "slide"\}/,
    );
    assert.doesNotMatch(editor, /animationType="slide"/);
  }
});

test("Today's Missions wraps large text and reflows its action without clipping", () => {
  const calendar = readSource(CALENDAR_PATH);
  const missionBoard = sourceBetween(
    calendar,
    "<View style={s.planMissionList}>",
    "</BoardCard>",
  );
  const rowStyle = sourceBetween(
    calendar,
    "  planMissionRow: {",
    "  planMissionIcon: {",
  );
  const copyStyle = sourceBetween(
    calendar,
    "  planMissionCopy: {",
    "  planMissionEyebrow: {",
  );
  const actionStyle = sourceBetween(
    calendar,
    "  planMissionAction: {",
    "  planMissionActionText: {",
  );
  const actionTextStyle = sourceBetween(
    calendar,
    "  planMissionActionText: {",
    "  planMissionDivider: {",
  );

  assert.doesNotMatch(
    missionBoard,
    /<Text\s+numberOfLines=\{1\}\s+style=\{\[s\.planMission(?:Title|Detail)/,
  );
  assert.match(rowStyle, /flexWrap:\s*"wrap"/);
  assert.doesNotMatch(rowStyle, /overflow:\s*"hidden"/);
  assert.match(copyStyle, /minWidth:\s*140/);
  assert.match(actionStyle, /minWidth:\s*66/);
  assert.match(actionStyle, /maxWidth:\s*"100%"/);
  assert.match(actionStyle, /minHeight:\s*MIN_MOBILE_TOUCH_TARGET/);
  assert.match(actionStyle, /flexShrink:\s*1/);
  assert.match(actionStyle, /paddingVertical:\s*6/);
  assert.doesNotMatch(actionStyle, /\bwidth:\s*66/);
  assert.match(actionTextStyle, /flexShrink:\s*1/);
  assert.match(actionTextStyle, /textAlign:\s*"center"/);
});

test("Plans editor actions expose roles, names, selected state, and pressed feedback", () => {
  const calendar = readSource(CALENDAR_PATH);
  const routineEditor = sourceBetween(
    calendar,
    "{/* Routine editor modal */}",
    "{/* Add-event modal */}",
  );
  const eventEditor = sourceBetween(
    calendar,
    "{/* Add-event modal */}",
    "const s = StyleSheet.create",
  );

  assert.match(
    routineEditor,
    /ROUTINE_TYPES\.map[\s\S]*accessibilityRole="button"[\s\S]*accessibilityLabel=\{`Select routine type \$\{t\.label\}`\}[\s\S]*accessibilityState=\{\{ selected: active \}\}[\s\S]*style=\{\(\{ pressed \}\) =>/,
  );
  assert.match(
    routineEditor,
    /caregivers\.map[\s\S]*accessibilityRole="button"[\s\S]*accessibilityLabel=\{`Assign \$\{caregiver\.name\} as caregiver`\}[\s\S]*accessibilityState=\{\{ selected: active \}\}[\s\S]*style=\{\(\{ pressed \}\) =>/,
  );
  assert.match(
    routineEditor,
    /accessibilityLabel=\{\s*routineEditId\s*\?\s*"Save routine changes"\s*:\s*"Add routine"\s*\}[\s\S]*style=\{\(\{ pressed \}\) =>/,
  );
  assert.match(
    routineEditor,
    /accessibilityLabel="Delete routine"[\s\S]*style=\{\(\{ pressed \}\) =>/,
  );

  assert.match(
    eventEditor,
    /EVENT_TYPES\.map[\s\S]*accessibilityRole="button"[\s\S]*accessibilityLabel=\{`Select event type \$\{t\.label\}`\}[\s\S]*accessibilityState=\{\{ selected: active \}\}[\s\S]*style=\{\(\{ pressed \}\) =>/,
  );
  assert.match(
    eventEditor,
    /accessibilityLabel=\{\s*eventEditId\s*\?\s*"Save event changes"\s*:\s*"Add event to calendar"\s*\}[\s\S]*style=\{\(\{ pressed \}\) =>/,
  );

  assert.match(
    calendar,
    /accessibilityLabel="Add routine"[\s\S]{0,260}style=\{\(\{ pressed \}\) =>/,
  );
  assert.match(
    calendar,
    /accessibilityLabel=\{`Edit routine \$\{r\.label\}`\}[\s\S]{0,620}style=\{\(\{ pressed \}\) =>/,
  );
  assert.match(
    calendar,
    /accessibilityLabel=\{`Edit \$\{e\.title\}`\}[\s\S]{0,220}style=\{\(\{ pressed \}\) =>/,
  );
});

test("every visible Plans editor field uses its visible label as its accessible name", () => {
  const calendar = readSource(CALENDAR_PATH);
  const expectedLabels: Record<string, string> = {
    rLabel: "Routine label",
    rTime: "Routine time",
    rOwner: "Routine owner, optional",
    rNote: "Routine note, optional",
    evTitle: "Event title",
    evDate: "Event date",
    evTime: "Event time",
    evLocation: "Event location, optional",
    location: "Dog event search location",
  };

  for (const [valueName, label] of Object.entries(expectedLabels)) {
    const input = Array.from(
      calendar.matchAll(/<TextInput\b[\s\S]*?\/>/g),
      (match) => match[0],
    ).find((candidate) => candidate.includes(`value={${valueName}}`));
    assert.ok(input, `expected a TextInput bound to ${valueName}`);
    assert.match(
      input,
      new RegExp(`accessibilityLabel="${label}"`),
      `${valueName} must be named from its visible label`,
    );
  }
});

test("the Discover action uses the measured bright-copper and navy pair", () => {
  const calendar = readSource(CALENDAR_PATH);
  const findAction = sourceBetween(
    calendar,
    'placeholder="Your city or area"',
    "</Pressable>",
  );

  assert.match(findAction, /backgroundColor: colors\.copperBright/);
  assert.match(
    findAction,
    /<ActivityIndicator\b[\s\S]*?size="small"[\s\S]*?color=\{colors\.brandNavy\}[\s\S]*?\/>/,
  );
  assert.match(findAction, /discoverGoText,\s*\{\s*color:\s*colors\.brandNavy/);
  assert.match(findAction, /accessibilityRole="button"/);
  assert.match(
    findAction,
    /accessibilityLabel=\{\s*loadingEvents\s*\?\s*"Finding nearby dog events"\s*:\s*"Find nearby dog events"\s*\}/,
  );
  assert.match(
    findAction,
    /accessibilityState=\{\{\s*disabled:\s*loadingEvents,\s*busy:\s*loadingEvents,?\s*\}\}/,
  );
  assert.match(findAction, /style=\{\(\{ pressed \}\) =>/);
  assert.doesNotMatch(findAction, /color="#fff"/i);
});

test("routine edit and completion actions are siblings and completed routines cannot be logged twice", () => {
  const calendar = readSource(CALENDAR_PATH);
  const scheduleEdit = openingTagContaining(calendar, "s.scheduleEditArea");
  const scheduleCompletion = openingTagContaining(calendar, "s.scheduleStatus");
  const routineEdit = openingTagContaining(calendar, "s.routineEditArea");
  const routineCompletion = openingTagContaining(calendar, "s.routineDoneBtn");
  const scheduleEditClose = calendar.indexOf("</Pressable>", scheduleEdit.end);
  const routineEditClose = calendar.indexOf("</Pressable>", routineEdit.end);

  assert.match(
    calendar,
    /<View key=\{r\.id\} style=\{s\.timelineRow\}>[\s\S]*accessibilityLabel=\{`Edit routine \$\{r\.label\}`\}[\s\S]*accessibilityLabel=\{[\s\S]*done[\s\S]*`View \$\{r\.label\} completion log`/,
  );
  assert.doesNotMatch(
    calendar,
    /<Pressable\s+key=\{r\.id\}/,
    "the routine container must be structural so its edit and completion buttons are siblings",
  );
  assert.ok(
    scheduleEditClose > scheduleEdit.end &&
      scheduleEditClose < scheduleCompletion.start,
    "the schedule completion action must begin only after the edit action closes",
  );
  assert.ok(
    routineEditClose > routineEdit.end &&
      routineEditClose < routineCompletion.start,
    "the routine completion action must begin only after the edit action closes",
  );
  assert.match(
    scheduleEdit.text,
    /accessibilityLabel=\{`Edit routine \$\{row\.label\}`\}/,
  );
  assert.match(
    scheduleCompletion.text,
    /accessibilityLabel=\{\s*done\s*\?\s*`View \$\{row\.label\} completion log`/,
  );
  assert.match(
    scheduleCompletion.text,
    /borderColor:\s*done\s*\?\s*colors\.sage\s*:\s*needsCorrection\s*\?\s*colors\.amber\s*:\s*colors\.primary/,
  );
  assert.match(
    calendar,
    /name=\{\s*done\s*\?\s*"checkmark"\s*:\s*needsCorrection\s*\?\s*"warning-outline"\s*:\s*"checkmark"\s*\}/,
  );
  assert.match(
    routineEdit.text,
    /accessibilityLabel=\{`Edit routine \$\{r\.label\}`\}/,
  );
  assert.match(
    routineCompletion.text,
    /done[\s\S]*`View \$\{r\.label\} completion log`/,
  );
  assert.doesNotMatch(
    calendar,
    /<PressScale[\s\S]{0,280}accessibilityLabel=\{`\$\{row\.time\} \$\{row\.label\}`\}/,
    "the schedule row must not be an accessible parent around its completion button",
  );
  assert.doesNotMatch(
    calendar,
    /disabled=\{done \|\| r\.status === "needs-correction"\}/,
  );
  assert.match(
    calendar,
    /if \(done\) \{[\s\S]{0,180}openRoutineCompletion\(sourceRoutine\);[\s\S]{0,80}return;/,
  );
  assert.match(
    calendar,
    /if \(done\) \{[\s\S]{0,180}openRoutineCompletion\(r\);[\s\S]{0,80}return;/,
  );
  assert.match(
    calendar,
    /accessibilityLabel=\{\s*done\s*\?\s*`View \$\{row\.label\} completion log`/,
  );
});

test("assigned caregivers reflow without truncation and remain in the routine edit context", () => {
  const calendar = readSource(CALENDAR_PATH);
  const scheduleEditAction = openingTagContaining(
    calendar,
    "s.scheduleEditArea",
  );
  const scheduleCompletionAction = openingTagContaining(
    calendar,
    "s.scheduleStatus",
  );
  const routineEditAction = openingTagContaining(calendar, "s.routineEditArea");
  const routineCompletionAction = openingTagContaining(
    calendar,
    "s.routineDoneBtn",
  );
  const scheduleEdit = calendar.slice(
    scheduleEditAction.start,
    scheduleCompletionAction.start,
  );
  const routineEdit = calendar.slice(
    routineEditAction.start,
    routineCompletionAction.start,
  );
  const ownerRowStyle = sourceBetween(
    calendar,
    "  scheduleOwnerRow: {",
    "  scheduleOwnerText: {",
  );
  const ownerTextStyle = sourceBetween(
    calendar,
    "  scheduleOwnerText: {",
    "  scheduleIconChip: {",
  );

  assert.doesNotMatch(scheduleEdit, /numberOfLines=\{1\}/);
  assert.match(
    scheduleEdit,
    /accessibilityHint=\{\s*row\.owner\s*\?\s*`Assigned to \$\{row\.owner\}/,
  );
  assert.match(
    routineEdit,
    /accessibilityHint=\{\s*r\.owner\s*\?\s*`Assigned to \$\{r\.owner\}/,
  );
  assert.match(ownerRowStyle, /alignItems:\s*"flex-start"/);
  assert.match(ownerTextStyle, /flex:\s*1/);
  assert.match(ownerTextStyle, /minWidth:\s*0/);
});

test("Plans opens the exact routine-board completion when legacy logs share a timestamp and type", async () => {
  const { deriveRoutineBoard } = await import("@workspace/care-domain");
  // Routine times are local wall-clock values, so keep the entire fixture in
  // the runner's local timezone. This exercises the same 7:30/7:50 pairing in
  // UTC CI and on Pacific-time development machines.
  const now = new Date(2026, 5, 6, 14).getTime();
  const sharedCompletionTime = new Date(2026, 5, 6, 7, 50).toISOString();
  const board = deriveRoutineBoard({
    now,
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM" },
      { id: "snack", label: "Snack", type: "meal", time: "7:45 AM" },
    ],
    entries: [
      {
        id: "meal_first",
        type: "meal",
        title: "Meal",
        occurredAt: sharedCompletionTime,
      },
      {
        id: "meal_second",
        type: "meal",
        title: "Meal",
        occurredAt: sharedCompletionTime,
      },
    ],
  });
  const calendar = readSource(CALENDAR_PATH);
  const openCompletion = sourceBetween(
    calendar,
    "const openRoutineCompletion =",
    "const logRoutineDone =",
  );

  assert.deepEqual(
    board.items.map((item) => item.completionEntryId),
    ["meal_first", "meal_second"],
  );
  assert.match(openCompletion, /entry\.id === routine\.completionEntryId/);
  assert.doesNotMatch(
    openCompletion,
    /occurredAt|normalizedType|normalizeCareEventType/,
  );
});

test("full-month day controls use a 48pt grid with a compact horizontal escape hatch", () => {
  const month = readSource(MONTH_PATH);
  const gridSection = sourceBetween(
    month,
    "{/* Week grid */}",
    "{/* Selected day timeline */}",
  );
  const dayCellStyle = sourceBetween(month, "dayCell: {", "dayCellInner: {");
  const dayCellInnerStyle = sourceBetween(
    month,
    "dayCellInner: {",
    "dayCircle: {",
  );
  const dayControl = openingTagContaining(month, "style={s.dayCellInner}").text;

  assert.match(gridSection, /<ScrollView\s+horizontal/);
  assert.match(
    gridSection,
    /scrollEnabled=\{monthLayout\.requiresHorizontalScroll\}/,
  );
  assert.match(
    gridSection,
    /showsHorizontalScrollIndicator=\{\s*monthLayout\.requiresHorizontalScroll\s*\}/,
  );
  assert.match(gridSection, /Swipe horizontally to see all seven days/);
  assert.match(gridSection, /<BoardCard\s+enter=\{0\}\s+padded=\{false\}/);
  assert.match(month, /getCalendarMonthGridLayout\(screenWidth\)/);
  assert.match(month, /paddingHorizontal:\s*monthLayout\.pageGutter/);
  assert.match(month, /paddingHorizontal:\s*monthLayout\.gridInset/);
  assert.match(dayCellStyle, /minWidth:\s*CALENDAR_MONTH_DAY_TARGET/);
  assert.match(dayCellStyle, /height:\s*CALENDAR_MONTH_DAY_TARGET/);
  assert.match(dayCellInnerStyle, /width:\s*"100%"/);
  assert.match(dayCellInnerStyle, /height:\s*"100%"/);
  assert.match(dayControl, /^<PressScale\b/);
  assert.match(dayControl, /key=\{cell\.dateKey\}/);
  assert.match(dayControl, /accessibilityRole="button"/);
  assert.match(dayControl, /onPress=\{\(\) => selectDay\(cell\)\}/);
  assert.match(
    dayControl,
    /containerStyle=\{\[\s*s\.dayCell,\s*\{\s*width:\s*monthLayout\.cellSize\s*\},?\s*\]\}/,
  );
  assert.match(dayControl, /style=\{s\.dayCellInner\}/);
  assert.doesNotMatch(
    dayControl,
    /hitSlop=/,
    "adjacent calendar cells must not use overlapping hit slop",
  );
});

test("month layout keeps seven distinct 48pt day regions at supported phone widths", async () => {
  const { CALENDAR_MONTH_DAY_TARGET, getCalendarMonthGridLayout } =
    await import("./calendarMonthLayout.ts");

  assert.equal(CALENDAR_MONTH_DAY_TARGET, 48);
  for (const viewportWidth of [320, 360, 390]) {
    const layout = getCalendarMonthGridLayout(viewportWidth);
    assert.ok(
      layout.cellSize >= 48,
      `${viewportWidth}px must keep a 48pt day target`,
    );
    if (viewportWidth === 320) {
      assert.equal(layout.requiresHorizontalScroll, true);
      assert.ok(layout.gridWidth > layout.cardContentWidth);
    } else {
      assert.equal(layout.requiresHorizontalScroll, false);
      assert.ok(
        layout.gridWidth <= layout.cardContentWidth + Number.EPSILON,
        `${viewportWidth}px must fit all seven columns inside the card`,
      );
    }
    const regions = Array.from({ length: 7 }, (_, index) => ({
      start: index * layout.cellSize,
      end: (index + 1) * layout.cellSize,
    }));
    for (let index = 1; index < regions.length; index += 1) {
      assert.equal(
        regions[index - 1].end,
        regions[index].start,
        `${viewportWidth}px day regions must meet without overlap`,
      );
    }
  }
});

test("focused Plans, Health, and More child presses reset to their tab roots", async () => {
  const { handleUniversalTabPress } = await import("./universalTabBar.ts");
  const layout = readSource(TAB_LAYOUT_PATH);

  const cases = [
    {
      input: {
        tabName: "calendar" as const,
        focused: true,
        pathname: "/calendar",
        plansItem: "routine:morning-walk",
        healthSection: "overview" as const,
        moreSection: "root" as const,
      },
      root: "/calendar",
    },
    {
      input: {
        tabName: "health" as const,
        focused: true,
        pathname: "/health",
        healthSection: "records" as const,
        moreSection: "root" as const,
      },
      root: "/health",
    },
    {
      input: {
        tabName: "more" as const,
        focused: true,
        pathname: "/more",
        healthSection: "overview" as const,
        moreSection: "privacy" as const,
      },
      root: "/more",
    },
  ];

  for (const { input, root } of cases) {
    const effects: string[] = [];
    assert.equal(
      handleUniversalTabPress(input, {
        preventDefault: () => effects.push("prevent-default"),
        replace: (pathname) => effects.push(`replace:${pathname}`),
      }),
      true,
      JSON.stringify(input),
    );
    assert.deepEqual(effects, ["prevent-default", `replace:${root}`]);
  }

  assert.match(layout, /tab\.name === "calendar"/);
  assert.match(layout, /tab\.name === "health"/);
  assert.match(layout, /plansItem:\s*activePlansItem/);
  assert.match(layout, /healthSection:\s*activeHealthSection/);
});

test("root and unfocused primary-tab presses stay Expo-owned", async () => {
  const { handleUniversalTabPress } = await import("./universalTabBar.ts");
  const inputs = [
    {
      tabName: "calendar" as const,
      focused: true,
      pathname: "/calendar",
      healthSection: "overview" as const,
      moreSection: "root" as const,
    },
    {
      tabName: "health" as const,
      focused: true,
      pathname: "/health",
      healthSection: "overview" as const,
      moreSection: "root" as const,
    },
    {
      tabName: "more" as const,
      focused: false,
      pathname: "/more",
      healthSection: "overview" as const,
      moreSection: "privacy" as const,
    },
  ];

  for (const input of inputs) {
    const effects: string[] = [];
    assert.equal(
      handleUniversalTabPress(input, {
        preventDefault: () => effects.push("prevent-default"),
        replace: (pathname) => effects.push(`replace:${pathname}`),
      }),
      false,
      JSON.stringify(input),
    );
    assert.deepEqual(effects, []);
  }
});

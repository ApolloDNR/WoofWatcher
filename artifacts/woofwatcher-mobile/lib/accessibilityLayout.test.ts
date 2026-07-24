import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("web QA font scale uses one query-gated hook across high-frequency surfaces", () => {
  const hookUrl = new URL(
    "../hooks/useWebQaFontScale.ts",
    import.meta.url,
  );
  assert.equal(
    existsSync(hookUrl),
    true,
    "the centralized web QA font-scale hook must exist",
  );
  if (!existsSync(hookUrl)) return;

  const hook = readFileSync(hookUrl, "utf8");
  assert.match(hook, /useGlobalSearchParams/);
  assert.match(hook, /resolveWebQaFontScale/);
  assert.match(hook, /EXPO_PUBLIC_WEB_QA_FONT_SCALE_PROOF/);
  assert.match(hook, /Platform\.OS/);

  for (const relativePath of [
    "../app/(tabs)/_layout.tsx",
    "../app/(tabs)/index.tsx",
    "../app/(tabs)/calendar.tsx",
    "../app/(tabs)/health.tsx",
    "../app/(tabs)/log.tsx",
    "../app/(tabs)/more.tsx",
    "../app/fastlog.tsx",
    "../components/board/BoardPrimitives.tsx",
    "../components/home/HomeEvidenceCard.tsx",
    "../components/home/HomeNowNextCard.tsx",
    "../components/home/HomeStorySummary.tsx",
    "../components/logging/QuickLogGrid.tsx",
    "../components/WebDialogHost.tsx",
  ]) {
    assert.match(
      source(relativePath),
      /useWebQaFontScale\(/,
      `${relativePath} must consume the centralized QA override`,
    );
  }

  const smokeExport = source("../scripts/smoke-web-export.js");
  assert.match(
    smokeExport,
    /EXPO_PUBLIC_WEB_QA_FONT_SCALE_PROOF:\s*"1"/,
  );
  assert.doesNotMatch(source("../app.json"), /WEB_QA_FONT_SCALE_PROOF/);
  assert.doesNotMatch(source("../eas.json"), /WEB_QA_FONT_SCALE_PROOF/);
});

test("core routes expose deterministic QA layout markers on their real controls", () => {
  for (const [relativePath, marker] of [
    ["../app/(tabs)/index.tsx", "qa-layout-today"],
    ["../app/(tabs)/calendar.tsx", "qa-layout-plan"],
    ["../app/fastlog.tsx", "qa-layout-fast-log"],
    ["../app/(tabs)/health.tsx", "qa-layout-health"],
    ["../app/(tabs)/more.tsx", "qa-layout-more"],
  ] as const) {
    const route = source(relativePath);
    assert.match(route, new RegExp(`testID="${marker}"`));
    assert.match(route, /createWebQaLayoutMarker\(\s*qaFontScale/);
    assert.match(route, /nativeID=\{createWebQaLayoutMarker\(/);
  }

  assert.match(
    source("../components/logging/QuickLogGrid.tsx"),
    /testID=\{`quick-log-action-\$\{action\.key\}`\}/,
  );
  const plan = source("../app/(tabs)/calendar.tsx");
  assert.match(plan, /testID="plan-mission-row"/);
  assert.ok(
    (plan.match(/testID="plan-mission-action"/g) ?? []).length >= 2,
    "both Plan action branches need the same proof target",
  );
  const health = source("../app/(tabs)/health.tsx");
  assert.match(health, /testID="health-summary-row"/);
  assert.match(health, /testID="health-summary-value"/);
  const more = source("../app/(tabs)/more.tsx");
  assert.match(more, /testID="more-directory-row"/);
  assert.match(more, /testID="more-directory-action"/);
});

test("Quick Log consumes the font-scale reflow contract", () => {
  const quickLog = source("../components/logging/QuickLogGrid.tsx");

  assert.match(quickLog, /useWindowDimensions\(\)/);
  assert.match(quickLog, /getAccessibleLayoutMetrics\(/);
  assert.match(quickLog, /width:\s*layout\.quickActionWidth/);
  assert.match(quickLog, /minHeight:\s*layout\.quickActionMinHeight/);
  assert.match(quickLog, /numberOfLines=\{layout\.actionLabelNumberOfLines\}/);
  assert.match(
    quickLog,
    /s\.aloneAction,[\s\S]*minHeight:\s*layout\.controlMinHeight/,
  );
  assert.match(
    quickLog,
    /numberOfLines=\{layout\.stackStatusRows \? 2 : 1\}/,
  );
});

test("tab chrome and web dialogs reflow at accessibility text sizes", () => {
  const tabLayout = source("../app/(tabs)/_layout.tsx");
  const webDialog = source("../components/WebDialogHost.tsx");

  assert.match(tabLayout, /useWindowDimensions\(\)/);
  assert.match(tabLayout, /useWebQaFontScale\(/);
  assert.ok(
    (
      tabLayout.match(
        /getFloatingTabChromeMetrics\(\{[\s\S]{0,180}?fontScale/g,
      ) ?? []
    ).length >= 2,
    "both the center Quick Log control and the tab bar must use font-scale-aware chrome",
  );
  assert.match(
    tabLayout,
    /aria-hidden[\s\S]{0,160}?numberOfLines=\{2\}[\s\S]{0,240}?Quick Log/,
  );

  assert.match(
    webDialog,
    /accessibilityLabel=\{`\$\{current\.title\}\. \$\{current\.message\}`\}/,
  );
  assert.match(webDialog, /layout\.stackStatusRows && s\.buttonRowStacked/);
  assert.match(
    webDialog,
    /buttonRowStacked:\s*\{[\s\S]*?flexDirection:\s*"column-reverse"/,
  );
  assert.match(
    webDialog,
    /button:\s*\{[\s\S]*?minHeight:\s*MIN_MOBILE_TOUCH_TARGET/,
  );
});

test("core tab routes reserve clearance for scaled tab chrome", () => {
  for (const relativePath of [
    "../app/(tabs)/index.tsx",
    "../app/(tabs)/calendar.tsx",
    "../app/(tabs)/log.tsx",
    "../app/(tabs)/health.tsx",
    "../app/(tabs)/more.tsx",
  ]) {
    assert.match(
      source(relativePath),
      /getTabbedRouteBottomPadding\(\{[\s\S]{0,180}?fontScale(?:\s*:\s*(?:fontScale|accessibleFontScale))?[\s,}]/,
      `${relativePath} must reserve bottom clearance using its QA-aware font scale`,
    );
  }
});

test("core care routes suppress optional motion when Reduce Motion is enabled", () => {
  const rootLayout = source("../app/_layout.tsx");
  const fastLog = source("../app/fastlog.tsx");
  const log = source("../app/(tabs)/log.tsx");
  const plan = source("../app/(tabs)/calendar.tsx");
  const more = source("../app/(tabs)/more.tsx");

  assert.match(rootLayout, /useReducedMotion\(\)/);
  assert.match(
    rootLayout,
    /animation:\s*reducedMotion \? "none" : "slide_from_bottom"/,
  );

  assert.match(fastLog, /useReducedMotion\(\)/);
  assert.match(
    fastLog,
    /new Animated\.Value\(animatesInternally && !reducedMotion \? 0 : 1\)/,
  );
  assert.match(fastLog, /!animatesInternally \|\| reducedMotion/);

  for (const route of [log, plan, more]) {
    assert.match(route, /useReducedMotion\(\)/);
    assert.match(route, /isWebRoutePreview \|\| reducedMotion/);
    assert.match(route, /animationType=\{reducedMotion \? "none"/);
    assert.doesNotMatch(route, /animationType="(?:slide|fade)"/);
  }

  assert.equal(
    more.match(/<PromptModal[\s\S]{0,900}?reducedMotion=\{reducedMotion\}/g)
      ?.length,
    3,
    "all three reusable More prompts must receive the Reduce Motion setting",
  );
});

test("Today care cards reflow instead of clipping at accessibility sizes", () => {
  const nowNext = source("../components/home/HomeNowNextCard.tsx");
  const evidence = source("../components/home/HomeEvidenceCard.tsx");
  const story = source("../components/home/HomeStorySummary.tsx");

  for (const card of [nowNext, evidence, story]) {
    assert.match(card, /useWindowDimensions\(\)/);
    assert.match(card, /getAccessibleLayoutMetrics\(/);
    assert.match(card, /layout\.stackStatusRows/);
    assert.match(card, /layout\.controlMinHeight/);
  }

  assert.match(nowNext, /s\.nowRowReflow/);
  assert.match(nowNext, /s\.nextRowReflow/);
  assert.match(nowNext, /s\.nextActionsReflow/);
  assert.match(evidence, /s\.promptReflow/);
  assert.match(story, /s\.storyRowReflow/);
  assert.match(story, /s\.actionsReflow/);
  assert.match(
    story,
    /numberOfLines=\{layout\.actionLabelNumberOfLines\}/,
  );
});

test("Health reflows summary values and live signals at accessibility text sizes", () => {
  const health = source("../app/(tabs)/health.tsx");

  assert.match(health, /useWindowDimensions\(\)/);
  assert.match(health, /getAccessibleLayoutMetrics\(/);
  assert.match(health, /layout=\{accessibleLayout\}/);
  assert.match(
    health,
    /numberOfLines=\{layout\.stackStatusRows \? undefined : 1\}/,
  );
  assert.match(
    health,
    /numberOfLines=\{layout\.stackStatusRows \? undefined : 2\}/,
  );
  assert.match(
    health,
    /minHeight:\s*accessibleLayout\.controlMinHeight/,
  );
  assert.match(
    health,
    /accessibleLayout\.stackStatusRows \? row\.actionLabel : "Log"/,
  );
  assert.match(
    health,
    /summaryRowValueReflow:\s*\{[\s\S]*?maxWidth:\s*"100%"/,
  );
  assert.match(
    health,
    /healthSignalStatusReflow:\s*\{[\s\S]*?maxWidth:\s*"100%"/,
  );
  assert.match(
    health,
    /healthSignalActionPillReflow:\s*\{[\s\S]*?minHeight:\s*MIN_MOBILE_TOUCH_TARGET/,
  );
  assert.match(
    health,
    /medicationAdherence\.items[\s\S]*?<HealthSummaryRow[\s\S]*?layout=\{accessibleLayout\}/,
    "medication rows must use the same large-text reflow contract as the rest of Health",
  );
});

test("detailed Log reflows care types and mood choices instead of shrinking labels", () => {
  const log = source("../app/(tabs)/log.tsx");
  const typeLauncher = log.slice(
    log.indexOf('title="Choose care type"'),
    log.indexOf("{/* Contextual controls */}"),
  );

  assert.match(log, /getAccessibleLayoutMetrics\(/);
  assert.match(log, /fontScale/);
  assert.match(typeLauncher, /width:\s*logLayout\.quickActionWidth/);
  assert.match(typeLauncher, /minHeight:\s*logLayout\.controlMinHeight/);
  assert.match(
    typeLauncher,
    /numberOfLines=\{logLayout\.actionLabelNumberOfLines\}/,
  );
  assert.doesNotMatch(typeLauncher, /adjustsFontSizeToFit/);
  assert.match(
    log,
    /g\.key === "mood" && logLayout\.fontScale >= 2[\s\S]*width:\s*logLayout\.quickActionWidth/,
  );
});

test("Fast Log recent care and shared CareRow yield metadata at large text sizes", () => {
  const fastLog = source("../app/fastlog.tsx");
  const primitives = source("../components/board/BoardPrimitives.tsx");

  assert.match(fastLog, /useWindowDimensions\(\)/);
  assert.match(fastLog, /getAccessibleLayoutMetrics\(/);
  assert.match(fastLog, /fastLogLayout\.stackStatusRows/);
  assert.match(
    fastLog,
    /numberOfLines=\{fastLogLayout\.stackStatusRows \? undefined : 1\}/,
  );
  assert.match(fastLog, /s\.recentOutcomeReflow/);

  assert.match(primitives, /export function CareRow[\s\S]*?useWindowDimensions\(\)/);
  assert.match(primitives, /getAccessibleLayoutMetrics\(/);
  assert.match(
    primitives,
    /numberOfLines=\{layout\.stackStatusRows \? undefined : 1\}/,
  );
  assert.match(primitives, /layout\.stackStatusRows[\s\S]*?styles\.rowMetaReflow/);
});

test("shared segment controls expose native and web selected semantics", () => {
  const primitives = source("../components/board/BoardPrimitives.tsx");

  assert.match(primitives, /accessibilityRole="tab"/);
  assert.match(primitives, /accessibilityState=\{\{ selected: isActive \}\}/);
  assert.match(primitives, /aria-selected=\{isActive\}/);
  assert.match(primitives, /is selected\./);
  assert.match(primitives, /Selects \$\{segment\.label\}\./);
  assert.match(primitives, /layout\.stackStatusRows && styles\.segmentRowReflow/);
  assert.match(primitives, /layout\.stackStatusRows && styles\.segmentChipReflow/);
  assert.match(
    primitives,
    /\{!layout\.stackStatusRows \? \([\s\S]*?<Reanimated\.View/,
  );
  assert.match(
    primitives,
    /numberOfLines=\{layout\.actionLabelNumberOfLines\}/,
  );
});

test("core care chips expose roles, labels, state, and state-specific hints", () => {
  const health = source("../app/(tabs)/health.tsx");
  const calendar = source("../app/(tabs)/calendar.tsx");
  const log = source("../app/(tabs)/log.tsx");

  assert.match(health, /accessibilityRole="tab"/);
  assert.match(health, /accessibilityState=\{\{ selected: active \}\}/);
  assert.match(calendar, /accessibilityRole="radio"/);
  assert.match(calendar, /accessibilityState=\{\{ checked: active \}\}/);
  assert.match(calendar, /Assigns this routine to/);
  assert.match(log, /accessibilityRole="checkbox"/);
  assert.match(log, /accessibilityState=\{\{ checked: filter === null \}\}/);
  assert.match(log, /Filters history to/);
  assert.match(log, /Updates the meal outcome to/);
});

test("shared high-frequency buttons use the 48-point target token", () => {
  const primitives = source("../components/board/BoardPrimitives.tsx");

  for (const styleName of [
    "segmentChip",
    "actionButton",
    "actionButtonCompact",
  ]) {
    assert.match(
      primitives,
      new RegExp(
        `${styleName}: \\{[\\s\\S]*?minHeight: MIN_MOBILE_TOUCH_TARGET`,
      ),
    );
  }
});

test("shared action buttons grow and wrap with Dynamic Type", () => {
  const primitives = source("../components/board/BoardPrimitives.tsx");

  assert.match(primitives, /useWindowDimensions\(\)/);
  assert.match(primitives, /getAccessibleLayoutMetrics\(/);
  assert.match(primitives, /minHeight:\s*layout\.controlMinHeight/);
  assert.match(
    primitives,
    /numberOfLines=\{layout\.actionLabelNumberOfLines\}/,
  );
});

test("shared section headers and Today shell reflow at accessibility sizes", () => {
  const primitives = source("../components/board/BoardPrimitives.tsx");
  const home = source("../app/(tabs)/index.tsx");

  assert.match(
    primitives,
    /layout\.stackStatusRows && styles\.sectionHeaderReflow/,
  );
  assert.match(
    primitives,
    /numberOfLines=\{layout\.stackStatusRows \? 2 : 1\}/,
  );
  assert.match(home, /getAccessibleLayoutMetrics\(/);
  assert.match(home, /s\.presencePanelReflow/);
  assert.match(home, /s\.secondaryLinksReflow/);
  assert.match(
    home,
    /minWidth:\s*homeAccessibleLayout\.controlMinHeight/,
  );
  assert.match(
    home,
    /width:\s*homeFirstScreenLayout\.heroStudioButtonWidth/,
  );
});

test("Log and Plan high-frequency controls retain 48-point targets", () => {
  const log = source("../app/(tabs)/log.tsx");
  const calendar = source("../app/(tabs)/calendar.tsx");

  for (const styleName of [
    "syncBtn",
    "returnInput",
    "typeChip",
    "segPill",
    "searchClear",
    "filterChip",
  ]) {
    assert.match(
      log,
      new RegExp(
        `${styleName}: \\{[\\s\\S]*?(?:minHeight|height): MIN_MOBILE_TOUCH_TARGET`,
      ),
    );
  }
  assert.match(
    calendar,
    /scheduleRow: \{[\s\S]*?minHeight: MIN_MOBILE_TOUCH_TARGET/,
  );
});

test("Plan editor sheets stay scrollable and keyboard-safe at accessibility sizes", () => {
  const calendar = source("../app/(tabs)/calendar.tsx");
  const routineSheet = calendar.slice(
    calendar.indexOf("{/* Routine editor modal */}"),
    calendar.indexOf("{/* Add-event modal */}"),
  );
  const eventSheet = calendar.slice(
    calendar.indexOf("{/* Add-event modal */}"),
    calendar.indexOf("\n    </View>\n  );", calendar.indexOf("{/* Add-event modal */}")),
  );

  assert.match(calendar, /useWindowDimensions\(\)/);
  assert.match(calendar, /getAccessibleLayoutMetrics\(\{/);
  assert.match(calendar, /layout\.stackFormFields/);
  assert.equal(
    (calendar.match(/<KeyboardAvoidingView/g) ?? []).length,
    2,
    "both the routine and event sheets must avoid the keyboard",
  );
  assert.equal(
    (calendar.match(/keyboardShouldPersistTaps="handled"/g) ?? []).length,
    2,
    "both long forms must remain vertically scrollable while editing",
  );
  assert.equal(
    (calendar.match(/style=\{s\.modalBackdrop\}\s+onPress=/g) ?? []).length,
    2,
    "both modal backdrops must retain tap-to-dismiss",
  );
  assert.match(
    calendar,
    /modalSheet: \{[\s\S]*?maxHeight:\s*"94%"/,
    "the sheet needs a bounded viewport for vertical scrolling",
  );
  assert.match(
    calendar,
    /fieldRowStacked: \{[\s\S]*?flexDirection:\s*"column"/,
    "paired fields must reflow at 2x Dynamic Type",
  );
  assert.ok(
    routineSheet.indexOf('testID="routine-editor-scroll"') <
      routineSheet.indexOf('accessibilityLabel="Delete routine"') &&
      routineSheet.indexOf('accessibilityLabel="Delete routine"') <
        routineSheet.lastIndexOf("</ScrollView>"),
    "routine Save and Delete actions must stay inside the vertical scroller",
  );
  assert.ok(
    eventSheet.indexOf('testID="event-editor-scroll"') <
      eventSheet.indexOf('accessibilityLabel="Add event to calendar"') &&
      eventSheet.indexOf('accessibilityLabel="Add event to calendar"') <
        eventSheet.lastIndexOf("</ScrollView>"),
    "event Save action must stay inside the vertical scroller",
  );
});

test("Plan mission rows yield detail and actions at accessibility text sizes", () => {
  const calendar = source("../app/(tabs)/calendar.tsx");

  assert.match(calendar, /layout\.stackStatusRows && s\.planMissionRowReflow/);
  assert.match(
    calendar,
    /numberOfLines=\{layout\.stackStatusRows \? undefined : 1\}/,
  );
  assert.match(calendar, /layout\.stackStatusRows[\s\S]*?s\.planMissionActionReflow/);
  assert.match(
    calendar,
    /accessibilityLabel=\{`Open \$\{mission\.eyebrow\}: \$\{mission\.title\}\. \$\{mission\.detail\}\. \$\{mission\.actionLabel\}`\}/,
  );
});

test("Plan editor fields and actions expose durable form semantics", () => {
  const calendar = source("../app/(tabs)/calendar.tsx");

  for (const label of [
    "Routine label",
    "Routine time",
    "Routine owner (optional)",
    "Routine note (optional)",
    "Event title",
    "Event date",
    "Event time",
    "Event location (optional)",
  ]) {
    assert.match(
      calendar,
      new RegExp(`accessibilityLabel="${label.replace(/[()]/g, "\\$&")}"`),
    );
  }

  assert.match(
    calendar,
    /accessibilityRole="radio"\s+accessibilityLabel=\{`Routine type \$\{t\.label\}`\}[\s\S]*?accessibilityState=\{\{ checked: active \}\}/,
  );
  assert.match(
    calendar,
    /accessibilityLabel=\{`Routine type \$\{t\.label\}`\}[\s\S]*?accessibilityHint=\{[\s\S]*?active[\s\S]*?is selected[\s\S]*?Selects routine type/,
  );
  assert.match(
    calendar,
    /accessibilityRole="radio"\s+accessibilityLabel=\{`Event type \$\{t\.label\}`\}[\s\S]*?accessibilityState=\{\{ checked: active \}\}/,
  );
  assert.match(
    calendar,
    /accessibilityLabel=\{`Event type \$\{t\.label\}`\}[\s\S]*?accessibilityHint=\{[\s\S]*?active[\s\S]*?is selected[\s\S]*?Selects event type/,
  );
  assert.match(
    calendar,
    /accessibilityRole="button"\s+accessibilityLabel=\{routineEditId \? "Save routine changes" : "Add routine"\}/,
  );
  assert.match(
    calendar,
    /accessibilityRole="button"\s+accessibilityLabel="Delete routine"/,
  );
  assert.match(
    calendar,
    /accessibilityRole="button"\s+accessibilityLabel="Add event to calendar"/,
  );
});

test("More command surfaces reflow instead of shrinking labels at accessibility sizes", () => {
  const more = source("../app/(tabs)/more.tsx");
  const commandHub = more.slice(
    more.indexOf("Launch Command Hub"),
    more.indexOf("{/* Care Team / Household */}"),
  );

  assert.match(more, /useWindowDimensions\(\)/);
  assert.match(more, /getAccessibleLayoutMetrics\(\{/);
  assert.match(
    commandHub,
    /moreAccessibleLayout\.stackStatusRows &&\s*s\.moreCommandHeadRowReflow/,
  );
  assert.match(
    commandHub,
    /moreAccessibleLayout\.stackStatusRows &&\s*s\.moreCommandStatsReflow/,
  );
  assert.match(
    commandHub,
    /moreAccessibleLayout\.fontScale >= 2[\s\S]*?\?\s*"100%"[\s\S]*?:\s*moreAccessibleLayout\.quickActionWidth/,
  );
  assert.match(
    commandHub,
    /moreAccessibleLayout\.stackStatusRows &&\s*s\.moreDirectoryRowReflow/,
  );
  assert.match(
    commandHub,
    /numberOfLines=\{\s*moreAccessibleLayout\.actionLabelNumberOfLines\s*\}/,
  );
  assert.doesNotMatch(commandHub, /adjustsFontSizeToFit/);
});

test("More selectable controls expose role, state, and state-specific guidance", () => {
  const more = source("../app/(tabs)/more.tsx");
  const activePackControl = more.slice(
    more.indexOf("accessibilityLabel={`Active pack:"),
    more.indexOf(
      "onPress={() => switchHousehold",
      more.indexOf("accessibilityLabel={`Active pack:"),
    ),
  );

  assert.match(
    more,
    /accessibilityRole="radio"\s+accessibilityLabel=\{`Access Pass role: \$\{kind\.label\}`\}[\s\S]*?accessibilityState=\{\{ checked: selected \}\}[\s\S]*?aria-checked=\{selected\}[\s\S]*?accessibilityHint=\{[\s\S]*?selected/,
  );
  assert.match(
    more,
    /accessibilityRole="radio"\s+accessibilityLabel=\{`Provider setup status: \$\{statusOption\.label\}`\}[\s\S]*?accessibilityState=\{\{ checked: selected \}\}[\s\S]*?aria-checked=\{selected\}[\s\S]*?accessibilityHint=\{[\s\S]*?selected/,
  );
  assert.match(
    more,
    /accessibilityRole="radio"\s+accessibilityLabel=\{`Weight unit: \$\{u\}`\}[\s\S]*?accessibilityState=\{\{ checked: pWeightUnit === u \}\}[\s\S]*?aria-checked=\{pWeightUnit === u\}[\s\S]*?accessibilityHint=\{[\s\S]*?pWeightUnit === u/,
  );
  assert.match(
    more,
    /accessibilityRole="radio"\s+accessibilityLabel=\{`Active pack: \$\{membership\.household\.name\}`\}/,
  );
  assert.match(activePackControl, /accessibilityState=\{\{/);
  assert.match(activePackControl, /checked: membership\.isActive/);
  assert.match(
    activePackControl,
    /disabled:\s*!membership\.eligible\s*\|\|\s*selectActiveHousehold\.isPending/,
  );
  assert.match(activePackControl, /aria-checked=\{membership\.isActive\}/);
  assert.match(activePackControl, /accessibilityHint=/);
  assert.match(activePackControl, /is the active pack/);
  assert.match(activePackControl, /cannot be selected/);
  assert.match(activePackControl, /Switches active care/);
});

test("More navigation rows keep explicit actions and wrapping metadata", () => {
  const more = source("../app/(tabs)/more.tsx");
  const actionRows = more.slice(
    more.indexOf("{/* Household actions */}"),
    more.indexOf("{/* Diet profile */}"),
  );

  assert.match(
    actionRows,
    /accessibilityRole="button"\s+accessibilityLabel="Edit your display name"/,
  );
  assert.match(
    actionRows,
    /accessibilityRole="button"\s+accessibilityLabel="Join another household"/,
  );
  assert.equal(
    (
      actionRows.match(
        /numberOfLines=\{\s*moreAccessibleLayout\.stackStatusRows\s*\?\s*undefined\s*:\s*1\s*\}/g,
      ) ?? []
    ).length,
    3,
    "all visible More navigation metadata must wrap instead of truncating at accessibility sizes",
  );
});

test("More form sheets keep fields and final actions reachable above the keyboard", () => {
  const more = source("../app/(tabs)/more.tsx");
  const sheetScrollIds = [
    "diet-editor-scroll",
    "pet-roster-editor-scroll",
    "access-pass-editor-scroll",
    "provider-setup-editor-scroll",
    "profile-editor-scroll",
  ];

  assert.match(more, /KeyboardAvoidingView/);
  assert.ok(
    (more.match(/<KeyboardAvoidingView/g) ?? []).length >= 6,
    "every bottom form sheet and the reusable prompt dialog must avoid the keyboard",
  );
  assert.ok(
    (more.match(/automaticallyAdjustKeyboardInsets/g) ?? []).length >= 5,
    "every long bottom form must use automatic keyboard insets",
  );
  assert.ok(
    (more.match(/keyboardShouldPersistTaps="handled"/g) ?? []).length >= 5,
    "every long bottom form must stay scrollable while editing",
  );
  assert.ok(
    (
      more.match(
        /s\.profWeightRow,\s*moreAccessibleLayout\.stackFormFields &&\s*s\.profWeightRowReflow/g,
      ) ?? []
    ).length >= 2,
    "paired profile fields must stack at accessibility text sizes",
  );

  for (const testId of sheetScrollIds) {
    assert.match(more, new RegExp(`testID="${testId}"`));
  }

  for (const [testId, actionLabel] of [
    ["diet-editor-scroll", "Save diet profile"],
    ["pet-roster-editor-scroll", "Save future dog draft"],
    ["access-pass-editor-scroll", "Save Access Pass draft"],
    ["provider-setup-editor-scroll", "Save provider launch setup"],
    ["profile-editor-scroll", "Save dog profile"],
  ] as const) {
    const start = more.indexOf(`testID="${testId}"`);
    const end = more.indexOf("</ScrollView>", start);
    const action = more.indexOf(`accessibilityLabel="${actionLabel}"`, start);
    assert.ok(start >= 0 && action > start && action < end);
  }
});

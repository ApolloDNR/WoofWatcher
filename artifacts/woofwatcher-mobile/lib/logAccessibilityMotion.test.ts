import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MOBILE_ROOT = existsSync(
  join(process.cwd(), "artifacts", "woofwatcher-mobile"),
)
  ? join(process.cwd(), "artifacts", "woofwatcher-mobile")
  : process.cwd();
const LOG_PATH = join(MOBILE_ROOT, "app", "(tabs)", "log.tsx");

function readLog(): string {
  return existsSync(LOG_PATH) ? readFileSync(LOG_PATH, "utf8") : "";
}

function componentBlocks(source: string, component: string): string[] {
  return Array.from(
    source.matchAll(new RegExp(`<${component}(?=\\s)[\\s\\S]*?\\/>`, "g")),
    (match) => match[0],
  );
}

function inputForValue(source: string, valueName: string): string {
  const block = componentBlocks(source, "TextInput").find((candidate) =>
    candidate.includes(`value={${valueName}}`),
  );
  assert.ok(block, `expected a TextInput bound to ${valueName}`);
  return block;
}

function pressableForLabel(source: string, label: string): string {
  const block = Array.from(
    source.matchAll(/<Pressable\b[\s\S]*?<\/Pressable>/g),
    (match) => match[0],
  ).find((candidate) => candidate.includes(`accessibilityLabel="${label}"`));
  assert.ok(block, `expected a Pressable named ${label}`);
  return block;
}

function pressableContaining(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `expected Pressable marker: ${marker}`);
  const start = source.lastIndexOf("<Pressable", markerIndex);
  const end = source.indexOf("</Pressable>", markerIndex);
  assert.ok(start >= 0 && end > markerIndex, `expected Pressable block for: ${marker}`);
  return source.slice(start, end + "</Pressable>".length);
}

function textUsingStyle(source: string, styleName: string): string {
  const markerIndex = source.indexOf(`s.${styleName}`);
  assert.notEqual(markerIndex, -1, `expected Text style: ${styleName}`);
  const start = source.lastIndexOf("<Text", markerIndex);
  const end = source.indexOf("</Text>", markerIndex);
  assert.ok(start >= 0 && end > markerIndex, `expected Text block for: ${styleName}`);
  return source.slice(start, end + "</Text>".length);
}

test("Log route entrance honors the platform Reduce Motion preference", () => {
  const log = readLog();

  assert.match(log, /useReducedMotion/);
  assert.match(log, /const reducedMotion = useReducedMotion\(\)/);
  assert.match(log, /useLayoutEffect\(\(\) => \{/);
  assert.match(log, /if \(isWebRoutePreview\) return;/);
  assert.match(
    log,
    /if \(reducedMotion\) \{[\s\S]*fade\.stopAnimation\(\)[\s\S]*slide\.stopAnimation\(\)[\s\S]*fade\.setValue\(1\)[\s\S]*slide\.setValue\(0\)[\s\S]*return/,
  );
  assert.match(log, /\}, \[fade, isWebRoutePreview, reducedMotion, slide\]\);/);
});

test("every Log modal disables its slide or fade transition under Reduce Motion", () => {
  const log = readLog();
  const modals = Array.from(log.matchAll(/<Modal(?=\s)[\s\S]*?>/g), (match) => match[0]);

  assert.equal(modals.length, 4);
  for (const modal of modals) {
    assert.match(
      modal,
      /animationType=\{reducedMotion \? "none" : "(?:slide|fade)"\}/,
    );
  }
  assert.equal(
    modals.filter((modal) => modal.includes(': "slide"}')).length,
    3,
  );
  assert.equal(
    modals.filter((modal) => modal.includes(': "fade"}')).length,
    1,
  );
});

test("Log sheets keep large text and keyboard-covered actions vertically reachable", () => {
  const log = readLog();
  const launcher = log.slice(
    log.indexOf("{/* Launcher detail sheet */}"),
    log.indexOf("{/* Entry detail modal */}"),
  );
  const editor = log.slice(
    log.indexOf("{/* Entry editor modal */}"),
    log.indexOf("{/* Post-log quick-note prompt */}"),
  );
  const stickyPrompt = log.slice(log.indexOf("{/* Post-log quick-note prompt */}"));

  assert.match(
    launcher,
    /<ScrollView[\s\S]{0,260}style=\{s\.launcherDetailScroll\}[\s\S]{0,180}contentContainerStyle=\{s\.launcherDetailContent\}/,
  );
  assert.match(
    editor,
    /<KeyboardAvoidingView[\s\S]{0,220}style=\{s\.modalDock\}[\s\S]*<ScrollView[\s\S]{0,260}style=\{s\.editFormScroll\}/,
  );
  assert.match(
    stickyPrompt,
    /<ScrollView[\s\S]{0,260}style=\{s\.modalPromptScroll\}[\s\S]{0,180}contentContainerStyle=\{s\.modalPromptContent\}/,
  );
  assert.match(log, /launcherDetailSheet:\s*\{[^}]*maxHeight:\s*"92%"/);
  assert.match(log, /launcherDetailScroll:\s*\{[^}]*flexShrink:\s*1[^}]*minHeight:\s*0/);
  assert.match(log, /editSheet:\s*\{[^}]*maxHeight:\s*"92%"/);
  assert.match(log, /editFormScroll:\s*\{[^}]*flexShrink:\s*1[^}]*minHeight:\s*0/);
  assert.match(log, /modalCard:\s*\{[^}]*maxHeight:\s*"100%"/);
  assert.match(log, /modalPromptScroll:\s*\{[^}]*flexShrink:\s*1[^}]*minHeight:\s*0/);

  for (const styleName of ["modalSkip", "modalSave"]) {
    const style = log.match(new RegExp(`${styleName}:\\s*\\{[^}]*\\}`))?.[0] ?? "";
    assert.match(style, /minHeight:\s*MIN_MOBILE_TOUCH_TARGET/);
    assert.match(style, /paddingVertical:\s*\d+/);
    assert.doesNotMatch(style, /\bheight:\s*48/);
  }
  for (const styleName of ["modalSkipText", "modalSaveText"]) {
    const style = log.match(new RegExp(`${styleName}:\\s*\\{[^}]*\\}`))?.[0] ?? "";
    assert.match(style, /flexShrink:\s*1/);
    assert.match(style, /textAlign:\s*"center"/);
  }
});

test("Log launcher values and labels can wrap instead of shrinking or truncating", () => {
  const log = readLog();

  for (const styleName of [
    "logCommandHudValue",
    "launcherTileText",
    "launcherTileModeText",
    "launcherDoctrineLabel",
    "launcherDoctrineDetail",
    "launcherDetailModeLabel",
    "launcherDetailModeDetail",
  ]) {
    const text = textUsingStyle(log, styleName);
    assert.doesNotMatch(text, /numberOfLines=/, `${styleName} must be allowed to wrap`);
    assert.doesNotMatch(
      text,
      /adjustsFontSizeToFit/,
      `${styleName} must preserve the user's requested text size`,
    );
  }

  for (const styleName of [
    "launcherTile",
    "launcherTileMode",
    "launcherDoctrineCard",
    "launcherDetailModeCard",
  ]) {
    const start = log.indexOf(`  ${styleName}: {`);
    const end = log.indexOf("\n  },", start);
    assert.ok(start >= 0 && end > start, `expected ${styleName} style block`);
    assert.doesNotMatch(
      log.slice(start, end),
      /\bheight:\s*\d+/,
      `${styleName} must grow vertically with wrapped large text`,
    );
  }
});

test("every visible Log composer text field has a stable programmatic label", () => {
  const log = readLog();
  const expectedLabels: Record<string, string> = {
    walkFinishRouteName: "Walk finish route or place",
    walkFinishDistanceMiles: "Walk finish distance in miles",
    walkFinishDogInteractions: "Walk finish dog interactions",
    walkFinishSocialOutcome: "Walk finish social outcome",
    walkFinishNote: "Walk finish note",
    returnRecoveryMinutes: "Home alone recovery minutes",
    returnNote: "Home alone return note",
    moodContext: "Mood care context",
    walkRouteName: "Walk route or place",
    walkDistanceMiles: "Walk distance in miles",
    walkDogInteractions: "Walk dog interactions",
    walkSocialOutcome: "Walk social outcome",
    trainingSkill: "Training skill or cue",
    trainingNextPractice: "Training next practice",
    aloneTrigger: "Home alone trigger or context",
    recoveryMinutes: "Home alone recovery minutes",
    calmingSupport: "Home alone calming support",
    incidentTrigger: "Incident trigger or context",
    incidentExposure: "Incident people or animals involved",
    incidentInjury: "Incident injury check",
    incidentAction: "Incident action taken",
    incidentFollowUp: "Incident follow-up",
    groomingCondition: "Grooming coat or skin note",
    groomingProducts: "Grooming products",
    groomingNextDue: "Grooming next due date",
    expectedPortion: "Meal expected portion",
    eatenAmount: "Meal eaten amount",
    medicationDose: "Medication dose",
  };

  for (const [valueName, label] of Object.entries(expectedLabels)) {
    assert.match(
      inputForValue(log, valueName),
      new RegExp(`accessibilityLabel="${label}"`),
      `${valueName} must not depend on placeholder text as its accessible name`,
    );
  }

  assert.match(
    inputForValue(log, "numeric"),
    /accessibilityLabel=\{`\$\{config\.numeric\.label\}, \$\{numericUnit\}, \$\{config\.numeric\.optional \? "optional" : "required"\}`\}/,
  );
  assert.match(
    inputForValue(log, "noteText"),
    /accessibilityLabel=\{`\$\{selectedLabel\} care note`\}/,
  );

  for (const input of componentBlocks(log, "TextInput")) {
    assert.match(
      input,
      /accessibilityLabel=/,
      "every rendered TextInput on Log must expose a programmatic label",
    );
  }
});

test("Log core controls expose 48pt frames without relying on 40pt legacy sizes", () => {
  const log = readLog();

  for (const [styleName, nextStyleName] of [
    ["syncBtn", "title"],
    ["returnInput", "returnInputHalf"],
    ["typeChip", "typeChipIcon"],
    ["segPill", "segText"],
    ["filterChip", "filterText"],
  ] as const) {
    const start = log.indexOf(`${styleName}:`);
    const end = log.indexOf(`${nextStyleName}:`, start + styleName.length);
    assert.ok(start >= 0 && end > start, `expected ${styleName} style block`);
    const style = log.slice(start, end);
    assert.match(style, /(?:minHeight|height):\s*MIN_MOBILE_TOUCH_TARGET/);
    assert.doesNotMatch(style, /(?:minHeight|height):\s*40\b/);
  }
});

test("Log segmented choices show pressed feedback as well as selected state", () => {
  const log = readLog();
  const controls = [
    pressableContaining(log, "Show ${tab.label} quick log actions"),
    pressableContaining(log, "Log ${q.label}"),
    pressableContaining(log, "Set ${g.label}: ${o.label}"),
    pressableContaining(log, "${config.stepper!.label}: ${v} ${config.stepper!.unit}"),
    pressableContaining(log, 'accessibilityLabel="Show all log types"'),
    pressableContaining(log, "Filter by ${q.label}"),
  ];

  for (const control of controls) {
    assert.match(control, /style=\{\(\{ pressed \}\) => \[/);
    assert.match(control, /opacity: pressed \? 0\.72 : 1/);
  }
});

test("every potty detail choice announces which value is selected", () => {
  const log = readLog();
  const panelStart = log.indexOf('{detailType === "potty" ? (');
  const panelEnd = log.indexOf("Save potty details", panelStart);
  assert.ok(panelStart >= 0 && panelEnd > panelStart, "expected the potty detail panel");
  const panel = log.slice(panelStart, panelEnd);

  for (const labelPrefix of [
    "Set potty outcome:",
    "Set potty location:",
    "Set pee detail:",
    "Set stool consistency:",
    "Set stool color:",
    "Set potty context:",
  ]) {
    const control = pressableContaining(panel, labelPrefix);
    assert.match(
      control,
      /accessibilityState=\{\{ selected: active \}\}/,
      `${labelPrefix} choices must expose their visual selection to assistive technology`,
    );
  }
});

test("search and sticky-note actions expose roles, names, touch size, and pressed feedback", () => {
  const log = readLog();
  const searchStart = log.indexOf('accessibilityLabel="Clear log search"');
  const searchButton = log.slice(searchStart, searchStart + 700);
  assert.ok(searchStart >= 0, "clear-search control must exist");
  assert.match(searchButton, /accessibilityRole="button"/);
  assert.match(searchButton, /hitSlop=\{MOBILE_INLINE_HIT_SLOP\}/);
  assert.match(searchButton, /style=\{\(\{ pressed \}\) =>/);
  assert.match(searchButton, /opacity: pressed \? 0\.7[25] : 1/);

  const promptStart = log.indexOf("{/* Post-log quick-note prompt */}");
  const prompt = log.slice(promptStart);
  for (const [label, visibleText] of [
    ["Skip sticky note", "Skip"],
    ["Save sticky note", "Save sticky"],
  ] as const) {
    const button = pressableForLabel(prompt, label);
    assert.match(button, /accessibilityRole="button"/);
    assert.match(button, /style=\{\(\{ pressed \}\) =>/);
    assert.match(button, new RegExp(`>${visibleText}<`));
  }
});

test("sticky-note dismissal never saves an undisclosed draft", () => {
  const log = readLog();
  const dismiss = log.slice(
    log.indexOf("const dismissQuickNote = useCallback"),
    log.indexOf("const saveQuickNote = useCallback"),
  );
  const prompt = log.slice(log.indexOf("{/* Post-log quick-note prompt */}"));

  assert.match(dismiss, /setPromptId\(null\)/);
  assert.match(dismiss, /setPromptNote\(""\)/);
  assert.equal(
    [...prompt.matchAll(/onRequestClose=\{dismissQuickNote\}/g)].length,
    2,
    "hardware close and sheet close must both skip the draft",
  );
  assert.match(prompt, /ModalBackdropPressable[\s\S]{0,180}onPress=\{dismissQuickNote\}/);
  assert.match(
    pressableForLabel(prompt, "Skip sticky note"),
    /onPress=\{dismissQuickNote\}/,
  );
  assert.doesNotMatch(
    prompt,
    /ModalBackdropPressable[\s\S]{0,180}onPress=\{saveQuickNote\}/,
  );
  assert.equal(
    [...prompt.matchAll(/(?:onPress|onSubmitEditing)=\{saveQuickNote\}/g)].length,
    2,
    "only explicit Save or keyboard submit may persist the sticky note",
  );
});

test("composer visibility switches keep visible press feedback", () => {
  const log = readLog();
  const switches = Array.from(
    log.matchAll(
      /<Pressable[\s\S]*?accessibilityLabel="Share this log with the household"[\s\S]*?<\/Pressable>/g,
    ),
    (match) => match[0],
  );

  assert.equal(switches.length, 8);
  for (const button of switches) {
    assert.match(button, /style=\{\(\{ pressed \}\) => \[/);
    assert.match(button, /opacity: pressed \? 0\.8[25] : 1/);
  }
});

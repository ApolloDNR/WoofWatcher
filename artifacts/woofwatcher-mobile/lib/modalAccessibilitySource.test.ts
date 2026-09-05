import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readAppFile(...segments: string[]) {
  return readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", ...segments),
    "utf8",
  );
}

function readComponentFile(...segments: string[]) {
  return readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "components",
      ...segments,
    ),
    "utf8",
  );
}

function modalSlice(source: string, visibleMarker: string) {
  const marker = source.indexOf(visibleMarker);
  assert.notEqual(marker, -1, `missing modal marker: ${visibleMarker}`);
  const start = source.lastIndexOf("<Modal", marker);
  const end = source.indexOf("</Modal>", marker);
  assert.ok(start >= 0 && end > marker, `could not isolate ${visibleMarker}`);
  return source.slice(start, end);
}

function assertContainerOnlyShell(modal: string, name: string) {
  const backdropStart = modal.indexOf("<Pressable");
  const sheetStart = modal.indexOf("<Pressable", backdropStart + 1);
  const firstChildControl = modal.indexOf("<Pressable", sheetStart + 1);
  assert.ok(backdropStart >= 0 && sheetStart > backdropStart);
  const backdrop = modal.slice(backdropStart, sheetStart);
  const sheet = modal.slice(
    sheetStart,
    firstChildControl > sheetStart ? firstChildControl : modal.length,
  );

  assert.match(
    backdrop,
    /^<Pressable[\s\S]*?accessible=\{false\}/,
    `${name} backdrop must not group the sheet`,
  );
  assert.match(
    sheet,
    /^<Pressable[\s\S]*?accessible=\{false\}[\s\S]*?accessibilityViewIsModal/,
    `${name} sheet must isolate modal traversal without grouping its children`,
  );
  assert.match(
    sheet,
    /stopPropagation\(\)/,
    `${name} sheet must preserve touch backdrop dismissal without bubbling`,
  );
}

test("WoofGuide owner review exposes every child action inside an iOS modal boundary", () => {
  const source = readAppFile("woofguide.tsx");
  const modal = modalSlice(source, "visible={reviewAction !== null}");

  assertContainerOnlyShell(modal, "WoofGuide owner review");
  assert.match(modal, /accessibilityLabel="Close owner review"/);
  assert.match(modal, /accessibilityLabel="Cancel owner review"/);
  assert.match(modal, /accessibilityLabel="Apply reviewed WoofGuide draft"/);
});

test("every More modal keeps its backdrop and sheet out of iOS accessibility grouping", () => {
  const source = readAppFile("(tabs)", "more.tsx");
  for (const marker of [
    "visible={dietEditOpen}",
    "visible={petRosterOpen}",
    "visible={accessPassOpen}",
    "visible={providerSetupOpen}",
    "visible={profileOpen}",
    "visible={visible}",
  ]) {
    assertContainerOnlyShell(modalSlice(source, marker), `More ${marker}`);
  }
});

test("every More editing sheet exposes a named non-mutating exit", () => {
  const source = readAppFile("(tabs)", "more.tsx");
  for (const [marker, label] of [
    ["visible={dietEditOpen}", "Close diet profile editor"],
    ["visible={petRosterOpen}", "Close future dog editor"],
    ["visible={accessPassOpen}", "Close Access Pass editor"],
    ["visible={providerSetupOpen}", "Close provider launch setup"],
    ["visible={profileOpen}", "Close dog profile editor"],
  ] as const) {
    assert.match(
      modalSlice(source, marker),
      new RegExp(`accessibilityLabel="${label}"`),
      `${marker} needs a separately reachable close control`,
    );
  }

  const prompt = modalSlice(source, "visible={visible}");
  assert.match(prompt, /accessibilityLabel=\{`Cancel \$\{title\}`\}/);
  const headerStart = source.indexOf("function ModalSheetHeader");
  const headerEnd = source.indexOf("function PromptModal", headerStart);
  assert.ok(headerStart >= 0 && headerEnd > headerStart);
  const header = source.slice(headerStart, headerEnd);
  assert.match(
    header,
    /<Pressable[\s\S]*?accessibilityRole="button"[\s\S]*?accessibilityLabel=\{accessibilityLabel\}[\s\S]*?onPress=\{onClose\}/,
  );
});

test("Calendar editors expose named exits and truthful disabled submit state", () => {
  const source = readAppFile("(tabs)", "calendar.tsx");
  const routine = modalSlice(source, "visible={routineOpen}");
  const event = modalSlice(source, "visible={addOpen}");

  assert.match(routine, /accessibilityLabel="Close routine editor"/);
  assert.match(event, /accessibilityLabel="Close event editor"/);

  assert.match(
    routine,
    /accessibilityLabel=\{\s*routineEditId\s*\?\s*"Save routine changes"\s*:\s*"Add routine"\s*\}[\s\S]*?accessibilityState=\{\{\s*disabled:\s*!rLabel\.trim\(\)\s*\}\}[\s\S]*?disabled=\{!rLabel\.trim\(\)\}[\s\S]*?onPress=\{submitRoutine\}/,
  );
  assert.match(
    event,
    /accessibilityLabel="Add event to calendar"[\s\S]*?accessibilityState=\{\{\s*disabled:\s*!evTitle\.trim\(\)\s*\}\}[\s\S]*?disabled=\{!evTitle\.trim\(\)\}[\s\S]*?onPress=\{submitEvent\}/,
  );
});

test("Log detail and editor sheets always offer a named non-mutating exit", () => {
  const source = readAppFile("(tabs)", "log.tsx");

  for (const [marker, label] of [
    ["visible={launcherDetailAction !== null}", "Close quick log details"],
    ["visible={detailEntry !== null}", "Close care log details"],
    ["visible={editEntry !== null}", "Cancel editing care log"],
  ] as const) {
    const modal = modalSlice(source, marker);
    assertContainerOnlyShell(modal, `Log ${marker}`);
    assert.match(
      modal,
      new RegExp(`accessibilityLabel="${label}"`),
      `${marker} must not require saving, sharing, editing, or deleting to exit`,
    );
  }
});

test("Log quick-note sheet dismisses without saving and exposes named controls", () => {
  const source = readAppFile("(tabs)", "log.tsx");
  const modal = modalSlice(source, "visible={promptId !== null}");

  assertContainerOnlyShell(modal, "Log quick-note prompt");
  assert.match(modal, /onRequestClose=\{dismissQuickNote\}/);

  const backdropStart = modal.indexOf("<Pressable");
  const sheetStart = modal.indexOf("<Pressable", backdropStart + 1);
  assert.ok(backdropStart >= 0 && sheetStart > backdropStart);
  assert.match(
    modal.slice(backdropStart, sheetStart),
    /onPress=\{dismissQuickNote\}/,
    "backdrop dismissal must not silently save the optional note",
  );
  assert.doesNotMatch(modal.slice(backdropStart, sheetStart), /saveQuickNote/);
  assert.match(modal, /accessibilityRole="header"/);
  assert.match(
    modal,
    /accessibilityLabel=\{\s*promptMode === "post-log"\s*\? "Optional care log note"\s*: "Sticky note"\s*\}/,
  );
  assert.match(modal, /accessibilityLabel="Skip sticky note"/);
  assert.match(modal, /accessibilityLabel="Save sticky note"/);
});

test("web confirms portal above route modals instead of hiding behind them", () => {
  const source = readComponentFile("WebDialogHost.tsx");

  assert.match(source, /import \{[\s\S]*?Modal[\s\S]*?\} from "react-native"/);
  assert.match(
    source,
    /<Modal[\s\S]*?visible[\s\S]*?transparent[\s\S]*?presentationStyle="overFullScreen"[\s\S]*?onRequestClose=/,
  );
  assert.match(source, /<Modal[\s\S]*?<View[\s\S]*?testID="web-dialog-host"/);
});

test("More prompt locks submission and every dismiss path while a mutation is pending", () => {
  const source = readAppFile("(tabs)", "more.tsx");
  const prompt = modalSlice(source, "visible={visible}");
  const componentStart = source.indexOf("function PromptModal");
  const componentEnd = source.indexOf(
    "const s = StyleSheet.create",
    componentStart,
  );
  assert.ok(componentStart >= 0 && componentEnd > componentStart);
  const promptComponent = source.slice(componentStart, componentEnd);

  assert.match(prompt, /editable=\{!loading\}/);
  assert.match(prompt, /accessibilityState=\{\{ disabled: loading \}\}/);
  assert.match(
    prompt,
    /onSubmitEditing=\{\(\) => \{\s*if \(!loading\) onConfirm\(\);\s*\}\}/,
  );
  assert.match(
    prompt,
    /accessibilityLabel=\{\s*loading\s*\? `\$\{confirmLabel\} in progress`\s*: confirmLabel\s*\}/,
  );
  assert.match(
    prompt,
    /accessibilityState=\{\{ disabled: loading, busy: loading \}\}/,
  );
  assert.match(prompt, /disabled=\{loading\}/);

  assert.match(
    promptComponent,
    /const requestDismiss = \(\) => \{\s*if \(!loading\) onCancel\(\);\s*\};/,
  );
  assert.match(prompt, /<Modal[\s\S]*?onRequestClose=\{requestDismiss\}/);

  const backdropStart = prompt.indexOf("<Pressable");
  const sheetStart = prompt.indexOf("<Pressable", backdropStart + 1);
  assert.ok(backdropStart >= 0 && sheetStart > backdropStart);
  assert.match(
    prompt.slice(backdropStart, sheetStart),
    /onPress=\{requestDismiss\}/,
  );

  const cancelMarker = prompt.indexOf("accessibilityLabel={`Cancel ${title}`}");
  const cancelStart = prompt.lastIndexOf("<Pressable", cancelMarker);
  const cancelEnd = prompt.indexOf("</Pressable>", cancelMarker);
  assert.ok(cancelMarker >= 0 && cancelStart >= 0 && cancelEnd > cancelMarker);
  const cancel = prompt.slice(cancelStart, cancelEnd);
  assert.match(cancel, /onPress=\{requestDismiss\}/);
  assert.match(cancel, /disabled=\{loading\}/);
  assert.match(cancel, /accessibilityState=\{\{ disabled: loading \}\}/);
});

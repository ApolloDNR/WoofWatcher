import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readMobileSource(...segments: string[]) {
  return readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", ...segments),
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

test("Privacy launch editor exposes its controls inside a non-grouping modal boundary", () => {
  const source = readMobileSource("app", "privacy.tsx");
  const modal = modalSlice(source, "visible={launchEditorOpen}");

  const backdropStart = modal.indexOf("<Pressable");
  const sheetStart = modal.indexOf("<Pressable", backdropStart + 1);
  const firstChildControl = modal.indexOf("<Pressable", sheetStart + 1);
  assert.ok(backdropStart >= 0 && sheetStart > backdropStart);

  assert.match(
    modal.slice(backdropStart, sheetStart),
    /^<Pressable[\s\S]*?accessible=\{false\}/,
  );
  assert.match(
    modal.slice(sheetStart, firstChildControl),
    /^<Pressable[\s\S]*?accessible=\{false\}[\s\S]*?accessibilityViewIsModal/,
  );
  assert.match(
    modal,
    /accessibilityLabel="Close launch support profile editor"/,
  );
});

test("developer error details isolate modal traversal and expose named recovery controls", () => {
  const source = readMobileSource("components", "ErrorFallback.tsx");
  const modal = modalSlice(source, "visible={isModalVisible}");

  assert.match(
    modal,
    /<View\s+accessible=\{false\}\s+style=\{styles\.modalOverlay\}>/,
  );
  assert.match(
    modal,
    /<View\s+accessible=\{false\}\s+accessibilityViewIsModal\s+style=\{\[/,
  );
  assert.match(
    modal,
    /accessibilityLabel="Close error details"[\s\S]*?accessibilityRole="button"/,
  );
  assert.match(
    source,
    /onPress=\{handleRestart\}[\s\S]*?accessibilityRole="button"[\s\S]*?accessibilityLabel="Try again after app error"/,
  );
});

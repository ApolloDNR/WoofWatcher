import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

test("Privacy profile fields expose their visible labels programmatically", () => {
  const source = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "components",
      "more",
      "PrivacyDataScreen.tsx",
    ),
    "utf8",
  );

  const profileInput = source.slice(source.indexOf("function ProfileInput"));
  assert.match(profileInput, /<TextInput[\s\S]{0,180}accessibilityLabel=\{label\}/);
});

test("Privacy confirmation binds its bounded layout to scrollable copy and fixed actions", () => {
  const source = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "components",
      "more",
      "PrivacyDataScreen.tsx",
    ),
    "utf8",
  );

  const sheetAt = source.indexOf('closeAccessibilityLabel="Cancel local data reset"');
  const sheetEnd = source.indexOf("</ModalSheetPressable>", sheetAt);
  const sheet = source.slice(sheetAt, sheetEnd);
  assert.match(sheet, /maxHeight:\s*privacyConfirmationLayout\.maxHeight/);
  const scrollAt = sheet.indexOf("<ScrollView");
  const scrollEnd = sheet.indexOf("</ScrollView>", scrollAt);
  const actionsAt = sheet.indexOf("s.confirmActions", scrollEnd);
  assert.ok(scrollAt > 0 && scrollEnd > scrollAt && actionsAt > scrollEnd);
  assert.match(
    sheet,
    /privacyConfirmationLayout\.stackActions\s*&&\s*s\.confirmActionsStacked/,
  );
  assert.equal(
    (sheet.match(/privacyConfirmationLayout\.stackActions\s*&&\s*s\.confirmActionStacked/g) ?? []).length,
    2,
  );
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  getPrivacyDataTruthCopy,
  PRIVACY_CURRENT_CARE_JSON_LIMITATION,
  PRIVACY_PROVIDER_COPY_NOTICE,
} from "./privacyDataTruth.ts";

const privacyScreen = readFileSync(
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

test("Privacy screen uses the shared truth model and removes absolute backup/local-only claims", () => {
  assert.match(privacyScreen, /getPrivacyDataTruthCopy/);
  assert.doesNotMatch(privacyScreen, /Export first if you want a backup/i);
  assert.doesNotMatch(privacyScreen, /Every care log lives only on this device/i);
  assert.doesNotMatch(privacyScreen, /there is no\s+server copy/i);
  assert.match(privacyScreen, /privacyTruthCopy\.exportLimitation/);
  assert.match(privacyScreen, /privacyTruthCopy\.eraseSteps/);
});

test("Privacy describes the device-wide destructive scope and current-care JSON limits", () => {
  const copy = getPrivacyDataTruthCopy(false);
  const destructiveCopy = `${copy.eraseSteps.confirm.message} ${copy.eraseSteps["confirm-final"].message}`;

  assert.match(copy.exportLimitation, /current care JSON/i);
  assert.match(PRIVACY_CURRENT_CARE_JSON_LIMITATION, /only the care data open/i);
  assert.match(PRIVACY_CURRENT_CARE_JSON_LIMITATION, /does not include[\s\S]{0,180}photo/i);
  assert.match(PRIVACY_CURRENT_CARE_JSON_LIMITATION, /document attachment/i);
  assert.match(PRIVACY_CURRENT_CARE_JSON_LIMITATION, /saved report file bytes/i);
  assert.match(PRIVACY_CURRENT_CARE_JSON_LIMITATION, /saved sign-in credentials/i);
  assert.match(PRIVACY_CURRENT_CARE_JSON_LIMITATION, /other accounts or households/i);
  assert.match(destructiveCopy, /every cached account, household, and dog/i);
  assert.match(destructiveCopy, /app-owned files/i);
  assert.match(destructiveCopy, /saved sign-in credentials/i);
  assert.match(destructiveCopy, /opaque non-content reset and sync-cleanup IDs may remain/i);
});

test("Privacy never claims that a device reset deletes a possible provider account copy", () => {
  const copies = [getPrivacyDataTruthCopy(false), getPrivacyDataTruthCopy(true)];
  const renderedCopy = copies
    .flatMap((copy) => [
      copy.hero,
      copy.rules,
      copy.eraseSteps.confirm.message,
      copy.eraseSteps["confirm-final"].message,
    ])
    .join(" ");

  assert.match(PRIVACY_PROVIDER_COPY_NOTICE, /provider account copy may (?:also )?exist/i);
  assert.match(
    PRIVACY_PROVIDER_COPY_NOTICE,
    /device deletion[\s\S]{0,120}does not delete or prove deletion/i,
  );
  assert.doesNotMatch(renderedCopy, /lives? only on this device/i);
  assert.doesNotMatch(renderedCopy, /no (?:cloud|server) (?:backup|copy)/i);
});

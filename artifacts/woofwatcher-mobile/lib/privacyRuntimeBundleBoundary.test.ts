import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");

test("the global reset shield stays outside owner privacy and launch preparation", () => {
  const shield = readFileSync(
    join(MOBILE_ROOT, "components", "LocalDataResetAppShield.tsx"),
    "utf8",
  );
  const resetRuntime = readFileSync(
    join(MOBILE_ROOT, "lib", "privacyLocalDataActions.ts"),
    "utf8",
  );
  const ownerExport = readFileSync(
    join(MOBILE_ROOT, "lib", "privacyCareDataExport.ts"),
    "utf8",
  );

  assert.match(shield, /from "@\/lib\/privacyLocalDataActions"/);
  assert.doesNotMatch(shield, /privacyCareDataExport|privacySafety/);
  assert.doesNotMatch(
    resetRuntime,
    /privacySafety|launchProviderSetup|supportRunbook|preparePrivacyCareExportWithDeviceInventory/,
  );
  assert.match(ownerExport, /from "\.\/privacySafety\.ts"/);
  assert.match(ownerExport, /preparePrivacyCareExportWithDeviceInventory/);
});

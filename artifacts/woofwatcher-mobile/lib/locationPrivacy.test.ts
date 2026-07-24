import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  PRIVACY_POLICY_MARKDOWN,
  TERMS_OF_SERVICE_MARKDOWN,
} from "./legalContent.ts";

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

test("declares the walk recorder's precise foreground location contract in Expo config", () => {
  const appConfig = JSON.parse(
    read("artifacts/woofwatcher-mobile/app.json"),
  ).expo;
  const locationPlugin = appConfig.plugins.find(
    (plugin: unknown) =>
      Array.isArray(plugin) && plugin[0] === "expo-location",
  );

  assert.ok(locationPlugin, "expo-location should be configured");
  const locationOptions = locationPlugin[1];
  assert.equal(locationOptions.isAndroidBackgroundLocationEnabled, false);
  assert.equal(locationOptions.isIosBackgroundLocationEnabled, false);
  assert.match(
    locationOptions.locationWhenInUsePermission,
    /precise foreground location/i,
  );
  assert.match(
    locationOptions.locationWhenInUsePermission,
    /only when you start recording a walk route/i,
  );
  assert.match(
    locationOptions.locationWhenInUsePermission,
    /draw the map and calculate.*distance/i,
  );
  assert.match(
    locationOptions.locationWhenInUsePermission,
    /may sync with your household/i,
  );
  assert.match(
    locationOptions.locationWhenInUsePermission,
    /background location is not enabled/i,
  );

  const preciseLocation =
    appConfig.ios.privacyManifests.NSPrivacyCollectedDataTypes.find(
      (dataType: { NSPrivacyCollectedDataType?: string }) =>
        dataType.NSPrivacyCollectedDataType ===
        "NSPrivacyCollectedDataTypePreciseLocation",
    );
  assert.ok(
    preciseLocation,
    "the privacy manifest must not claim an empty collection set while provider-synced routes are possible",
  );
  assert.equal(preciseLocation.NSPrivacyCollectedDataTypeLinked, true);
  assert.equal(preciseLocation.NSPrivacyCollectedDataTypeTracking, false);
  assert.deepEqual(preciseLocation.NSPrivacyCollectedDataTypePurposes, [
    "NSPrivacyCollectedDataTypePurposeAppFunctionality",
  ]);
});

test("explains route capture, household sync, and map-service requests in app surfaces and source", () => {
  const privacy = read("artifacts/woofwatcher-mobile/app/privacy.tsx");
  const log = read("artifacts/woofwatcher-mobile/app/(tabs)/log.tsx");
  const walkRoute = read("artifacts/woofwatcher-mobile/lib/walkRoute.ts");
  const recorder = read(
    "artifacts/woofwatcher-mobile/components/WalkRouteRecorder.tsx",
  );

  assert.match(privacy, /Walk location & route maps/);
  assert.match(privacy, /precise foreground location/i);
  assert.match(privacy, /only when you start recording a walk route/i);
  assert.match(privacy, /Background location is not enabled/i);
  assert.match(privacy, /saved with the walk in this device's care log/i);
  assert.match(privacy, /provider-synced household/i);
  assert.match(privacy, /visible to members of that household/i);
  assert.match(privacy, /OpenStreetMap.*tiles or neighborhood geometry/is);
  assert.match(log, /may sync with your household/i);
  assert.doesNotMatch(log, /stays in your care log/);

  assert.match(
    walkRoute,
    /provider-synced household entries[\s\S]*can carry it/i,
  );
  assert.match(
    walkRoute,
    /OpenStreetMap data for[\s\S]*the recorded area/i,
  );
  assert.match(recorder, /local\/provider household sync and visibility/i);
});

test("keeps legal and store material explicitly blocked while withdrawing false location answers", () => {
  const listing = read("docs/release/STORE_LISTING.md");
  const policy = read("docs/legal/PRIVACY_POLICY.md");
  const terms = read("docs/legal/TERMS_OF_SERVICE.md");
  const blockers = read("docs/BLOCKERS_FOR_APOLLO.md");
  const inAppLegal = `${PRIVACY_POLICY_MARKDOWN}\n${TERMS_OF_SERVICE_MARKDOWN}`;

  assert.match(listing, /Submission status — blocked for the shared-account build/i);
  assert.match(listing, /shared TestFlight beta first/i);
  assert.match(listing, /owner and legal approval required/i);
  assert.doesNotMatch(listing, /Location sharing: none/i);
  assert.doesNotMatch(
    listing,
    /Answer:\s*\*\*Data Not Collected\*\*\s*\(all categories\)/i,
  );
  assert.doesNotMatch(
    listing,
    /Data collected: none\. Data shared: none\./i,
  );
  assert.match(listing, /Precise Location/i);
  assert.match(listing, /provider-synced household/i);
  assert.match(listing, /OpenStreetMap/i);

  assert.equal(PRIVACY_POLICY_MARKDOWN.trim(), policy.trim());
  assert.equal(TERMS_OF_SERVICE_MARKDOWN.trim(), terms.trim());
  for (const draft of [policy, terms, inAppLegal]) {
    assert.match(draft, /Draft status/i);
    assert.match(draft, /do not publish/i);
  }

  assert.match(policy, /Walk route location and map services/);
  assert.match(policy, /precise foreground location/i);
  assert.match(policy, /provider-synced household/i);
  assert.match(policy, /OpenStreetMap/i);
  assert.match(policy, /background location/i);
  assert.doesNotMatch(policy, /## 2\. What we collect: nothing/i);
  for (const termsCopy of [terms, TERMS_OF_SERVICE_MARKDOWN]) {
    assert.match(termsCopy, /recorded walk routes/i);
    assert.match(termsCopy, /provider-synced household/i);
    assert.doesNotMatch(termsCopy, /all of your data is stored locally/i);
    assert.doesNotMatch(termsCopy, /All WoofWatcher data lives on your device/i);
  }

  assert.doesNotMatch(
    blockers,
    /saved walk routes should move.*GPS route recording/i,
  );
  assert.match(blockers, /Recorded walk-route location/i);
  assert.match(blockers, /retention\/export\/deletion terms/i);
});

test("carries the location boundary into store and support review packets", () => {
  const storePacket = read(
    "artifacts/woofwatcher-mobile/lib/storeSubmissionPacket.ts",
  );
  const supportRunbook = read(
    "artifacts/woofwatcher-mobile/lib/supportRunbook.ts",
  );

  assert.match(storePacket, /precise foreground location/i);
  assert.match(storePacket, /background location is not enabled/i);
  assert.match(storePacket, /provider-synced household/i);
  assert.match(storePacket, /OpenStreetMap/i);
  assert.match(supportRunbook, /location and map-service disclosures/i);
});

test("globally mounted route capture consumes a local arming token and authenticated owner", () => {
  const recorder = read(
    "artifacts/woofwatcher-mobile/components/WalkRouteRecorder.tsx",
  );
  const quickLog = read(
    "artifacts/woofwatcher-mobile/components/logging/useQuickLogController.ts",
  );
  const adventure = read("artifacts/woofwatcher-mobile/app/adventure.tsx");

  assert.match(recorder, /useWoofAuth/);
  assert.match(recorder, /findLocallyArmedWalkSession/);
  assert.match(recorder, /findWalkSessionForArming/);
  assert.match(recorder, /sessionKey:\s*pending\.sessionKey/);
  assert.match(recorder, /getWalkRouteCaptureArming/);
  assert.match(recorder, /caregiverUserId/);
  assert.doesNotMatch(recorder, /findOpenWalkSession/);
  assert.match(quickLog, /armWalkRouteCapture/);
  assert.match(adventure, /armWalkRouteCapture/);
});

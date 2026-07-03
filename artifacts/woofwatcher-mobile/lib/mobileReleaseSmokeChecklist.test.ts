import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveLaunchProviderSetup } from "./launchProviderSetup.ts";
import { deriveLaunchReadiness, type LaunchReadinessInput } from "./launchReadiness.ts";
import { buildMobileLaunchQaCapturePlan } from "./mobileLaunchQaEvidence.ts";
import {
  buildMobileReleaseSmokeChecklist,
  buildMobileReleaseSmokeChecklistShareText,
} from "./mobileReleaseSmokeChecklist.ts";
import type { MobileReleaseQaSurface } from "./mobileReleaseQa.ts";
import { buildReleasePacket } from "./releasePacket.ts";

const qaFirstInput: LaunchReadinessInput = {
  nativeQa: null,
  local: {
    careWorkflowsReady: true,
    easProfilesReady: true,
    pixelAssetsReady: true,
    privacyExportReady: true,
  },
  provider: {
    authConfigured: false,
    databaseConfigured: false,
    storageProviderConfigured: false,
    aiProviderConfigured: false,
    paymentsEnabled: false,
    accountDeletionEnabled: false,
    pushNotificationsConfigured: false,
    appStoreAccountsReady: false,
    privacyLegalApproved: false,
    supportRunbookApproved: false,
  },
  syncStatus: "ready",
};

const ownerLoopSurface: MobileReleaseQaSurface = {
  id: "owner-preview-core-loop",
  title: "Owner Preview Core Loop",
  route: "/care-twin-qa",
  priority: "launch-critical",
  goal: "Verify the real owner journey before beta sharing.",
  devicePrompt: "Run the owner route loop and attach proof.",
  setupSteps: ["Use Phoenix demo care data.", "Confirm the app opens on Home."],
  verificationSteps: ["Open Home.", "Open Log.", "Open More Launch Readiness."],
  acceptanceCriteria: ["No route dead-ends.", "Primary controls are phone-sized."],
  failureEscalation: "Mark Needs tune if any route clips, dead-ends, or feels below App Store quality.",
  requiredEvidence: [
    "iOS screenshot of Quick Log or Log.",
    "Android screenshot of More Launch Readiness.",
    "Note confirming Home, Log, Plans, Health, More, Adventure, Records, Avatar Studio, and Care Pass had no dead ends.",
  ],
  launchRisk: "This is the beta's real owner path.",
  routeChecklist: [
    {
      label: "Home",
      route: "/",
      expected: "Confirm Phoenix status, next care, and bottom navigation are clear.",
      proof: "Visual pass.",
    },
    {
      label: "Log",
      route: "/log",
      expected: "Quick-log one safe care event or open the detail sheet.",
      proof: "iOS screenshot.",
    },
    {
      label: "Records",
      route: "/records",
      expected: "Confirm Report History and Dog ID export copy stays local-file truthful.",
      proof: "Records export note.",
    },
  ],
};

test("builds a source-backed release smoke checklist without clearing blocked launch gates", () => {
  const releasePacket = buildReleasePacket(deriveLaunchReadiness(qaFirstInput), {
    appName: "WoofWatcher",
    buildName: "two-day owner beta",
    generatedAtIso: "2026-07-03T18:00:00.000Z",
  });
  const capturePlan = buildMobileLaunchQaCapturePlan(null, [ownerLoopSurface]);
  const providerSetupPlan = deriveLaunchProviderSetup({
    authConfigured: false,
    databaseConfigured: false,
    storageProviderConfigured: false,
    aiProviderConfigured: false,
    paymentsEnabled: false,
    accountDeletionEnabled: false,
    pushNotificationsConfigured: false,
    appStoreAccountsReady: false,
    providerStatus: "local-draft",
  });

  const checklist = buildMobileReleaseSmokeChecklist(releasePacket, capturePlan, {
    generatedAtIso: "2026-07-03T18:05:00.000Z",
    providerSetupPlan,
  });
  const text = buildMobileReleaseSmokeChecklistShareText(checklist);

  assert.equal(checklist.title, "WoofWatcher Release Smoke Checklist");
  assert.equal(checklist.generatedAtIso, "2026-07-03T18:05:00.000Z");
  assert.equal(checklist.releaseVerdict, "Not ready for public launch");
  assert.equal(checklist.betaVerdict, "Beta candidate - capture device proof");
  assert.deepEqual(
    checklist.sections.map((section) => section.title),
    [
      "Dependency and export proof",
      "Route rehearsal",
      "Records and export truth",
      "Provider proof gates",
      "Native and store proof",
    ],
  );
  assert.deepEqual(checklist.dependencyCommands, [
    "corepack prepare pnpm@10.24.0 --activate",
    "pnpm install",
    "pnpm run doctor:mobile-beta",
    "pnpm run doctor:mobile-beta:json",
    "pnpm --filter @workspace/woofwatcher-mobile run smoke:web",
    "pnpm --filter @workspace/woofwatcher-mobile run preview:smoke",
  ]);

  assert.match(text, /WoofWatcher Release Smoke Checklist/);
  assert.match(text, /Build: two-day owner beta/);
  assert.match(text, /Dependency and export proof:/);
  assert.match(text, /pnpm --filter @workspace\/woofwatcher-mobile run preview:smoke/);
  assert.match(text, /Route rehearsal:/);
  assert.match(text, /Owner Preview Core Loop \(\/care-twin-qa\)/);
  assert.match(text, /Open with QA return: \/care-twin-qa\?qaReturn=care-twin-qa/);
  assert.match(text, /Home \(\/\): Confirm Phoenix status/);
  assert.match(text, /Records \(\/records\): Confirm Report History and Dog ID export copy stays local-file truthful/);
  assert.match(text, /Records and export truth:/);
  assert.match(text, /WoofWatcherReports/);
  assert.match(text, /Printable HTML local file/);
  assert.match(text, /PDF pending/);
  assert.match(text, /WoofWatcherCredentials/);
  assert.match(text, /image\/PDF export stays pending/);
  assert.match(text, /Provider proof gates:/);
  assert.match(text, /Household database sync/);
  assert.match(text, /Care-entry provider sync proof packet/);
  assert.match(text, /care_entries\.updated_at/);
  assert.match(text, /care_entry_tombstones/);
  assert.match(text, /Native and store proof:/);
  assert.match(text, /iOS Quick Log\/Log proof/);
  assert.match(text, /Android Launch Readiness proof/);
  assert.match(text, /Store Screenshot QA/);
  assert.match(text, /Truth boundaries:/);
  assert.match(text, /does not approve App Store or Play Store submission/);
  assert.match(text, /does not prove provider-backed storage, sync, AI, payments, or push/);
  assert.match(text, /Generated PDF and credential image\/PDF export stay pending/);
  assert.doesNotMatch(text, /STORE READY/i);
});

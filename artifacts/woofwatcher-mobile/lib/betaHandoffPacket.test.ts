import { test } from "node:test";
import assert from "node:assert/strict";

import { buildBetaHandoffPacketShareText } from "./betaHandoffPacket.ts";
import { deriveLaunchProviderSetup } from "./launchProviderSetup.ts";
import { deriveLaunchReadiness, type LaunchReadinessInput } from "./launchReadiness.ts";
import { buildMobileLaunchQaCapturePlan } from "./mobileLaunchQaEvidence.ts";
import {
  buildMobileQaSessionProofManifest,
  buildMobileQaSessionSnapshot,
  type MobileQaSessionState,
} from "./mobileQaSession.ts";
import { buildReleasePacket } from "./releasePacket.ts";
import type { MobileReleaseQaSurface } from "./mobileReleaseQa.ts";

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
      label: "More",
      route: "/more",
      expected: "Open Launch Readiness and confirm proof status.",
      proof: "Android screenshot.",
    },
    {
      label: "Adventure",
      route: "/adventure",
      expected: "Confirm private care quests and memory proof are reachable.",
      proof: "Mission note.",
    },
  ],
};

test("builds a 48-hour beta handoff packet from release truth and native QA proof gaps", () => {
  const releasePacket = buildReleasePacket(deriveLaunchReadiness(qaFirstInput), {
    appName: "WoofWatcher",
    buildName: "two-day owner beta",
    generatedAtIso: "2026-06-25T12:00:00.000Z",
  });
  const qaPlan = buildMobileLaunchQaCapturePlan(null, [ownerLoopSurface]);
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

  const text = buildBetaHandoffPacketShareText(releasePacket, qaPlan, {
    generatedAtIso: "2026-06-25T12:05:00.000Z",
    providerSetupPlan,
  });

  assert.match(text, /WoofWatcher 48-Hour Beta Handoff/);
  assert.match(text, /Generated: 2026-06-25T12:05:00.000Z/);
  assert.match(text, /Beta verdict: Beta candidate - capture device proof/);
  assert.match(text, /Public launch verdict: Not ready for public launch/);
  assert.match(text, /Owner preview proof: Not reviewed/);
  assert.match(text, /Owner preview missing: Attach 1 iOS screenshot for Owner Preview Core Loop\./);
  assert.match(text, /Next device mission: Owner Preview Core Loop \(\/care-twin-qa\)/);
  assert.match(text, /Status: Not reviewed/);
  assert.match(text, /Missing proof: Attach 1 iOS screenshot for Owner Preview Core Loop\. Attach 1 Android screenshot/);
  assert.match(text, /Run order:/);
  assert.match(text, /1\. Home \(\/\): Confirm Phoenix status/);
  assert.match(text, /2\. Log \(\/log\): Quick-log one safe care event/);
  assert.match(text, /Dependency proof commands:/);
  assert.match(text, /corepack prepare pnpm@10\.24\.0 --activate/);
  assert.match(text, /pnpm run doctor:mobile-beta/);
  assert.match(text, /pnpm run doctor:mobile-beta:json/);
  assert.match(text, /pnpm --filter @workspace\/woofwatcher-mobile run smoke:web/);
  assert.match(text, /Dependency proof only counts when both doctor commands report no blockers/);
  assert.match(text, /Dependency proof requires a real PATH pnpm at 10\.24\.0; do not use a bundled pnpm 11\.x candidate/);
  assert.match(text, /Required beta proof after export:/);
  assert.match(text, /Open \/care-twin-qa on iOS and Android before sharing beta proof/);
  assert.match(text, /Attach iOS Quick Log\/Log proof and Android Launch Readiness proof/);
  assert.match(text, /Confirm Care Pass Report History storage status says Saved on this device or Ready to upload/);
  assert.match(text, /Confirm Care Pass export manifest shows Printable HTML local file, file size, and PDF pending before claiming PDF readiness/);
  assert.match(text, /Confirm Records Dog ID printable source shares as a local HTML credential file; image\/PDF export stays pending/);
  assert.match(text, /Save the Mission note and clear Pass pending proof in both \/care-twin-qa and More/);
  assert.match(text, /Native QA Needs tune fix brief:/);
  assert.match(text, /If any route is marked Needs tune, use More's Share Fix Brief before claiming beta proof/);
  assert.match(text, /Provider proof needed:/);
  assert.match(text, /Production auth: Clerk production app id/);
  assert.match(text, /Household database sync: Supabase project id/);
  assert.match(text, /care_entries\.updated_at/);
  assert.match(text, /care_entry_tombstones/);
  assert.match(text, /\/care-entries\?updatedSince=/);
  assert.match(text, /mobile full-refresh sign-off/);
  assert.match(text, /Records and media storage: Storage bucket names/);
  assert.match(text, /Provider proof does not approve App Store, Play Store, payment, AI, storage, or database readiness/);
  assert.match(text, /Done condition: capture required iOS\/Android proof, save the Mission note, clear Pass pending proof, then share the QA summary/);
  assert.match(text, /Truth boundaries:/);
  assert.match(text, /No App Store or Play Store submission is approved by this packet/);
  assert.match(text, /Provider-backed auth, database, storage, AI, push, and payments must stay gated/);
  assert.doesNotMatch(text, /STORE READY/i);
});

test("keeps the beta handoff focused when the current mission is pass pending proof", () => {
  const releasePacket = buildReleasePacket(deriveLaunchReadiness(qaFirstInput), {
    appName: "WoofWatcher",
    buildName: "two-day owner beta",
    generatedAtIso: "2026-06-25T12:00:00.000Z",
  });
  const sessionWithoutMissionNote: MobileQaSessionState = {
    careTwinStatusById: {},
    careTwinNotes: {},
    careTwinEvidenceById: {},
    surfaceStatusById: {
      "owner-preview-core-loop": "pass",
    },
    surfaceNotes: {},
    surfaceEvidenceById: {
      "owner-preview-core-loop": [
        {
          uri: "file:///qa/ios-log.png",
          fileName: "ios-log.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-25T12:01:00.000Z",
        },
        {
          uri: "file:///qa/android-launch.png",
          fileName: "android-launch.png",
          source: "library",
          targetPlatform: "android",
          capturedAtIso: "2026-06-25T12:02:00.000Z",
        },
      ],
    },
  };
  const qaPlan = buildMobileLaunchQaCapturePlan(sessionWithoutMissionNote, [ownerLoopSurface]);

  const text = buildBetaHandoffPacketShareText(releasePacket, qaPlan, "2026-06-25T12:05:00.000Z");

  assert.match(text, /Status: Pass pending proof/);
  assert.match(text, /Owner preview proof: Pass pending proof/);
  assert.match(text, /Owner preview missing: Add QA note for Owner Preview Core Loop\./);
  assert.match(text, /Missing proof: Add QA note for Owner Preview Core Loop\./);
  assert.match(text, /Tester instruction: finish the missing proof before treating this beta mission as complete\./);
});

test("includes saved QA proof manifest when More shares the beta handoff", () => {
  const releasePacket = buildReleasePacket(deriveLaunchReadiness(qaFirstInput), {
    appName: "WoofWatcher",
    buildName: "two-day owner beta",
    generatedAtIso: "2026-06-25T12:00:00.000Z",
  });
  const session: MobileQaSessionState = {
    careTwinStatusById: {
      happy: "pass",
    },
    careTwinNotes: {
      happy: "Happy loop reads clearly on iPhone.",
    },
    careTwinEvidenceById: {
      happy: [
        {
          uri: "file:///qa/happy-ios.png",
          fileName: "happy-ios.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-25T12:01:00.000Z",
        },
      ],
    },
    surfaceStatusById: {
      "owner-preview-core-loop": "pass",
    },
    surfaceNotes: {
      "owner-preview-core-loop": "Home, Log, Plans, Health, More, Adventure, Records, Avatar Studio, and Care Pass opened.",
    },
    surfaceEvidenceById: {
      "owner-preview-core-loop": [
        {
          uri: "file:///qa/android-launch.png",
          fileName: "android-launch.png",
          source: "library",
          targetPlatform: "android",
          capturedAtIso: "2026-06-25T12:02:00.000Z",
        },
      ],
    },
  };
  const snapshot = buildMobileQaSessionSnapshot(session, "2026-06-25T12:03:00.000Z");
  const proofManifest = buildMobileQaSessionProofManifest(snapshot, "2026-06-25T12:05:00.000Z");
  const qaPlan = buildMobileLaunchQaCapturePlan(session, [ownerLoopSurface]);

  const text = buildBetaHandoffPacketShareText(releasePacket, qaPlan, {
    generatedAtIso: "2026-06-25T12:05:00.000Z",
    proofManifest,
  });

  assert.match(text, /WoofWatcher QA Proof Manifest/);
  assert.match(text, new RegExp(`Proof ID: ${proofManifest.proofId}`));
  assert.match(text, /Care twin: 1 pass, 0 needs tune, 1 evidence file, 1 notes\./);
  assert.match(text, /Release: 1 pass, 0 needs tune, 1 evidence file, 1 notes\./);
  assert.match(text, /Platform evidence: iOS 1, Android 1, Web 0, Unknown 0\./);
  assert.match(text, /does not prove App Store or Play Store approval/);
});

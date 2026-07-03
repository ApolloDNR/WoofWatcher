import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildBetaHandoffPacketShareText,
  RECORDED_LIVE_PREVIEW_HANDOFF_PROOF,
  RECORDED_MOBILE_BETA_CI_PROOF,
} from "./betaHandoffPacket.ts";
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
    ciProof: RECORDED_MOBILE_BETA_CI_PROOF,
    livePreviewProof: RECORDED_LIVE_PREVIEW_HANDOFF_PROOF,
    providerSetupPlan,
  });

  assert.match(text, /WoofWatcher 48-Hour Beta Handoff/);
  assert.match(text, /Generated: 2026-06-25T12:05:00.000Z/);
  assert.match(text, /Beta verdict: Beta candidate - capture device proof/);
  assert.match(text, /Public launch verdict: Not ready for public launch/);
  assert.match(text, /Owner preview proof: Not reviewed/);
  assert.match(text, /Owner preview missing: Attach 1 iOS screenshot for Owner Preview Core Loop\./);
  assert.match(text, /Release smoke checklist:/);
  assert.match(text, /WoofWatcher Release Smoke Checklist/);
  assert.match(text, /Dependency and export proof:/);
  assert.match(text, /Live preview handoff proof:/);
  assert.match(text, /Dependency-complete branch CI/);
  assert.match(text, /Preview server handoff/);
  assert.match(text, /live preview proof does not replace native iOS\/Android proof/);
  assert.match(text, /Route rehearsal:/);
  assert.match(text, /Records and export truth:/);
  assert.match(text, /Provider proof gates:/);
  assert.match(text, /Native and store proof:/);
  assert.match(text, /Open with QA return: \/care-twin-qa\?qaReturn=care-twin-qa/);
  assert.match(text, /WoofWatcherReports/);
  assert.match(text, /WoofWatcherCredentials/);
  assert.match(text, /Generated PDF and credential PNG\/PDF export stay pending/);
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
  assert.match(text, /pnpm --filter @workspace\/woofwatcher-mobile run smoke:runtime/);
  assert.match(text, /pnpm --filter @workspace\/woofwatcher-mobile run preview:smoke/);
  assert.match(text, /Dependency-complete CI proof:/);
  assert.match(text, /Recorded branch CI proof: WoofWatcher Verify run 28664666368 passed/);
  assert.match(text, /job 85013346789/);
  assert.match(text, /automation\/premium-revenue-product-builder/);
  assert.match(text, /commit d3d767d/);
  assert.match(text, /Run mobile beta doctor/);
  assert.match(text, /auth\/setup smoke proof/);
  assert.match(text, /auth\/setup native QA target/);
  assert.match(text, /build:ci with mobile smoke:web, smoke:runtime, and proof:live-preview/);
  assert.match(text, /Rerun WoofWatcher Verify after any new commit before treating dependency proof as current/);
  assert.match(text, /CI proof does not approve native screenshots, provider setup, store approval, or Apollo sign-off/);
  assert.match(text, /Recorded live preview proof:/);
  assert.match(text, /WoofWatcher Live Preview Handoff Proof/);
  assert.match(text, /Result: PASS/);
  assert.match(text, /Routes: 10\/10 web-preview shell checks passed/);
  assert.match(text, /Recorded verifier URL: http:\/\/127\.0\.0\.1:\d+\//);
  assert.match(text, /Preview handoff URL: http:\/\/127\.0\.0\.1:4194\/ after preview:smoke is running/);
  assert.match(text, /Attach proof: JSON route proof plus preview:smoke URL\/output/);
  assert.match(text, /Live preview proof does not replace native iOS\/Android proof/);
  assert.match(text, /Dependency proof only counts when both doctor commands report no blockers/);
  assert.match(text, /Dependency proof requires a real PATH pnpm at 10\.24\.0; do not use a bundled pnpm 11\.x candidate/);
  assert.match(text, /Required beta proof after export:/);
  assert.match(text, /Open \/care-twin-qa on iOS and Android before sharing beta proof/);
  assert.match(text, /Attach iOS Quick Log\/Log proof and Android Launch Readiness proof/);
  assert.match(text, /Confirm Care Pass Report History storage status says Saved on this device or Ready to upload/);
  assert.match(text, /Confirm Care Pass export manifest shows Printable HTML local file, file size, and PDF pending before claiming PDF readiness/);
  assert.match(text, /Confirm Records Dog ID shares a local HTML credential file and SVG image source; PNG\/PDF export stays pending/);
  assert.match(text, /Open focused auth\/setup target: \/care-twin-qa\?qaSurface=auth-setup-onboarding-proof/);
  assert.match(text, /Capture Auth gateway and Setup local-preview proof while provider-backed auth and household creation stay blocked/);
  assert.match(text, /Open focused Records handoff target: \/care-twin-qa\?qaSurface=records-local-file-handoff/);
  assert.match(text, /Capture Care Pass Report History local HTML, Dog ID local HTML, Dog ID SVG, share sheet behavior, Android content URI, and fallback copy/);
  assert.match(text, /Open focused binary export proof target: \/care-twin-qa\?qaSurface=report-binary-export-proof/);
  assert.match(text, /Approve Care Pass PDF generator, Dog ID PNG renderer, provider storage policy, and iOS\/Android artifact proof before claiming PDF\/PNG readiness/);
  assert.match(text, /Open focused care-entry provider sync target: \/care-twin-qa\?qaSurface=care-entry-provider-sync-proof/);
  assert.match(text, /Attach Supabase project id, migration\/backfill for care_entries\.updated_at and care_entry_tombstones/);
  assert.match(text, /active-household RLS cursor\/tombstone proof/);
  assert.match(text, /mobile full-refresh sign-off before enabling incremental sync/);
  assert.match(text, /Open focused route visual target: \/care-twin-qa\?qaSurface=route-visual-consistency/);
  assert.match(text, /Capture Home, Log, Plans, Health, Records, and More on iOS and Android before claiming route visual proof/);
  assert.match(text, /Save the Mission note and clear Pass pending proof in both \/care-twin-qa and More/);
  assert.match(text, /Native QA Needs tune fix brief:/);
  assert.match(text, /If any route is marked Needs tune, use More's Share Fix Brief before claiming beta proof/);
  assert.match(text, /Provider proof needed:/);
  assert.match(text, /Production auth: Clerk production app id/);
  assert.match(text, /Household database sync: Supabase project id/);
  assert.match(text, /Care-entry provider sync proof packet/);
  assert.match(text, /Migration\/backfill/);
  assert.match(text, /Active-household RLS/);
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

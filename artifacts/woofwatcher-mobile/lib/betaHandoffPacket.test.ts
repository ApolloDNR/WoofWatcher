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
  setupSteps: ["Use Phoenix demo care data.", "Confirm the app opens on Today (Phoenix's room)."],
  verificationSteps: ["Open Today.", "Open Log.", "Open More Launch Readiness."],
  acceptanceCriteria: ["No route dead-ends.", "Primary controls are phone-sized."],
  failureEscalation: "Mark Needs tune if any route clips, dead-ends, or feels below App Store quality.",
  requiredEvidence: [
    "iOS screenshot of Quick Log or Log.",
    "Android screenshot of More Launch Readiness.",
    "Note confirming Log, Plan, Today, Pack, Story, Health, More, Adventure, Records, Avatar Studio, and Care Pass had no dead ends.",
  ],
  launchRisk: "This is the beta's real owner path.",
  routeChecklist: [
    {
      label: "Today",
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
  assert.match(text, /Generated Care Pass PDF and Dog ID PNG bytes stay local-only until native share\/reopen and provider storage proof are approved/);
  assert.match(text, /Next device mission: Owner Preview Core Loop \(\/care-twin-qa\)/);
  assert.match(text, /Status: Not reviewed/);
  assert.match(text, /Missing proof: Attach 1 iOS screenshot for Owner Preview Core Loop\. Attach 1 Android screenshot/);
  assert.match(text, /Run order:/);
  assert.match(text, /1\. Today \(\/\): Confirm Phoenix status/);
  assert.match(text, /2\. Log \(\/log\): Quick-log one safe care event/);
  assert.match(text, /Dependency proof commands:/);
  assert.match(text, /corepack prepare pnpm@10\.24\.0 --activate/);
  assert.match(text, /pnpm run doctor:mobile-beta/);
  assert.match(text, /pnpm run doctor:mobile-beta:json/);
  assert.match(text, /pnpm --filter @workspace\/woofwatcher-mobile run smoke:web/);
  assert.match(text, /pnpm --filter @workspace\/woofwatcher-mobile run smoke:runtime/);
  assert.match(text, /pnpm --filter @workspace\/woofwatcher-mobile run preview:smoke/);
  assert.match(text, /Dependency-complete CI proof:/);
  assert.match(text, /Recorded branch CI proof: WoofWatcher Verify run 28692423522 passed/);
  assert.match(text, /job 85096033279/);
  assert.match(text, /automation\/premium-revenue-product-builder/);
  assert.match(text, /commit fd3a98f/);
  assert.match(text, /Run mobile beta doctor/);
  assert.match(text, /auth\/setup smoke proof/);
  assert.match(text, /auth\/setup native QA target/);
  assert.match(text, /auth provider proof packet/);
  assert.match(text, /provider staged-row truth boundary/);
  assert.match(text, /support legal readiness proof target/);
  assert.match(text, /provider-approved support\/legal launch-readiness wiring/);
  assert.match(text, /Plus checkout approval truth boundary/);
  assert.match(text, /Records storage provider-approval clamp/);
  assert.match(text, /Records binary proof manifest/);
  assert.match(text, /Premium payments proof manifest/);
  assert.match(text, /Auth\/Setup proof manifest/);
  assert.match(text, /Route Visual proof manifest/);
  assert.match(text, /route-named Route Visual capture instructions/);
  assert.match(text, /build:ci with mobile smoke:web, smoke:runtime, and proof:live-preview/);
  assert.match(text, /Rerun WoofWatcher Verify after any new commit before treating dependency proof as current/);
  assert.match(text, /CI proof does not approve native screenshots, provider setup, store approval, or Apollo sign-off/);
  assert.match(text, /Recorded live preview proof:/);
  assert.match(text, /WoofWatcher Live Preview Handoff Proof/);
  assert.match(text, /Result: PASS/);
  assert.match(text, /Routes: 19\/19 web-preview shell checks passed/);
  assert.match(text, /\/care-twin-qa\?qaSurface=support-legal-readiness-proof PASS/);
  assert.match(text, /\/care-twin-qa\?qaSurface=route-visual-consistency PASS/);
  assert.match(text, /Recorded verifier URL: http:\/\/127\.0\.0\.1:\d+\//);
  assert.match(text, /Preview handoff URL: http:\/\/127\.0\.0\.1:4194\/ after preview:smoke is running/);
  assert.match(text, /Attach proof: JSON route proof plus preview:smoke URL\/output/);
  assert.match(text, /Live preview proof does not replace native iOS\/Android proof/);
  assert.match(text, /Dependency proof only counts when both doctor commands report no blockers/);
  assert.match(text, /Dependency proof requires a real PATH pnpm at 10\.24\.0; do not use a bundled pnpm 11\.x candidate/);
  assert.match(text, /Required beta proof after export:/);
  assert.match(text, /Open \/care-twin-qa on iOS and Android before sharing beta proof/);
  assert.match(text, /Attach iOS Quick Log\/Log proof and Android Launch Readiness proof/);
  assert.match(text, /Confirm Care Pass Report History storage status says Saved on this device, or Ready to upload only after structured provider storage proof is attached/);
  assert.match(text, /Confirm Report History Binary proof manifest shows local Care Pass PDF and Dog ID PNG rows while native\/provider proof remains blocked/);
  assert.match(text, /Confirm Records Dog ID shares a local HTML credential file and SVG image source, while generated PNG\/PDF readiness still needs native\/provider proof/);
  assert.match(text, /Open focused auth\/setup target: \/care-twin-qa\?qaSurface=auth-setup-onboarding-proof/);
  assert.match(text, /Capture Auth gateway and Setup local-preview proof while provider-backed auth and household creation stay blocked until structured Clerk/);
  assert.match(text, /household membership, and Apollo auth launch proof files/);
  assert.match(text, /Open focused Records handoff target: \/care-twin-qa\?qaSurface=records-local-file-handoff/);
  assert.match(text, /Capture Care Pass Report History local HTML, Dog ID local HTML, Dog ID SVG, share sheet behavior, Android content URI, and fallback copy/);
  assert.match(text, /Open focused binary export proof target: \/care-twin-qa\?qaSurface=report-binary-export-proof/);
  assert.match(text, /Capture local Care Pass PDF bytes, local Dog ID PNG bytes, native share\/reopen proof, iOS\/Android artifact proof, and a structured provider storage proof file/);
  assert.match(text, /bucket names, signed upload\/download, household scope, retention\/export\/deletion, QA evidence storage, and approvals/);
  assert.match(text, /Open focused care-entry provider sync target: \/care-twin-qa\?qaSurface=care-entry-provider-sync-proof/);
  assert.match(text, /Attach structured care-entry provider proof files before enabling incremental sync/);
  assert.match(text, /Supabase project id proof; migration\/backfill proof for care_entries\.updated_at and care_entry_tombstones with row count and existing-rows-backfilled/);
  assert.match(text, /active-household RLS cursor\/tombstone proof for \/care-entries\?updatedSince= and \/care-entries\/tombstones\?updatedSince=/);
  assert.match(text, /dependency-complete build proof with CI URL and run id/);
  assert.match(text, /mobile full-refresh sign-off with native QA reference and rollback plan/);
  assert.match(text, /file name or URI, MIME, byte size, and row-specific booleans or approvals/);
  assert.match(text, /Open focused WoofGuide AI provider target: \/care-twin-qa\?qaSurface=woofguide-ai-provider-proof/);
  assert.match(text, /Attach OpenAI key location, approved model policy, source\/citation rules, and owner-review write gate/);
  assert.match(text, /veterinary safety boundary and fallback\/incident handling before enabling live AI/);
  assert.match(text, /Open focused push notifications target: \/care-twin-qa\?qaSurface=push-notifications-proof/);
  assert.match(text, /Attach Expo push project id, APNs credentials, Firebase\/FCM credentials/);
  assert.match(text, /permission prompt copy, quiet hours, opt-out behavior, delivery QA, and missed notification fallback/);
  assert.match(text, /Open focused payments provider target: \/care-twin-qa\?qaSurface=payments-provider-proof/);
  assert.match(text, /Attach Plus and Family product ids, billing path decision, iOS App Store and Android Google Play sandbox purchase\/renewal\/cancel\/refund\/expired receipt proof/);
  assert.match(text, /JSON receipt files or URIs with product id, transaction id, byte size, and restorePurchaseConfirmed/);
  assert.match(text, /entitlement mapping, refund\/support policy, and checkout-gate proof before enabling paid checkout/);
  assert.match(text, /Open focused store accounts target: \/care-twin-qa\?qaSurface=store-accounts-proof/);
  assert.match(text, /Attach Apple Developer team id, App Store Connect app record, Google Play package record/);
  assert.match(text, /reviewer access\/test credentials, screenshots\/metadata ownership, and release role approval before claiming store submission/);
  assert.match(text, /Open focused account deletion target: \/care-twin-qa\?qaSurface=account-deletion-proof/);
  assert.match(text, /Attach structured account deletion proof files before enabling destructive deletion/);
  assert.match(text, /deletion-route\/auth proof with self-serve route, reauthentication, active-household scope/);
  assert.match(text, /data\/object deletion receipt proof; audit\/support receipt proof; recovery\/cancellation proof; and legal\/store\/Apollo approval proof/);
  assert.match(text, /Open focused support legal readiness target: \/care-twin-qa\?qaSurface=support-legal-readiness-proof/);
  assert.match(text, /Attach structured support\/legal proof files before public launch/);
  assert.match(text, /Apollo launch approval\/no-launch-boundary proof with MIME, byte size, and row-specific approvals/);
  assert.match(text, /Open focused route visual target: \/care-twin-qa\?qaSurface=route-visual-consistency/);
  assert.match(text, /Capture Home, Log, Plans, Health, More, Story & Progress, Records, and Care Team & Supplies on iOS and Android before claiming route visual proof/);
  assert.match(text, /Name or save each Route Visual screenshot with the canonical route label/);
  assert.match(text, /Home-iOS.*Story-Progress-iOS.*Care-Team-Supplies-Android/);
  assert.match(text, /Save the Mission note and clear Pass pending proof in both \/care-twin-qa and More/);
  assert.match(text, /Native QA Needs tune fix brief:/);
  assert.match(text, /If any route is marked Needs tune, use More's Share Fix Brief before claiming beta proof/);
  assert.match(text, /Provider proof needed:/);
  assert.match(text, /Production auth: Production auth provider proof packet/);
  assert.match(text, /Clerk production app/);
  assert.match(text, /Redirect and deep-link URLs/);
  assert.match(text, /OAuth sign-in test/);
  assert.match(text, /Session and token policy/);
  assert.match(text, /Household membership policy/);
  assert.match(text, /Household database sync: Supabase project id/);
  assert.match(text, /Care-entry provider sync proof packet/);
  assert.match(text, /Migration\/backfill/);
  assert.match(text, /Active-household RLS/);
  assert.match(text, /care_entries\.updated_at/);
  assert.match(text, /care_entry_tombstones/);
  assert.match(text, /\/care-entries\?updatedSince=/);
  assert.match(text, /mobile full-refresh sign-off/);
  assert.match(text, /Records and media storage: Storage bucket names/);
  assert.match(text, /WoofWatcher Plus payments: WoofWatcher Plus payments proof packet/);
  assert.match(text, /Product catalog: Plus and Family product ids/);
  assert.match(text, /Billing path decision: Approved App Store, Google Play, and Stripe or web checkout decision/);
  assert.match(text, /Sandbox receipt test: Sandbox purchase, renewal, cancel, refund, and expired receipt proof/);
  assert.match(text, /Entitlement mapping: Plus and Family feature gates/);
  assert.match(text, /Refund and support policy: Public refund, support, tax, and subscription terms/);
  assert.match(text, /Checkout gate and restore behavior: checkout stays disabled/);
  assert.match(text, /WoofGuide AI: WoofGuide AI provider proof packet/);
  assert.match(text, /Provider key and secret storage: OpenAI key location/);
  assert.match(text, /Approved model policy: Approved model id/);
  assert.match(text, /Source and citation rules: Approved source labels/);
  assert.match(text, /Owner-review write gate: owner-reviewed/);
  assert.match(text, /Veterinary safety boundary: not veterinary advice/);
  assert.match(text, /Fallback and incident handling: fallback copy/);
  assert.match(text, /Self-serve account deletion: Self-serve account deletion proof packet/);
  assert.match(text, /Deletion route and authentication gate: self-serve deletion route/);
  assert.match(text, /Export-before-delete handoff: export-before-delete warning/);
  assert.match(text, /Data and object deletion receipt: data\/object deletion receipt/);
  assert.match(text, /Recovery window and cancellation rules: recovery-window policy/);
  assert.match(text, /Legal and store approval: legal\/store approval/);
  assert.match(text, /Apple and Google store accounts: Apple and Google store accounts proof packet/);
  assert.match(text, /Apple Developer and App Store Connect access: Apple Developer team id/);
  assert.match(text, /Google Play Console package record: Google Play package record/);
  assert.match(text, /Reviewer access and test credentials: reviewer access notes/);
  assert.match(text, /Store screenshots and metadata ownership: store screenshots/);
  assert.match(text, /Release roles and submission approval: release role approval/);
  assert.match(text, /Push notifications: Push notifications proof packet/);
  assert.match(text, /Expo push project config: Expo push project id/);
  assert.match(text, /Apple APNs credentials: APNs credentials/);
  assert.match(text, /Firebase and FCM credentials: Firebase\/FCM credentials/);
  assert.match(text, /Permission prompt and preference copy: permission prompt copy/);
  assert.match(text, /Quiet hours and opt-out behavior: quiet hours/);
  assert.match(text, /Reminder delivery QA and fallback: delivery QA/);
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
      "owner-preview-core-loop": "Log, Plan, Today, Pack, Story, Health, More, Adventure, Records, Avatar Studio, and Care Pass opened.",
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

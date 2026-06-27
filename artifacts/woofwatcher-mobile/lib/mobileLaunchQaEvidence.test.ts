import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildMobileLaunchQaFixBriefShareText,
  buildMobileLaunchQaCaptureShareText,
  buildMobileLaunchQaCapturePlan,
  buildMobileLaunchQaFocusedTarget,
  buildMobileLaunchQaFocusedTargetShareText,
  deriveNativeQaSummaryFromMobileQaSession,
  listMobileLaunchQaSurfaces,
  mobileLaunchQaCaptureTargetStatusLabel,
} from "./mobileLaunchQaEvidence.ts";
import type { MobileQaSessionState } from "./mobileQaSession.ts";
import type { MobileReleaseQaSurface } from "./mobileReleaseQa.ts";

const focusedSurfaces: readonly MobileReleaseQaSurface[] = [
  {
    id: "home",
    title: "Home",
    route: "/",
    priority: "launch-critical",
    goal: "Verify the main screen.",
    devicePrompt: "Capture the screen.",
    setupSteps: ["Use a local preview household with Phoenix sample care data."],
    verificationSteps: ["Open Home.", "Capture iOS and Android screenshots."],
    acceptanceCriteria: ["Home is readable above the fold on both platforms."],
    failureEscalation: "Mark Needs tune if Home clips under the safe area or hides the main action.",
    requiredEvidence: ["iOS screenshot of Home.", "Android screenshot of Home."],
    launchRisk: "Home is the first impression.",
  },
  {
    id: "care-pass",
    title: "Care Pass",
    route: "/records",
    priority: "release-polish",
    goal: "Verify Care Pass.",
    devicePrompt: "Capture the handoff.",
    setupSteps: ["Open Records with visible report history."],
    verificationSteps: ["Open Records.", "Preview Care Pass."],
    acceptanceCriteria: ["Care Pass preview is readable and shareable."],
    failureEscalation: "Mark Needs tune if Care Pass copy clips or the share path is unclear.",
    requiredEvidence: ["Screenshot of Care Pass share preview."],
    launchRisk: "Care Pass needs proof.",
  },
];

test("derives a launch native QA summary from saved mobile QA session proof", () => {
  const session: MobileQaSessionState = {
    careTwinStatusById: {},
    careTwinNotes: {},
    careTwinEvidenceById: {},
    surfaceStatusById: {
      home: "pass",
      "care-pass": "needs-review",
    },
    surfaceNotes: {},
    surfaceEvidenceById: {
      home: [
        {
          uri: "file:///qa/ios-home.png",
          fileName: "ios-home.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-21T09:00:00.000Z",
        },
      ],
      "care-pass": [
        {
          uri: "file:///qa/care-pass.png",
          fileName: "care-pass.png",
          source: "library",
          targetPlatform: "unknown",
          capturedAtIso: "2026-06-21T09:02:00.000Z",
        },
      ],
    },
  };

  const summary = deriveNativeQaSummaryFromMobileQaSession(session, focusedSurfaces);

  assert.deepEqual(summary, {
    total: 2,
    passed: 1,
    needsReview: 1,
    unreviewed: 0,
    requiredScreenshots: 3,
    missingScreenshots: 1,
    missingIosScreenshots: 0,
    missingAndroidScreenshots: 1,
    missingAnyScreenshots: 0,
  });
});

test("keeps launch native QA empty until the saved session contains real review data", () => {
  const emptySession: MobileQaSessionState = {
    careTwinStatusById: {},
    careTwinNotes: {},
    careTwinEvidenceById: {},
    surfaceStatusById: {},
    surfaceNotes: {},
    surfaceEvidenceById: {},
  };

  assert.equal(deriveNativeQaSummaryFromMobileQaSession(null, focusedSurfaces), null);
  assert.equal(deriveNativeQaSummaryFromMobileQaSession(emptySession, focusedSurfaces), null);
});

test("lists the combined native release and store screenshot QA surfaces", () => {
  const surfaces = listMobileLaunchQaSurfaces();
  const ids = surfaces.map((surface) => surface.id);

  assert.ok(ids.includes("phoenix-home"));
  assert.ok(ids.includes("avatar-studio"));
  assert.ok(ids.includes("store-phoenix-home"));
  assert.ok(ids.includes("store-health-watch"));
  assert.ok(ids.includes("store-privacy-launch-gates"));
  assert.ok(surfaces.every((surface) => surface.requiredEvidence.some((item) => /screenshot/i.test(item))));
});

test("builds a prioritized capture plan from missing native QA evidence", () => {
  const session: MobileQaSessionState = {
    careTwinStatusById: {},
    careTwinNotes: {},
    careTwinEvidenceById: {},
    surfaceStatusById: {
      home: "pass",
      "care-pass": "pass",
    },
    surfaceNotes: {},
    surfaceEvidenceById: {
      home: [
        {
          uri: "file:///qa/ios-home.png",
          fileName: "ios-home.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-21T09:00:00.000Z",
        },
        {
          uri: "file:///qa/android-home.png",
          fileName: "android-home.png",
          source: "library",
          targetPlatform: "android",
          capturedAtIso: "2026-06-21T09:02:00.000Z",
        },
      ],
    },
  };

  const plan = buildMobileLaunchQaCapturePlan(session, focusedSurfaces);

  assert.equal(plan.totalSurfaces, 2);
  assert.equal(plan.openSurfaces, 1);
  assert.equal(plan.completeSurfaces, 1);
  assert.deepEqual(plan.nextTargets, [
    {
      surfaceId: "care-pass",
      title: "Care Pass",
      route: "/records",
      priority: "release-polish",
      status: "pass",
      missingEvidence: ["Attach 1 screenshot for Care Pass."],
      setupSteps: ["Open Records with visible report history."],
      verificationSteps: ["Open Records.", "Preview Care Pass."],
      acceptanceCriteria: ["Care Pass preview is readable and shareable."],
      failureEscalation: "Mark Needs tune if Care Pass copy clips or the share path is unclear.",
      evidenceAttached: 0,
      note: undefined,
    },
  ]);
});

test("prioritizes launch-critical unreviewed targets before release-polish targets", () => {
  const emptySession: MobileQaSessionState = {
    careTwinStatusById: {},
    careTwinNotes: {},
    careTwinEvidenceById: {},
    surfaceStatusById: {},
    surfaceNotes: {},
    surfaceEvidenceById: {},
  };

  const plan = buildMobileLaunchQaCapturePlan(emptySession, focusedSurfaces);

  assert.equal(plan.openSurfaces, 2);
  assert.equal(plan.nextTargets[0]?.surfaceId, "home");
  assert.deepEqual(plan.nextTargets[0]?.missingEvidence, [
    "Attach 1 iOS screenshot for Home.",
    "Attach 1 Android screenshot for Home.",
  ]);
  assert.equal(plan.nextTargets[1]?.surfaceId, "care-pass");
});

test("preserves release surface order inside each priority group", () => {
  const surfaces: readonly MobileReleaseQaSurface[] = [
    {
      id: "phoenix-home",
      title: "Phoenix Home",
      route: "/",
      priority: "launch-critical",
      goal: "Verify the first screen.",
      devicePrompt: "Capture Home first.",
      setupSteps: ["Use a local preview household with Phoenix sample care data."],
      verificationSteps: ["Open Phoenix Home.", "Verify Home first."],
      acceptanceCriteria: ["Home is readable and actionable."],
      failureEscalation: "Mark Needs tune if Home is clipped or confusing.",
      requiredEvidence: ["iOS screenshot of Phoenix Home."],
      launchRisk: "Home is the first impression.",
    },
    {
      id: "home-mission-deck",
      title: "Home Mission Deck",
      route: "/",
      priority: "launch-critical",
      goal: "Verify the mission deck.",
      devicePrompt: "Capture mission deck second.",
      setupSteps: ["Create pending meal and active session state."],
      verificationSteps: ["Open Phoenix Home.", "Verify mission route rows."],
      acceptanceCriteria: ["Mission rows are readable and reachable."],
      failureEscalation: "Mark Needs tune if rows are hidden behind navigation.",
      requiredEvidence: ["iOS screenshot of Home Mission Deck."],
      launchRisk: "Mission rows must not hide behind the nav.",
    },
    {
      id: "avatar-studio",
      title: "Avatar Studio",
      route: "/portrait",
      priority: "launch-critical",
      goal: "Verify Avatar Studio.",
      devicePrompt: "Capture Avatar Studio after Home.",
      setupSteps: ["Use the current PixelLab template pack."],
      verificationSteps: ["Open Avatar Studio.", "Switch template families."],
      acceptanceCriteria: ["Avatar Studio shows truthful template readiness."],
      failureEscalation: "Mark Needs tune if a template looks blurry or mislabeled.",
      requiredEvidence: ["iOS screenshot of Avatar Studio."],
      launchRisk: "Avatar Studio is the product hook.",
    },
    {
      id: "care-pass",
      title: "Care Pass",
      route: "/records",
      priority: "release-polish",
      goal: "Verify Care Pass.",
      devicePrompt: "Capture Care Pass.",
      setupSteps: ["Open Records with visible report history."],
      verificationSteps: ["Open Records.", "Preview Care Pass."],
      acceptanceCriteria: ["Care Pass preview is readable and shareable."],
      failureEscalation: "Mark Needs tune if Care Pass copy clips or the share path is unclear.",
      requiredEvidence: ["Screenshot of Care Pass."],
      launchRisk: "Care Pass needs proof.",
    },
  ];

  const plan = buildMobileLaunchQaCapturePlan(null, surfaces);

  assert.deepEqual(
    plan.nextTargets.map((target) => target.surfaceId),
    ["phoenix-home", "home-mission-deck", "avatar-studio", "care-pass"],
  );
});

test("builds a shareable native QA capture script for Apollo and device testers", () => {
  const plan = buildMobileLaunchQaCapturePlan(null, focusedSurfaces);
  const text = buildMobileLaunchQaCaptureShareText(plan, "2026-06-21T09:30:00.000Z");

  assert.match(text, /WoofWatcher Native QA Capture Plan/);
  assert.match(text, /Generated: 2026-06-21T09:30:00.000Z/);
  assert.match(text, /Progress: 0\/2 complete, 2 open/);
  assert.match(text, /1\. Home \(\/\)/);
  assert.match(text, /Priority: launch-critical/);
  assert.match(text, /Missing: Attach 1 iOS screenshot for Home\. Attach 1 Android screenshot for Home\./);
  assert.match(text, /Setup: Use a local preview household with Phoenix sample care data\./);
  assert.match(text, /Steps: Open Home\. Capture iOS and Android screenshots\./);
  assert.match(text, /Pass criteria: Home is readable above the fold on both platforms\./);
  assert.match(text, /Needs tune if: Mark Needs tune if Home clips under the safe area or hides the main action\./);
  assert.match(text, /2\. Care Pass \(\/records\)/);
  assert.match(text, /Done condition: capture iOS and Android proof in \/care-twin-qa/);
});

test("keeps store screenshot proof visible even when normal native targets fill the capture list", () => {
  const surfaces: readonly MobileReleaseQaSurface[] = [
    {
      ...focusedSurfaces[0],
      id: "home-one",
      title: "Home One",
    },
    {
      ...focusedSurfaces[0],
      id: "home-two",
      title: "Home Two",
    },
    {
      ...focusedSurfaces[0],
      id: "home-three",
      title: "Home Three",
    },
    {
      ...focusedSurfaces[0],
      id: "home-four",
      title: "Home Four",
    },
    {
      id: "store-health-watch",
      title: "Store: Health Watch",
      route: "/health",
      priority: "release-polish",
      goal: "Capture store-ready Health Watch evidence.",
      devicePrompt: "Capture Review packet and Vet-share checklist.",
      setupSteps: ["Open Health and keep Review packet visible before capturing the store screenshot."],
      verificationSteps: ["Confirm the Review packet is visible with the Vet-share checklist."],
      acceptanceCriteria: ["Health Review Packet shows owner prompts, vet-share checklist, and Not veterinary advice boundary."],
      failureEscalation: "Mark Needs tune if Health Watch hides the Review packet.",
      requiredEvidence: [
        "iOS screenshot for store packet: Health Watch.",
        "Android screenshot for store packet: Health Watch.",
        "Health Watch Review packet with Vet-share checklist and Draft vet questions visible.",
      ],
      launchRisk: "If Health Watch is missing, the store listing lacks truthful health-workflow proof.",
    },
  ];

  const plan = buildMobileLaunchQaCapturePlan(null, surfaces);

  assert.deepEqual(
    plan.nextTargets.map((target) => target.surfaceId),
    ["home-one", "home-two", "home-three", "home-four"],
  );
  assert.equal(plan.storeScreenshotProofStatus.total, 1);
  assert.equal(plan.storeScreenshotProofStatus.complete, 0);
  assert.equal(plan.storeScreenshotProofStatus.open, 1);
  assert.equal(plan.storeScreenshotProofStatus.statusLabel, "Store proof open");
  assert.equal(plan.storeScreenshotProofStatus.nextTarget?.surfaceId, "store-health-watch");
  assert.match(plan.storeScreenshotProofStatus.missingEvidence.join(" "), /Attach 1 iOS screenshot for Store: Health Watch/);

  const text = buildMobileLaunchQaCaptureShareText(plan, "2026-06-27T09:30:00.000Z");

  assert.match(text, /Store screenshot proof: Store proof open/);
  assert.match(text, /Next store screenshot: Store: Health Watch \(\/health\)/);
  assert.match(text, /Store screenshot missing: Attach 1 iOS screenshot for Store: Health Watch/);
});

test("builds a focused QA target for deep-linked launch readiness rows", () => {
  const surfaces: readonly MobileReleaseQaSurface[] = [
    {
      id: "store-health-watch",
      title: "Store: Health Watch",
      route: "/health",
      priority: "release-polish",
      goal: "Capture store-ready Health Watch evidence.",
      devicePrompt: "Capture Review packet and Vet-share checklist.",
      setupSteps: ["Open Health and keep Review packet visible before capturing the store screenshot."],
      verificationSteps: ["Confirm the Review packet is visible with the Vet-share checklist."],
      acceptanceCriteria: ["Health Review Packet shows owner prompts, vet-share checklist, and Not veterinary advice boundary."],
      failureEscalation: "Mark Needs tune if Health Watch hides the Review packet.",
      requiredEvidence: [
        "iOS screenshot for store packet: Health Watch.",
        "Android screenshot for store packet: Health Watch.",
        "Health Watch Review packet with Vet-share checklist and Draft vet questions visible.",
      ],
      launchRisk: "If Health Watch is missing, the store listing lacks truthful health-workflow proof.",
    },
  ];

  const focused = buildMobileLaunchQaFocusedTarget(null, "store-health-watch", surfaces);

  assert.ok(focused);
  assert.equal(focused.surface.id, "store-health-watch");
  assert.equal(focused.target.title, "Store: Health Watch");
  assert.equal(focused.statusLabel, "Not reviewed");
  assert.equal(focused.complete, false);
  assert.deepEqual(focused.target.setupSteps, [
    "Open Health and keep Review packet visible before capturing the store screenshot.",
  ]);
  assert.match(focused.target.missingEvidence.join(" "), /Attach 1 iOS screenshot for Store: Health Watch/);
  assert.equal(buildMobileLaunchQaFocusedTarget(null, "missing-surface", surfaces), null);
});

test("builds a focused target checklist for phone and handoff QA", () => {
  const focused = buildMobileLaunchQaFocusedTarget(null, "store-health-watch", [
    {
      id: "store-health-watch",
      title: "Store: Health Watch",
      route: "/health",
      priority: "release-polish",
      goal: "Capture store-ready Health Watch evidence.",
      devicePrompt: "Capture Review packet and Vet-share checklist.",
      setupSteps: ["Open Health and keep Review packet visible before capturing the store screenshot."],
      verificationSteps: ["Confirm the Review packet is visible with the Vet-share checklist."],
      acceptanceCriteria: ["Health Review Packet shows owner prompts, vet-share checklist, and Not veterinary advice boundary."],
      failureEscalation: "Mark Needs tune if Health Watch hides the Review packet.",
      requiredEvidence: [
        "iOS screenshot for store packet: Health Watch.",
        "Android screenshot for store packet: Health Watch.",
        "Health Watch Review packet with Vet-share checklist and Draft vet questions visible.",
      ],
      launchRisk: "If Health Watch is missing, the store listing lacks truthful health-workflow proof.",
    },
  ]);

  assert.ok(focused);

  const text = buildMobileLaunchQaFocusedTargetShareText(focused, "2026-06-27T10:00:00.000Z");

  assert.match(text, /WoofWatcher Focused QA Target/);
  assert.match(text, /Generated: 2026-06-27T10:00:00.000Z/);
  assert.match(text, /Target: Store: Health Watch/);
  assert.match(text, /Focused cockpit: \/care-twin-qa\?qaSurface=store-health-watch/);
  assert.match(text, /Open route: \/health/);
  assert.match(text, /Proof needed: Attach 1 iOS screenshot for Store: Health Watch\./);
  assert.match(text, /Attached proof: 0 screenshot/);
  assert.match(text, /Pass when: Health Review Packet shows owner prompts/);
  assert.match(text, /After capture: return to \/care-twin-qa\?qaSurface=store-health-watch/);
  assert.match(text, /Keep App Store\/Play Store approval separate/);
});

test("preserves owner preview route-loop details in the capture plan and share script", () => {
  const surfaces = listMobileLaunchQaSurfaces();
  const ownerLoop = surfaces.find((surface) => surface.id === "owner-preview-core-loop");

  assert.ok(ownerLoop);

  const plan = buildMobileLaunchQaCapturePlan(null, [ownerLoop]);
  const target = plan.nextTargets[0];

  assert.equal(target?.surfaceId, "owner-preview-core-loop");
  assert.deepEqual(
    target?.routeChecklist?.map((item) => `${item.label}:${item.route}`),
    [
      "Home:/",
      "Log:/log",
      "Plans:/calendar",
      "Health:/health",
      "More:/more",
      "Records:/records",
      "Avatar Studio:/portrait",
      "Care Pass:/records",
    ],
  );
  assert.match(target?.routeChecklist?.[1]?.expected ?? "", /Quick-log one safe care event/);
  assert.match(target?.routeChecklist?.[4]?.proof ?? "", /Android Launch Readiness screenshot/);

  const text = buildMobileLaunchQaCaptureShareText(plan, "2026-06-25T09:30:00.000Z");

  assert.match(text, /Route loop:/);
  assert.match(text, /Home \(\/\): Confirm Phoenix status/);
  assert.match(text, /Log \(\/log\): Quick-log one safe care event/);
  assert.match(text, /More \(\/more\): Open Launch Readiness/);
  assert.match(text, /Care Pass \(\/records\): Confirm sitter\/vet\/trainer handoff/);
});

test("keeps note-required owner preview evidence open until the QA note is written", () => {
  const surfaces = listMobileLaunchQaSurfaces();
  const ownerLoop = surfaces.find((surface) => surface.id === "owner-preview-core-loop");

  assert.ok(ownerLoop);

  const sessionWithoutNote: MobileQaSessionState = {
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
          uri: "file:///qa/ios-owner-log.png",
          fileName: "ios-owner-log.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-25T09:00:00.000Z",
        },
        {
          uri: "file:///qa/android-launch-readiness.png",
          fileName: "android-launch-readiness.png",
          source: "library",
          targetPlatform: "android",
          capturedAtIso: "2026-06-25T09:02:00.000Z",
        },
      ],
    },
  };

  const openPlan = buildMobileLaunchQaCapturePlan(sessionWithoutNote, [ownerLoop]);

  assert.equal(openPlan.openSurfaces, 1);
  assert.equal(openPlan.nextTargets[0]?.surfaceId, "owner-preview-core-loop");
  assert.match(openPlan.nextTargets[0]?.missingEvidence.join(" ") ?? "", /Add QA note for Owner Preview Core Loop/);
  assert.equal(mobileLaunchQaCaptureTargetStatusLabel(openPlan.nextTargets[0]), "Pass pending proof");

  const openShareText = buildMobileLaunchQaCaptureShareText(openPlan, "2026-06-25T09:30:00.000Z");
  assert.match(openShareText, /Status: Pass pending proof/);

  const sessionWithNote: MobileQaSessionState = {
    ...sessionWithoutNote,
    surfaceNotes: {
      "owner-preview-core-loop":
        "Home, Log, Plans, Health, More, Records, Avatar Studio, and Care Pass were reachable without dead ends. Care Pass Report History storage status stayed truthful.",
    },
  };

  const completePlan = buildMobileLaunchQaCapturePlan(sessionWithNote, [ownerLoop]);

  assert.equal(completePlan.openSurfaces, 0);
  assert.equal(completePlan.completeSurfaces, 1);
  assert.deepEqual(completePlan.nextTargets, []);
});

test("finds the first Needs tune route even when it is outside the visible next captures", () => {
  const surfaces: readonly MobileReleaseQaSurface[] = [
    {
      ...focusedSurfaces[0],
      id: "home-one",
      title: "Home One",
    },
    {
      ...focusedSurfaces[0],
      id: "home-two",
      title: "Home Two",
    },
    {
      ...focusedSurfaces[0],
      id: "home-three",
      title: "Home Three",
    },
    {
      ...focusedSurfaces[0],
      id: "home-four",
      title: "Home Four",
    },
    {
      ...focusedSurfaces[1],
      id: "care-pass",
      title: "Care Pass",
    },
  ];
  const session: MobileQaSessionState = {
    careTwinStatusById: {},
    careTwinNotes: {},
    careTwinEvidenceById: {},
    surfaceStatusById: {
      "care-pass": "needs-review",
    },
    surfaceNotes: {
      "care-pass": "Care Pass share button is too low behind the paw nav on Android.",
    },
    surfaceEvidenceById: {},
  };

  const plan = buildMobileLaunchQaCapturePlan(session, surfaces);

  assert.deepEqual(
    plan.nextTargets.map((target) => target.surfaceId),
    ["home-one", "home-two", "home-three", "home-four"],
  );
  assert.equal(plan.firstNeedsTuneTarget?.surfaceId, "care-pass");
  assert.equal(plan.firstNeedsTuneTarget?.note, "Care Pass share button is too low behind the paw nav on Android.");
});

test("keeps owner preview beta proof visible even when it is outside the visible next captures", () => {
  const surfaces: readonly MobileReleaseQaSurface[] = [
    {
      ...focusedSurfaces[0],
      id: "home-one",
      title: "Home One",
    },
    {
      ...focusedSurfaces[0],
      id: "home-two",
      title: "Home Two",
    },
    {
      ...focusedSurfaces[0],
      id: "home-three",
      title: "Home Three",
    },
    {
      ...focusedSurfaces[0],
      id: "home-four",
      title: "Home Four",
    },
    {
      id: "owner-preview-core-loop",
      title: "Owner Preview Core Loop",
      route: "/care-twin-qa",
      priority: "launch-critical",
      goal: "Verify the real owner journey before beta sharing.",
      devicePrompt: "Run the owner route loop and attach proof.",
      setupSteps: ["Use Phoenix demo care data."],
      verificationSteps: ["Open Home.", "Open Log.", "Open More Launch Readiness."],
      acceptanceCriteria: ["No route dead-ends."],
      failureEscalation: "Mark Needs tune if any route clips or dead-ends.",
      requiredEvidence: [
        "iOS screenshot of Quick Log or Log.",
        "Android screenshot of More Launch Readiness.",
        "Note confirming Home, Log, Plans, Health, More, Records, Avatar Studio, and Care Pass had no dead ends.",
      ],
      launchRisk: "This is the beta's real owner path.",
    },
  ];
  const session: MobileQaSessionState = {
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
          capturedAtIso: "2026-06-26T09:00:00.000Z",
        },
        {
          uri: "file:///qa/android-launch-readiness.png",
          fileName: "android-launch-readiness.png",
          source: "library",
          targetPlatform: "android",
          capturedAtIso: "2026-06-26T09:02:00.000Z",
        },
      ],
    },
  };

  const plan = buildMobileLaunchQaCapturePlan(session, surfaces);

  assert.deepEqual(
    plan.nextTargets.map((target) => target.surfaceId),
    ["home-one", "home-two", "home-three", "home-four"],
  );
  assert.equal(plan.ownerPreviewProofStatus.surfaceId, "owner-preview-core-loop");
  assert.equal(plan.ownerPreviewProofStatus.statusLabel, "Pass pending proof");
  assert.equal(plan.ownerPreviewProofStatus.complete, false);
  assert.equal(plan.ownerPreviewProofStatus.evidenceAttached, 2);
  assert.deepEqual(plan.ownerPreviewProofStatus.missingEvidence, ["Add QA note for Owner Preview Core Loop."]);

  const text = buildMobileLaunchQaCaptureShareText(plan, "2026-06-26T09:30:00.000Z");

  assert.match(text, /Owner preview proof: Pass pending proof/);
  assert.match(text, /Owner preview missing: Add QA note for Owner Preview Core Loop\./);
});

test("builds a focused fix brief for the first Needs tune target", () => {
  const session: MobileQaSessionState = {
    careTwinStatusById: {},
    careTwinNotes: {},
    careTwinEvidenceById: {},
    surfaceStatusById: {
      "care-pass": "needs-review",
    },
    surfaceNotes: {
      "care-pass": "Care Pass share button clips under the floating paw nav.",
    },
    surfaceEvidenceById: {
      "care-pass": [
        {
          uri: "file:///qa/android-care-pass.png",
          fileName: "android-care-pass.png",
          source: "library",
          targetPlatform: "android",
          capturedAtIso: "2026-06-25T12:00:00.000Z",
        },
      ],
    },
  };
  const plan = buildMobileLaunchQaCapturePlan(session, focusedSurfaces);

  const text = buildMobileLaunchQaFixBriefShareText(plan, "2026-06-25T12:30:00.000Z");

  assert.match(text, /WoofWatcher Needs Tune Fix Brief/);
  assert.match(text, /Generated: 2026-06-25T12:30:00.000Z/);
  assert.match(text, /Fix first: Care Pass/);
  assert.match(text, /Route: \/records/);
  assert.match(text, /QA note: Care Pass share button clips under the floating paw nav\./);
  assert.match(text, /Missing proof: No required proof is missing/);
  assert.match(text, /Done when: Care Pass preview is readable and shareable\./);
  assert.match(text, /After fix: return to \/care-twin-qa/);
});

test("fix brief stays truthful when no Needs tune target is marked", () => {
  const plan = buildMobileLaunchQaCapturePlan(null, focusedSurfaces);
  const text = buildMobileLaunchQaFixBriefShareText(plan, "2026-06-25T12:30:00.000Z");

  assert.match(text, /No Needs tune route is currently marked/);
  assert.match(text, /Continue with the next QA capture in \/care-twin-qa/);
});

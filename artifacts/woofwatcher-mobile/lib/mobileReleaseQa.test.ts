import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildStoreSubmissionScreenshotQaSurfaces,
  buildMobileReleaseQaShareText,
  formatMobileReleaseQaMissingEvidence,
  formatMobileReleaseQaPlatformEvidence,
  listMobileReleaseQaSurfaces,
  mobileReleaseQaMissingEvidenceForSurface,
  mobileReleaseQaFlexibleScreenshotSlotsSatisfied,
  mobileReleaseQaReviewStatusLabel,
  mobileReleaseQaRouteProofLabel,
  mobileReleaseQaScreenshotEvidenceComplete,
  mobileReleaseQaStatusLabel,
  summarizeMobileReleaseQaReviews,
  type MobileReleaseQaReview,
} from "./mobileReleaseQa.ts";
import type { StoreSubmissionPacket } from "./storeSubmissionPacket.ts";

test("lists the launch-critical mobile QA surfaces for the next native pass", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const ids = surfaces.map((surface) => surface.id);

  assert.ok(ids.includes("phoenix-home"));
  assert.ok(ids.includes("home-mission-deck"));
  assert.ok(ids.includes("owner-preview-core-loop"));
  assert.ok(ids.includes("route-visual-consistency"));
  assert.ok(ids.includes("care-twin-state-lab"));
  assert.ok(ids.includes("avatar-studio"));
  assert.ok(ids.includes("avatar-sprite-production-review"));
  assert.ok(ids.includes("incident-composer"));
  assert.ok(ids.includes("records-incident-watch"));
  assert.ok(surfaces.every((surface) => surface.requiredEvidence.length > 0));
  assert.ok(
    surfaces.every(
      (surface) =>
        Array.isArray((surface as { setupSteps?: readonly string[] }).setupSteps) &&
        (surface as { setupSteps: readonly string[] }).setupSteps.length > 0,
    ),
  );
  assert.ok(surfaces.every((surface) => surface.verificationSteps.length > 0));
  assert.ok(
    surfaces.every(
      (surface) =>
        Array.isArray((surface as { acceptanceCriteria?: readonly string[] }).acceptanceCriteria) &&
        (surface as { acceptanceCriteria: readonly string[] }).acceptanceCriteria.length > 0,
    ),
  );
  assert.ok(surfaces.every((surface) => (surface as { failureEscalation?: string }).failureEscalation?.length));
  assert.ok(surfaces.every((surface) => surface.launchRisk.length > 0));
});

test("adds a source-backed Avatar Sprite Production Review surface", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const surface = surfaces.find((item) => item.id === "avatar-sprite-production-review");

  assert.ok(surface);
  assert.equal(surface.route, "/portrait");
  assert.equal(surface.priority, "launch-critical");
  assert.match(surface.goal, /12\/12 PixelLab live template sprite packs/);
  assert.match(surface.goal, /phone-size crop, gait, anchor stability, and game feel/);
  assert.match(surface.devicePrompt, /iOS and Android/);
  assert.match(surface.devicePrompt, /real game sprites/);
  assert.match(surface.setupSteps.join("\n"), /24 registered template sprite slots/);
  assert.match(surface.setupSteps.join("\n"), /Shepherd\/Phoenix/);
  assert.match(surface.setupSteps.join("\n"), /Mixed Breed/);
  assert.match(surface.verificationSteps.join("\n"), /idle-tail-wag loop and the walk-loop/);
  assert.match(surface.verificationSteps.join("\n"), /duplicate sprite, second avatar/);
  assert.match(surface.verificationSteps.join("\n"), /bottom-center anchor/);
  assert.match(surface.verificationSteps.join("\n"), /walk gait feels like a video-game loop/);
  assert.match(surface.acceptanceCriteria.join("\n"), /Pass pending proof/);
  assert.match(surface.failureEscalation, /weak gait/);
  assert.match(surface.failureEscalation, /accessory overlay/);
  assert.match(surface.requiredEvidence.join("\n"), /iOS screenshot of Avatar Studio with Shepherd\/Phoenix/);
  assert.match(surface.requiredEvidence.join("\n"), /Android screenshot of Avatar Studio with a non-Phoenix live template/);
  assert.match(surface.requiredEvidence.join("\n"), /Note listing any weak gait/);
  assert.deepEqual(surface.routeChecklist?.map((item) => item.label), [
    "Avatar Studio sprite stage",
    "Care Twin State Lab",
  ]);
  assert.equal(surface.routeChecklist?.[0]?.route, "/portrait");
  assert.equal(surface.routeChecklist?.[1]?.route, "/care-twin-qa?qaSurface=care-twin-state-lab");
  assert.match(surface.routeChecklist?.[0]?.proof ?? "", /gait\/crop note/);
  assert.match(surface.launchRisk, /video-game avatar/);
});

test("keeps route visual consistency as a launch-critical design QA gate", () => {
  const surface = listMobileReleaseQaSurfaces().find((item) => item.id === "route-visual-consistency");

  assert.ok(surface);
  assert.equal(surface.title, "Route Visual Consistency");
  assert.equal(surface.priority, "launch-critical");
  assert.match(surface.goal, /one planned premium neo-retro app/);
  assert.match(surface.devicePrompt, /Home, Log, Plans, Health, Records, and More/);
  assert.match(
    surface.acceptanceCriteria.join("\n"),
    /No first-screen text, card, sprite, tab, or bottom navigation element overlaps/,
  );
  assert.match(surface.failureEscalation, /Option B pixel app boards/);
  assert.deepEqual(surface.routeChecklist?.map((item) => item.label), [
    "Home",
    "Log",
    "Plans",
    "Health",
    "Records",
    "More",
  ]);
  assert.match(
    surface.requiredEvidence.join("\n"),
    /iOS screenshot of Home route top/,
  );
  assert.match(
    surface.requiredEvidence.join("\n"),
    /Android screenshot of More route top/,
  );
  assert.equal(
    surface.requiredEvidence.filter((item) => /iOS screenshot/.test(item)).length,
    6,
  );
  assert.equal(
    surface.requiredEvidence.filter((item) => /Android screenshot/.test(item)).length,
    6,
  );
  assert.ok(surface.routeChecklist?.every((item) => item.requiredNativePlatforms?.join(",") === "ios,android"));
  assert.match(mobileReleaseQaRouteProofLabel(surface.routeChecklist?.[0] ?? {
    label: "missing",
    route: "/missing",
    expected: "missing",
  }) ?? "", /iOS \+ Android native screenshot required/);
});

test("routes Incident Composer QA into the detail-first incident flow", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const surface = surfaces.find((item) => item.id === "incident-composer");

  assert.ok(surface);
  assert.equal(surface.route, "/log?type=incident&detail=1&intent=incident-composer");
  assert.doesNotMatch(surface.route, /^\/log\?type=incident$/);
  assert.match(surface.devicePrompt, /Incident detail flow/);
  assert.match(surface.verificationSteps.join("\n"), /detail-first safety composer/);
});

test("keeps Phoenix Home long-press to Avatar Studio in native QA", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const home = surfaces.find((item) => item.id === "phoenix-home");
  const ownerLoop = surfaces.find((item) => item.id === "owner-preview-core-loop");

  assert.ok(home);
  assert.match(home.devicePrompt, /long-press Studio handoff/);
  assert.match(home.verificationSteps.join("\n"), /Long press the main Phoenix room/);
  assert.match(home.verificationSteps.join("\n"), /Avatar Studio/);
  assert.match(home.acceptanceCriteria.join("\n"), /long press opens Avatar Studio/);
  assert.match(home.requiredEvidence.join("\n"), /long-press-to-Studio/);
  assert.ok(ownerLoop);
  assert.match(ownerLoop.routeChecklist?.[0]?.expected ?? "", /long-press-to-Studio/);
});

test("keeps the Home mission deck as a launch-critical device QA target", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const surface = surfaces.find((item) => item.id === "home-mission-deck");

  assert.ok(surface);
  assert.equal(surface.route, "/");
  assert.equal(surface.priority, "launch-critical");
  assert.match(surface.goal, /care-RPG mission deck/);
  assert.match(surface.devicePrompt, /small iOS and Android phones/);
  assert.match(surface.devicePrompt, /floating paw nav/);
  assert.match(surface.setupSteps.join("\n"), /Create a meal served with outcome pending/);
  assert.match(surface.setupSteps.join("\n"), /Start a walk or Alone Time session/);
  assert.match(surface.verificationSteps.join("\n"), /Tap the pending meal mission/);
  assert.match(surface.verificationSteps.join("\n"), /Adventure, Health, and Care Pass/);
  assert.match(surface.acceptanceCriteria.join("\n"), /No mission row is hidden behind the floating paw nav/);
  assert.match(surface.acceptanceCriteria.join("\n"), /Every mission row routes to the named care workflow/);
  assert.match(surface.failureEscalation, /Mark Needs tune/);
  assert.match(surface.failureEscalation, /first blocked row or overflow/);
  assert.match(surface.requiredEvidence.join("\n"), /iOS screenshot of the compact Home mission deck/);
  assert.match(surface.requiredEvidence.join("\n"), /Android screenshot of the compact Home mission deck/);
  assert.match(surface.requiredEvidence.join("\n"), /pending meal routes to Meal Log/);
  assert.match(surface.requiredEvidence.join("\n"), /Care Pass routes to Records/);
  assert.match(surface.launchRisk, /dead ends/);
});

test("keeps the owner preview core loop as a launch-critical beta QA target", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const surface = surfaces.find((item) => item.id === "owner-preview-core-loop");

  assert.ok(surface);
  assert.equal(surface.route, "/");
  assert.equal(surface.priority, "launch-critical");
  assert.match(surface.goal, /main beta loop/);
  assert.match(surface.goal, /Home, Log, Plans, Health, More/);
  assert.match(surface.goal, /Adventure/);
  assert.match(surface.devicePrompt, /bottom-nav owner preview/);
  assert.match(surface.devicePrompt, /Adventure Mode/);
  assert.match(surface.devicePrompt, /Launch Readiness/);
  assert.match(surface.setupSteps.join("\n"), /provider, payment, storage, AI, and store gates/);
  assert.match(surface.verificationSteps.join("\n"), /Open Home, Log, Plans, Health, and More in order/);
  assert.match(surface.verificationSteps.join("\n"), /quick-log one safe care event/);
  assert.match(surface.verificationSteps.join("\n"), /Health Watch and Bile Watch/);
  assert.match(surface.verificationSteps.join("\n"), /Review packet/);
  assert.match(surface.verificationSteps.join("\n"), /Draft vet questions/);
  assert.match(surface.verificationSteps.join("\n"), /Adventure Mode/);
  assert.match(surface.verificationSteps.join("\n"), /Records, Avatar Studio, and Care Pass/);
  assert.match(surface.verificationSteps.join("\n"), /Report History storage status/);
  assert.match(surface.acceptanceCriteria.join("\n"), /bottom-nav loop never hides the active action/);
  assert.match(surface.acceptanceCriteria.join("\n"), /Adventure Mode/);
  assert.match(surface.acceptanceCriteria.join("\n"), /provider setup, store approval, payments, AI, and storage boundaries/);
  assert.match(surface.acceptanceCriteria.join("\n"), /Saved on this device|Ready to upload/);
  assert.match(surface.failureEscalation, /keyboard\/modal overlap/);
  assert.match(surface.failureEscalation, /Adventure/);
  assert.match(surface.failureEscalation, /claims provider\/store\/payment\/AI\/storage readiness/);
  assert.match(surface.requiredEvidence.join("\n"), /iOS screenshot of Quick Log or Log/);
  assert.match(surface.requiredEvidence.join("\n"), /Android screenshot of Launch Readiness/);
  assert.match(surface.requiredEvidence.join("\n"), /Adventure Mode/);
  assert.match(surface.requiredEvidence.join("\n"), /without dead ends/);
  assert.match(surface.requiredEvidence.join("\n"), /Report History storage status/);
  assert.deepEqual(
    surface.routeChecklist?.map((item) => item.label),
    ["Home", "Log", "Plans", "Health", "More", "Adventure", "Records", "Avatar Studio", "Care Pass"],
  );
  assert.match(surface.routeChecklist?.[1]?.expected ?? "", /Quick-log one safe care event/);
  assert.match(surface.routeChecklist?.[4]?.proof ?? "", /Launch Readiness/);
  assert.equal(surface.routeChecklist?.[5]?.route, "/adventure");
  assert.match(surface.routeChecklist?.[5]?.expected ?? "", /private care quests/);
  assert.match(surface.routeChecklist?.[8]?.expected ?? "", /sitter\/vet\/trainer handoff/);
  assert.match(surface.routeChecklist?.[8]?.expected ?? "", /Report History storage status/);
  assert.match(surface.routeChecklist?.[8]?.proof ?? "", /Care Pass Report History storage status/);
  assert.match(surface.launchRisk, /real owner beta journey/);
});

test("adds route-check proof to store screenshot QA surfaces", () => {
  const packet: StoreSubmissionPacket = {
    title: "WoofWatcher Store Submission Packet",
    buildName: "store-candidate",
    generatedAtLabel: "2026-06-30",
    submissionReady: false,
    verdictLabel: "Submission prep only",
    metadata: {
      appName: "WoofWatcher",
      subtitle: "Real care. Pixel heart.",
      shortDescription: "Dog care with a living pixel care twin.",
      fullDescription: "Store-safe dog care proof.",
      category: "Lifestyle",
      contentBoundary: "Owner-reviewed care organization only.",
    },
    keywords: ["dog care"],
    screenshotChecklist: [
      {
        screen: "Avatar Studio",
        requirement: "Show the PixelLab template/customization flow truthfully.",
        status: "needed",
      },
      {
        screen: "Privacy & Launch Gates",
        requirement: "Show launch-gate truth before submission.",
        status: "blocked",
      },
    ],
    reviewNotes: ["Prep only."],
    privacyDisclosures: ["No private data in screenshots."],
    blockedUntil: ["Native proof is still open."],
  };

  const surfaces = buildStoreSubmissionScreenshotQaSurfaces(packet);
  const avatar = surfaces.find((item) => item.id === "store-avatar-studio");
  const privacy = surfaces.find((item) => item.id === "store-privacy-launch-gates");

  assert.ok(avatar);
  assert.equal(avatar.route, "/portrait");
  assert.deepEqual(avatar.routeChecklist?.map((item) => item.label), ["Avatar Studio store frame"]);
  assert.equal(avatar.routeChecklist?.[0]?.route, "/portrait");
  assert.match(avatar.routeChecklist?.[0]?.expected ?? "", /PixelLab template\/customization flow/);
  assert.match(avatar.routeChecklist?.[0]?.expected ?? "", /Template-fitted/);
  assert.match(avatar.routeChecklist?.[0]?.proof ?? "", /iOS and Android store screenshots/);
  assert.match(avatar.routeChecklist?.[0]?.proof ?? "", /store note/);

  assert.ok(privacy);
  assert.equal(privacy.route, "/privacy");
  assert.equal(privacy.priority, "launch-critical");
  assert.deepEqual(privacy.routeChecklist?.map((item) => item.label), ["Privacy & Launch Gates store frame"]);
  assert.match(privacy.routeChecklist?.[0]?.expected ?? "", /blocked launch gate visible/);
  assert.match(privacy.routeChecklist?.[0]?.proof ?? "", /blocker note/);
});

test("summarizes mobile release QA review status and screenshot evidence", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const reviews: MobileReleaseQaReview[] = [
    {
      surfaceId: "phoenix-home",
      status: "pass",
      screenshotEvidence: [
        {
          uri: "file:///qa/ios-home.png",
          fileName: "ios-home.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-20T12:01:00.000Z",
        },
        {
          uri: "file:///qa/ios-home-2.png",
          fileName: "ios-home-2.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-20T12:02:00.000Z",
        },
      ],
    },
    { surfaceId: "phoenix-home", status: "needs-review", note: "Duplicate stale review should not double count." },
    { surfaceId: "avatar-studio", status: "needs-review", note: "Mixed Breed sprite clips at the bottom." },
    { surfaceId: "unknown-surface", status: "pass" },
  ];

  const summary = summarizeMobileReleaseQaReviews(surfaces, reviews);

  assert.equal(summary.total, surfaces.length);
  assert.equal(summary.passed, 1);
  assert.equal(summary.passedWithRequiredProof, 0);
  assert.equal(summary.passPendingProof, 1);
  assert.equal(summary.needsReview, 1);
  assert.equal(summary.unreviewed, surfaces.length - 2);
  assert.ok(summary.requiredScreenshots >= surfaces.length);
  assert.equal(summary.attachedScreenshots, 2);
  assert.ok(summary.requiredIosScreenshots > 0);
  assert.ok(summary.requiredAndroidScreenshots > 0);
  assert.equal(summary.attachedIosScreenshots, 2);
  assert.equal(summary.attachedAndroidScreenshots, 0);
  assert.equal(summary.missingIosScreenshots, Math.max(0, summary.requiredIosScreenshots - 2));
  assert.equal(summary.missingAndroidScreenshots, summary.requiredAndroidScreenshots);
  assert.ok(summary.missingScreenshots > 0);
  assert.equal(mobileReleaseQaScreenshotEvidenceComplete(summary), false);
  assert.match(formatMobileReleaseQaMissingEvidence(summary), /Missing/);
  assert.match(formatMobileReleaseQaPlatformEvidence(summary), /iOS 2\/\d+, Android 0\/\d+, flexible 0\/\d+/);
});

test("keeps passed release QA surfaces pending until required proof and notes are attached", () => {
  const surface = {
    id: "owner-preview-core-loop",
    title: "Owner Preview Core Loop",
    route: "/",
    priority: "launch-critical",
    goal: "Verify the owner loop.",
    devicePrompt: "Run the owner route loop.",
    setupSteps: ["Use local preview data."],
    verificationSteps: ["Open Home.", "Open Log.", "Open More."],
    acceptanceCriteria: ["No route dead-ends."],
    failureEscalation: "Mark Needs tune if any route clips or dead-ends.",
    requiredEvidence: [
      "iOS screenshot of Quick Log or Log.",
      "Android screenshot of Launch Readiness from More.",
      "Note confirming Home, Log, Plans, Health, More, Adventure, Records, Avatar Studio, and Care Pass had no dead ends.",
    ],
    launchRisk: "This is the beta owner path.",
  } as const;
  const pendingPass: MobileReleaseQaReview = {
    surfaceId: "owner-preview-core-loop",
    status: "pass",
    screenshotEvidence: [
      {
        uri: "file:///qa/ios-log.png",
        fileName: "ios-log.png",
        source: "library",
        targetPlatform: "ios",
        capturedAtIso: "2026-06-30T12:00:00.000Z",
      },
    ],
  };
  const completePass: MobileReleaseQaReview = {
    surfaceId: "owner-preview-core-loop",
    status: "pass",
    note: "Home, Log, Plans, Health, More, Adventure, Records, Avatar Studio, and Care Pass had no dead ends.",
    screenshotEvidence: [
      {
        uri: "file:///qa/ios-log.png",
        fileName: "ios-log.png",
        source: "library",
        targetPlatform: "ios",
        capturedAtIso: "2026-06-30T12:00:00.000Z",
      },
      {
        uri: "file:///qa/android-launch-readiness.png",
        fileName: "android-launch-readiness.png",
        source: "library",
        targetPlatform: "android",
        capturedAtIso: "2026-06-30T12:02:00.000Z",
      },
    ],
  };

  assert.equal(mobileReleaseQaReviewStatusLabel(surface, pendingPass), "Pass pending proof");
  assert.deepEqual(mobileReleaseQaMissingEvidenceForSurface(surface, pendingPass), [
    "Attach 1 Android screenshot for Owner Preview Core Loop.",
    "Add QA note for Owner Preview Core Loop.",
  ]);
  assert.equal(mobileReleaseQaReviewStatusLabel(surface, completePass), "Pass");
  assert.deepEqual(mobileReleaseQaMissingEvidenceForSurface(surface, completePass), []);

  assert.deepEqual(summarizeMobileReleaseQaReviews([surface], [pendingPass]), {
    total: 1,
    passed: 1,
    passedWithRequiredProof: 0,
    passPendingProof: 1,
    needsReview: 0,
    unreviewed: 0,
    requiredScreenshots: 2,
    requiredIosScreenshots: 1,
    requiredAndroidScreenshots: 1,
    requiredAnyScreenshots: 0,
    attachedScreenshots: 1,
    attachedIosScreenshots: 1,
    attachedAndroidScreenshots: 0,
    attachedOtherScreenshots: 0,
    missingScreenshots: 1,
    missingIosScreenshots: 0,
    missingAndroidScreenshots: 1,
    missingAnyScreenshots: 0,
  });
});

test("keeps flexible screenshot slots separate from required iOS and Android proof", () => {
  const surfaces = [
    {
      id: "home",
      title: "Home",
      route: "/",
      priority: "launch-critical",
      goal: "Check both native platforms.",
      devicePrompt: "Open on both phones.",
      verificationSteps: ["Open Home.", "Capture iOS and Android screenshots."],
      requiredEvidence: [
        "iOS screenshot of Home.",
        "Android screenshot of Home.",
        "Screenshot of shared report.",
      ],
      launchRisk: "Native gaps are easy to miss.",
    },
  ] as const;

  const iosOnly = summarizeMobileReleaseQaReviews(surfaces, [
    {
      surfaceId: "home",
      status: "pass",
      screenshotEvidence: [
        {
          uri: "file:///qa/home-ios-1.png",
          fileName: "home-ios-1.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-20T12:01:00.000Z",
        },
        {
          uri: "file:///qa/home-ios-2.png",
          fileName: "home-ios-2.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-20T12:02:00.000Z",
        },
      ],
    },
  ]);

  assert.equal(iosOnly.missingIosScreenshots, 0);
  assert.equal(iosOnly.missingAndroidScreenshots, 1);
  assert.equal(iosOnly.missingAnyScreenshots, 0);
  assert.equal(mobileReleaseQaFlexibleScreenshotSlotsSatisfied(iosOnly), 1);
  assert.equal(mobileReleaseQaScreenshotEvidenceComplete(iosOnly), false);
  assert.equal(formatMobileReleaseQaMissingEvidence(iosOnly), "Missing 1 Android");
  assert.equal(formatMobileReleaseQaPlatformEvidence(iosOnly), "iOS 2/1, Android 0/1, flexible 1/1");

  const complete = summarizeMobileReleaseQaReviews(surfaces, [
    {
      surfaceId: "home",
      status: "pass",
      screenshotEvidence: [
        {
          uri: "file:///qa/home-ios.png",
          fileName: "home-ios.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-20T12:01:00.000Z",
        },
        {
          uri: "file:///qa/home-android.png",
          fileName: "home-android.png",
          source: "library",
          targetPlatform: "android",
          capturedAtIso: "2026-06-20T12:02:00.000Z",
        },
        {
          uri: "file:///qa/home-report.png",
          fileName: "home-report.png",
          source: "library",
          targetPlatform: "unknown",
          capturedAtIso: "2026-06-20T12:03:00.000Z",
        },
      ],
    },
  ]);

  assert.equal(mobileReleaseQaScreenshotEvidenceComplete(complete), true);
  assert.equal(formatMobileReleaseQaMissingEvidence(complete), "All required platform evidence attached");
});

test("turns the store submission screenshot checklist into device QA surfaces", () => {
  const packet: StoreSubmissionPacket = {
    title: "WoofWatcher Store Submission Packet",
    buildName: "candidate",
    generatedAtLabel: "Jun 21, 2026",
    submissionReady: false,
    verdictLabel: "Submission prep only",
    metadata: {
      appName: "WoofWatcher",
      subtitle: "Real care. Pixel heart.",
      shortDescription: "Dog care, logs, records, and a living pixel care twin.",
      fullDescription: "Store draft.",
      category: "Lifestyle",
      contentBoundary: "Owner-reviewed care organization only.",
    },
    keywords: ["dog care"],
    screenshotChecklist: [
      {
        screen: "Phoenix Home",
        requirement: "Capture iOS and Android hero screenshots showing the pixel care twin.",
        status: "needed",
      },
      {
        screen: "Avatar Studio",
        requirement: "Capture Template overlay readiness with Template-fitted and Pack pending accessory labels visible.",
        status: "needed",
      },
      {
        screen: "Health Watch",
        requirement: "Capture Health Review Packet with Vet-share checklist and Draft vet questions visible.",
        status: "needed",
      },
      {
        screen: "Privacy & Launch Gates",
        requirement: "Capture export, deletion request, support runbook, and launch-gate truth before submission.",
        status: "blocked",
      },
    ],
    reviewNotes: ["Not approved for App Store or Play Store submission."],
    privacyDisclosures: ["Care logs may be stored."],
    blockedUntil: ["Native iOS/Android QA evidence is not attached."],
  };

  const surfaces = buildStoreSubmissionScreenshotQaSurfaces(packet);
  const ids = surfaces.map((surface) => surface.id);

  assert.deepEqual(ids, ["store-phoenix-home", "store-avatar-studio", "store-health-watch", "store-privacy-launch-gates"]);
  assert.equal(surfaces[0].route, "/");
  assert.equal(surfaces[1].route, "/portrait");
  assert.equal(surfaces[2].route, "/health");
  assert.equal(surfaces[3].route, "/privacy");
  assert.equal(surfaces[0].priority, "release-polish");
  assert.equal(surfaces[3].priority, "launch-critical");
  assert.match(surfaces[0].title, /Store: Phoenix Home/);
  assert.match(surfaces[0].devicePrompt, /App Store and Play Store/);
  assert.match(surfaces[0].setupSteps.join("\n"), /Use demo-safe or scrubbed household data/);
  assert.match(surfaces[1].setupSteps.join("\n"), /Open Customize and keep Template overlay readiness visible/);
  assert.match(surfaces[1].verificationSteps.join("\n"), /Template-fitted/);
  assert.match(surfaces[1].verificationSteps.join("\n"), /Pack pending/);
  assert.match(surfaces[1].acceptanceCriteria.join("\n"), /overlay-fit truth/);
  assert.match(surfaces[1].requiredEvidence.join("\n"), /Template overlay readiness panel/);
  assert.match(surfaces[2].setupSteps.join("\n"), /Open Health and keep Review packet visible/);
  assert.match(surfaces[2].verificationSteps.join("\n"), /Vet-share checklist/);
  assert.match(surfaces[2].verificationSteps.join("\n"), /Draft vet questions/);
  assert.match(surfaces[2].acceptanceCriteria.join("\n"), /Health Review Packet/);
  assert.match(surfaces[2].requiredEvidence.join("\n"), /Review packet with Vet-share checklist/);
  assert.match(surfaces[3].setupSteps.join("\n"), /Leave the blocker visible/);
  assert.match(surfaces[0].verificationSteps.join("\n"), /Open \//);
  assert.match(surfaces[0].verificationSteps.join("\n"), /Do not show private household data/);
  assert.match(surfaces[0].acceptanceCriteria.join("\n"), /No private household data/);
  assert.match(surfaces[0].acceptanceCriteria.join("\n"), /No provider claim appears unless the matching gate is actually closed/);
  assert.match(surfaces[3].failureEscalation, /do not stage a fake finished screenshot/);
  assert.match(surfaces[0].requiredEvidence.join("\n"), /iOS screenshot for store packet/);
  assert.match(surfaces[0].requiredEvidence.join("\n"), /Android screenshot for store packet/);
  assert.match(surfaces[3].launchRisk, /blocked/);
});

test("builds a release QA share report with the screenshot boundary intact", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const reviews: MobileReleaseQaReview[] = [
    {
      surfaceId: "phoenix-home",
      status: "pass",
      screenshotEvidence: [
        {
          uri: "file:///qa/ios-home.png",
          fileName: "ios-home.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-20T12:01:00.000Z",
        },
      ],
    },
    { surfaceId: "records-incident-watch", status: "needs-review", note: "Follow-up row needs larger touch target." },
  ];

  const text = buildMobileReleaseQaShareText(surfaces, reviews, "2026-06-20T12:00:00.000Z");

  assert.match(text, /WoofWatcher Mobile Release QA/);
  assert.match(text, /Summary: 1\/\d+ passed, 0 proof-backed pass, 1 pass pending proof/);
  assert.match(text, /Phoenix Home: Pass pending proof/);
  assert.match(text, /Missing proof: Attach 1 Android screenshot for Phoenix Home/);
  assert.match(text, /Records Incident Watch: Needs tune/);
  assert.match(text, /Follow-up row needs larger touch target/);
  assert.match(text, /Required screenshot slots:/);
  assert.match(text, /Setup:/);
  assert.match(text, /Use a local preview household with Phoenix sample care data/);
  assert.match(text, /Steps:/);
  assert.match(text, /Confirm Phoenix Home answers presence, feeling, next care, and quick logging/);
  assert.match(text, /Pass criteria:/);
  assert.match(text, /main Phoenix sprite reacts without a second avatar/);
  assert.match(text, /Needs tune if:/);
  assert.match(text, /duplicate avatar/);
  assert.match(text, /Screenshot evidence: 1 attached/);
  assert.match(text, /Platform evidence: iOS 1\/\d+, Android 0\/\d+, flexible 0\/\d+/);
  assert.match(text, /Evidence gap: Missing/);
  assert.match(text, /Screenshots: ios-home\.png \(iOS\)/);
  assert.match(text, /does not replace attached iOS\/Android screenshots/);
});

test("uses owner-readable release QA labels", () => {
  assert.equal(mobileReleaseQaStatusLabel("pass"), "Pass");
  assert.equal(mobileReleaseQaStatusLabel("needs-review"), "Needs tune");
  assert.equal(mobileReleaseQaStatusLabel("unreviewed"), "Unreviewed");
  assert.equal(
    mobileReleaseQaReviewStatusLabel(
      {
        id: "home",
        title: "Home",
        route: "/",
        priority: "launch-critical",
        goal: "Check Home.",
        devicePrompt: "Open Home.",
        setupSteps: ["Open Home."],
        verificationSteps: ["Review Home."],
        acceptanceCriteria: ["Home is readable."],
        failureEscalation: "Mark Needs tune if Home clips.",
        requiredEvidence: ["iOS screenshot of Home."],
        launchRisk: "Home is the first impression.",
      },
      { surfaceId: "home", status: "pass" },
    ),
    "Pass pending proof",
  );
});

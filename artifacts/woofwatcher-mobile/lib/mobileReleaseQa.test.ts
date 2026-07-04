import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildRouteVisualProofManifest,
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
  assert.ok(ids.includes("auth-setup-onboarding-proof"));
  assert.ok(ids.includes("care-entry-provider-sync-proof"));
  assert.ok(ids.includes("push-notifications-proof"));
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

test("builds a route visual proof manifest from native screenshot evidence", () => {
  const surface = listMobileReleaseQaSurfaces().find((item) => item.id === "route-visual-consistency");

  assert.ok(surface);
  const pending = buildRouteVisualProofManifest({ surface });
  assert.equal(pending.title, "Route visual proof manifest");
  assert.equal(pending.status, "blocked");
  assert.equal(pending.statusLabel, "Native proof blocked");
  assert.equal(pending.rows.length, 6);
  assert.deepEqual(pending.rows.map((row) => row.label), ["Home", "Log", "Plans", "Health", "Records", "More"]);
  assert.match(pending.rows[0]?.iosStatus ?? "", /iOS Home screenshot pending/);
  assert.match(pending.rows[0]?.androidStatus ?? "", /Android Home screenshot pending/);
  assert.match(pending.blockers.join("\n"), /Home: iOS Home screenshot pending/);
  assert.match(pending.blockers.join("\n"), /QA note pending/);
  assert.match(pending.webPreviewBoundary, /does not replace native iOS\/Android route screenshots/);

  const complete = buildRouteVisualProofManifest({
    surface,
    note: "No route-to-route design break found.",
    evidence: [
      ...["home", "log", "plans", "health", "records", "more"].map((route) => ({
        uri: `file:///qa/${route}-ios.png`,
        fileName: `${route}-ios.png`,
        source: "library" as const,
        targetPlatform: "ios" as const,
        capturedAtIso: "2026-07-03T12:00:00.000Z",
      })),
      ...["home", "log", "plans", "health", "records", "more"].map((route) => ({
        uri: `file:///qa/${route}-android.png`,
        fileName: `${route}-android.png`,
        source: "library" as const,
        targetPlatform: "android" as const,
        capturedAtIso: "2026-07-03T12:00:00.000Z",
      })),
    ],
  });
  assert.equal(complete.status, "ready");
  assert.equal(complete.statusLabel, "Native visual proof complete");
  assert.equal(complete.blockers.length, 0);
  assert.match(complete.rows[5]?.androidStatus ?? "", /Android More screenshot attached: more-android\.png/);
});

test("keeps route visual proof blocked until screenshots are route-named", () => {
  const surface = listMobileReleaseQaSurfaces().find((item) => item.id === "route-visual-consistency");

  assert.ok(surface);
  const manifest = buildRouteVisualProofManifest({
    surface,
    note: "No route-to-route design break found.",
    evidence: [
      ...Array.from({ length: 6 }, (_, index) => ({
        uri: `file:///qa/native-ios-${index + 1}.png`,
        fileName: `native-ios-${index + 1}.png`,
        source: "library" as const,
        targetPlatform: "ios" as const,
        capturedAtIso: "2026-07-03T12:00:00.000Z",
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        uri: `file:///qa/native-android-${index + 1}.png`,
        fileName: `native-android-${index + 1}.png`,
        source: "library" as const,
        targetPlatform: "android" as const,
        capturedAtIso: "2026-07-03T12:00:00.000Z",
      })),
    ],
  });

  assert.equal(manifest.attachedIosScreenshots, 6);
  assert.equal(manifest.attachedAndroidScreenshots, 6);
  assert.equal(manifest.status, "blocked");
  assert.match(manifest.rows[0]?.iosStatus ?? "", /iOS Home screenshot pending/);
  assert.match(manifest.rows[5]?.androidStatus ?? "", /Android More screenshot pending/);
  assert.match(manifest.blockers.join("\n"), /Home: iOS Home screenshot pending/);
  assert.match(manifest.blockers.join("\n"), /More: Android More screenshot pending/);
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
  assert.match(surface.acceptanceCriteria.join("\n"), /Saved on this device/);
  assert.match(surface.acceptanceCriteria.join("\n"), /Ready to upload only after provider-approved storage/);
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

test("adds a launch-critical auth and setup onboarding proof target", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const ids = surfaces.map((surface) => surface.id);
  const surface = surfaces.find((item) => item.id === "auth-setup-onboarding-proof");

  assert.ok(surface);
  assert.ok(
    ids.indexOf("auth-setup-onboarding-proof") > ids.indexOf("owner-preview-core-loop"),
    "Auth/setup proof should follow the owner loop in the focused launch targets",
  );
  assert.ok(
    ids.indexOf("auth-setup-onboarding-proof") < ids.indexOf("records-local-file-handoff"),
    "Auth/setup proof should stay visible before Records handoff proof",
  );
  assert.equal(surface.title, "Auth And Setup Onboarding Proof");
  assert.equal(surface.route, "/sign-in");
  assert.equal(surface.priority, "launch-critical");
  assert.match(surface.goal, /account gateway/);
  assert.match(surface.goal, /first-run setup/);
  assert.match(surface.devicePrompt, /iOS and Android/);
  assert.match(surface.devicePrompt, /provider-backed auth stays blocked/);
  assert.match(surface.setupSteps.join("\n"), /structured Clerk/);
  assert.match(surface.setupSteps.join("\n"), /Local preview household setup/);
  assert.match(surface.verificationSteps.join("\n"), /Open \/sign-in/);
  assert.match(surface.verificationSteps.join("\n"), /Open \/setup/);
  assert.match(surface.verificationSteps.join("\n"), /Local preview/);
  assert.match(surface.acceptanceCriteria.join("\n"), /provider-backed auth/);
  assert.match(surface.acceptanceCriteria.join("\n"), /household creation/);
  assert.match(surface.failureEscalation, /claims cross-device account sync/);
  assert.match(surface.requiredEvidence.join("\n"), /iOS screenshot of Auth gateway/);
  assert.match(surface.requiredEvidence.join("\n"), /Android screenshot of Setup/);
  assert.match(surface.requiredEvidence.join("\n"), /Structured auth provider proof files/);
  assert.match(surface.requiredEvidence.join("\n"), /Apollo auth launch approval/);
  assert.deepEqual(surface.routeChecklist?.map((item) => item.label), [
    "Auth gateway",
    "First-run setup",
  ]);
  assert.equal(surface.routeChecklist?.[0]?.route, "/sign-in");
  assert.equal(surface.routeChecklist?.[1]?.route, "/setup");
  assert.ok(surface.routeChecklist?.every((item) => item.requiredNativePlatforms?.join(",") === "ios,android"));
  assert.match(surface.routeChecklist?.[0]?.proof ?? "", /iOS \+ Android native screenshot required/);
  assert.match(surface.routeChecklist?.[1]?.proof ?? "", /local preview setup note/);
  assert.match(surface.launchRisk, /account entry/);
});

test("adds a launch-critical Records local file handoff proof target", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const ids = surfaces.map((surface) => surface.id);
  const surface = surfaces.find((item) => item.id === "records-local-file-handoff");

  assert.ok(surface);
  assert.ok(
    ids.indexOf("records-local-file-handoff") > ids.indexOf("owner-preview-core-loop"),
    "Records local file handoff should follow the owner loop in the first native QA targets",
  );
  assert.ok(
    ids.indexOf("records-local-file-handoff") < ids.indexOf("route-visual-consistency"),
    "Records local file handoff should stay visible before broad route screenshot work",
  );
  assert.equal(surface.title, "Records Local File Handoff");
  assert.equal(surface.route, "/records");
  assert.equal(surface.priority, "launch-critical");
  assert.match(surface.goal, /Care Pass Report History local HTML/);
  assert.match(surface.goal, /Dog ID local HTML and SVG/);
  assert.match(surface.devicePrompt, /iOS and Android/);
  assert.match(surface.devicePrompt, /share sheet/);
  assert.match(surface.devicePrompt, /Android content URI/);
  assert.match(surface.setupSteps.join("\n"), /WoofWatcherReports/);
  assert.match(surface.setupSteps.join("\n"), /WoofWatcherCredentials/);
  assert.match(surface.verificationSteps.join("\n"), /Care Pass Report History/);
  assert.match(surface.verificationSteps.join("\n"), /Printable HTML local file/);
  assert.match(surface.verificationSteps.join("\n"), /Dog ID local HTML credential/);
  assert.match(surface.verificationSteps.join("\n"), /SVG image source/);
  assert.match(surface.verificationSteps.join("\n"), /Android content URI/);
  assert.match(surface.verificationSteps.join("\n"), /fallback copy/);
  assert.match(surface.acceptanceCriteria.join("\n"), /Saved on this device/);
  assert.match(surface.acceptanceCriteria.join("\n"), /Ready to upload only after provider-approved storage/);
  assert.match(surface.acceptanceCriteria.join("\n"), /Generated PDF\/PNG proof is handled by Report Binary Export Proof/);
  assert.match(surface.acceptanceCriteria.join("\n"), /provider-backed storage/);
  assert.match(surface.failureEscalation, /provider-backed/);
  assert.match(surface.failureEscalation, /PNG\/PDF/);
  assert.match(surface.requiredEvidence.join("\n"), /iOS screenshot of Care Pass Report History/);
  assert.match(surface.requiredEvidence.join("\n"), /Android screenshot of Dog ID/);
  assert.match(surface.requiredEvidence.join("\n"), /Note confirming WoofWatcherReports/);
  assert.match(surface.requiredEvidence.join("\n"), /Note confirming WoofWatcherCredentials/);
  assert.deepEqual(surface.routeChecklist?.map((item) => item.label), [
    "Care Pass Report History local HTML",
    "Dog ID local HTML credential",
    "Dog ID SVG image source",
  ]);
  assert.ok(surface.routeChecklist?.every((item) => item.route === "/records"));
  assert.match(surface.routeChecklist?.[0]?.proof ?? "", /iOS \+ Android share-sheet proof/);
  assert.match(surface.routeChecklist?.[1]?.proof ?? "", /Android content URI/);
  assert.match(surface.routeChecklist?.[2]?.proof ?? "", /SVG image source/);
  assert.match(surface.launchRisk, /beta handoff cannot claim Records export proof/);
});

test("adds a launch-critical report binary export proof target", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const ids = surfaces.map((surface) => surface.id);
  const surface = surfaces.find((item) => item.id === "report-binary-export-proof");

  assert.ok(surface);
  assert.ok(
    ids.indexOf("report-binary-export-proof") > ids.indexOf("records-local-file-handoff"),
    "Report binary export proof should follow the local Records handoff target",
  );
  assert.ok(
    ids.indexOf("report-binary-export-proof") < ids.indexOf("route-visual-consistency"),
    "Report binary export proof should stay visible before broad route screenshot work",
  );
  assert.equal(surface.title, "Report Binary Export Proof");
  assert.equal(surface.route, "/more");
  assert.equal(surface.priority, "launch-critical");
  assert.match(surface.goal, /local Care Pass PDF/);
  assert.match(surface.goal, /Dog ID PNG bytes/);
  assert.match(surface.goal, /native share\/reopen/);
  assert.match(surface.goal, /structured provider storage evidence/);
  assert.match(surface.devicePrompt, /Provider Launch Setup/);
  assert.match(surface.devicePrompt, /iOS and Android/);
  assert.match(surface.setupSteps.join("\n"), /storage gate/);
  assert.match(surface.setupSteps.join("\n"), /generated Care Pass PDF action/);
  assert.match(surface.setupSteps.join("\n"), /generated Dog ID PNG action/);
  assert.match(surface.verificationSteps.join("\n"), /Records and media storage/);
  assert.match(surface.verificationSteps.join("\n"), /Care Pass PDF/);
  assert.match(surface.verificationSteps.join("\n"), /Dog ID PNG/);
  assert.match(surface.verificationSteps.join("\n"), /file name, file size, MIME/);
  assert.match(surface.acceptanceCriteria.join("\n"), /No PDF\/PNG readiness/);
  assert.match(surface.acceptanceCriteria.join("\n"), /iOS and Android/);
  assert.match(surface.failureEscalation, /HTML-only fallback/);
  assert.match(surface.failureEscalation, /provider storage/);
  assert.match(surface.requiredEvidence.join("\n"), /iOS screenshot of Provider Launch Setup/);
  assert.match(surface.requiredEvidence.join("\n"), /Android screenshot of generated PDF and PNG artifact proof/);
  assert.match(surface.requiredEvidence.join("\n"), /Note confirming local Care Pass PDF bytes/);
  assert.match(surface.requiredEvidence.join("\n"), /local Dog ID PNG bytes/);
  assert.match(surface.requiredEvidence.join("\n"), /Structured provider storage proof file/);
  assert.match(surface.requiredEvidence.join("\n"), /approval booleans/);
  assert.deepEqual(surface.routeChecklist?.map((item) => item.label), [
    "Provider Launch Setup storage gate",
    "Care Pass PDF artifact proof",
    "Dog ID PNG artifact proof",
  ]);
  assert.equal(surface.routeChecklist?.[0]?.route, "/more");
  assert.equal(surface.routeChecklist?.[1]?.route, "/records");
  assert.equal(surface.routeChecklist?.[2]?.route, "/records");
  assert.match(surface.routeChecklist?.[0]?.proof ?? "", /Structured provider storage proof file/);
  assert.match(surface.routeChecklist?.[1]?.proof ?? "", /iOS and Android generated PDF proof/);
  assert.match(surface.routeChecklist?.[2]?.proof ?? "", /iOS and Android generated PNG proof/);
  assert.match(surface.launchRisk, /binary export readiness can be claimed/);
});

test("adds a launch-critical care-entry provider sync proof target", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const ids = surfaces.map((surface) => surface.id);
  const surface = surfaces.find((item) => item.id === "care-entry-provider-sync-proof");

  assert.ok(surface);
  assert.ok(
    ids.indexOf("care-entry-provider-sync-proof") > ids.indexOf("report-binary-export-proof"),
    "Care-entry provider sync proof should follow binary export proof in the focused launch targets",
  );
  assert.ok(
    ids.indexOf("care-entry-provider-sync-proof") < ids.indexOf("route-visual-consistency"),
    "Care-entry provider sync proof should stay visible before broad route screenshot work",
  );
  assert.equal(surface.title, "Care-entry Provider Sync Proof");
  assert.equal(surface.route, "/more");
  assert.equal(surface.priority, "launch-critical");
  assert.match(surface.goal, /structured Supabase project/);
  assert.match(surface.goal, /migration\/backfill/);
  assert.match(surface.goal, /active-household RLS/);
  assert.match(surface.goal, /incremental care-entry sync/);
  assert.match(surface.devicePrompt, /Provider Launch Setup/);
  assert.match(surface.devicePrompt, /iOS and Android/);
  assert.match(surface.devicePrompt, /structured Household database sync proof files/);
  assert.match(surface.setupSteps.join("\n"), /Household database sync/);
  assert.match(surface.setupSteps.join("\n"), /full-refresh/);
  assert.match(surface.verificationSteps.join("\n"), /care_entries\.updated_at/);
  assert.match(surface.verificationSteps.join("\n"), /care_entry_tombstones/);
  assert.match(surface.verificationSteps.join("\n"), /\/care-entries\?updatedSince=/);
  assert.match(surface.verificationSteps.join("\n"), /\/care-entries\/tombstones\?updatedSince=/);
  assert.match(surface.acceptanceCriteria.join("\n"), /incremental sync stays blocked/);
  assert.match(surface.acceptanceCriteria.join("\n"), /retention\/export\/deletion/);
  assert.match(surface.failureEscalation, /RLS/);
  assert.match(surface.failureEscalation, /tombstone/);
  assert.match(surface.requiredEvidence.join("\n"), /iOS screenshot of Provider Launch Setup/);
  assert.match(surface.requiredEvidence.join("\n"), /Android screenshot of Provider Launch Setup/);
  assert.match(surface.requiredEvidence.join("\n"), /Supabase project id/);
  assert.match(surface.requiredEvidence.join("\n"), /mobile full-refresh sign-off/);
  assert.match(surface.requiredEvidence.join("\n"), /file names or URIs, MIME, byte size/);
  assert.match(surface.requiredEvidence.join("\n"), /row-specific approvals/);
  assert.deepEqual(surface.routeChecklist?.map((item) => item.label), [
    "Provider Launch Setup database gate",
    "Care-entry cursor route",
    "Care-entry tombstone route",
  ]);
  assert.equal(surface.routeChecklist?.[0]?.route, "/more");
  assert.equal(surface.routeChecklist?.[1]?.route, "/care-entries?updatedSince=");
  assert.equal(surface.routeChecklist?.[2]?.route, "/care-entries/tombstones?updatedSince=");
  assert.match(surface.routeChecklist?.[0]?.proof ?? "", /migration\/backfill/);
  assert.match(surface.routeChecklist?.[1]?.proof ?? "", /active-household RLS/);
  assert.match(surface.routeChecklist?.[2]?.proof ?? "", /tombstone RLS/);
  assert.match(surface.launchRisk, /cross-household/);
});

test("adds a launch-critical WoofGuide AI provider proof target", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const ids = surfaces.map((surface) => surface.id);
  const surface = surfaces.find((item) => item.id === "woofguide-ai-provider-proof");

  assert.ok(surface);
  assert.ok(
    ids.indexOf("woofguide-ai-provider-proof") > ids.indexOf("care-entry-provider-sync-proof"),
    "WoofGuide AI provider proof should follow provider sync proof in the focused launch targets",
  );
  assert.ok(
    ids.indexOf("woofguide-ai-provider-proof") < ids.indexOf("push-notifications-proof"),
    "WoofGuide AI provider proof should stay visible before push and payments proof work",
  );
  assert.equal(surface.title, "WoofGuide AI Provider Proof");
  assert.equal(surface.route, "/more");
  assert.equal(surface.priority, "launch-critical");
  assert.match(surface.goal, /OpenAI key location/);
  assert.match(surface.goal, /approved model policy/);
  assert.match(surface.goal, /owner-review write gate/);
  assert.match(surface.devicePrompt, /Provider Launch Setup/);
  assert.match(surface.devicePrompt, /WoofGuide/);
  assert.match(surface.setupSteps.join("\n"), /WoofGuide AI/);
  assert.match(surface.setupSteps.join("\n"), /deterministic\/fallback/);
  assert.match(surface.verificationSteps.join("\n"), /source\/citation rules/);
  assert.match(surface.verificationSteps.join("\n"), /veterinary safety boundary/);
  assert.match(surface.verificationSteps.join("\n"), /fallback\/incident handling/);
  assert.match(surface.acceptanceCriteria.join("\n"), /live AI stays blocked/);
  assert.match(surface.acceptanceCriteria.join("\n"), /permission-aware writes/);
  assert.match(surface.failureEscalation, /provider-backed AI/);
  assert.match(surface.requiredEvidence.join("\n"), /iOS screenshot of Provider Launch Setup/);
  assert.match(surface.requiredEvidence.join("\n"), /Android screenshot of WoofGuide/);
  assert.match(surface.requiredEvidence.join("\n"), /OpenAI key location/);
  assert.match(surface.requiredEvidence.join("\n"), /fallback\/incident handling/);
  assert.deepEqual(surface.routeChecklist?.map((item) => item.label), [
    "Provider Launch Setup WoofGuide AI gate",
    "WoofGuide model and key policy",
    "Source citations and owner-reviewed writes",
    "Veterinary safety and fallback handling",
  ]);
  assert.equal(surface.routeChecklist?.[0]?.route, "/more");
  assert.equal(surface.routeChecklist?.[1]?.route, "/woofguide");
  assert.equal(surface.routeChecklist?.[2]?.route, "/woofguide");
  assert.equal(surface.routeChecklist?.[3]?.route, "/woofguide");
  assert.match(surface.routeChecklist?.[0]?.proof ?? "", /WoofGuide AI provider proof packet/);
  assert.match(surface.routeChecklist?.[1]?.proof ?? "", /OpenAI key location/);
  assert.match(surface.routeChecklist?.[2]?.proof ?? "", /owner-review write gate/);
  assert.match(surface.routeChecklist?.[3]?.proof ?? "", /veterinary safety boundary/);
  assert.match(surface.launchRisk, /live AI can be enabled/);
});

test("adds a launch-critical push notifications proof target", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const ids = surfaces.map((surface) => surface.id);
  const surface = surfaces.find((item) => item.id === "push-notifications-proof");

  assert.ok(surface);
  assert.ok(
    ids.indexOf("push-notifications-proof") > ids.indexOf("care-entry-provider-sync-proof"),
    "Push notifications proof should follow provider sync proof in the focused launch targets",
  );
  assert.ok(
    ids.indexOf("push-notifications-proof") < ids.indexOf("route-visual-consistency"),
    "Push notifications proof should stay visible before broad route screenshot work",
  );
  assert.equal(surface.title, "Push Notifications Proof");
  assert.equal(surface.route, "/more");
  assert.equal(surface.priority, "launch-critical");
  assert.match(surface.goal, /Expo push project config/);
  assert.match(surface.goal, /APNs credentials/);
  assert.match(surface.goal, /Firebase\/FCM credentials/);
  assert.match(surface.devicePrompt, /Provider Launch Setup/);
  assert.match(surface.devicePrompt, /iOS and Android/);
  assert.match(surface.setupSteps.join("\n"), /Push notifications/);
  assert.match(surface.setupSteps.join("\n"), /quiet hours/);
  assert.match(surface.verificationSteps.join("\n"), /Expo push project config/);
  assert.match(surface.verificationSteps.join("\n"), /APNs credentials/);
  assert.match(surface.verificationSteps.join("\n"), /Firebase\/FCM credentials/);
  assert.match(surface.verificationSteps.join("\n"), /permission prompt/);
  assert.match(surface.verificationSteps.join("\n"), /delivery QA/);
  assert.match(surface.acceptanceCriteria.join("\n"), /reminder delivery stays blocked/);
  assert.match(surface.acceptanceCriteria.join("\n"), /opt-out behavior/);
  assert.match(surface.failureEscalation, /claims reminders are delivered/);
  assert.match(surface.requiredEvidence.join("\n"), /iOS screenshot of Provider Launch Setup/);
  assert.match(surface.requiredEvidence.join("\n"), /Android screenshot of Provider Launch Setup/);
  assert.match(surface.requiredEvidence.join("\n"), /Expo push project id/);
  assert.match(surface.requiredEvidence.join("\n"), /missed notification fallback/);
  assert.deepEqual(surface.routeChecklist?.map((item) => item.label), [
    "Provider Launch Setup push gate",
    "iOS APNs registration and delivery",
    "Android FCM registration and delivery",
    "Permission, quiet hours, and opt-out behavior",
  ]);
  assert.equal(surface.routeChecklist?.[0]?.route, "/more");
  assert.equal(surface.routeChecklist?.[1]?.route, "/calendar");
  assert.equal(surface.routeChecklist?.[2]?.route, "/calendar");
  assert.equal(surface.routeChecklist?.[3]?.route, "/calendar");
  assert.match(surface.routeChecklist?.[0]?.proof ?? "", /Expo push project id/);
  assert.match(surface.routeChecklist?.[1]?.proof ?? "", /APNs/);
  assert.match(surface.routeChecklist?.[2]?.proof ?? "", /Firebase\/FCM/);
  assert.match(surface.routeChecklist?.[3]?.proof ?? "", /quiet hours and opt-out/);
  assert.match(surface.launchRisk, /missed medication or care reminders/);
});

test("adds a launch-critical payments provider proof target", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const ids = surfaces.map((surface) => surface.id);
  const surface = surfaces.find((item) => item.id === "payments-provider-proof");

  assert.ok(surface);
  assert.ok(
    ids.indexOf("payments-provider-proof") > ids.indexOf("push-notifications-proof"),
    "Payments provider proof should follow push proof in the focused launch targets",
  );
  assert.ok(
    ids.indexOf("payments-provider-proof") < ids.indexOf("route-visual-consistency"),
    "Payments provider proof should stay visible before broad route screenshot work",
  );
  assert.equal(surface.title, "Payments Provider Proof");
  assert.equal(surface.route, "/more");
  assert.equal(surface.priority, "launch-critical");
  assert.match(surface.goal, /Plus and Family product ids/);
  assert.match(surface.goal, /sandbox receipt/);
  assert.match(surface.goal, /checkout gate/);
  assert.match(surface.devicePrompt, /Provider Launch Setup/);
  assert.match(surface.devicePrompt, /iOS and Android/);
  assert.match(surface.setupSteps.join("\n"), /Plus payments/);
  assert.match(surface.setupSteps.join("\n"), /checkout stays disabled/);
  assert.match(surface.verificationSteps.join("\n"), /Product catalog/);
  assert.match(surface.verificationSteps.join("\n"), /Billing path decision/);
  assert.match(surface.verificationSteps.join("\n"), /Sandbox receipt/);
  assert.match(surface.verificationSteps.join("\n"), /Entitlement mapping/);
  assert.match(surface.verificationSteps.join("\n"), /Refund and support policy/);
  assert.match(surface.acceptanceCriteria.join("\n"), /paid checkout stays blocked/);
  assert.match(surface.acceptanceCriteria.join("\n"), /restore purchases/);
  assert.match(surface.failureEscalation, /money movement/);
  assert.match(surface.requiredEvidence.join("\n"), /iOS screenshot of Provider Launch Setup/);
  assert.match(surface.requiredEvidence.join("\n"), /Android screenshot of Provider Launch Setup/);
  assert.match(surface.requiredEvidence.join("\n"), /Plus and Family product ids/);
  assert.match(surface.requiredEvidence.join("\n"), /iOS App Store and Android Google Play sandbox purchase, renewal, cancel, refund, expired receipt proof/);
  assert.match(surface.requiredEvidence.join("\n"), /restorePurchaseConfirmed/);
  assert.deepEqual(surface.routeChecklist?.map((item) => item.label), [
    "Provider Launch Setup payments gate",
    "Product catalog and billing path",
    "Sandbox receipts and restore purchases",
    "Entitlements, refunds, and checkout gate",
  ]);
  assert.equal(surface.routeChecklist?.[0]?.route, "/more");
  assert.equal(surface.routeChecklist?.[1]?.route, "/premium");
  assert.equal(surface.routeChecklist?.[2]?.route, "/premium");
  assert.equal(surface.routeChecklist?.[3]?.route, "/premium");
  assert.match(surface.routeChecklist?.[0]?.proof ?? "", /Provider Launch Setup screenshot/);
  assert.match(surface.routeChecklist?.[1]?.proof ?? "", /Plus and Family product ids/);
  assert.match(surface.routeChecklist?.[2]?.proof ?? "", /sandbox receipt/);
  assert.match(surface.routeChecklist?.[3]?.proof ?? "", /checkout stays disabled/);
  assert.match(surface.launchRisk, /paid checkout can be enabled/);
});

test("adds a launch-critical store accounts proof target", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const ids = surfaces.map((surface) => surface.id);
  const surface = surfaces.find((item) => item.id === "store-accounts-proof");

  assert.ok(surface);
  assert.ok(
    ids.indexOf("store-accounts-proof") > ids.indexOf("payments-provider-proof"),
    "Store accounts proof should follow payments proof in the focused launch targets",
  );
  assert.ok(
    ids.indexOf("store-accounts-proof") < ids.indexOf("route-visual-consistency"),
    "Store accounts proof should stay visible before broad route screenshot work",
  );
  assert.equal(surface.title, "Store Accounts Proof");
  assert.equal(surface.route, "/more");
  assert.equal(surface.priority, "launch-critical");
  assert.match(surface.goal, /Apple Developer team id/);
  assert.match(surface.goal, /Google Play package record/);
  assert.match(surface.goal, /reviewer access/);
  assert.match(surface.devicePrompt, /Provider Launch Setup/);
  assert.match(surface.devicePrompt, /iOS and Android/);
  assert.match(surface.setupSteps.join("\n"), /Apple and Google store accounts/);
  assert.match(surface.setupSteps.join("\n"), /store submission stays blocked/);
  assert.match(surface.verificationSteps.join("\n"), /App Store Connect app record/);
  assert.match(surface.verificationSteps.join("\n"), /Google Play package record/);
  assert.match(surface.verificationSteps.join("\n"), /bundle ids/);
  assert.match(surface.verificationSteps.join("\n"), /reviewer access/);
  assert.match(surface.acceptanceCriteria.join("\n"), /store submission stays blocked/);
  assert.match(surface.acceptanceCriteria.join("\n"), /screenshots\/metadata ownership/);
  assert.match(surface.failureEscalation, /App Review|Play review/);
  assert.match(surface.requiredEvidence.join("\n"), /iOS screenshot of Provider Launch Setup/);
  assert.match(surface.requiredEvidence.join("\n"), /Android screenshot of Provider Launch Setup/);
  assert.match(surface.requiredEvidence.join("\n"), /Apple Developer team id/);
  assert.match(surface.requiredEvidence.join("\n"), /Google Play package record/);
  assert.deepEqual(surface.routeChecklist?.map((item) => item.label), [
    "Provider Launch Setup store accounts gate",
    "Apple Developer and App Store Connect",
    "Google Play package and release access",
    "Reviewer access, metadata, and release roles",
  ]);
  assert.equal(surface.routeChecklist?.[0]?.route, "/more");
  assert.equal(surface.routeChecklist?.[1]?.route, "/more");
  assert.equal(surface.routeChecklist?.[2]?.route, "/more");
  assert.equal(surface.routeChecklist?.[3]?.route, "/more");
  assert.match(surface.routeChecklist?.[0]?.proof ?? "", /Apple and Google store accounts proof packet/);
  assert.match(surface.routeChecklist?.[1]?.proof ?? "", /Apple Developer team id/);
  assert.match(surface.routeChecklist?.[2]?.proof ?? "", /Google Play package record/);
  assert.match(surface.routeChecklist?.[3]?.proof ?? "", /reviewer access/);
  assert.match(surface.launchRisk, /store submission can be claimed/);
});

test("adds a launch-critical account deletion proof target", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const ids = surfaces.map((surface) => surface.id);
  const surface = surfaces.find((item) => item.id === "account-deletion-proof");

  assert.ok(surface);
  assert.ok(
    ids.indexOf("account-deletion-proof") > ids.indexOf("store-accounts-proof"),
    "Account deletion proof should follow store accounts in the focused launch targets",
  );
  assert.ok(
    ids.indexOf("account-deletion-proof") < ids.indexOf("route-visual-consistency"),
    "Account deletion proof should stay visible before broad route screenshot work",
  );
  assert.equal(surface.title, "Account Deletion Proof");
  assert.equal(surface.route, "/more");
  assert.equal(surface.priority, "launch-critical");
  assert.match(surface.goal, /self-serve deletion route/);
  assert.match(surface.goal, /export-before-delete/);
  assert.match(surface.goal, /data\/object deletion receipt/);
  assert.match(surface.devicePrompt, /Provider Launch Setup/);
  assert.match(surface.devicePrompt, /iOS and Android/);
  assert.match(surface.setupSteps.join("\n"), /Self-serve account deletion/);
  assert.match(surface.setupSteps.join("\n"), /destructive deletion stays blocked/);
  assert.match(surface.verificationSteps.join("\n"), /reauthentication/);
  assert.match(surface.verificationSteps.join("\n"), /export-before-delete warning/);
  assert.match(surface.verificationSteps.join("\n"), /audit trail/);
  assert.match(surface.acceptanceCriteria.join("\n"), /destructive deletion stays blocked/);
  assert.match(surface.acceptanceCriteria.join("\n"), /legal\/store approval/);
  assert.match(surface.failureEscalation, /App Store|Play Store|privacy/);
  assert.match(surface.requiredEvidence.join("\n"), /iOS screenshot of Provider Launch Setup/);
  assert.match(surface.requiredEvidence.join("\n"), /Android screenshot of Provider Launch Setup/);
  assert.match(surface.requiredEvidence.join("\n"), /export-before-delete/);
  assert.match(surface.requiredEvidence.join("\n"), /data\/object deletion receipt/);
  assert.deepEqual(surface.routeChecklist?.map((item) => item.label), [
    "Provider Launch Setup account deletion gate",
    "Deletion route and reauthentication",
    "Export, deletion receipt, and audit trail",
    "Recovery window, support, and store approval",
  ]);
  assert.equal(surface.routeChecklist?.[0]?.route, "/more");
  assert.equal(surface.routeChecklist?.[1]?.route, "/more");
  assert.equal(surface.routeChecklist?.[2]?.route, "/more");
  assert.equal(surface.routeChecklist?.[3]?.route, "/more");
  assert.match(surface.routeChecklist?.[0]?.proof ?? "", /Self-serve account deletion proof packet/);
  assert.match(surface.routeChecklist?.[1]?.proof ?? "", /self-serve deletion route/);
  assert.match(surface.routeChecklist?.[2]?.proof ?? "", /data\/object deletion receipt/);
  assert.match(surface.routeChecklist?.[3]?.proof ?? "", /recovery-window policy/);
  assert.match(surface.launchRisk, /destructive account deletion can be enabled/);
});

test("adds a launch-critical support legal readiness proof target", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const ids = surfaces.map((surface) => surface.id);
  const surface = surfaces.find((item) => item.id === "support-legal-readiness-proof");

  assert.ok(surface);
  assert.ok(
    ids.indexOf("support-legal-readiness-proof") > ids.indexOf("account-deletion-proof"),
    "Support legal readiness proof should follow the account deletion proof in the focused launch targets",
  );
  assert.ok(
    ids.indexOf("support-legal-readiness-proof") < ids.indexOf("route-visual-consistency"),
    "Support legal readiness proof should stay visible before broad route screenshot work",
  );
  assert.equal(surface.title, "Support Legal Readiness Proof");
  assert.equal(surface.route, "/privacy");
  assert.equal(surface.priority, "launch-critical");
  assert.match(surface.goal, /support inbox/);
  assert.match(surface.goal, /privacy policy and terms links/);
  assert.match(surface.goal, /refund and subscription policy/);
  assert.match(surface.goal, /veterinary and emergency boundary/);
  assert.match(surface.goal, /account deletion escalation/);
  assert.match(surface.goal, /incident response owner/);
  assert.match(surface.devicePrompt, /Privacy & Safety/);
  assert.match(surface.setupSteps.join("\n"), /Launch support profile/);
  assert.match(surface.setupSteps.join("\n"), /Share support runbook/);
  assert.match(surface.verificationSteps.join("\n"), /privacy policy/);
  assert.match(surface.verificationSteps.join("\n"), /terms/);
  assert.match(surface.verificationSteps.join("\n"), /refund/);
  assert.match(surface.verificationSteps.join("\n"), /not veterinary advice/);
  assert.match(surface.verificationSteps.join("\n"), /deletion escalation/);
  assert.match(surface.acceptanceCriteria.join("\n"), /public launch stays blocked/);
  assert.match(surface.requiredEvidence.join("\n"), /Privacy & Safety support runbook/);
  assert.match(surface.requiredEvidence.join("\n"), /support inbox/);
  assert.match(surface.requiredEvidence.join("\n"), /refund and subscription policy/);
  assert.match(surface.requiredEvidence.join("\n"), /veterinary boundary/);
  assert.match(surface.requiredEvidence.join("\n"), /Apollo approval/);
  assert.match(surface.launchRisk, /legal, support, refund, or veterinary-boundary approval/);
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

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildMobileReleaseQaShareText,
  formatMobileReleaseQaMissingEvidence,
  formatMobileReleaseQaPlatformEvidence,
  listMobileReleaseQaSurfaces,
  mobileReleaseQaFlexibleScreenshotSlotsSatisfied,
  mobileReleaseQaScreenshotEvidenceComplete,
  mobileReleaseQaStatusLabel,
  summarizeMobileReleaseQaReviews,
  type MobileReleaseQaReview,
} from "./mobileReleaseQa.ts";

test("lists the launch-critical mobile QA surfaces for the next native pass", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const ids = surfaces.map((surface) => surface.id);

  assert.ok(ids.includes("phoenix-home"));
  assert.ok(ids.includes("care-twin-state-lab"));
  assert.ok(ids.includes("avatar-studio"));
  assert.ok(ids.includes("incident-composer"));
  assert.ok(ids.includes("records-incident-watch"));
  assert.ok(surfaces.every((surface) => surface.requiredEvidence.length > 0));
  assert.ok(surfaces.every((surface) => surface.launchRisk.length > 0));
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

test("keeps flexible screenshot slots separate from required iOS and Android proof", () => {
  const surfaces = [
    {
      id: "home",
      title: "Home",
      route: "/",
      priority: "launch-critical",
      goal: "Check both native platforms.",
      devicePrompt: "Open on both phones.",
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
  assert.match(text, /Phoenix Home: Pass/);
  assert.match(text, /Records Incident Watch: Needs tune/);
  assert.match(text, /Follow-up row needs larger touch target/);
  assert.match(text, /Required screenshot slots:/);
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
});

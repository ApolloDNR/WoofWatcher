import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildMobileReleaseQaShareText,
  listMobileReleaseQaSurfaces,
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
    { surfaceId: "phoenix-home", status: "pass" },
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
});

test("builds a release QA share report with the screenshot boundary intact", () => {
  const surfaces = listMobileReleaseQaSurfaces();
  const reviews: MobileReleaseQaReview[] = [
    { surfaceId: "phoenix-home", status: "pass" },
    { surfaceId: "records-incident-watch", status: "needs-review", note: "Follow-up row needs larger touch target." },
  ];

  const text = buildMobileReleaseQaShareText(surfaces, reviews, "2026-06-20T12:00:00.000Z");

  assert.match(text, /WoofWatcher Mobile Release QA/);
  assert.match(text, /Phoenix Home: Pass/);
  assert.match(text, /Records Incident Watch: Needs tune/);
  assert.match(text, /Follow-up row needs larger touch target/);
  assert.match(text, /Required screenshot slots:/);
  assert.match(text, /does not replace attached iOS\/Android screenshots/);
});

test("uses owner-readable release QA labels", () => {
  assert.equal(mobileReleaseQaStatusLabel("pass"), "Pass");
  assert.equal(mobileReleaseQaStatusLabel("needs-review"), "Needs tune");
  assert.equal(mobileReleaseQaStatusLabel("unreviewed"), "Unreviewed");
});

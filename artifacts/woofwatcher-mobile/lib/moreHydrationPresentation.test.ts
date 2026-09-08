import assert from "node:assert/strict";
import test from "node:test";

import {
  getMoreHydrationPresentation,
  shouldLoadMoreOwnerQaSession,
} from "./moreHydrationPresentation.ts";

const hydratedContent = {
  career: {
    levelXp: 45,
    progress: 0.45,
    logsThisWeek: 5,
  },
  directory: ["Update meal outcome", "Create shared routines", "Care vault"],
  profile: { name: "Phoenix", breed: "Golden Retriever" },
  status: { mood: "happy", logsToday: 5 },
  ownerLaunchCommand: { actionLabel: "Beta Packet" },
};

const readyRouteSubtitle =
  "Phoenix's care tools, records, household, and settings.";

test("withholds every saved-care surface and action while local care is loading", () => {
  const presentation = getMoreHydrationPresentation(
    "loading",
    hydratedContent,
    readyRouteSubtitle,
  );

  assert.equal(presentation.status, "loading");
  assert.equal(presentation.content, null);
  assert.equal(presentation.isBusy, true);
  assert.equal(presentation.canRetry, false);
  assert.equal(presentation.canUseDataActions, false);
  assert.equal(presentation.badgeLabel, "Loading");
  assert.equal(presentation.metricPlaceholder, "—");
  assert.equal(presentation.statusTitle, "Loading saved care");
  assert.equal(
    presentation.statusDetail,
    "Reading this device's saved care record.",
  );
  assert.equal(
    presentation.routeSubtitle,
    "Loading saved care before showing this profile and its tools.",
  );
  assert.doesNotMatch(presentation.routeSubtitle, /Phoenix|Beta Packet|happy|5/);
});

test("offers recovery without exposing default content when local care cannot load", () => {
  const presentation = getMoreHydrationPresentation(
    "failed",
    hydratedContent,
    readyRouteSubtitle,
  );

  assert.equal(presentation.status, "failed");
  assert.equal(presentation.content, null);
  assert.equal(presentation.isBusy, false);
  assert.equal(presentation.canRetry, true);
  assert.equal(presentation.canUseDataActions, false);
  assert.equal(presentation.badgeLabel, "Load failed");
  assert.equal(presentation.statusTitle, "Saved care unavailable");
  assert.equal(
    presentation.statusDetail,
    "WoofWatcher could not read this device's saved care. Retry before using these tools.",
  );
  assert.equal(
    presentation.routeSubtitle,
    "Saved care is unavailable. Retry below to restore this profile and its tools.",
  );
});

test("reveals one unchanged hydrated snapshot only after care is ready", () => {
  const presentation = getMoreHydrationPresentation(
    "ready",
    hydratedContent,
    readyRouteSubtitle,
  );

  assert.equal(presentation.status, "ready");
  assert.equal(presentation.content, hydratedContent);
  assert.equal(presentation.content.career.progress, 0.45);
  assert.deepEqual(presentation.content.directory, hydratedContent.directory);
  assert.equal(presentation.isBusy, false);
  assert.equal(presentation.canRetry, false);
  assert.equal(presentation.canUseDataActions, true);
  assert.equal(presentation.badgeLabel, "Ready");
  assert.equal(presentation.routeSubtitle, readyRouteSubtitle);
});

test("loads owner QA storage only for an owner-operations surface", () => {
  assert.equal(shouldLoadMoreOwnerQaSession(false), false);
  assert.equal(shouldLoadMoreOwnerQaSession(true), true);
});

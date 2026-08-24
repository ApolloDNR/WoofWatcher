import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deriveHomeEvidenceCopy,
  formatHomeCompletion,
  isHomeMoodEvidence,
  selectHomeVisibleEntries,
} from "./homeEvidence.ts";

test("Home excludes household-private entries before selecting shared content", () => {
  const visible = selectHomeVisibleEntries([
    {
      id: "public-default",
      title: "Morning walk",
      caregiver: "Ari",
      details: { note: "Sunny block" },
    },
    {
      id: "private",
      title: "PRIVATE_TITLE_DO_NOT_RENDER",
      caregiver: "PRIVATE_CAREGIVER_DO_NOT_RENDER",
      details: {
        householdVisible: false,
        note: "PRIVATE_CONTENT_DO_NOT_RENDER",
      },
    },
    {
      id: "public-explicit",
      title: "Dinner",
      caregiver: "Sam",
      details: { householdVisible: true },
    },
  ]);

  assert.deepEqual(
    visible.map((entry) => entry.id),
    ["public-default", "public-explicit"],
  );
  const renderedHomeInput = JSON.stringify(visible);
  assert.doesNotMatch(renderedHomeInput, /PRIVATE_TITLE_DO_NOT_RENDER/);
  assert.doesNotMatch(renderedHomeInput, /PRIVATE_CAREGIVER_DO_NOT_RENDER/);
  assert.doesNotMatch(renderedHomeInput, /PRIVATE_CONTENT_DO_NOT_RENDER/);
});

test("Home completion labels never invent meal or potty targets", () => {
  assert.equal(formatHomeCompletion(0, 0), "No target");
  assert.equal(formatHomeCompletion(1, 0), "1 logged");
  assert.equal(formatHomeCompletion(0, 2), "0/2");
  assert.equal(formatHomeCompletion(4, 3), "4/3");
});

test("Home does not label activity-only evidence as an observed mood", () => {
  for (const normalizedType of ["walk", "play", "training", "meal", "potty"]) {
    assert.equal(
      isHomeMoodEvidence({ normalizedType }),
      false,
      `${normalizedType} alone must not qualify as Mood evidence`,
    );
  }

  assert.equal(
    isHomeMoodEvidence({ normalizedType: "walk", mood: "happy" }),
    true,
  );
  for (const normalizedType of ["mood", "symptom", "vomit", "alone"]) {
    assert.equal(isHomeMoodEvidence({ normalizedType }), true);
  }
});

test("fresh Home copy stays unknown instead of claiming a healthy state", () => {
  const copy = deriveHomeEvidenceCopy({
    todayLogCount: 0,
    healthAlert: false,
    bileCount: 0,
  });

  assert.deepEqual(copy, {
    careLine: "Awaiting today's first log",
    headline: "Ready for today's first log.",
    summary: "No care data logged today.",
    health: {
      status: "No data",
      detail: "No health evidence logged today",
    },
    bile: {
      status: "No data",
      detail: "No bile evidence logged today",
    },
  });
  assert.doesNotMatch(
    JSON.stringify(copy),
    /Stable|All good|Low Risk|Everything looks good|Nothing invented/,
  );
});

test("Home reports logged evidence without turning absence into a health claim", () => {
  assert.deepEqual(
    deriveHomeEvidenceCopy({
      todayLogCount: 2,
      healthAlert: false,
      bileCount: 0,
    }),
    {
      careLine: "No alerts logged today",
      headline: "Two care moments logged today.",
      summary: "Readings use today's available care evidence.",
      health: {
        status: "No alerts logged",
        detail: "Based on 2 care logs today",
      },
      bile: {
        status: "None logged",
        detail: "No bile events logged today",
      },
    },
  );

  assert.deepEqual(
    deriveHomeEvidenceCopy({
      todayLogCount: 3,
      healthAlert: true,
      bileCount: 2,
    }).bile,
    { status: "Watch", detail: "2 flagged today" },
  );
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { deriveCareDayStatus } from "@workspace/care-domain";

import {
  deriveHomeEvidenceCopy,
  formatHomeCompletion,
  isHomeMoodEvidence,
  selectObservableHomeEntries,
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

test("Home applies privacy before timestamps and rejects non-observable logs", () => {
  const now = Date.parse("2026-08-28T12:00:00.000Z");
  let privateTimestampRead = false;
  const privateEntry = {
    id: "private",
    details: { householdVisible: false },
    get occurredAt(): string {
      privateTimestampRead = true;
      throw new Error("a private entry timestamp must not cross Home's boundary");
    },
  };

  const observable = selectObservableHomeEntries(
    [
      {
        id: "past",
        details: { householdVisible: true },
        occurredAt: "2026-08-28T11:59:59.999Z",
      },
      {
        id: "boundary",
        details: {},
        occurredAt: "2026-08-28T12:00:00.000Z",
      },
      {
        id: "future-same-day",
        details: {},
        occurredAt: "2026-08-28T12:00:00.001Z",
      },
      { id: "invalid", details: {}, occurredAt: "not-a-date" },
      privateEntry,
    ],
    now,
  );

  assert.deepEqual(
    observable.map((entry) => entry.id),
    ["past", "boundary"],
  );
  assert.equal(
    privateTimestampRead,
    false,
    "private records must be removed before Home inspects their timestamps",
  );
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
    assert.equal(
      isHomeMoodEvidence({ normalizedType }),
      false,
      `${normalizedType} without a structured mood value must remain unknown`,
    );
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

test("Home mirrors owner-marked health urgency without promoting non-health urgency", () => {
  const now = Date.parse("2026-08-28T18:00:00.000Z");
  const urgentHealth = deriveCareDayStatus(
    [
      {
        type: "medication",
        occurredAt: "2026-08-28T17:00:00.000Z",
        severity: "urgent",
      },
    ],
    [],
    now,
  );
  const urgentNonHealth = deriveCareDayStatus(
    [
      {
        type: "training",
        occurredAt: "2026-08-28T17:00:00.000Z",
        severity: "urgent",
      },
    ],
    [],
    now,
  );

  assert.equal(urgentHealth.healthAlert, true);
  assert.equal(urgentNonHealth.healthAlert, false);
  assert.deepEqual(
    deriveHomeEvidenceCopy({
      todayLogCount: 1,
      healthAlert: urgentHealth.healthAlert,
      bileCount: 0,
    }).health,
    {
      status: "Needs Watch",
      detail: "Owner-marked health alert logged",
    },
  );

  const source = readFileSync(
    new URL("../app/(tabs)/index.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /healthAlert: status\.counts\.healthAlert/);
});

test("Home derives Bile Watch only from the canonical vomit evidence selector", () => {
  const source = readFileSync(
    new URL("../app/(tabs)/index.tsx", import.meta.url),
    "utf8",
  );
  const countStart = source.indexOf("const bileCount = useMemo(");
  const statusStart = source.indexOf("const status = useMemo(", countStart);
  assert.notEqual(countStart, -1);
  assert.notEqual(statusStart, -1);
  const countSource = source.slice(countStart, statusStart);

  assert.match(countSource, /deriveBileVomitEvidence30\(\{ entries: todayHomeEntries, now \}\)/);
  assert.match(countSource, /vomitEntriesNewestFirst\.length/);
  assert.doesNotMatch(countSource, /type === "symptom"|\/bile\/i\.test\(entry\.title\)/);
});

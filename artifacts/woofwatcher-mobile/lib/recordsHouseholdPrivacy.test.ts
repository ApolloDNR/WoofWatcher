import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { buildCarePass } from "../../../lib/care-domain/src/care-pass.ts";
import {
  buildRecordsProgressReport,
  selectRecordsHouseholdEntries,
  selectRecordsRecentMealNotes,
} from "./recordsHouseholdPrivacy.ts";

const RECORDS_SCREEN_PATH = join(
  process.cwd(),
  "artifacts",
  "woofwatcher-mobile",
  "components",
  "health",
  "RecordsScreen.tsx",
);

function recordsSource(): string {
  return readFileSync(RECORDS_SCREEN_PATH, "utf8");
}

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source boundary: ${start}`);
  assert.notEqual(endIndex, -1, `missing source boundary: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("Records filters household-private logs once before every shared aggregate", () => {
  const records = recordsSource();
  const aggregateSetup = sourceBetween(
    records,
    "const healthWatch = useMemo",
    "const recordVault = useMemo",
  );
  const streakSetup = sourceBetween(
    records,
    "const streak = useMemo",
    "const lastIncidentDays = useMemo",
  );
  const carePassBuilder = sourceBetween(
    records,
    "const buildCarePassFor =",
    "const openCarePassPreview =",
  );

  assert.match(
    records,
    /const householdEntries = useMemo\([\s\S]{0,180}selectRecordsHouseholdEntries\(state\.entries\)/,
  );
  assert.doesNotMatch(aggregateSetup, /state\.entries/);
  assert.match(aggregateSetup, /entries: householdEntries/);
  assert.match(
    aggregateSetup,
    /buildRecordsProgressReport\(householdEntries, period, now\)/,
  );
  assert.match(
    aggregateSetup,
    /selectRecordsRecentMealNotes\(householdEntries\)/,
  );
  assert.doesNotMatch(streakSetup, /state\.entries/);
  assert.match(streakSetup, /householdEntries\.flatMap/);
  assert.match(carePassBuilder, /entries: householdEntries/);
});

test("Records regenerates every saved Care Pass share from current household-visible data", () => {
  const records = recordsSource();
  const livePreview = sourceBetween(
    records,
    "const buildCarePassFor =",
    "const openIncidentFollowUp =",
  );
  const reportHistory = sourceBetween(
    records,
    "const reportArtifacts = useMemo",
    "const shareCarePass =",
  );
  const textShare = sourceBetween(
    records,
    "const shareReportArtifact =",
    "const sharePrintableReportArtifact =",
  );
  const printableShare = sourceBetween(
    records,
    "const sharePrintableReportArtifact =",
    "const shareGeneratedCarePassPdfArtifact =",
  );
  const pdfShare = sourceBetween(
    records,
    "const shareGeneratedCarePassPdfArtifact =",
    "const openRecordsFileProofMission =",
  );

  for (const sharePath of [textShare, printableShare, pdfShare]) {
    assert.match(sharePath, /buildCurrentCarePassArtifact\(artifact\)/);
  }
  assert.match(
    reportHistory,
    /\.map\(\(artifact\) => buildCurrentCarePassArtifact\(artifact\)\)/,
  );
  assert.match(records, /useState<CarePassAudience \| null>\(null\)/);
  assert.match(
    livePreview,
    /carePassPreviewAudience\s*\? buildCarePassFor\(carePassPreviewAudience\)/,
  );
  assert.match(livePreview, /setCarePassPreviewAudience\(audience\)/);
  assert.doesNotMatch(textShare, /artifact\.message/);
  assert.doesNotMatch(printableShare, /getCarePassArtifactPrintView\(artifact\)/);
  assert.doesNotMatch(pdfShare, /artifact\.(summary|message)/);
});

test("Records keeps the unfiltered local entry collection for owned-file accounting", () => {
  const records = recordsSource();
  const ownedFileAccounting = sourceBetween(
    records,
    "const carePickedMediaUris =",
    "const reportPickedMediaCleanupFailure =",
  );

  assert.match(ownedFileAccounting, /entries: careStateRef\.current\.entries/);
  assert.doesNotMatch(ownedFileAccounting, /householdEntries/);
});

test("private logs cannot enter Records cards, meal notes, caregiver ranking, or a new Care Pass", () => {
  const now = new Date("2026-08-23T18:00:00.000Z").getTime();
  const privateMeal = {
    id: "private-meal",
    type: "meal",
    title: "PRIVATE_TITLE_DO_NOT_SHARE",
    caregiver: "PRIVATE_CAREGIVER_DO_NOT_SHARE",
    occurredAt: "2026-08-23T17:50:00.000Z",
    note: "PRIVATE_MEAL_NOTE_DO_NOT_SHARE",
    details: { householdVisible: false },
  };
  const entries = [
    {
      id: "shared-meal",
      type: "meal",
      title: "Breakfast",
      caregiver: "Ava",
      occurredAt: "2026-08-23T16:00:00.000Z",
      note: "Ate breakfast.",
      details: { householdVisible: true },
    },
    {
      id: "shared-walk",
      type: "walk",
      title: "Morning walk",
      caregiver: "Ava",
      occurredAt: "2026-08-23T15:00:00.000Z",
      durationMinutes: 24,
      details: {},
    },
    privateMeal,
    {
      ...privateMeal,
      id: "private-incident",
      type: "incident",
      occurredAt: "2026-08-23T17:40:00.000Z",
    },
    {
      ...privateMeal,
      id: "private-walk",
      type: "walk",
      occurredAt: "2026-08-23T17:30:00.000Z",
      durationMinutes: 999,
    },
  ];
  const originalSnapshot = JSON.stringify(entries);

  const visible = selectRecordsHouseholdEntries(entries);
  const report = buildRecordsProgressReport(visible, 30, now);
  const mealNotes = selectRecordsRecentMealNotes(visible);
  const pass = buildCarePass({
    audience: "caregiver",
    profile: { name: "Phoenix" },
    entries: visible,
    now,
  });

  assert.deepEqual(
    visible.map((entry) => entry.id),
    ["shared-meal", "shared-walk"],
  );
  assert.deepEqual(report, {
    total: 2,
    meals: 1,
    walks: 1,
    walkMinutes: 24,
    play: 0,
    potty: 0,
    treats: 0,
    incidents: 0,
    topCaregiver: { name: "Ava", count: 2 },
  });
  assert.deepEqual(
    mealNotes.map((entry) => ({ id: entry.id, note: entry.note })),
    [{ id: "shared-meal", note: "Ate breakfast." }],
  );
  assert.doesNotMatch(
    JSON.stringify({ report, mealNotes, share: pass.message }),
    /PRIVATE_(TITLE|CAREGIVER|MEAL_NOTE)_DO_NOT_SHARE/,
  );

  // Filtering is a read projection only: the private entry remains owned by
  // the local care document for owner export, editing, and deletion.
  assert.equal(entries[2], privateMeal);
  assert.equal(JSON.stringify(entries), originalSnapshot);
});

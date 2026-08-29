import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  deriveBileVomitEvidence30,
  deriveBileWatchStatus,
  deriveHealthWatch,
} from "../../../lib/care-domain/src/index.ts";

import {
  buildHealthReviewPacketShareText,
  deriveHealthMetricEvidence,
  deriveHealthReviewPacket,
} from "./healthReviewPacket.ts";

const noWatchCounts = {
  vomit7: 0,
  vomit30: 0,
  appetiteWatch7: 0,
  stoolWatch7: 0,
  anxiety7: 0,
};

const NOW = Date.parse("2026-08-28T18:00:00.000Z");
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * 3_600_000).toISOString();

function deriveMetrics(entries: Parameters<typeof deriveHealthMetricEvidence>[0]["entries"]) {
  return deriveHealthMetricEvidence({
    entries,
    healthCounts: noWatchCounts,
    signals: [],
  });
}

test("a meal-only window does not invent activity, stool, hydration, energy, or vomiting positives", () => {
  const metrics = deriveMetrics([
    {
      type: "meal",
      occurredAt: at(1),
      details: { portion: "full" },
    },
  ]);

  assert.deepEqual(metrics.activity, {
    status: "No data",
    detail: "No activity logs",
    tone: "empty",
  });
  assert.deepEqual(metrics.stool, {
    status: "No data",
    detail: "No stool logs",
    tone: "empty",
  });
  assert.deepEqual(metrics.hydration, {
    status: "No data",
    detail: "No water logs",
    tone: "empty",
  });
  assert.deepEqual(metrics.energy, {
    status: "No data",
    detail: "No energy logs",
    tone: "empty",
  });
  assert.deepEqual(metrics.vomiting, {
    status: "No data",
    detail: "No vomit logs",
    tone: "empty",
  });
  assert.deepEqual(metrics.appetite, {
    status: "Logged",
    detail: "1 meal log",
    tone: "positive",
  });
});

test("bare and attempt-only potty entries do not become positive stool evidence", () => {
  for (const entry of [
    { type: "potty", occurredAt: at(1) },
    { type: "potty", occurredAt: at(1), details: { pottyOutcome: "attempt" } },
    { type: "potty", occurredAt: at(1), details: { pottyOutcome: "pee" } },
  ]) {
    assert.deepEqual(deriveMetrics([entry]).stool, {
      status: "No data",
      detail: "No stool logs",
      tone: "empty",
    });

    const healthWatch = deriveHealthWatch({ entries: [entry], now: NOW });
    assert.deepEqual(
      deriveHealthMetricEvidence({
        entries: [entry],
        healthCounts: healthWatch.counts,
        signals: healthWatch.signals,
      }).stool,
      {
        status: "No data",
        detail: "No stool logs",
        tone: "empty",
      },
    );
  }
});

test("explicit pee, attempt, and tried-nothing outcomes beat stale stool-looking details", () => {
  for (const entry of [
    {
      type: "potty",
      occurredAt: at(1),
      details: { kind: " PEE ", condition: "normal", stoolColor: "yellow" },
    },
    {
      type: "potty",
      occurredAt: at(1),
      details: { pottyOutcome: " attempt ", condition: "normal" },
    },
    {
      type: "potty",
      occurredAt: at(1),
      details: { pottyOutcome: "tried-nothing", stoolColor: "red-black" },
    },
    {
      type: " PeE ",
      occurredAt: at(1),
      details: { condition: "normal", stoolColor: "brown" },
    },
  ]) {
    assert.deepEqual(deriveMetrics([entry]).stool, {
      status: "No data",
      detail: "No stool logs",
      tone: "empty",
    });

    const healthWatch = deriveHealthWatch({ entries: [entry], now: NOW });
    assert.deepEqual(
      deriveHealthMetricEvidence({
        entries: [entry],
        healthCounts: healthWatch.counts,
        signals: healthWatch.signals,
      }).stool,
      {
        status: "No data",
        detail: "No stool logs",
        tone: "empty",
      },
    );
  }
});

test("a mood entry without an energy observation does not become positive energy evidence", () => {
  assert.deepEqual(
    deriveMetrics([{ type: "mood", occurredAt: at(1), details: { mood: "happy" } }]).energy,
    {
      status: "No data",
      detail: "No energy logs",
      tone: "empty",
    },
  );
});

test("legacy generic energy detail is not presented as an observed energy level", () => {
  assert.deepEqual(
    deriveMetrics([
      {
        type: "mood",
        occurredAt: at(1),
        details: { energy: "high" },
      },
    ]).energy,
    {
      status: "No data",
      detail: "No energy logs",
      tone: "empty",
    },
  );
});

test("energy uses timestamps and the newest explicit observation instead of array order", () => {
  const newestSteady = deriveMetrics([
    { type: "mood", occurredAt: at(1), details: { energyLevel: "steady" } },
    { type: "mood", occurredAt: at(12), details: { energyLevel: "high" } },
  ]);
  assert.deepEqual(newestSteady.energy, {
    status: "Steady",
    detail: "Steady energy logged",
    tone: "positive",
  });

  const newestHighOutOfOrder = deriveMetrics([
    { type: "mood", occurredAt: at(12), details: { energyLevel: "steady" } },
    { type: "mood", occurredAt: at(1), details: { energyLevel: "high" } },
  ]);
  assert.deepEqual(newestHighOutOfOrder.energy, {
    status: "High",
    detail: "High energy logged",
    tone: "positive",
  });
});

test("metric evidence excludes private, malformed, and future entries before content reads", () => {
  let privateTypeRead = false;
  let privateTimestampRead = false;
  const privateEntry = {
    details: { householdVisible: false },
    get type(): string {
      privateTypeRead = true;
      throw new Error("private metric type must not be read");
    },
    get occurredAt(): string {
      privateTimestampRead = true;
      throw new Error("private metric timestamp must not be read");
    },
  };

  const metrics = deriveHealthMetricEvidence({
    now: NOW,
    entries: [
      privateEntry,
      { type: "mood", occurredAt: "not-a-date", details: { energyLevel: "high" } },
      { type: "mood", occurredAt: new Date(NOW + 1).toISOString(), details: { energyLevel: "high" } },
    ],
    healthCounts: noWatchCounts,
    signals: [],
  });

  assert.deepEqual(metrics.energy, {
    status: "No data",
    detail: "No energy logs",
    tone: "empty",
  });
  assert.equal(privateTypeRead, false);
  assert.equal(privateTimestampRead, false);
});

test("metric copy preserves recognized evidence-derived positives and warnings", () => {
  const metrics = deriveHealthMetricEvidence({
    entries: [
      { type: "walk", occurredAt: at(1) },
      { type: "potty", occurredAt: at(2), details: { pottyOutcome: "poop", condition: "normal" } },
      { type: "water", occurredAt: at(3) },
      { type: "mood", occurredAt: at(4), details: { energyLevel: "high" } },
      { type: "vomit", occurredAt: at(5) },
    ],
    healthCounts: {
      ...noWatchCounts,
      vomit7: 1,
    },
    signals: [],
  });

  assert.deepEqual(metrics.activity, {
    status: "Logged",
    detail: "1 activity log",
    tone: "positive",
  });
  assert.deepEqual(metrics.stool, {
    status: "Normal",
    detail: "Normal stool logged",
    tone: "positive",
  });
  assert.deepEqual(metrics.hydration, {
    status: "Logged",
    detail: "1 water log",
    tone: "positive",
  });
  assert.deepEqual(metrics.energy, {
    status: "High",
    detail: "High energy logged",
    tone: "positive",
  });
  assert.deepEqual(metrics.vomiting, {
    status: "Watch",
    detail: "1 in 7 days",
    tone: "watch",
  });
});

test("explicit poop outcome or recognized stool detail counts as stool evidence", () => {
  for (const entry of [
    { type: "potty", occurredAt: at(1), details: { pottyOutcome: "poop" } },
    { type: "potty", occurredAt: at(1), details: { kind: "both" } },
    { type: "potty", occurredAt: at(1), details: { stoolColor: "brown" } },
    { type: " PoOp ", occurredAt: at(1) },
  ]) {
    assert.equal(deriveMetrics([entry]).stool.status, "Logged");
  }

  assert.deepEqual(
    deriveMetrics([{ type: "potty", occurredAt: at(1), details: { stoolCondition: "soft" } }]).stool,
    {
      status: "Watch",
      detail: "1 stool log needs review",
      tone: "watch",
    },
  );

  for (const stoolColor of ["yellow", "red-black", "black-tarry", "gray", "white"]) {
    assert.deepEqual(
      deriveMetrics([
        {
          type: "potty",
          occurredAt: at(1),
          details: { pottyOutcome: "poop", stoolColor },
        },
      ]).stool,
      {
        status: "Watch",
        detail: "1 stool log needs review",
        tone: "watch",
      },
      stoolColor,
    );
  }
});

test("normalization preserves symptom-vomit and throwup evidence without turning raw pee into stool", () => {
  const metrics = deriveMetrics([
    { type: " symptom ", occurredAt: at(1), details: { what: " Vomit " } },
    { type: " ThrowUp ", occurredAt: at(2) },
    { type: " pLaY ", occurredAt: at(3) },
    { type: " PeE ", occurredAt: at(4) },
  ]);

  assert.deepEqual(metrics.vomiting, {
    status: "Watch",
    detail: "2 vomit logs",
    tone: "watch",
  });
  assert.deepEqual(metrics.activity, {
    status: "Logged",
    detail: "1 activity log",
    tone: "positive",
  });
  assert.deepEqual(metrics.stool, {
    status: "No data",
    detail: "No stool logs",
    tone: "empty",
  });
});

test("stool signals preserve alert urgency and remain evidence when counts disagree", () => {
  const alert = deriveHealthMetricEvidence({
    entries: [],
    healthCounts: { ...noWatchCounts, stoolWatch7: 1 },
    signals: [{ kind: "stool-watch", urgency: "alert" }],
  });
  assert.deepEqual(alert.stool, {
    status: "Review",
    detail: "1 review log needs prompt review",
    tone: "review",
  });

  const signalOnly = deriveHealthMetricEvidence({
    entries: [],
    healthCounts: noWatchCounts,
    signals: [{ kind: "stool-watch", urgency: "watch" }],
  });
  assert.deepEqual(signalOnly.stool, {
    status: "Watch",
    detail: "Stool pattern logged",
    tone: "watch",
  });
});

test("the shared 30-day bile evidence retains a 14-day event and rejects unrelated alerts", () => {
  const evidence = deriveBileVomitEvidence30({
    now: NOW,
    entries: [
      {
        type: " symptom ",
        occurredAt: at(14 * 24),
        title: "Yellow fluid",
        details: { what: " yellow bile " },
      },
      {
        type: "throwup",
        occurredAt: at(31 * 24),
        title: "Yellow vomit",
      },
      {
        type: "potty",
        occurredAt: at(1),
        title: "Urgent stool",
        severity: "urgent",
      },
    ],
  });

  assert.equal(evidence.vomitEntriesNewestFirst.length, 1);
  assert.equal(evidence.yellowBileEntriesNewestFirst.length, 1);
  assert.equal(evidence.yellowBileEntriesNewestFirst[0]?.occurredAt, at(14 * 24));
  assert.equal(deriveBileWatchStatus(evidence), "Watch");

  const unrelatedAlertEvidence = deriveBileVomitEvidence30({
    now: NOW,
    entries: [
      {
        type: "potty",
        occurredAt: at(1),
        title: "Urgent stool",
        severity: "urgent",
      },
    ],
  });
  assert.equal(
    deriveBileWatchStatus(unrelatedAlertEvidence),
    "No data",
  );
});

test("zero bile or vomit evidence stays explicitly unknown, including packet language", () => {
  const bileStatus = deriveBileWatchStatus(
    deriveBileVomitEvidence30({ entries: [], now: NOW }),
  );

  assert.equal(bileStatus, "No data");

  const packet = deriveHealthReviewPacket({
    dogName: "Phoenix",
    healthStatus: "good",
    healthSummary: "No health watch signals logged in the selected window.",
    healthCounts: noWatchCounts,
    redFlagCount: 0,
    bileStatus,
    lastYellowBileLabel: "No data",
    longestMealLogIntervalLabel: "Needs at least two meal logs in 30 days",
    bedtimeSnackPlanLabel: "Not set",
  });
  const packetText = JSON.stringify(packet);

  assert.doesNotMatch(packetText, /low risk/i);
  assert.doesNotMatch(packetText, /calm/i);
  assert.equal(packet.statusLabel, "More data needed");
  assert.match(packetText, /more observations are logged/i);
});

test("shared review packet cannot include private health or bile content", () => {
  const privateMarker = "PRIVATE_CLINICAL_NOTE_DO_NOT_SHARE";
  const entries = [
    {
      id: "private-vomit",
      type: "vomit",
      title: privateMarker,
      note: privateMarker,
      severity: "urgent",
      occurredAt: at(1),
      details: { householdVisible: false, what: "yellow bile" },
    },
  ];
  const health = deriveHealthWatch({ entries, now: NOW, petName: "Phoenix" });
  const bile = deriveBileVomitEvidence30({ entries, now: NOW });
  const packet = deriveHealthReviewPacket({
    dogName: "Phoenix",
    healthStatus: health.status,
    healthSummary: health.summary,
    healthCounts: {
      vomit30: health.counts.vomit30,
      appetiteWatch7: health.counts.appetiteWatch7,
      stoolWatch7: health.counts.stoolWatch7,
      anxiety7: health.counts.anxiety7,
    },
    redFlagCount: health.redFlags.length,
    bileStatus: deriveBileWatchStatus(bile),
    lastYellowBileLabel: bile.yellowBileEntriesNewestFirst[0]?.occurredAt ?? "No data",
    longestMealLogIntervalLabel: "Needs at least two meal logs in 30 days",
    bedtimeSnackPlanLabel: "Not set",
  });
  const share = buildHealthReviewPacketShareText(packet, {
    dogName: "Phoenix",
    generatedAtIso: new Date(NOW).toISOString(),
  });

  assert.doesNotMatch(share, new RegExp(privateMarker));
  assert.match(share, /More data needed/);
  assert.match(share, /Vomiting logs in 30 days: 0/);
});

test("an urgent overall status outranks bile no-data in packet boundary language", () => {
  const packet = deriveHealthReviewPacket({
    dogName: "Phoenix",
    healthStatus: "alert",
    healthSummary: "A health alert needs caregiver review.",
    healthCounts: { ...noWatchCounts, stoolWatch7: 1 },
    redFlagCount: 1,
    bileStatus: "No data",
    lastYellowBileLabel: "No data in 30 days",
    longestMealLogIntervalLabel: "Needs at least two meal logs in 30 days",
    bedtimeSnackPlanLabel: "Not set",
  });

  assert.equal(packet.statusLabel, "Consider sharing with your vet");
  assert.match(packet.boundary, /consider sharing with your vet/i);
  assert.doesNotMatch(packet.boundary, /while more observations are logged/i);
});

test("Health and Bile no-evidence presentation avoids positive status leakage", () => {
  const healthSource = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "(tabs)", "health.tsx"),
    "utf8",
  );
  const packetSource = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "lib", "healthReviewPacket.ts"),
    "utf8",
  );
  const logSource = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "(tabs)", "log.tsx"),
    "utf8",
  );

  assert.doesNotMatch(healthSource, /\? "GOOD"/);
  assert.doesNotMatch(
    healthSource,
    /You're on a roll|Feeling steady|Care rhythm looks steady|Let's take it easy/,
  );
  assert.doesNotMatch(healthSource, /Bile looks low risk|records patterns calmly/);
  assert.match(healthSource, /heroLoggedDays7\s*=\s*isBileTab\s*\?\s*bileLoggedDays7\s*:\s*loggedDays7/);
  assert.match(healthSource, /heroStatusTone\s*=\s*isBileTab\s*\?\s*bileTone\s*:\s*statusTone/);
  assert.match(healthSource, /selectSharedCareEvidence\(state\.entries, now\)/);
  assert.match(healthSource, /deriveBileVomitEvidence30\(\{ entries: sharedEntries, now \}\)/);
  assert.match(healthSource, /deriveBileWatchStatus\(bileEvidence30\)/);
  assert.match(
    healthSource,
    /onPress=\{\(\) => openHealthStatusRoute\(isBileTab \? "symptom" : "note"\)\}/,
  );
  assert.match(healthSource, /isBileTab \? "Log vomiting" : "Log health note"/);
  assert.match(
    logSource,
    /label: "Vomit", type: "symptom"[^\n]+preset: \{ what: "vomit", severity: "watch" \}/,
  );
  assert.doesNotMatch(healthSource, /label="Longest food gap"/);
  assert.doesNotMatch(healthSource, /label="Bedtime snack proof"/);
  assert.doesNotMatch(
    packetSource,
    /deriveBileEvidenceWindow|Low Risk|calm household context|Longest food gap|Bedtime snack proof/,
  );
});

test("Health uses semantic foregrounds for primary actions and small status copy", () => {
  const healthSource = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "(tabs)", "health.tsx"),
    "utf8",
  );

  const primaryActionAt = healthSource.indexOf(
    "accessibilityLabel={healthReviewPacket.primaryAction.label}",
  );
  assert.notEqual(primaryActionAt, -1);
  const primaryAction = healthSource.slice(primaryActionAt, primaryActionAt + 700);
  assert.match(primaryAction, /backgroundColor: colors\.primary/);
  assert.match(primaryAction, /color: colors\.primaryForeground/);
  assert.doesNotMatch(primaryAction, /#FFFFFF|#fff|color: "white"/i);

  for (const semanticText of [
    "s.heroLabel, { color: colors.foreground",
    "s.healthRhythmTitle, { color: colors.foreground",
    "s.healthSignalStatus, { color: colors.foreground",
    "s.healthSignalAction, { color: colors.foreground",
    "s.patternStep, { color: colors.foreground",
    "s.boundaryLabel, { color: colors.foreground",
  ]) {
    assert.ok(
      healthSource.includes(semanticText),
      `missing semantic small-text foreground: ${semanticText}`,
    );
  }
});

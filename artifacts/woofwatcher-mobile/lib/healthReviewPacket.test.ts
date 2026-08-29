import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildHealthReviewPacketShareText,
  deriveMealLogIntervalEvidence,
  deriveHealthReviewPacket,
  resolveHealthReviewPacketActionHref,
  type HealthReviewPacketInput,
} from "./healthReviewPacket.ts";
import {
  deriveBileVomitEvidence30,
  deriveBileWatchStatus,
  deriveHealthWatch,
} from "../../../lib/care-domain/src/index.ts";

const baseInput: HealthReviewPacketInput = {
  dogName: "Phoenix",
  healthStatus: "good",
  healthSummary: "No health watch signals logged in the selected window.",
  healthCounts: {
    vomit30: 0,
    appetiteWatch7: 0,
    stoolWatch7: 0,
    anxiety7: 0,
  },
  redFlagCount: 0,
  bileStatus: "No data",
  lastYellowBileLabel: "No data in 30 days",
  longestMealLogIntervalLabel: "Needs at least two meal logs in 30 days",
  bedtimeSnackPlanLabel: "1 small bedtime snack",
};

test("meal spacing and a configured snack stay labeled as logs and a plan", () => {
  const now = Date.parse("2026-07-30T18:00:00.000Z");
  let rejectedTypeRead = false;
  let privateTimestampRead = false;
  const interval = deriveMealLogIntervalEvidence({
    now,
    entries: [
      {
        details: { householdVisible: false },
        get occurredAt(): string {
          privateTimestampRead = true;
          throw new Error("private meal timestamp must not be read");
        },
        get type(): string {
          rejectedTypeRead = true;
          throw new Error("private meal type must not be read");
        },
      },
      {
        occurredAt: "not-a-date",
        get type(): string {
          rejectedTypeRead = true;
          throw new Error("invalid meal type must not be read");
        },
      },
      {
        occurredAt: new Date(now + 1).toISOString(),
        get type(): string {
          rejectedTypeRead = true;
          throw new Error("future meal type must not be read");
        },
      },
      {
        occurredAt: new Date(now - 31 * 86_400_000).toISOString(),
        get type(): string {
          rejectedTypeRead = true;
          throw new Error("out-of-window meal type must not be read");
        },
      },
      { type: "meal", occurredAt: new Date(now - 29 * 86_400_000).toISOString() },
      { type: "meal", occurredAt: new Date(now - 3_600_000).toISOString() },
    ],
  });

  assert.deepEqual(interval, {
    mealLogCount: 2,
    longestIntervalHours: 695,
    label: "695.0 hours",
  });
  assert.equal(privateTimestampRead, false);
  assert.equal(rejectedTypeRead, false);

  const packet = deriveHealthReviewPacket({
    ...baseInput,
    longestMealLogIntervalLabel: interval.label,
  });
  const share = buildHealthReviewPacketShareText(packet, {
    dogName: "Phoenix",
    generatedAtIso: new Date(now).toISOString(),
  });
  assert.match(share, /Longest interval between meal logs: 695\.0 hours/);
  assert.match(share, /Bedtime snack plan: 1 small bedtime snack/);
  assert.doesNotMatch(share, /food gap|snack proof/i);
});

test("routes packet actions through canonical owners and preserves only a validated WoofGuide prompt", () => {
  const packet = deriveHealthReviewPacket(baseInput);
  assert.deepEqual(packet.primaryAction, {
    label: "Log health detail",
    route: "/log?type=symptom&detail=1&intent=health-review",
  });
  assert.deepEqual(packet.secondaryAction, {
    label: "Draft vet questions",
    route: "/more?section=woofguide",
    params: { prompt: "health-review" },
  });
  assert.deepEqual(resolveHealthReviewPacketActionHref(packet.secondaryAction), {
    pathname: "/more",
    params: { section: "woofguide", prompt: "health-review" },
  });
  assert.deepEqual(
    resolveHealthReviewPacketActionHref({
      label: "Untrusted prompt",
      route: "/more?section=woofguide",
      params: {
        prompt: "\u202ehidden",
        extra: "must-not-leak",
        section: "privacy",
      },
    }),
    {
      pathname: "/more",
      params: { section: "woofguide" },
    },
  );
  assert.deepEqual(
    resolveHealthReviewPacketActionHref({
      label: "Repeated prompt",
      route: "/more?section=woofguide",
      params: {
        prompt: ["health-review", "ignored"],
      } as unknown as Record<string, string>,
    }),
    {
      pathname: "/more",
      params: { section: "woofguide" },
    },
  );
  assert.deepEqual(
    resolveHealthReviewPacketActionHref({
      label: "Inherited prompt",
      route: "/more?section=woofguide",
      params: Object.create({ prompt: "health-review" }) as Record<string, string>,
    }),
    {
      pathname: "/more",
      params: { section: "woofguide" },
    },
  );
});

test("keeps a non-urgent 14-day yellow-bile pattern at Watch", () => {
  const now = Date.parse("2026-07-30T18:00:00.000Z");
  const entries = [
    {
      id: "older_bile",
      type: "vomit",
      title: "Yellow bile vomit",
      note: "Yellow bile noted",
      occurredAt: new Date(now - 14 * 86_400_000).toISOString(),
    },
  ];
  const healthWatch = deriveHealthWatch({
    entries,
    routines: [],
    now,
    petName: "Phoenix",
  });

  assert.equal(healthWatch.status, "watch");
  assert.equal(healthWatch.counts.vomit7, 0);
  assert.ok(
    healthWatch.signals.some((signal) => signal.kind === "vomit-pattern"),
  );
  const bileEvidence = deriveBileVomitEvidence30({ entries, now });
  assert.equal(bileEvidence.vomitEntriesNewestFirst[0]?.occurredAt, entries[0].occurredAt);
  assert.equal(deriveBileWatchStatus(bileEvidence), "Watch");
});

test("keeps an urgent 14-day yellow-bile event at Review", () => {
  const now = Date.parse("2026-07-30T18:00:00.000Z");
  const entries = [
    {
      id: "older_urgent_bile",
      type: "vomit",
      title: "Yellow bile vomit",
      note: "Yellow bile noted",
      severity: "urgent",
      occurredAt: new Date(now - 14 * 86_400_000).toISOString(),
    },
  ];
  const healthWatch = deriveHealthWatch({
    entries,
    routines: [],
    now,
    petName: "Phoenix",
  });

  assert.equal(healthWatch.status, "alert");
  assert.equal(healthWatch.counts.vomit7, 0);
  assert.equal(healthWatch.redFlags.length, 1);
  const bileEvidence = deriveBileVomitEvidence30({ entries, now });
  assert.equal(bileEvidence.urgentVomitEntriesNewestFirst.length, 1);
  assert.equal(deriveBileWatchStatus(bileEvidence), "Review");
});

test("keeps one urgent non-bile vomit at Review throughout the 30-day window", () => {
  const now = Date.parse("2026-07-30T18:00:00.000Z");

  for (const daysAgo of [1, 8]) {
    const entryId = `urgent_vomit_${daysAgo}`;
    const entries = [
      {
        id: entryId,
        type: "vomit",
        title: "Urgent vomit",
        note: "Clear fluid",
        severity: "urgent",
        occurredAt: new Date(
          now - daysAgo * 86_400_000,
        ).toISOString(),
      },
    ];
    const healthWatch = deriveHealthWatch({
      entries,
      routines: [],
      now,
      petName: "Phoenix",
    });

    assert.equal(healthWatch.status, "alert");
    assert.ok(
      healthWatch.signals.some(
        (signal) =>
          signal.kind === "vomit-pattern" &&
          signal.urgency === "alert" &&
          signal.entryIds.includes(entryId),
      ),
    );
    const bileEvidence = deriveBileVomitEvidence30({ entries, now });
    assert.equal(deriveBileWatchStatus(bileEvidence), "Review");
  }
});

test("keeps an unrelated urgent stool event out of Bile Watch", () => {
  const now = Date.parse("2026-07-30T18:00:00.000Z");
  const entries = [
    {
      id: "older_bile",
      type: "vomit",
      title: "Yellow bile vomit",
      note: "Yellow bile noted",
      occurredAt: new Date(now - 14 * 86_400_000).toISOString(),
    },
    {
      id: "urgent_stool",
      type: "potty",
      title: "Urgent loose stool",
      note: "Loose stool needs prompt review",
      severity: "urgent",
      occurredAt: new Date(now - 60_000).toISOString(),
      details: { condition: "loose" },
    },
  ];
  const healthWatch = deriveHealthWatch({
    entries,
    routines: [],
    now,
    petName: "Phoenix",
  });

  assert.equal(healthWatch.status, "alert");
  assert.ok(
    healthWatch.signals.some(
      (signal) =>
        signal.kind === "vomit-pattern" && signal.urgency === "watch",
    ),
  );
  assert.ok(
    healthWatch.signals.some(
      (signal) =>
        signal.kind === "stool-watch" && signal.urgency === "alert",
    ),
  );
  const bileEvidence = deriveBileVomitEvidence30({ entries, now });
  assert.equal(bileEvidence.urgentVomitEntriesNewestFirst.length, 0);
  assert.equal(deriveBileWatchStatus(bileEvidence), "Watch");
});

test("keeps a no-evidence Health Review Packet neutral", () => {
  const packet = deriveHealthReviewPacket(baseInput);

  assert.equal(packet.title, "Review packet");
  assert.equal(packet.statusLabel, "More data needed");
  assert.equal(packet.languagePill, "Not veterinary advice");
  assert.match(packet.summary, /Phoenix/);
  assert.match(packet.summary, /owner observations/i);
  assert.ok(packet.prompts.includes("Log bile or vomiting observations to build the 30-day evidence window."));
  assert.ok(packet.vetShareChecklist.includes("Recent meals, portions, and appetite notes"));
  assert.ok(packet.vetShareChecklist.includes("Last yellow bile event: No data in 30 days"));
  assert.ok(packet.vetShareChecklist.includes("Vomiting logs in 30 days: 0"));
  assert.doesNotMatch(JSON.stringify(packet), /steady|calm|low risk/i);
  assert.deepEqual(packet.primaryAction, {
    label: "Log health detail",
    route: "/log?type=symptom&detail=1&intent=health-review",
  });
  assert.deepEqual(packet.secondaryAction, {
    label: "Draft vet questions",
    route: "/more?section=woofguide",
    params: { prompt: "health-review" },
  });
});

test("raises watch language when bile, meal-log intervals, or health signals need review", () => {
  const packet = deriveHealthReviewPacket({
    ...baseInput,
    healthStatus: "watch",
    healthSummary: "1 vomit incident in 7 days, with yellow bile noted.",
    healthCounts: {
      vomit30: 1,
      appetiteWatch7: 2,
      stoolWatch7: 0,
      anxiety7: 1,
    },
    bileStatus: "Watch",
    lastYellowBileLabel: "Jun 26, 7:15 AM",
    longestMealLogIntervalLabel: "13.5 hours",
  });

  assert.equal(packet.statusLabel, "Worth watching");
  assert.equal(packet.languagePill, "Pattern noticed");
  assert.match(packet.summary, /Pattern noticed/);
  assert.match(packet.summary, /13.5 hours/);
  assert.ok(packet.prompts.includes("Capture timing, time since the last logged meal, appetite after, energy after, stool detail, and hydration."));
  assert.ok(packet.vetShareChecklist.includes("Longest interval between meal logs: 13.5 hours"));
  assert.ok(packet.vetShareChecklist.includes("Appetite watch logs: 2"));
  assert.ok(packet.vetShareChecklist.includes("Anxiety or alone-time signals: 1"));
  assert.ok(packet.boundary.includes("Consider sharing with your vet"));
  assert.ok(packet.boundary.includes("Not veterinary advice"));
});

test("uses review language without diagnosis or treatment claims for alert status", () => {
  const packet = deriveHealthReviewPacket({
    ...baseInput,
    healthStatus: "alert",
    healthSummary: "A health alert needs caregiver review.",
    redFlagCount: 1,
    bileStatus: "Review",
    lastYellowBileLabel: "Jun 27, 6:10 AM",
    longestMealLogIntervalLabel: "15.0 hours",
  });

  assert.equal(packet.statusLabel, "Consider sharing with your vet");
  assert.equal(packet.languagePill, "Review");
  assert.match(packet.summary, /caregiver review/i);
  assert.ok(packet.vetShareChecklist.includes("Red-flag logs to review: 1"));
  assert.ok(packet.prompts.includes("If urgent red flags appear, contact a veterinarian or emergency clinic promptly."));

  const combined = [
    packet.summary,
    packet.boundary,
    ...packet.prompts,
    ...packet.vetShareChecklist,
  ].join(" ");

  assert.doesNotMatch(combined, /\bdiagnose[sd]?\b/i);
  assert.doesNotMatch(combined, /\btreat(?:ment|s|ed|ing)?\b/i);
  assert.doesNotMatch(combined, /\bcure[sd]?\b/i);
});

test("formats a shareable Health Review Packet without medical certainty", () => {
  const packet = deriveHealthReviewPacket({
    ...baseInput,
    healthStatus: "watch",
    healthSummary: "Yellow bile was logged once this week.",
    healthCounts: {
      vomit30: 1,
      appetiteWatch7: 1,
      stoolWatch7: 0,
      anxiety7: 0,
    },
    bileStatus: "Watch",
    lastYellowBileLabel: "Jun 27, 7:05 AM",
    longestMealLogIntervalLabel: "13.0 hours",
  });

  const text = buildHealthReviewPacketShareText(packet, {
    dogName: "Phoenix",
    generatedAtIso: "2026-06-27T16:50:00.000Z",
  });

  assert.match(text, /WoofWatcher Health Review Packet/);
  assert.match(text, /Generated: 2026-06-27T16:50:00.000Z/);
  assert.match(text, /Dog: Phoenix/);
  assert.match(text, /Status: Worth watching/);
  assert.match(text, /Language: Pattern noticed/);
  assert.match(text, /Suggested prompts/);
  assert.match(text, /Vet-share checklist/);
  assert.match(text, /Boundary/);
  assert.match(text, /Not veterinary advice/);
  assert.doesNotMatch(text, /\bdiagnose[sd]?\b/i);
  assert.doesNotMatch(text, /\btreat(?:ment|s|ed|ing)?\b/i);
});

test("keeps fresh-install review and share copy neutral", () => {
  const packet = deriveHealthReviewPacket({
    ...baseInput,
    dogName: "My Dog",
    healthStatus: "watch",
    bileStatus: "Watch",
  });
  const text = buildHealthReviewPacketShareText(packet, { dogName: "My Dog" });

  assert.match(packet.prompts.join(" "), /what your dog ate/);
  assert.match(text, /Dog: your dog/);
  assert.doesNotMatch(`${JSON.stringify(packet)} ${text}`, /Phoenix|My Dog/);
});

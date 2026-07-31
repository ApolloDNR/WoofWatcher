import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildHealthReviewPacketShareText,
  deriveBileWatchStatus,
  deriveHealthReviewPacket,
  type HealthReviewPacketInput,
} from "./healthReviewPacket.ts";
import { deriveHealthWatch } from "../../../lib/care-domain/src/index.ts";

const baseInput: HealthReviewPacketInput = {
  dogName: "Phoenix",
  healthStatus: "good",
  healthSummary: "No health watch signals logged in the selected window.",
  healthCounts: {
    vomit7: 0,
    appetiteWatch7: 0,
    stoolWatch7: 0,
    anxiety7: 0,
  },
  redFlagCount: 0,
  bileStatus: "Low Risk",
  lastYellowBileLabel: "None logged",
  longestFoodGapLabel: "Needs more meal logs",
  bedtimeSnackLabel: "1 small bedtime snack",
};

test("keeps a non-urgent 14-day yellow-bile pattern at Watch", () => {
  const now = Date.parse("2026-07-30T18:00:00.000Z");
  const healthWatch = deriveHealthWatch({
    entries: [
      {
        id: "older_bile",
        type: "vomit",
        title: "Yellow bile vomit",
        note: "Yellow bile noted",
        occurredAt: new Date(now - 14 * 86_400_000).toISOString(),
      },
    ],
    routines: [],
    now,
    petName: "Phoenix",
  });

  assert.equal(healthWatch.status, "watch");
  assert.equal(healthWatch.counts.vomit7, 0);
  assert.ok(
    healthWatch.signals.some((signal) => signal.kind === "vomit-pattern"),
  );
  assert.equal(
    deriveBileWatchStatus({
      healthStatus: healthWatch.status,
      vomit7: healthWatch.counts.vomit7,
      recentYellowBileCount: 0,
      signals: healthWatch.signals,
    }),
    "Watch",
  );
});

test("keeps an urgent 14-day yellow-bile event at Review", () => {
  const now = Date.parse("2026-07-30T18:00:00.000Z");
  const healthWatch = deriveHealthWatch({
    entries: [
      {
        id: "older_urgent_bile",
        type: "vomit",
        title: "Yellow bile vomit",
        note: "Yellow bile noted",
        severity: "urgent",
        occurredAt: new Date(now - 14 * 86_400_000).toISOString(),
      },
    ],
    routines: [],
    now,
    petName: "Phoenix",
  });

  assert.equal(healthWatch.status, "alert");
  assert.equal(healthWatch.counts.vomit7, 0);
  assert.equal(healthWatch.redFlags.length, 1);
  assert.equal(
    deriveBileWatchStatus({
      healthStatus: healthWatch.status,
      vomit7: healthWatch.counts.vomit7,
      recentYellowBileCount: 0,
      signals: healthWatch.signals,
    }),
    "Review",
  );
});

test("builds a steady non-diagnostic Health Review Packet", () => {
  const packet = deriveHealthReviewPacket(baseInput);

  assert.equal(packet.title, "Review packet");
  assert.equal(packet.statusLabel, "Steady");
  assert.equal(packet.languagePill, "Not veterinary advice");
  assert.match(packet.summary, /Phoenix/);
  assert.match(packet.summary, /owner observations/i);
  assert.ok(packet.prompts.includes("Keep logging meals, stool, vomiting, energy, and medication."));
  assert.ok(packet.vetShareChecklist.includes("Recent meals, portions, and appetite notes"));
  assert.ok(packet.vetShareChecklist.includes("Last yellow bile event: None logged"));
  assert.deepEqual(packet.primaryAction, {
    label: "Log health detail",
    route: "/log?type=symptom&detail=1&intent=health-review",
  });
  assert.deepEqual(packet.secondaryAction, {
    label: "Draft vet questions",
    route: "/woofguide",
    params: { prompt: "health-review" },
  });
});

test("raises watch language when bile, food gap, or health signals need review", () => {
  const packet = deriveHealthReviewPacket({
    ...baseInput,
    healthStatus: "watch",
    healthSummary: "1 vomit incident in 7 days, with yellow bile noted.",
    healthCounts: {
      vomit7: 1,
      appetiteWatch7: 2,
      stoolWatch7: 0,
      anxiety7: 1,
    },
    bileStatus: "Watch",
    lastYellowBileLabel: "Jun 26, 7:15 AM",
    longestFoodGapLabel: "13.5 hours",
  });

  assert.equal(packet.statusLabel, "Worth watching");
  assert.equal(packet.languagePill, "Pattern noticed");
  assert.match(packet.summary, /Pattern noticed/);
  assert.match(packet.summary, /13.5 hours/);
  assert.ok(packet.prompts.includes("Capture timing, food gap, appetite after, energy after, stool detail, and hydration."));
  assert.ok(packet.vetShareChecklist.includes("Longest food gap: 13.5 hours"));
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
    longestFoodGapLabel: "15.0 hours",
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
      vomit7: 1,
      appetiteWatch7: 1,
      stoolWatch7: 0,
      anxiety7: 0,
    },
    bileStatus: "Watch",
    lastYellowBileLabel: "Jun 27, 7:05 AM",
    longestFoodGapLabel: "13.0 hours",
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

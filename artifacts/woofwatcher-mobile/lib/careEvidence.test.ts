import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveCareEvidenceSnapshot,
  selectEvidenceBackedHealthPatterns,
  type CareEvidenceEntry,
  type EvidenceLaneId,
} from "./careEvidence.ts";
import { deriveAvatarMotion } from "./avatarMotion.ts";
import { derivePhoenixStatus } from "./phoenixStatus.ts";
import { deriveHealthHeroAttention } from "./healthHeroAttention.ts";

const NOW = new Date("2026-07-23T18:00:00.000Z").getTime();

function entry(
  type: string,
  input: Partial<CareEvidenceEntry> = {},
): CareEvidenceEntry {
  return {
    id: `${type}-${Math.random()}`,
    type,
    occurredAt: new Date(NOW - 60 * 60 * 1000).toISOString(),
    ...input,
  };
}

test("zero entries produces six explicit not-logged evidence lanes", () => {
  const snapshot = deriveCareEvidenceSnapshot([], NOW);

  assert.equal(snapshot.windowDays, 7);
  assert.equal(snapshot.observedCount, 0);
  assert.equal(snapshot.totalCount, 6);
  assert.deepEqual(
    snapshot.lanes.map((lane) => [lane.id, lane.status]),
    [
      ["mood", "not-logged"],
      ["energy", "not-logged"],
      ["appetite", "not-logged"],
      ["hydration", "not-logged"],
      ["stool", "not-logged"],
      ["activity", "not-logged"],
    ],
  );
  for (const lane of snapshot.lanes) {
    assert.equal(lane.observedAt, null);
    assert.equal(lane.detail, "Not logged");
    assert.equal(lane.value, null);
    assert.match(lane.prompt, /^Log /);
  }
});

test("an unrelated note does not unlock any care evidence lane", () => {
  const snapshot = deriveCareEvidenceSnapshot([
    entry("note", {
      title: "House note",
      note: "Happy, high energy, ate, drank water, pooped, and walked.",
    }),
  ], NOW);

  assert.equal(snapshot.observedCount, 0);
  assert.ok(snapshot.lanes.every((lane) => lane.status === "not-logged"));
});

test("explicit evidence unlocks only the lane it actually observes", () => {
  const cases: {
    name: string;
    evidence: CareEvidenceEntry;
    expected: EvidenceLaneId;
  }[] = [
    {
      name: "mood",
      evidence: entry("mood", { mood: "calm" }),
      expected: "mood",
    },
    {
      name: "energy",
      evidence: entry("mood", { details: { energyLevel: "steady" } }),
      expected: "energy",
    },
    {
      name: "appetite",
      evidence: entry("meal", { details: { mealCompletion: "complete" } }),
      expected: "appetite",
    },
    {
      name: "hydration",
      evidence: entry("water", { details: { amount: "bowl" } }),
      expected: "hydration",
    },
    {
      name: "stool",
      evidence: entry("potty", {
        details: { kind: "poop", condition: "normal" },
      }),
      expected: "stool",
    },
    {
      name: "activity",
      evidence: entry("walk", { durationMinutes: 20 }),
      expected: "activity",
    },
  ];

  for (const { name, evidence, expected } of cases) {
    const snapshot = deriveCareEvidenceSnapshot([evidence], NOW);
    assert.equal(snapshot.observedCount, 1, `${name} should count once`);
    for (const lane of snapshot.lanes) {
      assert.equal(
        lane.status,
        lane.id === expected ? "observed" : "not-logged",
        `${name} should only unlock ${expected}, not ${lane.id}`,
      );
    }
  }
});

test("watch observations remain evidence without becoming positive claims", () => {
  const snapshot = deriveCareEvidenceSnapshot([
    entry("mood", {
      mood: "anxious",
      details: { energyLevel: "low" },
    }),
    entry("meal", { details: { mealCompletion: "skipped" } }),
    entry("potty", {
      details: { kind: "poop", condition: "soft" },
    }),
  ], NOW);

  assert.equal(snapshot.observedCount, 4);
  for (const id of ["mood", "energy", "appetite", "stool"] as const) {
    assert.equal(
      snapshot.lanes.find((lane) => lane.id === id)?.status,
      "watch",
    );
  }
});

test("served or unstructured meals do not claim an appetite outcome", () => {
  const snapshot = deriveCareEvidenceSnapshot([
    entry("meal", { details: { mealCompletion: "served" } }),
    entry("meal", { title: "Meal" }),
  ], NOW);

  const appetite = snapshot.lanes.find((lane) => lane.id === "appetite")!;
  assert.equal(appetite.status, "not-logged");
  assert.equal(appetite.detail, "Not logged");
  assert.equal(snapshot.observedCount, 0);
});

test("outcome-pending grazing does not claim an appetite observation", () => {
  const snapshot = deriveCareEvidenceSnapshot([
    entry("meal", {
      details: {
        mealCompletion: "grazing",
        mealLifecycle: "outcome-pending",
      },
    }),
  ], NOW);

  const appetite = snapshot.lanes.find((lane) => lane.id === "appetite")!;
  assert.equal(appetite.status, "not-logged");
  assert.equal(appetite.detail, "Not logged");
  assert.equal(snapshot.observedCount, 0);
});

test("a shared yellow-bile observation is health attention even when none of the six care lanes apply", () => {
  const entries = [
    entry("vomit", {
      title: "Yellow bile",
      note: "Yellow bile before breakfast",
      details: { householdVisible: true },
    }),
  ];
  const snapshot = deriveCareEvidenceSnapshot(entries, NOW);
  const hero = deriveHealthHeroAttention({
    careEvidenceObservedCount: snapshot.observedCount,
    careEvidenceTotalCount: snapshot.totalCount,
    evidenceWatchCount: 0,
    healthStatus: "watch",
    healthSummary: "1 vomit incident in 7 days, with yellow bile noted.",
    bileStatus: "Watch",
  });

  assert.equal(snapshot.observedCount, 0);
  assert.equal(hero.kind, "health-attention");
  assert.equal(hero.statusLabel, "REVIEW LOGS");
  assert.match(hero.title, /health observation/i);
  assert.match(hero.copy, /yellow bile/i);
  assert.match(hero.copy, /not diagnose/i);
  assert.doesNotMatch(`${hero.title} ${hero.copy}`, /score|wellness|low risk/i);
});

test("pattern rows omit the synthetic steady fallback", () => {
  const rows = selectEvidenceBackedHealthPatterns([
    { kind: "steady", label: "Health steady" },
    { kind: "vomit-pattern", label: "Vomit pattern" },
  ]);

  assert.deepEqual(rows, [
    { kind: "vomit-pattern", label: "Vomit pattern" },
  ]);
  assert.deepEqual(
    selectEvidenceBackedHealthPatterns([
      { kind: "steady", label: "Health steady" },
    ]),
    [],
  );
});

test("private entries are excluded from the household evidence summary", () => {
  const privateEntries = [
    entry("mood", {
      mood: "happy",
      details: { energyLevel: "high", householdVisible: false },
    }),
    entry("meal", {
      details: { mealCompletion: "complete", householdVisible: false },
    }),
    entry("water", { details: { amount: "bowl", householdVisible: false } }),
    entry("potty", {
      details: {
        kind: "poop",
        condition: "normal",
        householdVisible: false,
      },
    }),
    entry("walk", {
      durationMinutes: 30,
      details: { householdVisible: false },
    }),
  ];

  const snapshot = deriveCareEvidenceSnapshot(privateEntries, NOW);

  assert.equal(snapshot.observedCount, 0);
  assert.ok(snapshot.lanes.every((lane) => lane.status === "not-logged"));
});

test("Phoenix household counts do not reveal private care entries", () => {
  const status = derivePhoenixStatus(
    {
      entries: [
        entry("meal", {
          details: {
            mealCompletion: "complete",
            householdVisible: false,
          },
        }),
      ],
      routines: [],
    } as never,
    NOW,
  );

  assert.equal(status.counts.meals.done, 0);
  assert.equal(status.evidence.observedCount, 0);
  assert.equal(status.meta.label, "Not logged");
});

test("the seven-day snapshot uses the newest eligible household observation", () => {
  const newest = new Date(NOW - 2 * 60 * 60 * 1000).toISOString();
  const snapshot = deriveCareEvidenceSnapshot([
    entry("mood", {
      occurredAt: new Date(NOW - 8 * 86400000).toISOString(),
      mood: "anxious",
    }),
    entry("mood", {
      occurredAt: new Date(NOW + 60 * 1000).toISOString(),
      mood: "anxious",
    }),
    entry("mood", {
      occurredAt: new Date(NOW - 24 * 60 * 60 * 1000).toISOString(),
      mood: "happy",
    }),
    entry("mood", { occurredAt: newest, mood: "calm" }),
  ], NOW);

  const mood = snapshot.lanes.find((lane) => lane.id === "mood")!;
  assert.equal(snapshot.observedCount, 1);
  assert.equal(mood.status, "observed");
  assert.equal(mood.observedAt, newest);
  assert.equal(mood.value, "calm");
  assert.equal(mood.detail, "Calm logged");
});

test("Phoenix status exposes not-logged mood and energy instead of simulated labels", () => {
  const status = derivePhoenixStatus(
    { entries: [], routines: [] } as never,
    NOW,
  );

  assert.equal(status.evidence.observedCount, 0);
  assert.equal(status.moodObserved, false);
  assert.equal(status.energyObserved, false);
  assert.equal(status.meta.label, "Not logged");
  assert.equal(status.energyLabel, "Not logged");
});

test("Phoenix status uses explicit owner mood and energy observations", () => {
  const status = derivePhoenixStatus(
    {
      entries: [
        entry("mood", {
          mood: "calm",
          details: { energyLevel: "steady" },
        }),
      ],
      routines: [],
    } as never,
    NOW,
  );

  assert.equal(status.moodObserved, true);
  assert.equal(status.energyObserved, true);
  assert.equal(status.meta.label, "Calm");
  assert.equal(status.energyLabel, "Steady");
});

test("avatar defaults to neutral not-logged copy without observations", () => {
  const motion = deriveAvatarMotion({
    entries: [],
    routines: [],
    now: NOW,
  });

  assert.equal(motion.cue, "slow-breath");
  assert.equal(motion.intensity, "resting");
  assert.equal(motion.avatarMood, "calm");
  assert.equal(motion.label, "Not logged");
  assert.match(motion.speech, /check-in/i);
  assert.doesNotMatch(`${motion.speech} ${motion.line}`, /steady|happy|content/i);
});

test("avatar reflects an explicit mood watch instead of reverting to happy", () => {
  const motion = deriveAvatarMotion({
    entries: [
      entry("mood", {
        occurredAt: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(),
        mood: "anxious",
      }),
    ],
    routines: [],
    now: NOW,
  });

  assert.equal(motion.state, "sad");
  assert.equal(motion.avatarMood, "anxious");
  assert.equal(motion.label, "Anxious logged");
  assert.match(motion.line, /owner observation/i);
  assert.doesNotMatch(motion.line, /diagnos/i);
});

test("avatar uses explicit low energy without requiring a synthetic percentage", () => {
  const motion = deriveAvatarMotion({
    entries: [
      entry("mood", {
        occurredAt: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(),
        details: { energyLevel: "low" },
      }),
    ],
    routines: [],
    now: NOW,
  });

  assert.equal(motion.state, "tired");
  assert.equal(motion.label, "Low logged");
  assert.match(motion.line, /owner observation/i);
});

test("avatar does not expose a recent private care entry to the household", () => {
  const motion = deriveAvatarMotion({
    entries: [
      entry("meal", {
        occurredAt: new Date(NOW - 5 * 60 * 1000).toISOString(),
        details: { mealCompletion: "complete", householdVisible: false },
      }),
    ],
    routines: [],
    now: NOW,
  });

  assert.equal(motion.label, "Not logged");
  assert.notEqual(motion.state, "eating");
});

test("avatar does not turn a private health observation into a household alert", () => {
  const motion = deriveAvatarMotion({
    entries: [
      entry("vomit", {
        occurredAt: new Date(NOW - 5 * 60 * 1000).toISOString(),
        severity: "alert",
        details: { householdVisible: false },
      }),
    ],
    routines: [],
    now: NOW,
  });

  assert.equal(motion.label, "Not logged");
  assert.notEqual(motion.state, "sick");
});

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCarePass,
  createCarePassArtifact,
  createPetCredentialArtifact,
  createProgressReportArtifact,
  getCarePassArtifactPrintView,
  getReportArtifactPrintView,
  renderCarePassPrintHtml,
  renderProgressReportPrintHtml,
  describeReportArtifactRemoval,
  describeReportArtifactSource,
  summarizeReportArtifacts,
  summarizePetCredentialArtifacts,
} from "../src/index.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-06T15:00:00-07:00").getTime();

function baseInput() {
  return {
    now: NOW,
    profile: {
      name: "Phoenix",
      breed: "German Shepherd mix",
      weight: { current: 68, unit: "lb" },
      careFocus: "Keep meals calm and track yellow bile vomiting.",
      vetBoundary: "Track patterns for caregiver and vet review. This is not a diagnosis.",
    },
    dietProfile: {
      primaryFood: "Sensitive stomach kibble",
      normalPortion: "1 cup",
      mealSchedule: "7 AM and 6 PM",
      bedtimeSnack: "Small kibble snack",
      avoid: "Rich treats",
      appetiteQuirks: "Eats better when the house is calm.",
    },
    caregivers: [
      { name: "Emma", role: "Primary" },
      { name: "Apollo", role: "Caregiver" },
    ],
    routines: [
      { id: "breakfast", type: "meal", label: "Breakfast", time: "7:00 AM", owner: "Emma" },
      { id: "walk", type: "walk", label: "Walk", time: "8:30 AM", owner: "Apollo" },
      { id: "dinner", type: "meal", label: "Dinner", time: "6:00 PM", owner: "Emma" },
    ],
    records: [
      { id: "rabies", type: "vaccine", title: "Rabies", due: "May 2026", note: "Up to date" },
    ],
    entries: [
      {
        id: "meal_1",
        type: "meal",
        title: "Breakfast",
        caregiver: "Emma",
        occurredAt: "2026-06-06T14:00:00.000Z",
      },
      {
        id: "walk_1",
        type: "walk",
        title: "Morning walk",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T14:30:00.000Z",
        durationMinutes: 25,
      },
      {
        id: "vomit_1",
        type: "vomit",
        title: "Yellow bile",
        caregiver: "Emma",
        occurredAt: "2026-06-06T13:00:00.000Z",
        severity: "watch",
        details: { kind: "yellow bile" },
      },
    ],
  };
}

test("builds a sitter care pass with routine, diet, and next action context", () => {
  const pass = buildCarePass({ ...baseInput(), audience: "sitter" });

  assert.equal(pass.audience, "sitter");
  assert.match(pass.title, /Sitter Care Pass/);
  assert.match(pass.message, /Phoenix/);
  assert.match(pass.message, /Dinner at 6:00 PM/);
  assert.match(pass.message, /Sensitive stomach kibble/);
  assert.match(pass.message, /Small kibble snack/);
  assert.match(pass.message, /Keep meals calm/);
});

test("sitter care pass includes a practical handoff checklist", () => {
  const pass = buildCarePass({ ...baseInput(), audience: "sitter" });

  assert.ok(pass.sections.some((section) => section.title === "Handoff Checklist"));
  assert.match(pass.message, /Confirm the next routine/i);
  assert.match(pass.message, /served amount/i);
  assert.match(pass.message, /Health Watch/i);
});

test("builds a vet care pass with health signals and records", () => {
  const pass = buildCarePass({ ...baseInput(), audience: "vet" });

  assert.match(pass.title, /Vet Care Pass/);
  assert.match(pass.message, /Yellow bile/);
  assert.match(pass.message, /Health watch/);
  assert.match(pass.message, /Rabies/);
  assert.match(pass.message, /not a diagnosis/i);
});

test("vet care pass includes health pattern review next steps", () => {
  const pass = buildCarePass({ ...baseInput(), audience: "vet" });

  assert.ok(pass.sections.some((section) => section.title === "Health Pattern Review"));
  assert.match(pass.message, /Yellow bile/i);
  assert.match(pass.message, /Track timing/i);
  assert.match(pass.message, /vet promptly/i);
});

test("care pass includes medication adherence and follow-up language", () => {
  const pass = buildCarePass({
    ...baseInput(),
    audience: "vet",
    now: new Date("2026-06-06T11:00:00-07:00").getTime(),
    routines: [
      ...baseInput().routines,
      { id: "am-meds", type: "medication", label: "Apoquel", time: "8:00 AM", owner: "Apollo", note: "1 tablet" },
      { id: "pm-meds", type: "medication", label: "Probiotic", time: "9:00 PM", owner: "Emma", note: "1 capsule" },
    ],
    records: [
      ...baseInput().records,
      { id: "apoquel-refill", type: "medication", title: "Apoquel refill", due: "Jun 10, 2026", note: "14 tablets left" },
    ],
    entries: [
      ...baseInput().entries,
      {
        id: "am-log",
        type: "medication",
        title: "Apoquel",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T08:05:00-07:00",
        details: { routineId: "am-meds", dose: "1 tablet", medicationOutcome: "taken", householdVisible: true },
      },
    ],
  });

  assert.ok(pass.sections.some((section) => section.title === "Medication"));
  assert.match(pass.message, /1\/2 medication doses logged today/);
  assert.match(pass.message, /Apoquel: taken/);
  assert.match(pass.message, /Probiotic: upcoming/);
  assert.match(pass.message, /Apoquel refill due soon/);
});

test("care pass includes daily hydration language", () => {
  const pass = buildCarePass({
    ...baseInput(),
    audience: "sitter",
    now: new Date("2026-06-06T20:00:00-07:00").getTime(),
    entries: [
      ...baseInput().entries,
      {
        id: "water_1",
        type: "water",
        title: "Fresh water refill",
        caregiver: "Emma",
        occurredAt: "2026-06-06T10:00:00-07:00",
        details: { waterAmount: "refill", householdVisible: true },
      },
      {
        id: "water_2",
        type: "water",
        title: "A sip",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T18:00:00-07:00",
        details: { amount: "sip", householdVisible: true },
      },
    ],
  });

  assert.ok(pass.sections.some((section) => section.title === "Hydration"));
  assert.match(pass.message, /2 water logs today/);
  assert.match(pass.message, /1.25 bowl refills tracked/);
  assert.match(pass.message, /Keep logging fresh water/i);
});

test("care pass includes walk activity and dog interaction context", () => {
  const pass = buildCarePass({
    audience: "trainer",
    profile: {
      name: "Phoenix",
      breed: "German Shepherd Mix",
      careFocus: "Practice calm greetings.",
      vetBoundary: "Owner-reported context only.",
    },
    dietProfile: {},
    routines: [{ id: "walk", type: "walk", label: "Walk", time: "8:30 AM", owner: "Apollo" }],
    caregivers: [{ name: "Apollo", role: "Owner" }],
    records: [],
    now: new Date("2026-06-06T20:00:00-07:00").getTime(),
    entries: [
      {
        id: "walk-park",
        type: "walk",
        title: "Dog park visit",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T17:20:00-07:00",
        details: {
          durationMinutes: 35,
          location: "Dog park",
          dogInteractions: 2,
          socialOutcome: "Calm greeting, one bark near the gate",
        },
      },
    ],
  });

  const activity = pass.sections.find((section) => section.title === "Walk Activity");
  assert.ok(activity);
  assert.match(pass.message, /1 walk today - 35 minutes, 2 dog interactions noted/);
  assert.match(pass.message, /Places: Dog park/);
  assert.match(pass.message, /Latest: Dog park visit at Dog park/);
  assert.match(pass.message, /Saved routes: Dog park \(1 visit, 35m avg, 2 dog interactions\) - Social practice route/);
});

test("care pass includes weekly care trend context", () => {
  const pass = buildCarePass({
    ...baseInput(),
    audience: "sitter",
    now: new Date("2026-06-08T12:00:00-07:00").getTime(),
    entries: [
      {
        id: "meal-complete",
        type: "meal",
        title: "Breakfast",
        caregiver: "Emma",
        occurredAt: "2026-06-08T07:00:00-07:00",
        details: { mealCompletion: "complete", householdVisible: true },
      },
      {
        id: "meal-partial",
        type: "meal",
        title: "Dinner",
        caregiver: "Apollo",
        occurredAt: "2026-06-07T18:00:00-07:00",
        details: { mealCompletion: "partial", householdVisible: true },
      },
      {
        id: "walk",
        type: "walk",
        title: "Neighborhood walk",
        caregiver: "Emma",
        occurredAt: "2026-06-08T08:30:00-07:00",
        durationMinutes: 35,
        details: { routeName: "Neighborhood Loop", distanceMiles: 1.4 },
      },
      {
        id: "potty-watch",
        type: "potty",
        title: "Potty - poop",
        caregiver: "Apollo",
        occurredAt: "2026-06-08T10:00:00-07:00",
        details: { kind: "poop", condition: "soft", householdVisible: true },
      },
    ],
  });

  assert.ok(pass.sections.some((section) => section.title === "Care Trends"));
  assert.match(pass.message, /7-day trends/);
  assert.match(pass.message, /4 visible care logs over 2 days/);
  assert.match(pass.message, /Meals: 1 complete, 1 partial, 0 skipped/);
  assert.match(pass.message, /Walks: 35 min/);
  assert.match(pass.message, /Watch: Potty watch/);
});

test("care pass includes shared mood and energy handoff context", () => {
  const pass = buildCarePass({
    ...baseInput(),
    audience: "trainer",
    now: new Date("2026-06-08T12:00:00-07:00").getTime(),
    entries: [
      ...baseInput().entries,
      {
        id: "mood-low",
        type: "mood",
        title: "Mood - visitors",
        caregiver: "Emma",
        occurredAt: "2026-06-08T08:00:00-07:00",
        mood: "anxious",
        details: {
          energyLevel: "low",
          moodContext: "Visitors came by before breakfast",
          householdVisible: true,
        },
      },
      {
        id: "mood-steady",
        type: "mood",
        title: "Mood - settled",
        caregiver: "Apollo",
        occurredAt: "2026-06-07T18:00:00-07:00",
        mood: "calm",
        details: { energyLevel: "steady", householdVisible: true },
      },
      {
        id: "private-mood",
        type: "mood",
        title: "Private mood",
        caregiver: "Emma",
        occurredAt: "2026-06-08T09:00:00-07:00",
        mood: "happy",
        details: { energyLevel: "high", householdVisible: false },
      },
      {
        id: "old-mood",
        type: "mood",
        title: "Old mood",
        caregiver: "Apollo",
        occurredAt: "2026-04-01T09:00:00-07:00",
        mood: "unwell",
        details: { energyLevel: "low", householdVisible: true },
      },
    ],
  });

  const section = pass.sections.find((item) => item.title === "Mood & Energy");
  assert.ok(section);
  assert.match(pass.message, /2 shared mood check-ins/);
  assert.match(pass.message, /Energy: 1 low, 1 steady, 0 high/);
  assert.match(pass.message, /Latest: Anxious, low energy by Emma/);
  assert.match(pass.message, /Visitors came by before breakfast/);
  assert.doesNotMatch(pass.message, /Private mood/);
  assert.doesNotMatch(pass.message, /Old mood/);
});

test("care pass includes local record attachment prep without claiming cloud storage", () => {
  const pass = buildCarePass({
    ...baseInput(),
    audience: "vet",
    records: [
      ...baseInput().records,
      { id: "receipt-ready", type: "receipt", title: "Wellness receipt", note: "$182 exam", attachmentUri: "file://receipt.jpg" },
      { id: "doc-missing", type: "document", title: "Rabies certificate" },
      { id: "doc-ready", type: "document", title: "Insurance PDF", attachmentUri: "file://insurance.pdf" },
    ],
  });

  const section = pass.sections.find((item) => item.title === "Records Attachment Prep");
  assert.ok(section);
  assert.match(pass.message, /Local files: 2\/3 receipts or documents attached/);
  assert.match(pass.message, /Needs local file: Rabies certificate/);
  assert.match(pass.message, /Attachments are saved locally on this device/);
  assert.doesNotMatch(pass.message, /cloud/i);
});

test("care pass includes Dog ID credential prep before sharing handoffs", () => {
  const pass = buildCarePass({
    ...baseInput(),
    audience: "sitter",
    profile: {
      ...baseInput().profile,
      emergencyContact: "Apollo - 555-0100",
    },
    records: [
      { id: "microchip", type: "microchip", title: "HomeAgain", note: "985112003004551" },
      { id: "insurance", type: "insurance", title: "Lemonade", note: "Policy WW-1042" },
      { id: "rabies", type: "vaccine", title: "Rabies", due: "May 2026", note: "Up to date" },
    ],
  });

  const section = pass.sections.find((item) => item.title === "Dog ID Prep");
  assert.ok(section);
  assert.match(pass.message, /Dog ID fields: 7\/8 ready/);
  assert.match(pass.message, /Needs Dog ID field: Primary vet/);
  assert.match(pass.message, /Dog ID is a local printable source until provider-backed credential\/PDF storage is approved/);
  assert.doesNotMatch(pass.message, /image export ready/i);
});

test("care pass includes potty health context for sitter and vet review", () => {
  const pass = buildCarePass({
    ...baseInput(),
    audience: "vet",
    now: new Date("2026-06-06T20:00:00-07:00").getTime(),
    entries: [
      {
        id: "potty-soft",
        type: "potty",
        title: "Potty - pee & poop",
        caregiver: "Emma",
        occurredAt: "2026-06-06T12:30:00-07:00",
        details: { kind: "both", condition: "soft", stoolColor: "yellow", pottyContext: "accident", note: "Soft but no blood." },
      },
      {
        id: "potty-normal",
        type: "potty",
        title: "Potty - pee",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T08:10:00-07:00",
        details: { kind: "pee", condition: "normal" },
      },
    ],
  });

  const section = pass.sections.find((item) => item.title === "Potty Health");
  assert.ok(section);
  assert.match(pass.message, /2 potty logs today - 2 pee, 1 poop, 1 needs stool review/);
  assert.match(pass.message, /Conditions: soft/);
  assert.match(pass.message, /Colors: yellow/);
  assert.match(pass.message, /Context: accident/);
  assert.match(pass.message, /Latest: Potty - pee & poop - pee & poop, soft/);
});

test("trainer care pass emphasizes behavior and activity context", () => {
  const pass = buildCarePass({ ...baseInput(), audience: "trainer" });

  assert.match(pass.message, /Training focus/);
  assert.match(pass.message, /Morning walk/);
  assert.match(pass.message, /Eats better when the house is calm/);
});

test("trainer care pass includes training progress context", () => {
  const pass = buildCarePass({
    ...baseInput(),
    audience: "trainer",
    now: new Date("2026-06-08T12:00:00-07:00").getTime(),
    entries: [
      ...baseInput().entries,
      {
        id: "training-win",
        type: "training",
        title: "Leash manners",
        caregiver: "Emma",
        occurredAt: "2026-06-08T09:00:00-07:00",
        durationMinutes: 12,
        details: {
          skill: "Leash manners",
          trainingOutcome: "win",
          cue: "Heel",
          nextPractice: "Practice calm passes",
          householdVisible: true,
        },
      },
      {
        id: "training-struggle",
        type: "training",
        title: "Calm greeting",
        caregiver: "Apollo",
        occurredAt: "2026-06-07T17:00:00-07:00",
        durationMinutes: 9,
        details: {
          skill: "Calm greeting",
          trainingOutcome: "struggle",
          trigger: "Dog at gate",
          householdVisible: true,
        },
      },
    ],
  });

  const section = pass.sections.find((item) => item.title === "Training Progress");
  assert.ok(section);
  assert.match(pass.message, /2 training sessions in the last 30 days/);
  assert.match(pass.message, /Skills: Leash manners, Calm greeting/);
  assert.match(pass.message, /Latest: Leash manners - win with Emma/);
  assert.match(pass.message, /Practice calm passes/);
});

test("care pass includes alone-time anxiety context", () => {
  const pass = buildCarePass({
    ...baseInput(),
    audience: "sitter",
    now: new Date("2026-06-11T12:00:00-07:00").getTime(),
    entries: [
      ...baseInput().entries,
      {
        id: "alone-anxious",
        type: "alone",
        title: "Alone time - anxious",
        caregiver: "Apollo",
        occurredAt: "2026-06-11T09:00:00-07:00",
        durationMinutes: 45,
        details: {
          aloneOutcome: "anxious",
          trigger: "Leaving after breakfast",
          calmingSupport: "Puzzle toy",
          recoveryMinutes: 15,
          householdVisible: true,
        },
      },
    ],
  });

  const section = pass.sections.find((item) => item.title === "Alone Time");
  assert.ok(section);
  assert.match(pass.message, /1 alone-time log in the last 30 days/);
  assert.match(pass.message, /Outcomes: 0 calm, 1 anxious, 0 distressed/);
  assert.match(pass.message, /Triggers: Leaving after breakfast/);
  assert.match(pass.message, /Supports: Puzzle toy/);
  assert.match(pass.message, /Latest: Alone time - anxious - anxious with Apollo/);
});

test("care pass includes weight trend context for vet review", () => {
  const pass = buildCarePass({
    ...baseInput(),
    audience: "vet",
    now: new Date("2026-06-11T12:00:00-07:00").getTime(),
    goals: [{ id: "weight-goal", category: "weight", title: "Reach 70 lb", target: "70 lb", status: "active", due: "", note: "" }],
    entries: [
      ...baseInput().entries,
      {
        id: "weight-1",
        type: "weight",
        title: "Weight",
        caregiver: "Emma",
        occurredAt: "2026-05-20T09:00:00-07:00",
        amount: "67",
        details: { householdVisible: true },
      },
      {
        id: "weight-2",
        type: "weight",
        title: "Weight",
        caregiver: "Apollo",
        occurredAt: "2026-06-10T09:00:00-07:00",
        amount: "68",
        details: { householdVisible: true },
      },
    ],
  });

  const section = pass.sections.find((item) => item.title === "Weight Trend");
  assert.ok(section);
  assert.match(pass.message, /2 weigh-ins in the last 90 days/);
  assert.match(pass.message, /Goal: 70 lb/);
  assert.match(pass.message, /Latest: 68 lb by Apollo/);
  assert.match(pass.message, /owner-reported context/i);
});

test("care pass includes grooming care context for sitter and groomer handoff", () => {
  const pass = buildCarePass({
    ...baseInput(),
    audience: "sitter",
    now: new Date("2026-06-11T12:00:00-07:00").getTime(),
    entries: [
      ...baseInput().entries,
      {
        id: "grooming-brush",
        type: "grooming",
        title: "Grooming - Brush",
        caregiver: "Emma",
        occurredAt: "2026-06-10T18:00:00-07:00",
        durationMinutes: 15,
        details: {
          kind: "brush",
          groomingCondition: "Light shedding",
          groomingProducts: "Slicker brush",
          groomingNextDue: "2026-06-18",
          householdVisible: true,
        },
      },
    ],
  });

  const section = pass.sections.find((item) => item.title === "Grooming Care");
  assert.ok(section);
  assert.match(pass.message, /1 grooming log in the last 45 days/);
  assert.match(pass.message, /Latest: Grooming - Brush - brush with Emma/);
  assert.match(pass.message, /Products: Slicker brush/);
  assert.match(pass.message, /Next due: 2026-06-18/);
  assert.match(pass.message, /owner-reported coat and grooming context/i);
});

test("creates a stable report artifact snapshot from a care pass", () => {
  const pass = buildCarePass({ ...baseInput(), audience: "vet" });
  const artifact = createCarePassArtifact(pass, "2026-06-08T06:30:00.000Z");

  assert.equal(artifact.id, "care_pass_vet_2026-06-08T06-30-00-000Z");
  assert.equal(artifact.audience, "vet");
  assert.equal(artifact.title, pass.title);
  assert.equal(artifact.createdAt, "2026-06-08T06:30:00.000Z");
  assert.equal(artifact.summary, pass.summary);
  assert.equal(artifact.message, pass.message);
  assert.deepEqual(artifact.sectionTitles, pass.sections.map((section) => section.title));
});

test("creates print-ready progress report artifacts with mood energy context", () => {
  const artifact = createProgressReportArtifact({
    dogName: "Phoenix <script>",
    periodDays: 30,
    generatedAt: "Jun 8, 7:30 AM",
    createdAt: "2026-06-08T06:30:00.000Z",
    summary: "30-day progress report for caregiver and vet review.",
    sections: [
      {
        title: "Care Summary",
        lines: ["Total entries logged: 14", "Most active caregiver: Emma (7)"],
      },
      {
        title: "Mood & Energy",
        lines: [
          "Mood & Energy snapshot: 2 shared mood check-ins, 3.5/5 average with something worth watching.",
          "Owner-reported mood and energy context only; not a diagnosis or emergency triage.",
        ],
      },
    ],
  });
  const printable = getReportArtifactPrintView(artifact);

  assert.equal(artifact.id, "progress_report_30d_2026-06-08T06-30-00-000Z");
  assert.equal(artifact.kind, "progress_report");
  assert.equal(artifact.title, "Phoenix <script> 30-day Progress Report");
  assert.equal(artifact.periodDays, 30);
  assert.deepEqual(artifact.sectionTitles, ["Care Summary", "Mood & Energy"]);
  assert.match(artifact.message, /Mood & Energy snapshot/);
  assert.equal(artifact.printFileName, "phoenix-script-30-day-progress-report-2026-06-08.html");
  assert.equal(printable.status, "ready");
  assert.equal(printable.html, artifact.printHtml);
  assert.match(renderProgressReportPrintHtml(artifact), /Phoenix &lt;script&gt; 30-day Progress Report/);
  assert.match(printable.html, /Mood &amp; Energy/);
  assert.match(printable.html, /not a diagnosis or emergency triage/i);
  assert.doesNotMatch(printable.html, /Phoenix <script>/);
});

test("creates print-ready Dog ID credential artifacts for local report history", () => {
  const artifact = createPetCredentialArtifact(
    {
      name: "Phoenix <script>",
      breed: "German Shepherd mix",
      weight: "68 lb",
      careFocus: "Keep meals calm.",
      primaryCaregiver: "Emma",
      primaryVet: "Alameda Wellness Vet",
      emergencyContact: "Apollo - 555-0100",
      microchip: "985112003004551",
      insurance: "Lemonade - WW-1042",
      vaccines: "Rabies - May 2028",
      generatedAt: "2026-06-08T06:30:00.000Z",
      message: "Phoenix <script> Dog ID\nMicrochip: 985112003004551",
    },
    "2026-06-08T06:30:00.000Z",
  );
  const printable = getReportArtifactPrintView(artifact);

  assert.equal(artifact.id, "pet_credential_2026-06-08T06-30-00-000Z");
  assert.equal(artifact.kind, "pet_credential");
  assert.equal(artifact.title, "Phoenix <script> Dog ID");
  assert.equal(artifact.summary, "Local Dog ID credential source for caregiver and veterinarian review.");
  assert.deepEqual(artifact.sectionTitles, ["Dog ID"]);
  assert.match(artifact.message, /Microchip: 985112003004551/);
  assert.equal(artifact.printFileName, "phoenix-script-dog-id-2026-06-08.html");
  assert.equal(printable.status, "ready");
  assert.equal(printable.html, artifact.printHtml);
  assert.match(printable.html, /Phoenix &lt;script&gt; Dog ID/);
  assert.match(printable.html, /WoofWatcher organizes owner-reported credential context/);
  assert.doesNotMatch(printable.html, /Phoenix <script>/);
  assert.doesNotMatch(artifact.message, /cloud storage ready|PDF export ready/i);
});

test("summarizes saved Dog ID credential artifacts for report history review", () => {
  const oldArtifact = createPetCredentialArtifact(
    {
      name: "Phoenix",
      generatedAt: "2026-06-07T06:30:00.000Z",
      message: "Phoenix Dog ID\nMicrochip: 985112003004551",
    },
    "2026-06-07T06:30:00.000Z",
  );
  const latestArtifact = createPetCredentialArtifact(
    {
      name: "Phoenix",
      generatedAt: "2026-06-08T06:30:00.000Z",
      message: "Phoenix Dog ID\nPrimary vet: Alameda Wellness Vet",
    },
    "2026-06-08T06:30:00.000Z",
  );

  const summary = summarizePetCredentialArtifacts([oldArtifact, latestArtifact]);

  assert.equal(summary.total, 2);
  assert.equal(summary.latest?.id, latestArtifact.id);
  assert.match(summary.summary, /2 local Dog ID credential sources saved/);
  assert.match(summary.latestLine, /Latest Dog ID Credential saved Jun 7, 2026/);
  assert.match(summary.action, /Report History/);
  assert.match(summary.boundaryLine, /local credential sources/);
  assert.doesNotMatch(summary.boundaryLine, /cloud storage ready|PDF export ready/i);
});

test("summarizes saved report artifacts for local handoff readiness", () => {
  const carePass = createCarePassArtifact(
    buildCarePass({ ...baseInput(), audience: "sitter" }),
    "2026-06-08T06:30:00.000Z",
  );
  const progress = createProgressReportArtifact({
    dogName: "Phoenix",
    periodDays: 30,
    generatedAt: "Jun 9, 7:30 AM",
    createdAt: "2026-06-09T06:30:00.000Z",
    summary: "30-day progress report for caregiver and vet review.",
    sections: [{ title: "Care Summary", lines: ["Total entries logged: 14"] }],
  });
  const credential = createPetCredentialArtifact(
    {
      name: "Phoenix",
      generatedAt: "2026-06-10T06:30:00.000Z",
      message: "Phoenix Dog ID\nMicrochip: 985112003004551",
    },
    "2026-06-10T06:30:00.000Z",
  );

  const summary = summarizeReportArtifacts([carePass, progress, credential]);

  assert.equal(summary.total, 3);
  assert.equal(summary.carePassCount, 1);
  assert.equal(summary.progressReportCount, 1);
  assert.equal(summary.petCredentialCount, 1);
  assert.equal(summary.latest?.id, credential.id);
  assert.match(summary.summary, /3 local report sources saved/);
  assert.match(summary.latestLine, /Latest saved source: Dog ID Credential/);
  assert.match(summary.action, /Resend or share printable source/);
  assert.match(summary.reviewLine, /Review the latest local source/);
  assert.match(summary.reviewLine, /routines, medications, records, and audience/);
  assert.match(summary.cleanupLine, /Remove obsolete local sources only after review/);
  assert.match(summary.cleanupLine, /does not revoke shares/);
  assert.match(summary.boundaryLine, /local reusable sources/);
  assert.doesNotMatch(`${summary.reviewLine} ${summary.cleanupLine} ${summary.boundaryLine}`, /cloud storage ready|PDF export ready/i);
});

test("describes report artifact print-source readiness without claiming provider lifecycle", () => {
  const readyProgress = createProgressReportArtifact({
    dogName: "Phoenix",
    periodDays: 30,
    generatedAt: "Jun 9, 7:30 AM",
    createdAt: "2026-06-09T06:30:00.000Z",
    summary: "30-day progress report for caregiver and vet review.",
    sections: [{ title: "Care Summary", lines: ["Total entries logged: 14"] }],
  });
  const restoredCarePass = {
    ...createCarePassArtifact(
      buildCarePass({ ...baseInput(), audience: "sitter" }),
      "2026-06-08T06:30:00.000Z",
    ),
    printHtml: undefined,
  };

  const ready = describeReportArtifactSource(readyProgress);
  const restored = describeReportArtifactSource(restoredCarePass);

  assert.equal(ready.kindLabel, "Progress Report");
  assert.match(ready.metadataLine, /Progress Report - 1 section - Print-ready source/);
  assert.match(ready.fileLine, /phoenix-30-day-progress-report-2026-06-09.html/);
  assert.match(ready.lifecycleLine, /Local printable source only/);
  assert.match(restored.metadataLine, /Care Pass - .* - Restored printable source/);
  assert.match(restored.lifecycleLine, /native PDF export, server-backed report storage, cloud sharing, retention, and deletion policy are not enabled/);
  assert.doesNotMatch(`${ready.lifecycleLine} ${restored.lifecycleLine}`, /cloud storage ready|PDF export ready/i);
});

test("builds local report artifact removal copy without claiming provider deletion", () => {
  const artifact = createProgressReportArtifact({
    dogName: "Phoenix",
    periodDays: 30,
    generatedAt: "Jun 9, 7:30 AM",
    createdAt: "2026-06-09T06:30:00.000Z",
    summary: "30-day progress report for caregiver and vet review.",
    sections: [{ title: "Care Summary", lines: ["Total entries logged: 14"] }],
  });

  const copy = describeReportArtifactRemoval(artifact);

  assert.equal(copy.title, "Remove Progress Report source?");
  assert.match(copy.body, /Phoenix 30-day Progress Report/);
  assert.match(copy.body, /local reusable source/);
  assert.match(copy.body, /does not delete anything from cloud storage/);
  assert.match(copy.confirmLabel, /Remove local source/);
  assert.match(copy.accessibilityLabel, /Remove local Progress Report source/);
  assert.doesNotMatch(`${copy.title} ${copy.body} ${copy.confirmLabel}`, /server deletion enabled|cloud deletion ready/i);
});

test("renders a print-ready care pass document with escaped care content", () => {
  const pass = buildCarePass({
    ...baseInput(),
    audience: "vet",
    profile: {
      ...baseInput().profile,
      name: "Phoenix <script>",
    },
  });

  const html = renderCarePassPrintHtml(pass);
  const artifact = createCarePassArtifact(pass, "2026-06-08T06:30:00.000Z");

  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /@media print/);
  assert.match(html, /Phoenix &lt;script&gt; Vet Care Pass/);
  assert.doesNotMatch(html, /Phoenix <script>/);
  assert.match(html, /Health Pattern Review/);
  assert.match(html, /This is not a diagnosis/);
  assert.equal(artifact.printFileName, "phoenix-script-vet-care-pass-2026-06-08.html");
  assert.equal(artifact.printHtml, html);
});

test("returns stored print source for current care pass artifacts", () => {
  const pass = buildCarePass({ ...baseInput(), audience: "sitter" });
  const artifact = createCarePassArtifact(pass, "2026-06-08T06:30:00.000Z");
  const printable = getCarePassArtifactPrintView(artifact);

  assert.equal(printable.status, "ready");
  assert.equal(printable.fileName, "phoenix-sitter-care-pass-2026-06-08.html");
  assert.equal(printable.html, artifact.printHtml);
});

test("restores escaped print source for older care pass artifacts", () => {
  const printable = getCarePassArtifactPrintView({
    id: "care_pass_sitter_legacy",
    kind: "care_pass",
    audience: "sitter",
    title: "Phoenix <script> Sitter Care Pass",
    generatedAt: "Jun 8, 7:30 AM",
    createdAt: "2026-06-08T06:30:00.000Z",
    summary: "Imported report text for a saved Care Pass.",
    sectionTitles: ["Dog", "Next Care"],
    message: "Phoenix <script>\nDog\n- Needs breakfast reviewed",
  });

  assert.equal(printable.status, "restored");
  assert.equal(printable.fileName, "phoenix-script-sitter-care-pass-2026-06-08.html");
  assert.match(printable.html, /^<!doctype html>/i);
  assert.match(printable.html, /Phoenix &lt;script&gt; Sitter Care Pass/);
  assert.match(printable.html, /Imported report text/);
  assert.match(printable.html, /Needs breakfast reviewed/);
  assert.doesNotMatch(printable.html, /Phoenix <script>/);
});

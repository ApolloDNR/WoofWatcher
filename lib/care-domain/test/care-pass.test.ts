import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCarePass,
  createCarePassArtifact,
  getCarePassArtifactPrintView,
  renderCarePassPrintHtml,
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

test("care pass diet section labels pending and estimated meal amounts", () => {
  const pass = buildCarePass({
    ...baseInput(),
    audience: "sitter",
    dietProfile: {
      ...baseInput().dietProfile,
      normalPortion: "1 cup twice daily",
      mealSchedule: "Breakfast and dinner",
    },
    entries: [
      {
        id: "breakfast-served",
        type: "meal",
        title: "Breakfast - outcome pending",
        caregiver: "Emma",
        occurredAt: "2026-06-06T07:00:00-07:00",
        details: {
          mealCompletion: "served",
          mealLifecycle: "outcome-pending",
          servedAmount: 1,
          servedUnit: "cup",
          householdVisible: true,
        },
      },
      {
        id: "lunch-partial",
        type: "meal",
        title: "Lunch - Ate some",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T12:00:00-07:00",
        details: {
          mealCompletion: "partial",
          servedAmount: 1,
          servedUnit: "cup",
          householdVisible: true,
        },
      },
      {
        id: "dinner-complete",
        type: "meal",
        title: "Dinner - Ate all",
        caregiver: "Emma",
        occurredAt: "2026-06-06T14:00:00-07:00",
        details: {
          mealCompletion: "complete",
          servedAmount: 1,
          servedUnit: "cup",
          eatenAmount: 1,
          eatenUnit: "cup",
          householdVisible: true,
        },
      },
    ],
  });

  const diet = pass.sections.find((section) => section.title === "Diet");
  assert.ok(diet);
  assert.match(pass.message, /Daily food: 1.5 of 2 cups today; 1 outcome pending; 1 estimated partial amount/);
  assert.match(pass.message, /Meal amount note: 1 outcome pending; 1 estimated partial amount/);
});

test("care pass includes meal follow-up rows for pending estimated and corrected outcomes", () => {
  const pass = buildCarePass({
    ...baseInput(),
    audience: "sitter",
    entries: [
      {
        id: "breakfast-served",
        type: "meal",
        title: "Breakfast",
        caregiver: "Emma",
        occurredAt: "2026-06-06T07:00:00-07:00",
        details: {
          mealCompletion: "served",
          mealLifecycle: "outcome-pending",
          servedAmount: 1,
          servedUnit: "cup",
          householdVisible: true,
        },
      },
      {
        id: "lunch-partial",
        type: "meal",
        title: "Lunch",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T12:00:00-07:00",
        details: {
          mealCompletion: "partial",
          servedAmount: 1,
          servedUnit: "cup",
          householdVisible: true,
        },
      },
      {
        id: "dinner-corrected",
        type: "meal",
        title: "Dinner",
        caregiver: "Emma",
        occurredAt: "2026-06-06T14:00:00-07:00",
        details: {
          mealCompletion: "partial",
          eatenAmount: 0.5,
          eatenUnit: "cup",
          householdVisible: true,
          trustState: "corrected",
          auditTrail: [
            {
              id: "audit-1",
              action: "corrected",
              createdAt: "2026-06-06T14:30:00-07:00",
              caregiver: "Apollo",
              summary: "Apollo corrected Dinner from ate all to ate some.",
            },
          ],
        },
      },
    ],
  });

  const followUps = pass.sections.find((section) => section.title === "Meal Follow-ups");
  assert.ok(followUps);
  assert.match(pass.message, /Outcome pending: Breakfast \(Emma, 7:00 AM\) - update eaten amount before sharing/);
  assert.match(pass.message, /Estimated amount: Lunch \(Apollo, 12:00 PM\) - confirm exact eaten amount if possible/);
  assert.match(pass.message, /Corrected outcome: Dinner \(Emma, 2:00 PM\) - review audit history before sharing/);
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
        id: "meal-served",
        type: "meal",
        title: "Bedtime snack",
        caregiver: "Emma",
        occurredAt: "2026-06-07T21:00:00-07:00",
        details: {
          mealCompletion: "served",
          mealLifecycle: "outcome-pending",
          servedAmount: 0.25,
          servedUnit: "cup",
          householdVisible: true,
        },
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
  assert.match(pass.message, /5 visible care logs over 2 days/);
  assert.match(pass.message, /Meals: 1 complete, 1 partial, 0 skipped, 1 pending outcome/);
  assert.match(pass.message, /Watch: Meal follow-up/);
  assert.match(pass.message, /1 partial, 0 skipped, and 1 outcome pending/);
  assert.match(pass.message, /Walks: 35 min/);
  assert.match(pass.message, /Watch: Potty watch/);
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

test("care pass includes Incident Watch context for trainer and sitter handoff", () => {
  const pass = buildCarePass({
    ...baseInput(),
    audience: "trainer",
    now: new Date("2026-06-20T12:00:00-07:00").getTime(),
    entries: [
      ...baseInput().entries,
      {
        id: "incident-dog-gate",
        type: "incident",
        title: "Incident - dog conflict",
        caregiver: "Emma",
        occurredAt: "2026-06-20T08:30:00-07:00",
        details: {
          incidentType: "dog-conflict",
          incidentTrigger: "Fast dog at gate",
          incidentExposure: "Leashed dog by fence",
          incidentInjury: "None",
          incidentAction: "Moved across street",
          incidentFollowUp: "Practice calm passes",
          householdVisible: true,
        },
      },
    ],
  });

  const section = pass.sections.find((item) => item.title === "Incident Watch");
  assert.ok(section);
  assert.match(pass.message, /1 incident in the last 90 days/);
  assert.match(pass.message, /Triggers: Fast dog at gate/);
  assert.match(pass.message, /Exposure\/context: Leashed dog by fence/);
  assert.match(pass.message, /Action taken: Moved across street/);
  assert.match(pass.message, /Follow-up: Practice calm passes/);
  assert.match(pass.message, /Trend: Rising pattern/);
  assert.match(pass.message, /Owner follow-ups: Close open follow-up/);
  assert.match(pass.message, /Trainer goal ideas: Calm dog passes/);
  assert.match(pass.message, /does not diagnose behavior or medical issues/i);
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

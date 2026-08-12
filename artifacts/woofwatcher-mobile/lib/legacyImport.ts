/**
 * One-time import of the legacy web PWA's saved state.
 *
 * The original WoofWatcher web app (artifacts/woofwatcher) stored everything
 * under localStorage["woofwatcher.v1.state"]. The Expo web build replaced it
 * at the same URL, so a returning web user's real care history sits ignored
 * in that key while the new app boots empty. This module converts that state
 * into the v2 shapes so hydration can adopt it.
 *
 * Laws this import obeys:
 * - HONESTY: the legacy app seeded every install with factory demo data
 *   (a sample Phoenix profile, six routines, four fake log entries). Demo
 *   rows that the user never touched are filtered out - we import what the
 *   owner actually authored, never the tutorial fiction.
 * - PRIVACY: legacy entries marked visibility "Private" become
 *   details.householdVisible=false so they keep out of shared artifacts.
 * - SAFETY: this module is pure (no storage access); the caller decides
 *   when it is safe to apply. The legacy key is never deleted - the
 *   original data stays as its own backup.
 */

import { resolvePetName } from "./petIdentity.ts";

export interface LegacyImportEntry {
  id: string;
  type: string;
  title: string;
  caregiver: string;
  occurredAt: string;
  durationMinutes?: number;
  amount?: string;
  mood?: string;
  severity?: string;
  note?: string;
  dogInteractions?: number;
  food?: string;
  details?: { [key: string]: unknown };
  syncStatus?: "local";
}

export interface LegacyImportDocPatch {
  profile?: {
    name: string;
    publicLabel: string;
    breed: string;
    background: string;
    careFocus: string;
    weight: { current: number; goal: string; unit: string };
  };
  caregivers?: { name: string; role: string }[];
  dietProfile?: { [key: string]: string };
  routines?: { id: string; label: string; type: string; time: string; owner: string; note: string }[];
  goals?: { id: string; category: string; title: string; target: string; status: string; due: string; note: string }[];
  records?: { id: string; type: string; title: string; due: string; note: string }[];
}

export interface LegacyImportResult {
  docPatch: LegacyImportDocPatch;
  entries: LegacyImportEntry[];
  summary: { entries: number; routines: number; goals: number; records: number; profile: boolean };
}

export const LEGACY_STATE_KEY = "woofwatcher.v1.state";
export const LEGACY_IMPORT_FLAG_KEY = "woofwatcher.v1.import";

/* ------------------------------------------------------------------ */
/* Factory templates from the legacy app's getDefaultState. An item is  */
/* demo data only when EVERY compared field still matches the template  */
/* - an edited default routine is real user intent and imports.         */
/* ------------------------------------------------------------------ */

const DEMO_PROFILE = {
  name: "Phoenix",
  publicLabel: "Phoenix",
  breed: "German Shepherd / Belgian Shepherd mix",
  background: "Rescued over a year ago after being underweight and food anxious.",
  careFocus: "Keep routines calm, document appetite patterns, and prevent long empty-stomach windows.",
  weightCurrent: 56.2,
  weightGoal: "Slow, vet-guided weight gain and stable appetite",
  weightUnit: "lb",
};

const DEMO_DIET: { [key: string]: string } = {
  primaryFood: "Regular kibble Phoenix tolerates well",
  normalPortion: "1 to 1.5 cups per meal, adjusted gently",
  mealSchedule: "Breakfast, dinner, and a small bedtime snack",
  toppers: "Warm water or gentle topper only when needed",
  supplements: "Only vet-approved supplements",
  bedtimeSnack: "Small snack before sleep to reduce long empty-stomach windows",
  treatsAllowed: "Training treats and simple chews",
  avoid: "Rich table scraps and sudden food changes",
  sensitivities: "Food anxiety and long meal gaps",
  appetiteQuirks: "Eats best when the house is calm and nobody pressures her",
  vetNotes: "Track appetite, refused meals, and yellow bile patterns for vet review",
};

const DEMO_CAREGIVERS = [
  { name: "Apollo", role: "Primary caregiver" },
  { name: "Girlfriend", role: "Primary caregiver" },
];

const DEMO_ROUTINES: { [id: string]: [string, string, string, string, string] } = {
  routine_breakfast: ["Breakfast", "meal", "7:30 AM", "Whoever is up first", "Small calm meal; avoid pressure if Phoenix is anxious."],
  routine_morning_walk: ["Morning walk", "walk", "8:15 AM", "Apollo", "Decompress walk, sniffing encouraged."],
  routine_midday_check: ["Midday check", "note", "12:30 PM", "Either caregiver", "Water, mood, appetite, and anxiety check."],
  routine_dinner: ["Dinner", "meal", "6:30 PM", "Either caregiver", "Document amount and whether she needed company to eat."],
  routine_evening_walk: ["Evening walk", "walk", "8:15 PM", "Whoever is home", "Short settling walk before bedtime."],
  routine_bedtime_snack: ["Bedtime snack", "treat", "10:00 PM", "Either caregiver", "Small snack may help reduce empty-stomach bile mornings."],
};

const DEMO_GOAL_IDS = new Set(["goal_weight_stability", "goal_place_work", "goal_social_neutrality"]);
const DEMO_RECORD_IDS = new Set(["record_vet_baseline", "record_weight_goal", "record_vaccines"]);

/** type|title|note tuples of the four factory demo entries. */
const DEMO_ENTRIES = new Set([
  "meal|Breakfast|Ate after a calm start.",
  "walk|Morning walk|Loose leash, sniffed calmly.",
  "training|Place work|Held place while food was prepared.",
  "vomit|Yellow bile|Small amount before breakfast. Normal energy after.",
]);

/* ------------------------------------------------------------------ */

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumber(value: unknown): number | undefined {
  const num = typeof value === "number" ? value : Number.parseFloat(clean(value));
  return Number.isFinite(num) ? num : undefined;
}

function isObject(value: unknown): value is { [key: string]: unknown } {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseLegacyState(raw: string | null | undefined): { [key: string]: unknown } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) return null;
    // Minimal shape check: a v1 doc always carried these collections.
    if (!Array.isArray(parsed.entries) && !Array.isArray(parsed.routines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Legacy fields that move into details on the v2 entry, when present. */
const ENTRY_DETAIL_FIELDS = [
  "mealType",
  "servedAt",
  "servedBy",
  "portionOffered",
  "portionEaten",
  "outcomeAt",
  "outcomeBy",
  "appetite",
  "pottyLocation",
  "pottyOutcome",
  "treatType",
  "reason",
  "reaction",
  "skill",
] as const;

function convertEntry(input: unknown, index: number): LegacyImportEntry | null {
  if (!isObject(input)) return null;
  const type = clean(input.type) || "note";
  const title = clean(input.title);
  const note = clean(input.note);
  if (DEMO_ENTRIES.has(`${type}|${title}|${note}`)) return null;
  const occurredAt = clean(input.occurredAt);
  if (!occurredAt || Number.isNaN(new Date(occurredAt).getTime())) return null;

  const details: { [key: string]: unknown } = { importedFrom: "web-v1" };
  for (const field of ENTRY_DETAIL_FIELDS) {
    const value = clean(input[field]);
    if (value) details[field] = value;
  }
  // Privacy must survive the migration: legacy "Private" logs stay out of
  // shared artifacts (Care Pass filters on details.householdVisible).
  if (clean(input.visibility) === "Private") details.householdVisible = false;

  const entry: LegacyImportEntry = {
    id: clean(input.id) || `legacy_entry_${index}`,
    type,
    title: title || "Care note",
    caregiver: clean(input.caregiver) || "Unassigned",
    occurredAt,
    details,
    syncStatus: "local",
  };
  const durationMinutes = cleanNumber(input.durationMinutes);
  if (durationMinutes) entry.durationMinutes = durationMinutes;
  const dogInteractions = cleanNumber(input.dogInteractions);
  if (dogInteractions) entry.dogInteractions = dogInteractions;
  const amount = clean(input.amount);
  if (amount) entry.amount = amount;
  const mood = clean(input.mood);
  if (mood) entry.mood = mood;
  const severity = clean(input.severity);
  if (severity && severity !== "normal") entry.severity = severity;
  if (note) entry.note = note;
  const food = clean(input.food);
  if (food) entry.food = food;
  return entry;
}

function convertRoutines(input: unknown): LegacyImportDocPatch["routines"] {
  if (!Array.isArray(input)) return undefined;
  const routines = input
    .filter(isObject)
    .map((routine, index) => ({
      id: clean(routine.id) || `legacy_routine_${index}`,
      label: clean(routine.label) || "Routine",
      type: clean(routine.type) || "note",
      time: clean(routine.time),
      owner: clean(routine.owner),
      note: clean(routine.note),
    }))
    .filter((routine) => {
      const demo = DEMO_ROUTINES[routine.id];
      if (!demo) return true;
      const [label, type, time, owner, note] = demo;
      return !(routine.label === label && routine.type === type && routine.time === time && routine.owner === owner && routine.note === note);
    });
  return routines.length ? routines : undefined;
}

function convertGoals(input: unknown): LegacyImportDocPatch["goals"] {
  if (!Array.isArray(input)) return undefined;
  const goals = input
    .filter(isObject)
    .filter((goal) => !DEMO_GOAL_IDS.has(clean(goal.id)))
    .map((goal, index) => ({
      id: clean(goal.id) || `legacy_goal_${index}`,
      category: clean(goal.category) || "custom",
      title: clean(goal.title) || "Goal",
      target: clean(goal.target),
      status: clean(goal.status) || "active",
      due: clean(goal.due),
      note: clean(goal.note),
    }));
  return goals.length ? goals : undefined;
}

function convertRecords(input: unknown): LegacyImportDocPatch["records"] {
  if (!Array.isArray(input)) return undefined;
  const records = input
    .filter(isObject)
    .filter((record) => !DEMO_RECORD_IDS.has(clean(record.id)))
    .map((record, index) => ({
      id: clean(record.id) || `legacy_record_${index}`,
      type: clean(record.type) || "instruction",
      title: clean(record.title) || "Record",
      due: clean(record.due),
      note: clean(record.note),
    }));
  return records.length ? records : undefined;
}

function convertProfile(input: unknown): LegacyImportDocPatch["profile"] {
  if (!isObject(input)) return undefined;
  const weight = isObject(input.weight) ? input.weight : {};
  const name = resolvePetName(clean(input.name));
  const profile = {
    name,
    publicLabel: resolvePetName(clean(input.publicLabel), name),
    breed: clean(input.breed),
    background: clean(input.background),
    careFocus: clean(input.careFocus),
    weight: {
      current: cleanNumber(weight.current) ?? 0,
      goal: clean(weight.goal),
      unit: clean(weight.unit) || "lb",
    },
  };
  const untouched =
    profile.name === DEMO_PROFILE.name &&
    profile.breed === DEMO_PROFILE.breed &&
    profile.background === DEMO_PROFILE.background &&
    profile.careFocus === DEMO_PROFILE.careFocus &&
    profile.weight.current === DEMO_PROFILE.weightCurrent &&
    profile.weight.goal === DEMO_PROFILE.weightGoal;
  if (untouched || !clean(input.name)) return undefined;
  return profile;
}

function convertDiet(input: unknown): LegacyImportDocPatch["dietProfile"] {
  if (!isObject(input)) return undefined;
  const diet: { [key: string]: string } = {};
  let touched = false;
  for (const key of Object.keys(DEMO_DIET)) {
    const value = clean(input[key]);
    diet[key] = value;
    if (value && value !== DEMO_DIET[key]) touched = true;
  }
  return touched ? diet : undefined;
}

function convertCaregivers(input: unknown): LegacyImportDocPatch["caregivers"] {
  if (!Array.isArray(input)) return undefined;
  const caregivers = input
    .filter(isObject)
    .map((caregiver) => ({
      name: clean(caregiver.name),
      role: clean(caregiver.role) || "Caregiver",
    }))
    .filter((caregiver) => caregiver.name);
  if (!caregivers.length) return undefined;
  const untouched =
    caregivers.length === DEMO_CAREGIVERS.length &&
    caregivers.every((caregiver, index) =>
      caregiver.name === DEMO_CAREGIVERS[index].name && caregiver.role === DEMO_CAREGIVERS[index].role,
    );
  return untouched ? undefined : caregivers;
}

/**
 * Convert a parsed legacy state into v2 shapes. Returns null when nothing
 * user-authored survives the demo filter - a legacy install that was only
 * ever opened, never actually used, has nothing worth importing.
 */
export function convertLegacyState(legacy: { [key: string]: unknown } | null): LegacyImportResult | null {
  if (!legacy) return null;

  const entries = (Array.isArray(legacy.entries) ? legacy.entries : [])
    .map((entry, index) => convertEntry(entry, index))
    .filter((entry): entry is LegacyImportEntry => entry !== null)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const docPatch: LegacyImportDocPatch = {};
  const routines = convertRoutines(legacy.routines);
  if (routines) docPatch.routines = routines;
  const goals = convertGoals(legacy.goals);
  if (goals) docPatch.goals = goals;
  const records = convertRecords(legacy.records);
  if (records) docPatch.records = records;
  const profile = convertProfile(legacy.profile);
  if (profile) docPatch.profile = profile;
  const diet = convertDiet(legacy.dietProfile);
  if (diet) docPatch.dietProfile = diet;
  const caregivers = convertCaregivers(legacy.caregivers);
  if (caregivers) docPatch.caregivers = caregivers;

  if (!entries.length && !Object.keys(docPatch).length) return null;

  return {
    docPatch,
    entries,
    summary: {
      entries: entries.length,
      routines: routines?.length ?? 0,
      goals: goals?.length ?? 0,
      records: records?.length ?? 0,
      profile: !!profile,
    },
  };
}

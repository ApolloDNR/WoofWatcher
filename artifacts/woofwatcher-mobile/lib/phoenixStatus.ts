import type { CareState, Entry, Routine } from "@/context/CareContext";
import { deriveCareDayStatus, normalizeCareEventType } from "@workspace/care-domain";
import {
  deriveCareEvidenceSnapshot,
  type CareEvidenceSnapshot,
} from "./careEvidence.ts";

export type Mood = "happy" | "excited" | "calm" | "anxious" | "unwell";

export interface MoodMeta {
  label: string;
  emoji: string;
  speech: string;
}

export const MOOD_META: Record<Mood, MoodMeta> = {
  happy: {
    label: "Happy",
    emoji: "🥰",
    speech: "Happy was logged in the latest mood check-in.",
  },
  excited: {
    label: "Excited",
    emoji: "😤",
    speech: "Excited was logged in the latest mood check-in.",
  },
  calm: {
    label: "Calm",
    emoji: "😌",
    speech: "Calm was logged in the latest mood check-in.",
  },
  anxious: {
    label: "Anxious",
    emoji: "🥺",
    speech: "Anxious was logged. Add context if the pattern continues.",
  },
  unwell: {
    label: "Unwell",
    emoji: "🤒",
    speech: "Unwell was logged. Keep observations available for review.",
  },
};

const NOT_LOGGED_MOOD_META: MoodMeta = {
  label: "Not logged",
  emoji: "🐾",
  speech: "Add a mood check-in when you have an observation.",
};

export interface CountStat {
  done: number;
  target: number;
}

export interface PhoenixStatus {
  mood: Mood;
  meta: MoodMeta;
  energy: number;
  energyLabel: string;
  moodObserved: boolean;
  energyObserved: boolean;
  evidence: CareEvidenceSnapshot;
  counts: {
    meals: CountStat;
    walks: CountStat;
    potty: CountStat;
    training: number;
    walkMinutes: number;
    healthAlert: boolean;
  };
  nextRoutine: Routine | null;
  minutesUntilNext: number | null;
}

function isToday(iso: string, now: number): boolean {
  const d = new Date(iso);
  const n = new Date(now);
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function routineDateMs(r: Routine, now: number): number {
  const [time, period] = r.time.split(" ");
  const [hStr, mStr] = time.split(":");
  let h = parseInt(hStr, 10);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  const d = new Date(now);
  d.setHours(h, parseInt(mStr || "0", 10), 0, 0);
  return d.getTime();
}

function entryDetailValue(entry: Entry, key: string): unknown {
  const details = entry.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  return (details as Record<string, unknown>)[key];
}

function isHouseholdVisible(entry: Entry): boolean {
  return entryDetailValue(entry, "householdVisible") !== false;
}

function isPendingMeal(entry: Entry): boolean {
  if (normalizeCareEventType(entry.type, entry.details) !== "meal") return false;
  const completion = String(entryDetailValue(entry, "mealCompletion") ?? "");
  const lifecycle = String(entryDetailValue(entry, "mealLifecycle") ?? "");
  return lifecycle === "outcome-pending" || completion === "served" || completion === "grazing";
}

export function getGreeting(now: number): { text: string; emoji: string } {
  const h = new Date(now).getHours();
  if (h < 12) return { text: "Good morning", emoji: "☀️" };
  if (h < 17) return { text: "Good afternoon", emoji: "🌤️" };
  if (h < 21) return { text: "Good evening", emoji: "🌅" };
  return { text: "Good night", emoji: "🌙" };
}

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Consecutive days (ending today, or yesterday if today is still empty) that have
 * at least one logged entry. Pure function of the logged history.
 */
export function computeCareStreak(state: CareState, now: number = Date.now()): number {
  const days = new Set<string>();
  for (const e of state.entries.filter(isHouseholdVisible)) {
    days.add(dayKeyOf(new Date(e.occurredAt)));
  }
  const cursor = new Date(now);
  if (!days.has(dayKeyOf(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKeyOf(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** 0..1 share of today's core routines (meals, walks, potty) that are done. */
export function computeDayProgress(status: PhoenixStatus): number {
  const c = status.counts;
  const parts = [
    c.meals.target ? Math.min(1, c.meals.done / c.meals.target) : 0,
    c.walks.target ? Math.min(1, c.walks.done / c.walks.target) : 0,
    c.potty.target ? Math.min(1, c.potty.done / c.potty.target) : 0,
  ];
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

export function derivePhoenixStatus(
  state: CareState,
  now: number = Date.now(),
): PhoenixStatus {
  const visibleEntries = state.entries.filter(isHouseholdVisible);
  const todays = visibleEntries.filter((e) => isToday(e.occurredAt, now));
  const dayStatus = deriveCareDayStatus(visibleEntries, state.routines, now);
  const evidence = deriveCareEvidenceSnapshot(visibleEntries, now);

  const mealTarget = dayStatus.counts.meals.target;
  const completedMeals = todays.filter(
    (entry) =>
      normalizeCareEventType(entry.type, entry.details) === "meal" &&
      !isPendingMeal(entry),
  ).length;
  const meals: CountStat = {
    ...dayStatus.counts.meals,
    done: Math.min(completedMeals, mealTarget || completedMeals),
  };
  const walks: CountStat = dayStatus.counts.walks;
  const potty: CountStat = dayStatus.counts.potty;
  const training = dayStatus.counts.training;
  const walkMinutes = dayStatus.counts.walkMinutes;

  const healthAlert = dayStatus.healthAlert;

  // Next upcoming routine today — earliest by clock time, independent of array order
  const nextRoutine =
    state.routines
      .map((r) => ({ r, ms: routineDateMs(r, now) }))
      .filter((x) => x.ms > now)
      .sort((a, b) => a.ms - b.ms)[0]?.r ?? null;
  const minutesUntilNext = nextRoutine
    ? Math.max(0, Math.round((routineDateMs(nextRoutine, now) - now) / 60000))
    : null;

  const moodLane = evidence.lanes.find((lane) => lane.id === "mood");
  const energyLane = evidence.lanes.find((lane) => lane.id === "energy");
  const observedMood = (
    ["happy", "excited", "calm", "anxious", "unwell"] as const
  ).find((candidate) => candidate === moodLane?.value);
  const observedEnergy = (
    ["low", "steady", "high"] as const
  ).find((candidate) => candidate === energyLane?.value);
  const moodObserved = observedMood !== undefined;
  const energyObserved = observedEnergy !== undefined;

  // These fallbacks only keep legacy avatar/image call sites type-safe. They
  // are never presented as observations: meta/energyLabel and the shared
  // evidence gates render "Not logged" until an owner records the lane.
  const mood: Mood = observedMood ?? "calm";
  const energy = observedEnergy === "low" ? 40 : observedEnergy === "high" ? 80 : 60;
  const energyLabel = observedEnergy
    ? `${observedEnergy.charAt(0).toUpperCase()}${observedEnergy.slice(1)}`
    : "Not logged";

  return {
    mood,
    meta: moodObserved ? MOOD_META[mood] : NOT_LOGGED_MOOD_META,
    energy,
    energyLabel,
    moodObserved,
    energyObserved,
    evidence,
    counts: { meals, walks, potty, training, walkMinutes, healthAlert },
    nextRoutine,
    minutesUntilNext,
  };
}

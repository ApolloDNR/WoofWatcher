import type { CareState, Entry, Routine } from "@/context/CareContext";
import {
  deriveCareDayStatus,
  deriveRoutineBoard,
  isRoutineBoardScheduledItem,
  normalizeCareEventType,
} from "@workspace/care-domain";

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
    speech: "Best day ever! Thanks for taking such good care of me. 💚",
  },
  excited: {
    label: "Impatient",
    emoji: "😤",
    speech: "It's walk o'clock! My paws are ready and so is my tail. 🐾",
  },
  calm: {
    label: "Content",
    emoji: "😌",
    speech: "Feeling cozy and settled. Life is pretty good. ☁️",
  },
  anxious: {
    label: "Unsure",
    emoji: "🥺",
    speech: "Feeling a little uneasy today — stay close to me? 🫶",
  },
  unwell: {
    label: "Off day",
    emoji: "🤒",
    speech: "My tummy's a bit funny. Let's take it easy today. 🤍",
  },
};

export interface CountStat {
  done: number;
  target: number;
}

export interface PhoenixStatus {
  mood: Mood;
  meta: MoodMeta;
  energy: number;
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
  routineCorrectionCount: number;
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

function hoursAgo(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / (1000 * 60 * 60);
}

function entryDetailValue(entry: Entry, key: string): unknown {
  const details = entry.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  return (details as Record<string, unknown>)[key];
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
  for (const e of state.entries) {
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
  const todays = state.entries.filter((e) => isToday(e.occurredAt, now));
  const routineBoard = deriveRoutineBoard({
    routines: state.routines,
    entries: state.entries,
    now,
  });
  const scheduledRoutines = routineBoard.items.filter(isRoutineBoardScheduledItem);
  const dayStatus = deriveCareDayStatus(state.entries, scheduledRoutines, now);

  const countType = (types: string[]) =>
    todays.filter((e) =>
      types.includes(normalizeCareEventType(e.type, e.details)),
    ).length;

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

  const recentVomit = dayStatus.healthAlert;
  const healthAlert = dayStatus.healthAlert;

  const normalizedType = (entry: Entry) =>
    normalizeCareEventType(entry.type, entry.details);

  const recentAnxious = state.entries.some(
    (e) =>
      hoursAgo(e.occurredAt, now) < 4 &&
      (normalizedType(e) === "alone" ||
        (e.mood ?? "").toLowerCase().includes("anx") ||
        (e.mood ?? "").toLowerCase().includes("nerv")),
  );
  const recentActive = state.entries.some(
    (e) =>
      hoursAgo(e.occurredAt, now) < 3 &&
      ["walk", "play", "training"].includes(normalizedType(e)),
  );

  // Next upcoming routine today — earliest by clock time, independent of array order
  const nextItem = scheduledRoutines
    .filter((item) => item.minutesFromNow > 0)
    .sort((a, b) => a.minutesFromNow - b.minutesFromNow)[0] ?? null;
  const nextRoutine = nextItem
    ? state.routines.find((routine) => routine.id === nextItem.id) ?? null
    : null;
  const minutesUntilNext = nextItem?.minutesFromNow ?? null;

  const walkSoon =
    normalizeCareEventType(nextRoutine?.type) === "walk" &&
    minutesUntilNext !== null &&
    minutesUntilNext <= 60;
  const noWalkYet = walks.done === 0 && new Date(now).getHours() >= 8;

  let mood: Mood;
  if (recentVomit) mood = "unwell";
  else if (recentAnxious) mood = "anxious";
  else if (walkSoon || noWalkYet) mood = "excited";
  else if (recentActive) mood = "happy";
  else mood = "calm";

  // Energy: deterministic from the day's activity
  let energy = 64;
  energy += walks.done * 6;
  energy += training * 4;
  energy += countType(["play"]) * 5;
  if (mood === "excited") energy += 6;
  if (mood === "unwell") energy -= 22;
  if (mood === "anxious") energy -= 8;
  energy = Math.max(35, Math.min(96, energy));

  return {
    mood,
    meta: MOOD_META[mood],
    energy,
    counts: { meals, walks, potty, training, walkMinutes, healthAlert },
    nextRoutine,
    minutesUntilNext,
    routineCorrectionCount: routineBoard.correctionCount,
  };
}

import type { CareState, Entry, Routine } from "@/context/CareContext";

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

  const countType = (types: string[]) =>
    todays.filter((e) => types.includes(e.type)).length;

  const mealRoutines = state.routines.filter((r) => r.type === "meal").length;
  const walkRoutines = state.routines.filter((r) => r.type === "walk").length;

  const meals: CountStat = { done: countType(["meal"]), target: mealRoutines || 2 };
  const walks: CountStat = { done: countType(["walk"]), target: walkRoutines || 2 };
  const potty: CountStat = { done: countType(["potty", "pee", "poop"]), target: 3 };
  const training = countType(["training"]);
  const walkMinutes = todays
    .filter((e) => e.type === "walk")
    .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);

  const recentVomit = todays.some(
    (e) =>
      (e.type === "vomit" || e.type === "symptom") &&
      (e.severity === "watch" || e.severity === "alert"),
  );
  const healthAlert = recentVomit;

  const recentAnxious = state.entries.some(
    (e) =>
      hoursAgo(e.occurredAt, now) < 4 &&
      (e.type === "alone" ||
        (e.mood ?? "").toLowerCase().includes("anx") ||
        (e.mood ?? "").toLowerCase().includes("nerv")),
  );
  const recentActive = state.entries.some(
    (e) => hoursAgo(e.occurredAt, now) < 3 && ["walk", "play", "training"].includes(e.type),
  );

  // Next upcoming routine today — earliest by clock time, independent of array order
  const nextRoutine =
    state.routines
      .map((r) => ({ r, ms: routineDateMs(r, now) }))
      .filter((x) => x.ms > now)
      .sort((a, b) => a.ms - b.ms)[0]?.r ?? null;
  const minutesUntilNext = nextRoutine
    ? Math.max(0, Math.round((routineDateMs(nextRoutine, now) - now) / 60000))
    : null;

  const walkSoon =
    nextRoutine?.type === "walk" &&
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
  };
}

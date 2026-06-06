import { normalizeCareEventType, type CareEventDetails } from "./events.ts";

export interface CareStatusEntry {
  type: string;
  occurredAt: string;
  durationMinutes?: number | null;
  mood?: string | null;
  severity?: string | null;
  details?: CareEventDetails;
}

export interface CareStatusRoutine {
  type: string;
}

export interface CountStat {
  done: number;
  target: number;
}

export interface CareDayStatus {
  counts: {
    meals: CountStat;
    walks: CountStat;
    potty: CountStat;
    training: number;
    medication: number;
    vomit: number;
    anxiety: number;
    walkMinutes: number;
  };
  healthAlert: boolean;
}

function isSameLocalDay(iso: string, now: number): boolean {
  const d = new Date(iso);
  const n = new Date(now);
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function isAnxietyEntry(entry: CareStatusEntry): boolean {
  const mood = (entry.mood ?? "").toLowerCase();
  return (
    normalizeCareEventType(entry.type, entry.details) === "alone" ||
    mood.includes("anx") ||
    mood.includes("nerv") ||
    mood.includes("unsure")
  );
}

export function deriveCareDayStatus(
  entries: readonly CareStatusEntry[],
  routines: readonly CareStatusRoutine[] = [],
  now: number = Date.now(),
): CareDayStatus {
  const todays = entries.filter((entry) => isSameLocalDay(entry.occurredAt, now));
  const normalized = todays.map((entry) => ({
    ...entry,
    normalizedType: normalizeCareEventType(entry.type, entry.details),
  }));

  const countType = (type: string): number =>
    normalized.filter((entry) => entry.normalizedType === type).length;

  const mealTarget =
    routines.filter((routine) => normalizeCareEventType(routine.type) === "meal")
      .length || 2;
  const walkTarget =
    routines.filter((routine) => normalizeCareEventType(routine.type) === "walk")
      .length || 2;

  const vomitEntries = normalized.filter((entry) => entry.normalizedType === "vomit");
  const healthAlert = vomitEntries.some((entry) =>
    ["alert", "urgent", "watch"].includes((entry.severity ?? "").toLowerCase()),
  );

  return {
    counts: {
      meals: { done: countType("meal"), target: mealTarget },
      walks: { done: countType("walk"), target: walkTarget },
      potty: { done: countType("potty"), target: 3 },
      training: countType("training"),
      medication: countType("medication"),
      vomit: vomitEntries.length,
      anxiety: todays.filter(isAnxietyEntry).length,
      walkMinutes: normalized
        .filter((entry) => entry.normalizedType === "walk")
        .reduce((sum, entry) => sum + (entry.durationMinutes ?? 0), 0),
    },
    healthAlert,
  };
}

import {
  isHealthWatchEventType,
  normalizeCareEventType,
  type CareEventDetails,
} from "./events.ts";

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
  pending?: number;
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

/** Severities that require a caregiver follow-up across care event types. */
export function isCareFollowUpSeverity(
  severity: string | null | undefined,
): boolean {
  return ["watch", "alert", "urgent"].includes(
    (severity ?? "").trim().toLowerCase(),
  );
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

export function isOwnerMarkedUrgentHealthEntry(
  entry: CareStatusEntry,
): boolean {
  return (
    isHealthWatchEventType(entry.type, entry.details) &&
    ["alert", "urgent"].includes((entry.severity ?? "").trim().toLowerCase())
  );
}

export function isStructuredAnxietyEvidence(entry: CareStatusEntry): boolean {
  const details = asObject(entry.details);
  return [entry.mood, details.mood, details.aloneOutcome, details.returnState]
    .map((value) =>
      String(value ?? "")
        .trim()
        .toLowerCase(),
    )
    .some((value) =>
      [
        "anxious",
        "nervous",
        "unsure",
        "uneasy",
        "distressed",
        "restless",
      ].includes(value),
    );
}

function asObject(details: CareEventDetails): Record<string, unknown> {
  return details != null &&
    typeof details === "object" &&
    !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : {};
}

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isPendingMealOutcome(entry: CareStatusEntry): boolean {
  if (normalizeCareEventType(entry.type, entry.details) !== "meal")
    return false;
  const details = asObject(entry.details);
  const completion = clean(
    details.mealCompletion ?? details.completion ?? details.outcome,
  );
  const lifecycle = clean(details.mealLifecycle);
  return (
    [
      "served",
      "pending",
      "outcome-pending",
      "still grazing",
      "grazing",
    ].includes(completion) ||
    [
      "served",
      "pending",
      "outcome-pending",
      "still grazing",
      "grazing",
    ].includes(lifecycle)
  );
}

export function deriveCareDayStatus(
  entries: readonly CareStatusEntry[],
  routines: readonly CareStatusRoutine[] = [],
  now: number = Date.now(),
): CareDayStatus {
  const todays = entries.filter((entry) =>
    isSameLocalDay(entry.occurredAt, now),
  );
  const normalized = todays.map((entry) => ({
    ...entry,
    normalizedType: normalizeCareEventType(entry.type, entry.details),
  }));

  const countType = (type: string): number =>
    normalized.filter((entry) => entry.normalizedType === type).length;

  const mealTarget =
    routines.filter(
      (routine) => normalizeCareEventType(routine.type) === "meal",
    ).length || 2;
  const walkTarget =
    routines.filter(
      (routine) => normalizeCareEventType(routine.type) === "walk",
    ).length || 2;

  const vomitEntries = normalized.filter(
    (entry) => entry.normalizedType === "vomit",
  );
  const healthAlert =
    normalized.some(isOwnerMarkedUrgentHealthEntry) ||
    vomitEntries.some((entry) =>
      ["alert", "urgent", "watch"].includes(
        (entry.severity ?? "").toLowerCase(),
      ),
    );
  const mealEntries = normalized.filter(
    (entry) => entry.normalizedType === "meal",
  );
  const pendingMealOutcomes = mealEntries.filter(isPendingMealOutcome).length;
  const resolvedMealCount = Math.max(
    0,
    mealEntries.length - pendingMealOutcomes,
  );

  return {
    counts: {
      meals: {
        done: resolvedMealCount,
        target: mealTarget,
        pending: pendingMealOutcomes,
      },
      walks: { done: countType("walk"), target: walkTarget },
      potty: { done: countType("potty"), target: 3 },
      training: countType("training"),
      medication: countType("medication"),
      vomit: vomitEntries.length,
      anxiety: todays.filter(isStructuredAnxietyEvidence).length,
      walkMinutes: normalized
        .filter((entry) => entry.normalizedType === "walk")
        .reduce((sum, entry) => sum + (entry.durationMinutes ?? 0), 0),
    },
    healthAlert,
  };
}

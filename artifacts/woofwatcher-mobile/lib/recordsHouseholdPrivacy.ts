import {
  normalizeCareEventType,
  selectSharedCareEvidence,
} from "@workspace/care-domain";

export interface RecordsHouseholdVisibilityEntry {
  occurredAt?: unknown;
  details?: unknown;
}

export interface RecordsHouseholdEntry extends RecordsHouseholdVisibilityEntry {
  type: string;
  occurredAt: string;
  caregiver?: string;
  durationMinutes?: number;
  note?: string;
}

export interface RecordsProgressReport {
  total: number;
  meals: number;
  walks: number;
  walkMinutes: number;
  play: number;
  potty: number;
  treats: number;
  incidents: number;
  topCaregiver: { name: string; count: number } | null;
}

function careEventDetails(
  details: unknown,
): Record<string, unknown> | undefined {
  return details && typeof details === "object" && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : undefined;
}

/**
 * Records is a household-facing surface. Keep private/future/malformed logs in
 * the owned local care document, but remove them from the single observable
 * dataset used by Records cards and outbound reports.
 */
export function selectRecordsHouseholdEntries<
  T extends RecordsHouseholdVisibilityEntry,
>(entries: readonly T[], now: number = Date.now()): T[] {
  return selectSharedCareEvidence(entries, now);
}

export function buildRecordsProgressReport(
  entries: readonly RecordsHouseholdEntry[],
  periodDays: number,
  now: number,
): RecordsProgressReport {
  const within = selectRecordsHouseholdEntries(entries, now).filter(
    (entry) =>
      (now - new Date(entry.occurredAt).getTime()) / 86_400_000 <= periodDays,
  );
  const count = (types: readonly string[]) =>
    within.filter((entry) =>
      types.includes(
        normalizeCareEventType(entry.type, careEventDetails(entry.details)),
      ),
    ).length;
  const walkMinutes = within
    .filter(
      (entry) =>
        normalizeCareEventType(
          entry.type,
          careEventDetails(entry.details),
        ) === "walk",
    )
    .reduce((sum, entry) => sum + (entry.durationMinutes ?? 0), 0);
  const byCaregiver: Record<string, number> = {};
  for (const entry of within) {
    if (entry.caregiver) {
      byCaregiver[entry.caregiver] = (byCaregiver[entry.caregiver] ?? 0) + 1;
    }
  }
  const topCaregiver = Object.entries(byCaregiver).sort(
    (left, right) => right[1] - left[1],
  )[0];

  return {
    total: within.length,
    meals: count(["meal"]),
    walks: count(["walk"]),
    walkMinutes,
    play: count(["play", "training"]),
    potty: count(["potty"]),
    treats: count(["treat"]),
    incidents: count(["incident"]),
    topCaregiver: topCaregiver
      ? { name: topCaregiver[0], count: topCaregiver[1] }
      : null,
  };
}

export function selectRecordsRecentMealNotes<T extends RecordsHouseholdEntry>(
  entries: readonly T[],
  now: number = Date.now(),
  limit = 4,
): T[] {
  return selectRecordsHouseholdEntries(entries, now)
    .filter(
      (entry) =>
        normalizeCareEventType(
          entry.type,
          careEventDetails(entry.details),
        ) === "meal" &&
        Boolean(entry.note),
    )
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() -
        new Date(left.occurredAt).getTime(),
    )
    .slice(0, limit);
}

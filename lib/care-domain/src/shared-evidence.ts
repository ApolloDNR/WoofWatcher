export interface SharedCareEvidenceEntry {
  occurredAt?: unknown;
  details?: unknown;
}

function detailRecord(details: unknown): Record<string, unknown> | null {
  return details != null &&
    typeof details === "object" &&
    !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : null;
}

export function isHouseholdVisibleCareEvidence(
  entry: SharedCareEvidenceEntry,
): boolean {
  const details = detailRecord(entry.details);
  if (
    !details ||
    !Object.prototype.hasOwnProperty.call(details, "householdVisible")
  ) {
    return true;
  }
  return details.householdVisible === true;
}

export function isSharedCareEvidenceObservableAt(
  entry: SharedCareEvidenceEntry,
  now: number = Date.now(),
): boolean {
  if (!isHouseholdVisibleCareEvidence(entry)) return false;
  if (typeof entry.occurredAt !== "string") return false;
  const occurredAt = Date.parse(entry.occurredAt);
  return Number.isFinite(occurredAt) && occurredAt <= now;
}

export function selectSharedCareEvidence<
  TEntry extends SharedCareEvidenceEntry,
>(entries: readonly TEntry[], now: number = Date.now()): TEntry[] {
  return entries.filter((entry) =>
    isSharedCareEvidenceObservableAt(entry, now),
  );
}

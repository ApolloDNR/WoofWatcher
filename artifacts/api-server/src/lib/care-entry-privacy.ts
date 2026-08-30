const CARE_STATE_LOG_COLLECTION_KEYS = [
  "entries",
  "careEntries",
  "careEntryTombstones",
] as const;

export interface CareEntryHouseholdVisibilityMetadata {
  present: boolean;
  valid: boolean;
  value: boolean;
}

export function readCareEntryHouseholdVisibility(
  details: Record<string, unknown> | null | undefined,
): CareEntryHouseholdVisibilityMetadata {
  if (
    details == null ||
    !Object.prototype.hasOwnProperty.call(details, "householdVisible")
  ) {
    return { present: false, valid: true, value: true };
  }
  if (typeof details.householdVisible !== "boolean") {
    return { present: true, valid: false, value: false };
  }
  return {
    present: true,
    valid: true,
    value: details.householdVisible,
  };
}

export function resolveCareEntryHouseholdVisibility(
  details: Record<string, unknown> | null | undefined,
): boolean {
  const metadata = readCareEntryHouseholdVisibility(details);
  return metadata.valid && metadata.value;
}

export function containsEmbeddedCareLogCollections(
  doc: Record<string, unknown>,
): boolean {
  return CARE_STATE_LOG_COLLECTION_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(doc, key),
  );
}

export function stripEmbeddedCareLogCollections(
  doc: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = { ...doc };
  for (const key of CARE_STATE_LOG_COLLECTION_KEYS) {
    delete sanitized[key];
  }
  return sanitized;
}

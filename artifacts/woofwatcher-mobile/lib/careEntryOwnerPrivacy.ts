import { isHouseholdVisibleCareEvidence } from "@workspace/care-domain";

export interface OwnerScopedCareEntry {
  caregiverUserId?: unknown;
  details?: unknown;
}

export interface CareEntryOwnerPrivacyPartition<
  TEntry extends OwnerScopedCareEntry,
> {
  retained: TEntry[];
  quarantined: TEntry[];
}

export function partitionCareEntriesForSignedInUser<
  TEntry extends OwnerScopedCareEntry,
>(
  entries: readonly TEntry[],
  exactUserId: string,
): CareEntryOwnerPrivacyPartition<TEntry> {
  const retained: TEntry[] = [];
  const quarantined: TEntry[] = [];
  for (const entry of entries) {
    if (
      isHouseholdVisibleCareEvidence(entry) ||
      entry.caregiverUserId === exactUserId
    ) {
      retained.push(entry);
    } else {
      quarantined.push(entry);
    }
  }
  return { retained, quarantined };
}

export function stampSignedInPrivateCareEntryCreator<
  TEntry extends OwnerScopedCareEntry,
>(entry: TEntry, exactUserId: string): TEntry {
  if (isHouseholdVisibleCareEvidence(entry)) return entry;
  return { ...entry, caregiverUserId: exactUserId };
}

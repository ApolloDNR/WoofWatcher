export const CARE_ENTRY_SYNC_REVISION_KEY =
  "clientSyncRevision" as const;
export const CARE_ENTRY_SYNC_PROTOCOL = "revision-v1" as const;

export function readCareEntrySyncRevision(
  details: Record<string, unknown> | null | undefined,
): number | null {
  const value = details?.[CARE_ENTRY_SYNC_REVISION_KEY];
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

export function nextCareEntrySyncRevision(
  details: Record<string, unknown> | null | undefined,
): number {
  const current = readCareEntrySyncRevision(details) ?? 0;
  return current < Number.MAX_SAFE_INTEGER ? current + 1 : current;
}

export interface ResolveLegacyCareEntrySyncWriteRevisionInput {
  storedDetails: Record<string, unknown> | null | undefined;
  requestedDetails: Record<string, unknown> | null | undefined;
  detailsWereSupplied: boolean;
}

/**
 * Legacy clients either omit details/revision or echo the revision they last
 * read. In both cases the server advances from the row it selected, while a
 * genuinely stale lower revision is preserved so the atomic UPDATE predicate
 * rejects it. Current clients use CARE_ENTRY_SYNC_PROTOCOL and must establish
 * exactly the next revision instead.
 */
export function resolveLegacyCareEntrySyncWriteRevision({
  storedDetails,
  requestedDetails,
  detailsWereSupplied,
}: ResolveLegacyCareEntrySyncWriteRevisionInput): number {
  const storedRevision = readCareEntrySyncRevision(storedDetails) ?? 0;
  const requestedRevision = detailsWereSupplied
    ? readCareEntrySyncRevision(requestedDetails)
    : null;

  if (
    requestedRevision == null ||
    requestedRevision === storedRevision
  ) {
    return nextCareEntrySyncRevision(storedDetails);
  }

  return requestedRevision;
}

export function isNextCareEntrySyncRevision(
  storedDetails: Record<string, unknown> | null | undefined,
  requestedDetails: Record<string, unknown> | null | undefined,
): boolean {
  const storedRevision = readCareEntrySyncRevision(storedDetails) ?? 0;
  const requestedRevision = readCareEntrySyncRevision(requestedDetails);
  return (
    storedRevision < Number.MAX_SAFE_INTEGER &&
    requestedRevision != null &&
    requestedRevision === storedRevision + 1
  );
}

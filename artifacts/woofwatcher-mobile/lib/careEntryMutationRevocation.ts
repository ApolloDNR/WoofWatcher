export interface CareEntryRevocationCandidate {
  id: string;
}

export interface CareEntryRevocationSuppressionPersistence {
  persistCleanupLedger: () => Promise<boolean>;
  persistIdentitySlot: () => Promise<boolean>;
}

async function attemptCareEntryRevocationSuppressionWrite(
  persist: () => Promise<boolean>,
): Promise<boolean> {
  try {
    return await persist();
  } catch {
    return false;
  }
}

/**
 * Persists the same terminal revocation through both independent recovery
 * paths. The cleanup ledger suppresses an old primary-slot row during
 * hydration, while the identity-slot rewrite removes the row directly. A
 * failure in either store must not prevent the other store from being tried.
 */
export async function persistCareEntryRevocationSuppression({
  persistCleanupLedger,
  persistIdentitySlot,
}: CareEntryRevocationSuppressionPersistence): Promise<boolean> {
  const [cleanupLedgerPersisted, identitySlotPersisted] = await Promise.all([
    attemptCareEntryRevocationSuppressionWrite(persistCleanupLedger),
    attemptCareEntryRevocationSuppressionWrite(persistIdentitySlot),
  ]);
  return cleanupLedgerPersisted || identitySlotPersisted;
}

export interface CareEntryRevocationSuppressionRelease {
  persistIdentitySlot: () => Promise<boolean>;
  clearCleanupLedger: () => Promise<void>;
}

/**
 * Releases a durable cleanup-ledger fallback only after a clean primary slot
 * has been confirmed. Otherwise a later refresh could erase the sole durable
 * suppression record while stale retryable bytes still exist in the primary
 * store.
 */
export async function releaseCareEntryRevocationSuppression({
  persistIdentitySlot,
  clearCleanupLedger,
}: CareEntryRevocationSuppressionRelease): Promise<boolean> {
  const identitySlotPersisted =
    await attemptCareEntryRevocationSuppressionWrite(persistIdentitySlot);
  if (!identitySlotPersisted) return false;
  try {
    await clearCleanupLedger();
    return true;
  } catch {
    return false;
  }
}

interface DurableExactCareEntryRevocationInput<
  TEntry extends CareEntryRevocationCandidate,
> {
  retained: TEntry[];
  revoked: TEntry;
  canContinue: () => boolean;
  clearMutationState: (revoked: TEntry) => void;
  replaceActiveSlot: (retained: TEntry[], revoked: TEntry) => void;
  publishEntries: (retained: TEntry[]) => void;
  persistActiveSlot: () => Promise<boolean>;
  onPersistenceFailure: (retained: TEntry[], revoked: TEntry) => void;
}

async function commitDurableExactCareEntryRevocation<
  TEntry extends CareEntryRevocationCandidate,
>({
  retained,
  revoked,
  canContinue,
  clearMutationState,
  replaceActiveSlot,
  publishEntries,
  persistActiveSlot,
  onPersistenceFailure,
}: DurableExactCareEntryRevocationInput<TEntry>): Promise<
  "persisted" | "persistence-failed" | "ignored-stale"
> {
  if (!canContinue()) return "ignored-stale";
  replaceActiveSlot(retained, revoked);
  let persisted = false;
  try {
    persisted = await persistActiveSlot();
  } catch {
    persisted = false;
  }
  if (!canContinue()) return "ignored-stale";
  clearMutationState(revoked);
  publishEntries(retained);
  if (!persisted) {
    onPersistenceFailure(retained, revoked);
    return "persistence-failed";
  }
  return "persisted";
}

export const CARE_ENTRY_CREATE_REVOKED_CODE =
  "care_entry_create_revoked" as const;

export type ExactCareEntryCreateRevocationResult<
  TEntry extends CareEntryRevocationCandidate,
> =
  | { status: "not-revoked" }
  | { status: "ignored-stale" }
  | {
      status: "persistence-failed";
      retained: TEntry[];
      revoked: TEntry;
    }
  | {
      status: "revoked";
      retained: TEntry[];
      revoked: TEntry;
    };

export interface ExactCareEntryCreateRevocationInput<
  TEntry extends CareEntryRevocationCandidate,
> {
  tempId: string;
  error: unknown;
  canContinue: () => boolean;
  isCurrentAttempt: () => boolean;
  readEntries: () => readonly TEntry[];
  clearCreateState: (tempId: string, entry: TEntry) => void;
  replaceActiveSlot: (retained: TEntry[], revoked: TEntry) => void;
  publishEntries: (retained: TEntry[]) => void;
  persistActiveSlot: () => Promise<boolean>;
  onPersistenceFailure: (retained: TEntry[], revoked: TEntry) => void;
}

function isExactCareEntryCreateRevocation(
  error: unknown,
  tempId: string,
): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; data?: unknown };
  if (
    candidate.status !== 410 ||
    !candidate.data ||
    typeof candidate.data !== "object"
  ) {
    return false;
  }
  const data = candidate.data as {
    code?: unknown;
    clientKey?: unknown;
  };
  return (
    data.code === CARE_ENTRY_CREATE_REVOKED_CODE && data.clientKey === tempId
  );
}

/**
 * Applies the API's terminal, creator-scoped CREATE revocation. The response
 * is accepted only for the exact temp identity under the still-current auth
 * permit. Its local row moves to non-renderable recovery evidence and is
 * removed from the active slot before another sync can derive a retry.
 */
export async function applyExactCareEntryCreateRevocation<
  TEntry extends CareEntryRevocationCandidate,
>({
  tempId,
  error,
  canContinue,
  isCurrentAttempt,
  readEntries,
  clearCreateState,
  replaceActiveSlot,
  publishEntries,
  persistActiveSlot,
  onPersistenceFailure,
}: ExactCareEntryCreateRevocationInput<TEntry>): Promise<
  ExactCareEntryCreateRevocationResult<TEntry>
> {
  if (!isExactCareEntryCreateRevocation(error, tempId)) {
    return { status: "not-revoked" };
  }
  if (!canContinue() || !isCurrentAttempt()) {
    return { status: "ignored-stale" };
  }

  const currentEntries = [...readEntries()];
  const revoked = currentEntries.find((entry) => entry.id === tempId);
  if (!revoked) return { status: "ignored-stale" };
  const retained = currentEntries.filter((entry) => entry.id !== tempId);
  if (!canContinue() || !isCurrentAttempt()) {
    return { status: "ignored-stale" };
  }

  const durability = await commitDurableExactCareEntryRevocation({
    retained,
    revoked,
    canContinue: () => canContinue() && isCurrentAttempt(),
    clearMutationState: () => clearCreateState(tempId, revoked),
    replaceActiveSlot,
    publishEntries,
    persistActiveSlot,
    onPersistenceFailure,
  });
  if (durability === "ignored-stale") {
    return { status: "ignored-stale" };
  }
  if (durability === "persistence-failed") {
    return { status: "persistence-failed", retained, revoked };
  }
  return { status: "revoked", retained, revoked };
}

export type ExactCareEntryNotFoundRevocationResult<
  TEntry extends CareEntryRevocationCandidate,
> =
  | { status: "not-revoked" }
  | { status: "ignored-stale" }
  | {
      status: "persistence-failed";
      retained: TEntry[];
      revoked: TEntry;
    }
  | {
      status: "revoked";
      retained: TEntry[];
      revoked: TEntry;
    };

export interface ExactCareEntryNotFoundRevocationInput<
  TEntry extends CareEntryRevocationCandidate,
> {
  entryId: string;
  submittedEntry: TEntry;
  error: unknown;
  isNotFoundError: (error: unknown) => boolean;
  canContinue: () => boolean;
  readEntries: () => readonly TEntry[];
  cancelMutation: (entryId: string) => void;
  clearMutationAuthority: (entryId: string, entry: TEntry) => void;
  replaceActiveSlot: (retained: TEntry[], revoked: TEntry) => void;
  publishEntries: (retained: TEntry[]) => void;
  persistActiveSlot: () => Promise<boolean>;
  onPersistenceFailure: (retained: TEntry[], revoked: TEntry) => void;
}

function isNeverAcknowledgedLocalIdentity(entryId: string): boolean {
  return entryId.startsWith("temp_") || entryId.startsWith("local_");
}

/**
 * Treats an exact current-permit PATCH 404 as row-specific revocation. A 404
 * deliberately does not distinguish deletion from a shared-to-private change;
 * either way this user must stop rendering and retrying the durable row.
 *
 * Capped list absence is never accepted here as revocation evidence, and local
 * create identities remain untouched until a server acknowledgement gives
 * them a durable id.
 */
export async function applyExactCareEntryNotFoundRevocation<
  TEntry extends CareEntryRevocationCandidate,
>({
  entryId,
  submittedEntry,
  error,
  isNotFoundError,
  canContinue,
  readEntries,
  cancelMutation,
  clearMutationAuthority,
  replaceActiveSlot,
  publishEntries,
  persistActiveSlot,
  onPersistenceFailure,
}: ExactCareEntryNotFoundRevocationInput<TEntry>): Promise<
  ExactCareEntryNotFoundRevocationResult<TEntry>
> {
  if (!isNotFoundError(error) || isNeverAcknowledgedLocalIdentity(entryId)) {
    return { status: "not-revoked" };
  }
  if (!canContinue()) return { status: "ignored-stale" };

  const currentEntries = [...readEntries()];
  const revoked = currentEntries.find((entry) => entry.id === entryId);
  if (revoked !== submittedEntry) return { status: "ignored-stale" };
  const retained = currentEntries.filter((entry) => entry.id !== entryId);
  if (!canContinue()) return { status: "ignored-stale" };

  const durability = await commitDurableExactCareEntryRevocation({
    retained,
    revoked,
    canContinue,
    clearMutationState() {
      cancelMutation(entryId);
      clearMutationAuthority(entryId, revoked);
    },
    replaceActiveSlot,
    publishEntries,
    persistActiveSlot,
    onPersistenceFailure,
  });
  if (durability === "ignored-stale") {
    return { status: "ignored-stale" };
  }
  if (durability === "persistence-failed") {
    return { status: "persistence-failed", retained, revoked };
  }
  return { status: "revoked", retained, revoked };
}

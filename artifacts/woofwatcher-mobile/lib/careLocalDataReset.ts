import type { LocalDataResetParticipant } from "./localDataResetCoordinator.ts";

export const CARE_PRIMARY_LOCAL_DATA_KEY = "woofwatcher.v2.state";

export const CARE_AUXILIARY_LOCAL_DATA_KEYS = [
  "woofwatcher.v2.state.recovery",
  "woofwatcher.v2.discarded-server-entry-ids.recovery",
  "woofwatcher.v1.import",
  "woofwatcher.v1.state",
] as const;

export const CARE_PRESERVED_LOCAL_DATA_KEY =
  "woofwatcher.v2.discarded-server-entry-ids";

export interface CareLocalDataResetHooks {
  canPrepare(): boolean;
  drainPrimarySnapshots(): Promise<void>;
  drainCleanupLedger(): Promise<void>;
  beginCommit(): void;
  endCommit(result: { committed: boolean }): void;
  invalidateAndDrainPrimarySnapshots(): Promise<void>;
  persistCleanupIntent(): Promise<void>;
  removeItem(key: string): Promise<void>;
  finalizeSuccessfulCommit(): void;
}

export interface CareLocalDataResetController {
  participant: Omit<LocalDataResetParticipant, "id">;
}

export interface CareHydrationAttempt {
  isCurrent(): boolean;
  cancel(): void;
}

export interface CareHydrationAttemptAuthority {
  begin(admissionOpen: boolean): CareHydrationAttempt | null;
}

export interface CarePersistenceIdentity<TDoc, TEntry> {
  doc: TDoc;
  entries: readonly TEntry[];
  serverVersion: number;
}

export function isSameCarePersistenceIdentity<TDoc, TEntry>(
  current: CarePersistenceIdentity<TDoc, TEntry>,
  expected: CarePersistenceIdentity<TDoc, TEntry>,
): boolean {
  return (
    current.doc === expected.doc &&
    current.entries === expected.entries &&
    current.serverVersion === expected.serverVersion
  );
}

export type CarePristineSnapshotPersistenceDecision =
  | "wait"
  | "suppress"
  | "persist";

export function getCarePristineSnapshotPersistenceDecision<TDoc, TEntry>({
  current,
  pristine,
  operationSettledEpoch,
  resetStartedAtEpoch,
}: {
  current: CarePersistenceIdentity<TDoc, TEntry>;
  pristine: CarePersistenceIdentity<TDoc, TEntry>;
  operationSettledEpoch: number;
  resetStartedAtEpoch: number;
}): CarePristineSnapshotPersistenceDecision {
  if (!isSameCarePersistenceIdentity(current, pristine)) return "persist";
  return operationSettledEpoch <= resetStartedAtEpoch
    ? "wait"
    : "suppress";
}

export function hasInterruptedCareEntryMutationsToRecover(
  entries: readonly { syncStatus?: string }[],
): boolean {
  return entries.some((entry) => entry.syncStatus === "pending");
}

export function createCareHydrationAttemptAuthority(): CareHydrationAttemptAuthority {
  let generation = 0;
  return {
    begin(admissionOpen) {
      if (!admissionOpen) return null;
      generation += 1;
      const acceptedGeneration = generation;
      let cancelled = false;
      return {
        isCurrent: () =>
          !cancelled && acceptedGeneration === generation,
        cancel() {
          if (cancelled) return;
          cancelled = true;
          if (generation === acceptedGeneration) generation += 1;
        },
      };
    },
  };
}

function invokeAsync(operation: () => Promise<void>): Promise<void> {
  try {
    return Promise.resolve(operation());
  } catch (error) {
    return Promise.reject(error);
  }
}

export function createCareLocalDataResetController(
  hooks: CareLocalDataResetHooks,
): CareLocalDataResetController {
  let preparationAttempt = 0;
  let preparedAttempt: number | null = null;

  const participant: Omit<LocalDataResetParticipant, "id"> = {
    prepare() {
      const attempt = ++preparationAttempt;
      preparedAttempt = null;
      if (!hooks.canPrepare()) {
        return Promise.reject(
          new Error("Care local data is not ready for reset."),
        );
      }

      const primaryDrain = invokeAsync(hooks.drainPrimarySnapshots);
      const cleanupDrain = invokeAsync(hooks.drainCleanupLedger);
      return Promise.all([primaryDrain, cleanupDrain]).then(() => {
        if (preparationAttempt === attempt) preparedAttempt = attempt;
      });
    },
    async commit() {
      if (preparedAttempt === null) {
        throw new Error("Care local data reset was not prepared.");
      }
      preparedAttempt = null;

      let committed = false;
      try {
        hooks.beginCommit();
        await hooks.invalidateAndDrainPrimarySnapshots();
        await hooks.drainCleanupLedger();
        await hooks.persistCleanupIntent();

        const auxiliaryFailures: unknown[] = [];
        for (const key of CARE_AUXILIARY_LOCAL_DATA_KEYS) {
          try {
            await hooks.removeItem(key);
          } catch (error) {
            auxiliaryFailures.push(error);
          }
        }
        if (auxiliaryFailures.length > 0) {
          throw new Error("Could not remove every auxiliary Care key.");
        }

        await hooks.removeItem(CARE_PRIMARY_LOCAL_DATA_KEY);
        committed = true;
        hooks.finalizeSuccessfulCommit();
      } finally {
        hooks.endCommit({ committed });
      }
    },
  };

  return {
    participant: Object.freeze(participant),
  };
}

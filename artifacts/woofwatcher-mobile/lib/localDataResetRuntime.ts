import {
  createGenerationPermitAuthority,
  type GenerationPermitAuthority,
} from "./generationPermit.ts";
import {
  createLocalDataOperations,
  type LocalDataOperations,
} from "./localDataOperations.ts";
import {
  createLocalDataResetCoordinator,
  type LocalDataResetParticipant,
} from "./localDataResetCoordinator.ts";
import {
  createRequiredParticipantSlot,
  type RequiredParticipantSlot,
} from "./localDataResetParticipantSlot.ts";
import {
  CARE_PRESERVED_LOCAL_DATA_KEY,
  type CareResetCommitContext,
} from "./careLocalDataReset.ts";
import {
  createRemovableLocalDataStorage,
  type LocalDataStorageAdapter,
  type RemovableLocalDataStorage,
} from "./removableLocalDataStorage.ts";
import {
  createLocalDataResetFence,
  type LocalDataResetFenceOptions,
} from "./localDataResetFence.ts";
import {
  createTrackedLocalDataWork,
  type TrackedLocalDataWork,
} from "./trackedLocalDataWork.ts";

export const REQUIRED_LOCAL_DATA_PARTICIPANT_IDS = Object.freeze([
  "auth-credentials",
  "avatar",
  "care",
  "device-preferences",
  "files",
  "query-cache",
  "walk-capture",
  "web-runtime",
] as const);

export type RequiredLocalDataParticipantId =
  (typeof REQUIRED_LOCAL_DATA_PARTICIPANT_IDS)[number];

export interface LocalDataResetRuntime {
  operations: LocalDataOperations;
  generationAuthority: GenerationPermitAuthority;
  removableStorage: RemovableLocalDataStorage;
  trackedWork: TrackedLocalDataWork;
  registerParticipant(participant: LocalDataResetParticipant): () => void;
  attachRequiredParticipant(
    id: RequiredLocalDataParticipantId,
    delegate: Omit<LocalDataResetParticipant, "id">,
  ): () => void;
}

export function createLocalDataResetRuntime(
  storage: LocalDataStorageAdapter,
  fenceOptions: LocalDataResetFenceOptions = {},
): LocalDataResetRuntime {
  const generationAuthority = createGenerationPermitAuthority();
  const resetCoordinator = createLocalDataResetCoordinator();
  const resetFence = createLocalDataResetFence(storage, fenceOptions);
  const operations = createLocalDataOperations({
    resetCoordinator,
    generationAuthority,
    beginResetFence: resetFence.beginReset,
    runExportFence: resetFence.runProtectedOperation,
  });
  const removableStorage = createRemovableLocalDataStorage({
    storage,
    capturePermit: generationAuthority.capture,
    isPermitValid: generationAuthority.isValid,
    isAdmissionOpen: operations.isWriteAdmissionOpen,
    runWithStorageFence: resetFence.runStorageOperation,
  });
  const invokeCareCommit = async (
    delegate: Omit<LocalDataResetParticipant, "id">,
    commit: Omit<LocalDataResetParticipant, "id">["commit"],
  ): Promise<void> => {
    let contextOpen = true;
    const operations: Promise<void>[] = [];
    const context = Object.freeze<CareResetCommitContext>({
      persistCareCleanupLedger(entryIds) {
        if (!contextOpen) {
          return Promise.reject(
            new Error("The Care reset commit capability has expired."),
          );
        }
        if (
          !Array.isArray(entryIds) ||
          entryIds.some(
            (entryId) =>
              typeof entryId !== "string" ||
              entryId.length === 0 ||
              entryId.trim() !== entryId ||
              /[\u0000-\u001f\u007f]/.test(entryId),
          )
        ) {
          return Promise.reject(
            new Error("The Care reset cleanup ledger is invalid."),
          );
        }
        const uniqueEntryIds = [...new Set(entryIds)];
        const operation = resetFence.runResetCommitStorageOperation(() =>
          storage.setItem(
            CARE_PRESERVED_LOCAL_DATA_KEY,
            JSON.stringify(uniqueEntryIds),
          ),
        );
        operations.push(operation);
        return operation;
      },
    });

    let delegateFailed = false;
    let delegateFailure: unknown = undefined;
    try {
      await commit.call(delegate, context);
    } catch (error) {
      delegateFailed = true;
      delegateFailure = error;
    } finally {
      contextOpen = false;
    }
    const operationResults = await Promise.allSettled(operations);
    if (delegateFailed) throw delegateFailure;
    const operationFailures = operationResults.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (operationFailures.length > 0) {
      throw new AggregateError(
        operationFailures,
        "The Care reset cleanup ledger could not be preserved.",
      );
    }
  };
  const trackedWork = createTrackedLocalDataWork({
    capturePermit: generationAuthority.capture,
    isPermitValid: generationAuthority.isValid,
    isAdmissionOpen: operations.isWriteAdmissionOpen,
  });
  const requiredSlots: Record<
    RequiredLocalDataParticipantId,
    RequiredParticipantSlot
  > = {
    "auth-credentials": createRequiredParticipantSlot(
      "auth-credentials",
      "credentials",
    ),
    avatar: createRequiredParticipantSlot("avatar"),
    care: createRequiredParticipantSlot("care", "data", invokeCareCommit),
    "device-preferences": createRequiredParticipantSlot("device-preferences"),
    files: createRequiredParticipantSlot("files"),
    "query-cache": createRequiredParticipantSlot("query-cache"),
    "walk-capture": createRequiredParticipantSlot("walk-capture"),
    "web-runtime": createRequiredParticipantSlot("web-runtime"),
  };

  for (const id of REQUIRED_LOCAL_DATA_PARTICIPANT_IDS) {
    resetCoordinator.register(requiredSlots[id].participant);
  }
  resetCoordinator.register({
    id: "work-drain",
    prepare() {
      let storageDrain: Promise<void>;
      let trackedDrain: Promise<void>;
      try {
        storageDrain = removableStorage.drain();
      } catch (error) {
        storageDrain = Promise.reject(error);
      }
      try {
        trackedDrain = trackedWork.drain();
      } catch (error) {
        trackedDrain = Promise.reject(error);
      }
      return Promise.all([storageDrain, trackedDrain]).then(() => {});
    },
    async commit() {},
  });

  return {
    operations,
    generationAuthority,
    removableStorage,
    trackedWork,
    registerParticipant: resetCoordinator.register,
    attachRequiredParticipant(id, delegate) {
      return requiredSlots[id].attach(delegate);
    },
  };
}

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
  createRemovableLocalDataStorage,
  type LocalDataStorageAdapter,
  type RemovableLocalDataStorage,
} from "./removableLocalDataStorage.ts";
import {
  createTrackedLocalDataWork,
  type TrackedLocalDataWork,
} from "./trackedLocalDataWork.ts";

export const REQUIRED_LOCAL_DATA_PARTICIPANT_IDS = Object.freeze([
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
): LocalDataResetRuntime {
  const generationAuthority = createGenerationPermitAuthority();
  const resetCoordinator = createLocalDataResetCoordinator();
  const operations = createLocalDataOperations({
    resetCoordinator,
    generationAuthority,
  });
  const removableStorage = createRemovableLocalDataStorage({
    storage,
    capturePermit: generationAuthority.capture,
    isPermitValid: generationAuthority.isValid,
    isAdmissionOpen: operations.isWriteAdmissionOpen,
  });
  const trackedWork = createTrackedLocalDataWork({
    capturePermit: generationAuthority.capture,
    isPermitValid: generationAuthority.isValid,
    isAdmissionOpen: operations.isWriteAdmissionOpen,
  });
  const requiredSlots: Record<
    RequiredLocalDataParticipantId,
    RequiredParticipantSlot
  > = {
    avatar: createRequiredParticipantSlot("avatar"),
    care: createRequiredParticipantSlot("care"),
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

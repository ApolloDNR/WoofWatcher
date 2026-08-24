import { createCarePersistenceWriter } from "./carePersistenceWriter.ts";
import type { GenerationPermit } from "./generationPermit.ts";

export interface LocalDataStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface RemovableLocalDataStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  drain(): Promise<void>;
}

export interface RemovableLocalDataStorageOptions {
  storage: LocalDataStorageAdapter;
  capturePermit(): GenerationPermit;
  isPermitValid(permit: GenerationPermit): boolean;
  isAdmissionOpen(): boolean;
  runWithStorageFence?<T>(operation: () => Promise<T>): Promise<T>;
}

type QueuedStorageOperation =
  | {
      type: "set";
      key: string;
      value: string;
      permit: GenerationPermit;
    }
  | {
      type: "remove";
      key: string;
      permit: GenerationPermit;
    };

export class LocalDataResetInProgressError extends Error {
  constructor() {
    super("A local data reset is in progress.");
    this.name = "LocalDataResetInProgressError";
  }
}

export function createRemovableLocalDataStorage({
  storage,
  capturePermit,
  isPermitValid,
  isAdmissionOpen,
  runWithStorageFence = (operation) => operation(),
}: RemovableLocalDataStorageOptions): RemovableLocalDataStorage {
  const isOperationAdmitted = (permit: GenerationPermit) =>
    isAdmissionOpen() && isPermitValid(permit);

  const writer = createCarePersistenceWriter<QueuedStorageOperation>(async (operation) => {
    await Promise.resolve();
    if (!isPermitValid(operation.permit)) return;
    await runWithStorageFence(async () => {
      if (!isPermitValid(operation.permit)) return;
      if (operation.type === "set") {
        await storage.setItem(operation.key, operation.value);
        return;
      }
      await storage.removeItem(operation.key);
    });
  });

  const rejectBlocked = <T>() => Promise.reject<T>(new LocalDataResetInProgressError());

  const captureAdmittedPermit = (): GenerationPermit | null => {
    if (!isAdmissionOpen()) return null;
    const permit = capturePermit();
    return isOperationAdmitted(permit) ? permit : null;
  };

  const enqueue = (operation: QueuedStorageOperation): Promise<void> => {
    try {
      if (!isOperationAdmitted(operation.permit)) return rejectBlocked();
      return writer.enqueue(operation);
    } catch (error) {
      return Promise.reject(error);
    }
  };

  return {
    getItem(key) {
      let permit: GenerationPermit | null;
      try {
        permit = captureAdmittedPermit();
      } catch (error) {
        return Promise.reject(error);
      }
      if (!permit) return rejectBlocked();

      let read: Promise<string | null>;
      try {
        read = runWithStorageFence(() => storage.getItem(key));
      } catch (error) {
        return Promise.reject(error);
      }
      return Promise.resolve(read).then((value) => {
        if (!isOperationAdmitted(permit)) {
          throw new LocalDataResetInProgressError();
        }
        return value;
      });
    },
    setItem(key, value) {
      let permit: GenerationPermit | null;
      try {
        permit = captureAdmittedPermit();
      } catch (error) {
        return Promise.reject(error);
      }
      if (!permit) return rejectBlocked();
      return enqueue({ type: "set", key, value, permit });
    },
    removeItem(key) {
      let permit: GenerationPermit | null;
      try {
        permit = captureAdmittedPermit();
      } catch (error) {
        return Promise.reject(error);
      }
      if (!permit) return rejectBlocked();
      return enqueue({ type: "remove", key, permit });
    },
    drain() {
      return writer.drain();
    },
  };
}

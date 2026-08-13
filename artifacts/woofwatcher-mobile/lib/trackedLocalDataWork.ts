import type { GenerationPermit } from "./generationPermit.ts";
import { LocalDataResetInProgressError } from "./removableLocalDataStorage.ts";

export interface TrackedLocalDataWorkScope {
  permit: GenerationPermit;
  isCurrent(): boolean;
}

export type TrackedLocalDataWorkResult<T> =
  | { status: "complete"; value: T }
  | { status: "revoked" };

export interface TrackedLocalDataWork {
  run<T>(
    start: (scope: TrackedLocalDataWorkScope) => Promise<T>,
  ): Promise<TrackedLocalDataWorkResult<T>>;
  drain(): Promise<void>;
}

export interface TrackedLocalDataWorkOptions {
  capturePermit(): GenerationPermit;
  isPermitValid(permit: GenerationPermit): boolean;
  isAdmissionOpen(): boolean;
}

export function createTrackedLocalDataWork({
  capturePermit,
  isPermitValid,
  isAdmissionOpen,
}: TrackedLocalDataWorkOptions): TrackedLocalDataWork {
  const tracked = new Set<Promise<TrackedLocalDataWorkResult<unknown>>>();

  const rejectBlocked = <T>() =>
    Promise.reject<TrackedLocalDataWorkResult<T>>(
      new LocalDataResetInProgressError(),
    );

  return {
    run<T>(start: (scope: TrackedLocalDataWorkScope) => Promise<T>) {
      let permit: GenerationPermit;
      try {
        if (!isAdmissionOpen()) return rejectBlocked<T>();
        permit = capturePermit();
        if (!isAdmissionOpen() || !isPermitValid(permit)) {
          return rejectBlocked<T>();
        }
      } catch (error) {
        return Promise.reject(error);
      }

      let resolveOperation!: (result: TrackedLocalDataWorkResult<T>) => void;
      let rejectOperation!: (reason?: unknown) => void;
      const operation = new Promise<TrackedLocalDataWorkResult<T>>(
        (resolve, reject) => {
          resolveOperation = resolve;
          rejectOperation = reject;
        },
      );

      const trackedOperation = operation as Promise<
        TrackedLocalDataWorkResult<unknown>
      >;
      tracked.add(trackedOperation);
      void operation.then(
        () => tracked.delete(trackedOperation),
        () => tracked.delete(trackedOperation),
      );

      const settleRevokedOr = (
        settleCurrent: () => void,
      ): void => {
        if (isPermitValid(permit)) {
          settleCurrent();
        } else {
          resolveOperation({ status: "revoked" });
        }
      };

      const scope: TrackedLocalDataWorkScope = {
        permit,
        isCurrent: () => isAdmissionOpen() && isPermitValid(permit),
      };

      let started: Promise<T>;
      try {
        started = start(scope);
      } catch (error) {
        settleRevokedOr(() => rejectOperation(error));
        return operation;
      }

      void Promise.resolve(started).then(
        (value) => {
          settleRevokedOr(() =>
            resolveOperation({ status: "complete", value }),
          );
        },
        (error) => {
          settleRevokedOr(() => rejectOperation(error));
        },
      );

      return operation;
    },
    drain() {
      return Promise.allSettled([...tracked]).then(() => {});
    },
  };
}

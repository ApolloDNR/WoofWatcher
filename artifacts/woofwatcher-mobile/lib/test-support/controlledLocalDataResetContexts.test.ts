import { useSyncExternalStore } from "react";

type OperationState =
  | { status: "idle" }
  | {
      status: "failed";
      operation: "delete";
      failedParticipantIds: string[];
    };

let operationState: OperationState;
let shieldRequested: boolean;
let clearResultCalls: number;
let releaseCalls: number;
let runResetCalls: number;
const operationListeners = new Set<() => void>();
const shieldListeners = new Set<() => void>();

export function resetControlledGenericFailure(): void {
  resetControlledFailure([]);
}

export function resetControlledFailure(failedParticipantIds: string[]): void {
  operationState = {
    status: "failed",
    operation: "delete",
    failedParticipantIds: [...failedParticipantIds],
  };
  shieldRequested = true;
  clearResultCalls = 0;
  releaseCalls = 0;
  runResetCalls = 0;
}

resetControlledGenericFailure();

export function getControlledCalls(): {
  clearResult: number;
  release: number;
  runReset: number;
} {
  return {
    clearResult: clearResultCalls,
    release: releaseCalls,
    runReset: runResetCalls,
  };
}

export function useLocalDataReset() {
  const state = useSyncExternalStore(
    (listener) => {
      operationListeners.add(listener);
      return () => operationListeners.delete(listener);
    },
    () => operationState,
    () => operationState,
  );
  return {
    operationState: state,
    runReset: async () => {
      runResetCalls += 1;
      return {
        status: "failed" as const,
        failedParticipantIds:
          operationState.status === "failed"
            ? [...operationState.failedParticipantIds]
            : [],
      };
    },
    clearResult() {
      clearResultCalls += 1;
      operationState = { status: "idle" };
      for (const listener of operationListeners) listener();
    },
  };
}

export function useQueryCacheLocalDataReset() {
  return {
    attachPersonalQueryObserverShieldHost: () => () => {},
    subscribeToPersonalQueryObserverShield(listener: () => void) {
      shieldListeners.add(listener);
      return () => shieldListeners.delete(listener);
    },
    isPersonalQueryObserverShieldRequested: () => shieldRequested,
    confirmPersonalQueryObserversHidden() {},
    releasePersonalQueryObserverShield() {
      releaseCalls += 1;
      shieldRequested = false;
      for (const listener of shieldListeners) listener();
    },
  };
}

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
const operationListeners = new Set<() => void>();
const shieldListeners = new Set<() => void>();

export function resetControlledGenericFailure(): void {
  operationState = {
    status: "failed",
    operation: "delete",
    failedParticipantIds: [],
  };
  shieldRequested = true;
  clearResultCalls = 0;
  releaseCalls = 0;
}

resetControlledGenericFailure();

export function getControlledCalls(): {
  clearResult: number;
  release: number;
} {
  return { clearResult: clearResultCalls, release: releaseCalls };
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
      throw new Error("not used by the generic failure case");
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

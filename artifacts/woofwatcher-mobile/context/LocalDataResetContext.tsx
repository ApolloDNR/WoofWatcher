import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createLocalDataIntentAuthority,
  runWithLocalDataIntent,
  type LocalDataIntent,
  type LocalDataIntentAuthority,
  type LocalDataIntentInteractionResult,
} from "@/lib/localDataIntent";
import type {
  LocalDataOperationState,
  LocalDataOperations,
} from "@/lib/localDataOperations";
import type {
  LocalDataResetParticipant,
  LocalDataResetResult,
} from "@/lib/localDataResetCoordinator";
import {
  createLocalDataResetRuntime,
  type LocalDataResetRuntime,
  type RequiredLocalDataParticipantId,
} from "@/lib/localDataResetRuntime";
import type { RemovableLocalDataStorage } from "@/lib/removableLocalDataStorage";
import type { TrackedLocalDataWork } from "@/lib/trackedLocalDataWork";

export interface LocalDataResetContextValue {
  operationState: LocalDataOperationState;
  operationSettledEpoch: number;
  runExport: LocalDataOperations["runExport"];
  runReset(): Promise<LocalDataResetResult>;
  clearResult: LocalDataOperations["clearResult"];
  isResetting: LocalDataOperations["isResetting"];
  isWriteAdmissionOpen: LocalDataOperations["isWriteAdmissionOpen"];
  registerParticipant(participant: LocalDataResetParticipant): () => void;
  attachRequiredParticipant(
    id: RequiredLocalDataParticipantId,
    delegate: Omit<LocalDataResetParticipant, "id">,
  ): () => void;
  removableStorage: RemovableLocalDataStorage;
  runTrackedLocalDataWork: TrackedLocalDataWork["run"];
  captureLocalDataIntent(): LocalDataIntent | null;
  isLocalDataIntentCurrent(intent: LocalDataIntent): boolean;
  runWithLocalDataIntent<T>(
    interact: () => Promise<T>,
  ): Promise<LocalDataIntentInteractionResult<T>>;
}

const LocalDataResetContext = createContext<LocalDataResetContextValue | null>(
  null,
);

export function LocalDataResetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const runtimeRef = useRef<LocalDataResetRuntime | null>(null);
  if (runtimeRef.current === null) {
    runtimeRef.current = createLocalDataResetRuntime(AsyncStorage);
  }
  const runtime = runtimeRef.current;
  const intentAuthorityRef = useRef<LocalDataIntentAuthority | null>(null);
  if (intentAuthorityRef.current === null) {
    intentAuthorityRef.current = createLocalDataIntentAuthority({
      generationAuthority: runtime.generationAuthority,
      isAdmissionOpen: runtime.operations.isWriteAdmissionOpen,
    });
  }
  const intentAuthority = intentAuthorityRef.current;
  const [operationState, setOperationState] = useState<LocalDataOperationState>(
    () => runtime.operations.getState(),
  );
  const [operationSettledEpoch, setOperationSettledEpoch] = useState(0);
  const observedResetPromisesRef = useRef(new WeakSet<Promise<LocalDataResetResult>>());

  useEffect(() => {
    const unsubscribe = runtime.operations.subscribe(setOperationState);
    setOperationState(runtime.operations.getState());
    return unsubscribe;
  }, [runtime]);

  const runReset = useCallback(() => {
    const resetPromise = runtime.operations.runReset();
    if (!observedResetPromisesRef.current.has(resetPromise)) {
      observedResetPromisesRef.current.add(resetPromise);
      const markSettled = () => {
        queueMicrotask(() => {
          setOperationSettledEpoch((epoch) => epoch + 1);
        });
      };
      void resetPromise.then(markSettled, markSettled);
    }
    return resetPromise;
  }, [runtime]);
  const runLocalDataIntentInteraction = useCallback(
    <T,>(interact: () => Promise<T>) =>
      runWithLocalDataIntent(intentAuthority, interact),
    [intentAuthority],
  );

  const value = useMemo<LocalDataResetContextValue>(
    () => ({
      operationState,
      operationSettledEpoch,
      runExport: runtime.operations.runExport,
      runReset,
      clearResult: runtime.operations.clearResult,
      isResetting: runtime.operations.isResetting,
      isWriteAdmissionOpen: runtime.operations.isWriteAdmissionOpen,
      registerParticipant: runtime.registerParticipant,
      attachRequiredParticipant: runtime.attachRequiredParticipant,
      removableStorage: runtime.removableStorage,
      runTrackedLocalDataWork: runtime.trackedWork.run,
      captureLocalDataIntent: intentAuthority.capture,
      isLocalDataIntentCurrent: intentAuthority.isCurrent,
      runWithLocalDataIntent: runLocalDataIntentInteraction,
    }),
    [
      intentAuthority,
      operationSettledEpoch,
      operationState,
      runLocalDataIntentInteraction,
      runReset,
      runtime,
    ],
  );

  return (
    <LocalDataResetContext.Provider value={value}>
      {children}
    </LocalDataResetContext.Provider>
  );
}

export function useLocalDataReset(): LocalDataResetContextValue {
  const value = useContext(LocalDataResetContext);
  if (!value) {
    throw new Error("useLocalDataReset must be used within LocalDataResetProvider.");
  }
  return value;
}

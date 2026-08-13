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

import type { GenerationPermitAuthority } from "@/lib/generationPermit";
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
  generationAuthority: GenerationPermitAuthority;
  removableStorage: RemovableLocalDataStorage;
  runTrackedLocalDataWork: TrackedLocalDataWork["run"];
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
      generationAuthority: runtime.generationAuthority,
      removableStorage: runtime.removableStorage,
      runTrackedLocalDataWork: runtime.trackedWork.run,
    }),
    [operationSettledEpoch, operationState, runReset, runtime],
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

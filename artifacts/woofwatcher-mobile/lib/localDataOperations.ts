import type { GenerationPermitAuthority } from "./generationPermit.ts";
import type {
  LocalDataResetCoordinator,
  LocalDataResetResult,
} from "./localDataResetCoordinator.ts";
import { LocalDataResetInProgressError } from "./removableLocalDataStorage.ts";

export type LocalDataOperation = "export" | "delete";

export type LocalDataOperationState =
  | { status: "idle" }
  | { status: "exporting" }
  | { status: "deleting" }
  | {
      status: "failed";
      operation: LocalDataOperation;
      failedParticipantIds: string[];
    }
  | { status: "complete"; operation: LocalDataOperation };

export interface LocalDataOperations {
  getState(): LocalDataOperationState;
  subscribe(listener: (state: LocalDataOperationState) => void): () => void;
  runExport<T>(
    capture: () => Readonly<T>,
    perform: (captured: Readonly<T>) => Promise<void>,
  ): Promise<void>;
  runReset(): Promise<LocalDataResetResult>;
  isResetting(): boolean;
  isWriteAdmissionOpen(): boolean;
  clearResult(): void;
}

export interface LocalDataOperationsOptions {
  resetCoordinator: LocalDataResetCoordinator;
  generationAuthority: GenerationPermitAuthority;
  beginResetFence?(): Promise<() => Promise<void>>;
  runExportFence?<T>(operation: () => Promise<T>): Promise<T>;
}

export function createLocalDataOperations({
  resetCoordinator,
  generationAuthority,
  beginResetFence,
  runExportFence,
}: LocalDataOperationsOptions): LocalDataOperations {
  let state: LocalDataOperationState = { status: "idle" };
  let activeExport: Promise<void> | null = null;
  let activeReset: Promise<LocalDataResetResult> | null = null;
  const listeners = new Set<(state: LocalDataOperationState) => void>();

  const setState = (next: LocalDataOperationState) => {
    state = next;
    for (const listener of listeners) {
      try {
        listener(state);
      } catch {
        // A display listener cannot interrupt a privacy operation.
      }
    }
  };

  const operations: LocalDataOperations = {
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    runExport<T>(capture: () => Readonly<T>, perform: (captured: Readonly<T>) => Promise<void>) {
      if (activeExport) return activeExport;
      if (activeReset) {
        return Promise.reject(new LocalDataResetInProgressError());
      }

      let resolveOperation!: () => void;
      let rejectOperation!: (reason?: unknown) => void;
      const operation = new Promise<void>((resolve, reject) => {
        resolveOperation = resolve;
        rejectOperation = reject;
      });
      activeExport = operation;
      void operation.then(
        () => {
          if (activeExport === operation) activeExport = null;
        },
        () => {
          if (activeExport === operation) activeExport = null;
        },
      );
      setState({ status: "exporting" });

      const fail = (error: unknown) => {
        setState({
          status: "failed",
          operation: "export",
          failedParticipantIds: [],
        });
        rejectOperation(error);
      };

      let captured: Readonly<T>;
      try {
        captured = capture();
      } catch (error) {
        fail(error);
        return operation;
      }

      let performed: Promise<void>;
      try {
        const execute = async () => perform(captured);
        performed = runExportFence ? runExportFence(execute) : execute();
      } catch (error) {
        fail(error);
        return operation;
      }

      void Promise.resolve(performed).then(
        () => {
          setState({ status: "complete", operation: "export" });
          resolveOperation();
        },
        fail,
      );
      return operation;
    },
    runReset() {
      if (activeReset) return activeReset;

      let resolveReset!: (result: LocalDataResetResult) => void;
      let rejectReset!: (reason?: unknown) => void;
      const resetOperation = new Promise<LocalDataResetResult>((resolve, reject) => {
        resolveReset = resolve;
        rejectReset = reject;
      });
      activeReset = resetOperation;
      void resetOperation.then(
        () => {
          if (activeReset === resetOperation) activeReset = null;
        },
        () => {
          if (activeReset === resetOperation) activeReset = null;
        },
      );

      const beginReset = () => {
        setState({ status: "deleting" });

        let coordinated: Promise<LocalDataResetResult>;
        try {
          let releaseResetFence: (() => Promise<void>) | null = null;
          coordinated = resetCoordinator.run(
            async () => {
              releaseResetFence = await beginResetFence?.() ?? null;
              generationAuthority.invalidate();
            },
            async () => {
              await releaseResetFence?.();
            },
          );
        } catch (error) {
          setState({
            status: "failed",
            operation: "delete",
            failedParticipantIds: [],
          });
          rejectReset(error);
          return;
        }

        void Promise.resolve(coordinated).then(
          (result) => {
            if (result.status === "complete") {
              setState({ status: "complete", operation: "delete" });
            } else {
              setState({
                status: "failed",
                operation: "delete",
                failedParticipantIds: [...result.failedParticipantIds],
              });
            }
            resolveReset(result);
          },
          (error) => {
            setState({
              status: "failed",
              operation: "delete",
              failedParticipantIds: [],
            });
            rejectReset(error);
          },
        );
      };

      if (activeExport) {
        void activeExport.then(beginReset, beginReset);
      } else {
        beginReset();
      }
      return resetOperation;
    },
    isResetting() {
      return activeReset !== null;
    },
    isWriteAdmissionOpen() {
      return activeReset === null;
    },
    clearResult() {
      if (activeExport || activeReset) return;
      if (state.status === "failed" || state.status === "complete") {
        setState({ status: "idle" });
      }
    },
  };

  return operations;
}

export interface LocalDataResetParticipant {
  id: string;
  commitPhase?: "data" | "credentials";
  prepare(): Promise<void>;
  commit(context?: unknown): Promise<void>;
}

export interface LocalDataResetResult {
  status: "complete" | "partial-failure";
  committedParticipantIds: string[];
  failedParticipantIds: string[];
}

export interface LocalDataResetCoordinator {
  register(participant: LocalDataResetParticipant): () => void;
  run(
    beforeCommit?: () => void | Promise<void>,
    afterCommit?: () => void | Promise<void>,
  ): Promise<LocalDataResetResult>;
}

export function createLocalDataResetCoordinator(): LocalDataResetCoordinator {
  interface RegisteredParticipant {
    id: string;
    commitPhase: "data" | "credentials";
    participant: LocalDataResetParticipant;
  }

  const participants = new Map<string, RegisteredParticipant>();
  let inFlight: Promise<LocalDataResetResult> | null = null;

  const executeRun = async (
    beforeCommit?: () => void | Promise<void>,
    afterCommit?: () => void | Promise<void>,
  ): Promise<LocalDataResetResult> => {
    const snapshot = [...participants.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    const preparations = snapshot.map(({ participant }) => {
      try {
        return Promise.resolve(participant.prepare());
      } catch (error) {
        return Promise.reject(error);
      }
    });
    const preparationResults = await Promise.allSettled(preparations);
    const failedPreparationIds = snapshot
      .filter((_participant, index) => preparationResults[index]?.status === "rejected")
      .map(({ id }) => id);

    if (failedPreparationIds.length > 0) {
      return {
        status: "partial-failure",
        committedParticipantIds: [],
        failedParticipantIds: failedPreparationIds,
      };
    }

    let commitBoundaryEntered = false;
    try {
      if (beforeCommit) await beforeCommit();
      commitBoundaryEntered = true;

      const committedParticipantIds: string[] = [];
      const failedParticipantIds: string[] = [];
      const commitSnapshot = [...snapshot].sort((left, right) => {
        const phaseOrder =
          Number(left.commitPhase === "credentials") -
          Number(right.commitPhase === "credentials");
        return phaseOrder || left.id.localeCompare(right.id);
      });
      for (const { id, participant } of commitSnapshot) {
        try {
          await participant.commit();
          committedParticipantIds.push(id);
        } catch {
          failedParticipantIds.push(id);
        }
      }

      return {
        status: failedParticipantIds.length === 0 ? "complete" : "partial-failure",
        committedParticipantIds,
        failedParticipantIds,
      };
    } finally {
      if (commitBoundaryEntered) await afterCommit?.();
    }
  };

  return {
    register(participant) {
      const registeredId = participant.id;
      if (participants.has(registeredId)) {
        throw new Error(`Local data reset participant '${registeredId}' is already registered.`);
      }
      const registration = {
        id: registeredId,
        commitPhase: participant.commitPhase ?? "data",
        participant,
      };
      participants.set(registeredId, registration);
      return () => {
        if (participants.get(registeredId) === registration) {
          participants.delete(registeredId);
        }
      };
    },
    run(beforeCommit, afterCommit) {
      if (inFlight) return inFlight;
      let resolveOperation!: (result: LocalDataResetResult) => void;
      let rejectOperation!: (reason?: unknown) => void;
      const operation = new Promise<LocalDataResetResult>((resolve, reject) => {
        resolveOperation = resolve;
        rejectOperation = reject;
      });
      inFlight = operation;
      const execution = executeRun(beforeCommit, afterCommit);
      void execution.then(resolveOperation, rejectOperation);
      void operation.then(
        () => {
          if (inFlight === operation) inFlight = null;
        },
        () => {
          if (inFlight === operation) inFlight = null;
        },
      );
      return operation;
    },
  };
}

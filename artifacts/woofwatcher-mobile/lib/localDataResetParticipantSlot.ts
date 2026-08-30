import type { LocalDataResetParticipant } from "./localDataResetCoordinator.ts";

export interface RequiredParticipantSlot {
  participant: LocalDataResetParticipant;
  attach(delegate: Omit<LocalDataResetParticipant, "id">): () => void;
}

export function createRequiredParticipantSlot(
  requiredId: string,
  commitPhase: LocalDataResetParticipant["commitPhase"] = "data",
  invokeCommit?: (
    delegate: Omit<LocalDataResetParticipant, "id">,
    commit: Omit<LocalDataResetParticipant, "id">["commit"],
  ) => Promise<void>,
): RequiredParticipantSlot {
  type Delegate = Omit<LocalDataResetParticipant, "id">;
  interface DelegateSnapshot {
    delegate: Delegate;
    prepare: Delegate["prepare"];
    commit: Delegate["commit"];
  }
  interface Attachment {
    delegate: Delegate;
  }

  let attachment: Attachment | null = null;
  let preparedDelegate: DelegateSnapshot | null = null;
  let preparationAttempt = 0;

  const participant = Object.freeze<LocalDataResetParticipant>({
    id: requiredId,
    commitPhase,
    prepare() {
      const attempt = ++preparationAttempt;
      preparedDelegate = null;
      const delegate = attachment?.delegate ?? null;
      if (!delegate) {
        return Promise.reject(
          new Error(`Required local data participant '${requiredId}' is not attached.`),
        );
      }
      const snapshot: DelegateSnapshot = {
        delegate,
        prepare: delegate.prepare,
        commit: delegate.commit,
      };

      let preparation: Promise<void>;
      try {
        preparation = snapshot.prepare.call(snapshot.delegate);
      } catch (error) {
        return Promise.reject(error);
      }

      return Promise.resolve(preparation).then(() => {
        if (preparationAttempt === attempt) preparedDelegate = snapshot;
      });
    },
    commit() {
      const delegate = preparedDelegate;
      preparedDelegate = null;
      if (!delegate) {
        return Promise.reject(
          new Error(`Required local data participant '${requiredId}' is not prepared.`),
        );
      }

      try {
        return invokeCommit
          ? Promise.resolve(invokeCommit(delegate.delegate, delegate.commit))
          : Promise.resolve(delegate.commit.call(delegate.delegate));
      } catch (error) {
        return Promise.reject(error);
      }
    },
  });

  return {
    participant,
    attach(delegate) {
      const registration: Attachment = { delegate };
      attachment = registration;
      return () => {
        if (attachment === registration) attachment = null;
      };
    },
  };
}

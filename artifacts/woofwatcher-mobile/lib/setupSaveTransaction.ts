export interface SetupSavePlan<TSuccess> {
  saveCare: () => boolean | Promise<boolean>;
  saveAvatar?: () => void | boolean | Promise<void | boolean>;
  isCurrent?: () => boolean;
  success: TSuccess;
}

export interface SetupSaveFenceState {
  careScopeRevision: number;
  activePetId: string;
  careSourceFingerprint: string;
  careDocumentFingerprint: string;
}

export function isSetupSaveFenceCurrent({
  acceptedCareDocumentFingerprint,
  captured,
  current,
}: {
  acceptedCareDocumentFingerprint: string | null;
  captured: SetupSaveFenceState;
  current: SetupSaveFenceState;
}): boolean {
  if (
    captured.careScopeRevision !== current.careScopeRevision ||
    captured.activePetId !== current.activePetId
  ) {
    return false;
  }

  return acceptedCareDocumentFingerprint === null
    ? captured.careSourceFingerprint === current.careSourceFingerprint
    : acceptedCareDocumentFingerprint === current.careDocumentFingerprint;
}

export type SetupSaveOutcome<TSuccess> =
  | { status: "saved"; success: TSuccess }
  | { status: "care-rejected" }
  | { status: "avatar-failed"; success: TSuccess; error: unknown }
  | { status: "avatar-stale"; success: TSuccess }
  | { status: "nothing-to-retry" }
  | { status: "stale" };

export interface SetupSaveCoordinator<TSuccess> {
  save: (plan: SetupSavePlan<TSuccess>) => Promise<SetupSaveOutcome<TSuccess>>;
  retryAvatar: () => Promise<SetupSaveOutcome<TSuccess>>;
  hasPendingAvatarRetry: () => boolean;
  invalidate: () => void;
}

interface PendingAvatarRetry<TSuccess> {
  saveAvatar: () => void | boolean | Promise<void | boolean>;
  isCurrent: () => boolean;
  success: TSuccess;
}

/**
 * Coordinates Setup's accepted care update with its optional durable Avatar
 * write. The pending Avatar closure retains the exact save-time snapshot so a
 * retry never replays the already-accepted care update or adopts later edits.
 */
export function createSetupSaveCoordinator<
  TSuccess,
>(): SetupSaveCoordinator<TSuccess> {
  let active: Promise<SetupSaveOutcome<TSuccess>> | null = null;
  let pendingAvatarRetry: PendingAvatarRetry<TSuccess> | null = null;
  let generation = 0;

  const singleFlight = (
    operation: () => Promise<SetupSaveOutcome<TSuccess>>,
  ): Promise<SetupSaveOutcome<TSuccess>> => {
    if (active) return active;
    const next = Promise.resolve().then(operation);
    active = next;
    void next.then(
      () => {
        if (active === next) active = null;
      },
      () => {
        if (active === next) active = null;
      },
    );
    return next;
  };

  return {
    save(plan) {
      const operationGeneration = generation;
      const isCurrent = () =>
        operationGeneration === generation && (plan.isCurrent?.() ?? true);
      return singleFlight(async () => {
        if (!isCurrent()) return { status: "stale" };
        let careAccepted = false;
        try {
          careAccepted = await plan.saveCare();
        } catch {
          if (!isCurrent()) return { status: "stale" };
          return { status: "care-rejected" };
        }
        if (!isCurrent()) return { status: "stale" };
        if (!careAccepted) return { status: "care-rejected" };

        if (!plan.saveAvatar) {
          pendingAvatarRetry = null;
          return { status: "saved", success: plan.success };
        }

        try {
          const avatarAccepted = await plan.saveAvatar();
          if (!isCurrent()) return { status: "stale" };
          if (avatarAccepted === false) {
            pendingAvatarRetry = null;
            return { status: "avatar-stale", success: plan.success };
          }
          pendingAvatarRetry = null;
          return { status: "saved", success: plan.success };
        } catch (error) {
          if (!isCurrent()) return { status: "stale" };
          pendingAvatarRetry = {
            saveAvatar: plan.saveAvatar,
            isCurrent,
            success: plan.success,
          };
          return { status: "avatar-failed", success: plan.success, error };
        }
      });
    },

    retryAvatar() {
      const operationGeneration = generation;
      return singleFlight(async () => {
        if (operationGeneration !== generation) return { status: "stale" };
        const retry = pendingAvatarRetry;
        if (!retry) return { status: "nothing-to-retry" };
        if (!retry.isCurrent()) {
          pendingAvatarRetry = null;
          return { status: "stale" };
        }
        try {
          const avatarAccepted = await retry.saveAvatar();
          if (operationGeneration !== generation || !retry.isCurrent()) {
            pendingAvatarRetry = null;
            return { status: "stale" };
          }
          if (avatarAccepted === false) {
            if (pendingAvatarRetry === retry) pendingAvatarRetry = null;
            return { status: "avatar-stale", success: retry.success };
          }
          if (pendingAvatarRetry === retry) pendingAvatarRetry = null;
          return { status: "saved", success: retry.success };
        } catch (error) {
          if (operationGeneration !== generation || !retry.isCurrent()) {
            pendingAvatarRetry = null;
            return { status: "stale" };
          }
          return { status: "avatar-failed", success: retry.success, error };
        }
      });
    },

    hasPendingAvatarRetry() {
      return pendingAvatarRetry !== null;
    },

    invalidate() {
      generation += 1;
      pendingAvatarRetry = null;
      // The platform write may already be in flight and cannot be cancelled,
      // but detaching it lets the replacement scope start independently. Its
      // eventual result is fenced by generation and cannot publish success.
      active = null;
    },
  };
}

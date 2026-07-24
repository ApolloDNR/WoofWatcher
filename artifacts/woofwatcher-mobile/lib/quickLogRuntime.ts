export interface QuickLogIdentity {
  id: string;
  type?: string;
  occurredAt?: string;
  caregiver?: string;
}

export interface QuickLogIdentityEntry {
  id: string;
  type?: string;
  occurredAt?: string;
  caregiver?: string;
  details?: Record<string, unknown>;
}

/**
 * Resolves an optimistic quick-log identity after CareContext replaces its
 * temp id with the server id. The server preserves the temp id as clientKey,
 * so routes and feedback remain stable across the asynchronous swap.
 */
export function resolveQuickLogEntry<T extends QuickLogIdentityEntry>(
  entries: readonly T[],
  identity: QuickLogIdentity,
): T | null {
  const exact = entries.find((entry) => entry.id === identity.id);
  if (exact) return exact;

  const rebound = entries.find(
    (entry) => entry.details?.clientKey === identity.id,
  );
  if (rebound) return rebound;

  if (!identity.type || !identity.occurredAt || !identity.caregiver) return null;
  return (
    entries.find(
      (entry) =>
        entry.type === identity.type &&
        entry.occurredAt === identity.occurredAt &&
        entry.caregiver === identity.caregiver,
    ) ?? null
  );
}

export type QuickLogPersistence =
  | "uncertain"
  | "local-only"
  | "action";

export interface QuickLogFailure {
  message: string;
  persistence: QuickLogPersistence;
}

export interface QuickLogFailureInput {
  storageWarning?: "save-failed" | "read-failed" | "reset" | null;
  refreshError?: string | null;
  syncRefreshError?: string | null;
  feedbackEntry?: {
    syncStatus?: string;
    syncError?: string;
  } | null;
  transientFailure?: string | null;
}

/**
 * Context-owned persistence failures outrank ephemeral controller messages.
 * They stay visible until CareContext clears the underlying condition.
 */
export function deriveQuickLogFailure(
  input: QuickLogFailureInput,
): QuickLogFailure | null {
  if (input.storageWarning === "save-failed") {
    return {
      message:
        "This care log may not be saved on this device. Review device storage and try again.",
      persistence: "uncertain",
    };
  }
  if (input.storageWarning === "read-failed") {
    return {
      message:
        "Saved care data could not be read, so Quick Log is paused for this session.",
      persistence: "uncertain",
    };
  }
  if (input.storageWarning === "reset") {
    return {
      message:
        "Saved care data was reset on this device. Review Log History before adding more care.",
      persistence: "uncertain",
    };
  }
  if (input.feedbackEntry?.syncStatus === "failed") {
    return {
      message:
        input.feedbackEntry.syncError ||
        "This care log is saved on this device but has not synced.",
      persistence: "local-only",
    };
  }
  if (input.refreshError) {
    return {
      message: input.refreshError,
      persistence: "local-only",
    };
  }
  if (input.syncRefreshError) {
    return {
      message: input.syncRefreshError,
      persistence: "local-only",
    };
  }
  if (input.transientFailure) {
    return {
      message: input.transientFailure,
      persistence: "action",
    };
  }
  return null;
}

export function quickLogFeedbackPersistenceCopy(
  failure: QuickLogFailure | null,
): string {
  if (failure?.persistence === "uncertain") {
    return "Save status is uncertain. Review the warning below.";
  }
  if (failure?.persistence === "local-only") {
    return "Saved on this device. Cloud sync needs attention.";
  }
  if (failure?.persistence === "action") {
    return "Review the warning below before continuing.";
  }
  return "Saved locally. Add details or undo this care event.";
}

export interface QuickLogFailureAnnouncementGuard {
  next: (message: string | null) => string | null;
}

/**
 * Announces a visible failure once, while allowing the same failure to be
 * announced again after it clears and later recurs.
 */
export function createQuickLogFailureAnnouncementGuard():
  QuickLogFailureAnnouncementGuard {
  let lastMessage: string | null = null;
  return {
    next(message) {
      if (!message) {
        lastMessage = null;
        return null;
      }
      if (message === lastMessage) return null;
      lastMessage = message;
      return message;
    },
  };
}

export interface QuickLogUndoToken {
  feedbackId: string;
  sequence: number;
}

export interface QuickLogUndoGuard {
  readonly busy: boolean;
  begin: (feedbackId: string) => QuickLogUndoToken | null;
  isCurrent: (
    token: QuickLogUndoToken,
    currentFeedbackId: string | null,
  ) => boolean;
  finish: (token: QuickLogUndoToken) => boolean;
}

export function createQuickLogUndoGuard(): QuickLogUndoGuard {
  let active: QuickLogUndoToken | null = null;
  let sequence = 0;
  return {
    get busy() {
      return active !== null;
    },
    begin(feedbackId) {
      if (active) return null;
      active = { feedbackId, sequence: ++sequence };
      return active;
    },
    isCurrent(token, currentFeedbackId) {
      return active === token && currentFeedbackId === token.feedbackId;
    },
    finish(token) {
      if (active !== token) return false;
      active = null;
      return true;
    },
  };
}

export interface RunQuickLogUndoOptions {
  guard: QuickLogUndoGuard;
  feedbackId: string;
  entryId: string;
  getCurrentFeedbackId: () => string | null;
  deleteEntry: (id: string) => Promise<boolean>;
  onBusyChange: (busy: boolean) => void;
  onRemoved: () => void;
  onFailure: (message: string) => void;
  failureMessage: string;
}

/**
 * Runs Undo under a synchronous token guard. A delayed result can only mutate
 * feedback when the same feedback item is still current.
 */
export async function runQuickLogUndo(
  options: RunQuickLogUndoOptions,
): Promise<boolean> {
  const token = options.guard.begin(options.feedbackId);
  if (!token) return false;
  options.onBusyChange(true);
  try {
    const removed = await options.deleteEntry(options.entryId);
    if (!options.guard.isCurrent(token, options.getCurrentFeedbackId())) {
      return false;
    }
    if (!removed) {
      options.onFailure(options.failureMessage);
      return false;
    }
    options.onRemoved();
    return true;
  } catch {
    if (options.guard.isCurrent(token, options.getCurrentFeedbackId())) {
      options.onFailure(options.failureMessage);
    }
    return false;
  } finally {
    if (options.guard.finish(token)) options.onBusyChange(false);
  }
}

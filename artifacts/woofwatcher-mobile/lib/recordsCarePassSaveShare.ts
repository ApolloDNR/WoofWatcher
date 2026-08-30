import type { ShareTextOutcome } from "./shareText.ts";

export type DurableCarePassSaveShareResult =
  | {
      status: "shared";
      outcome: Exclude<ShareTextOutcome, "dismissed" | "failed">;
    }
  | {
      status: "saved-not-shared";
      outcome: Extract<ShareTextOutcome, "dismissed" | "failed">;
    }
  | {
      status: "save-failed";
      reason: "mutation-rejected" | "persistence-failed";
      rollback: "not-needed" | "durable-complete" | "partial-failure";
      rollbackReason?: "mutation-rejected" | "persistence-unconfirmed";
    };

export interface DurableCarePassSaveShareActions {
  save(): boolean;
  persist(): Promise<boolean>;
  rollback(): boolean;
  persistRollback(): Promise<boolean>;
  share(): Promise<ShareTextOutcome>;
}

/**
 * A Care Pass is shareable only after its Report Preset is confirmed in the
 * durable local Care snapshot. If that confirmation fails, both the live
 * rollback and its replacement snapshot must confirm before removal is
 * reported as complete.
 */
export async function runDurableCarePassSaveShare(
  actions: DurableCarePassSaveShareActions,
): Promise<DurableCarePassSaveShareResult> {
  let saved = false;
  try {
    saved = actions.save();
  } catch {
    saved = false;
  }
  if (!saved) {
    return {
      status: "save-failed",
      reason: "mutation-rejected",
      rollback: "not-needed",
    };
  }

  let persisted = false;
  try {
    persisted = await actions.persist();
  } catch {
    persisted = false;
  }
  if (!persisted) {
    let rollbackAccepted = false;
    try {
      rollbackAccepted = actions.rollback();
    } catch {
      rollbackAccepted = false;
    }
    if (!rollbackAccepted) {
      return {
        status: "save-failed",
        reason: "persistence-failed",
        rollback: "partial-failure",
        rollbackReason: "mutation-rejected",
      };
    }
    let rollbackPersisted = false;
    try {
      rollbackPersisted = await actions.persistRollback();
    } catch {
      rollbackPersisted = false;
    }
    return {
      status: "save-failed",
      reason: "persistence-failed",
      rollback: rollbackPersisted ? "durable-complete" : "partial-failure",
      ...(rollbackPersisted
        ? {}
        : { rollbackReason: "persistence-unconfirmed" as const }),
    };
  }

  let outcome: ShareTextOutcome = "failed";
  try {
    outcome = await actions.share();
  } catch {
    outcome = "failed";
  }
  if (outcome === "dismissed" || outcome === "failed") {
    return { status: "saved-not-shared", outcome };
  }
  return { status: "shared", outcome };
}

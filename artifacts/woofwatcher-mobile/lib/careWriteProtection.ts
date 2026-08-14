export type CareStorageWarning =
  | "save-failed"
  | "read-failed"
  | "reset"
  | "newer-version"
  | null;

export const CARE_READ_ONLY_MESSAGE =
  "This care data was created by a newer WoofWatcher version. Update WoofWatcher to safely make changes; this version will not overwrite it.";

export interface CareWriteProtection {
  capture(): number;
  isBlocked(): boolean;
  canContinue(generation: number): boolean;
  invalidate(): number;
  protect(): number;
  reset(): number;
}

export function createCareWriteProtection(): CareWriteProtection {
  let generation = 0;
  let blocked = false;
  return {
    capture: () => generation,
    isBlocked: () => blocked,
    canContinue: (capturedGeneration) =>
      !blocked && capturedGeneration === generation,
    invalidate: () => {
      generation += 1;
      return generation;
    },
    protect: () => {
      generation += 1;
      blocked = true;
      return generation;
    },
    reset: () => {
      generation += 1;
      blocked = false;
      return generation;
    },
  };
}

export function prioritizeCareStorageWarning(
  current: CareStorageWarning,
  requested: CareStorageWarning,
  writesBlocked: boolean,
): CareStorageWarning {
  if (writesBlocked || current === "newer-version") return "newer-version";
  return requested;
}

export function careMutationWasAccepted(value: string | boolean): boolean {
  return value === true || (typeof value === "string" && value.length > 0);
}

export function runAcceptedCareMutation<T extends string | boolean>(
  result: T,
  onAccepted: (result: T) => void,
): boolean {
  if (!careMutationWasAccepted(result)) return false;
  onAccepted(result);
  return true;
}

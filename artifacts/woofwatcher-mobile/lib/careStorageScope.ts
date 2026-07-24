export type CareStorageScope =
  | { kind: "local" }
  | { kind: "account"; userId: string; householdId: string };

export function getCareStorageKey(scope: CareStorageScope): string {
  if (scope.kind === "local") return "woofwatcher.v3.local";
  return `woofwatcher.v3.account.${encodeURIComponent(scope.userId)}.${encodeURIComponent(scope.householdId)}`;
}

export function getCareRecoveryKey(scope: CareStorageScope): string {
  return `${getCareStorageKey(scope)}.recovery`;
}

export function getCarePendingDeleteStorageKey(
  scope: CareStorageScope,
): string {
  return `${getCareStorageKey(scope)}.pending-care-entry-deletes`;
}

export function shouldAdoptUnscopedV2Cache(input: {
  clerkConfigured: boolean;
  scope: CareStorageScope;
}): boolean {
  return !input.clerkConfigured && input.scope.kind === "local";
}

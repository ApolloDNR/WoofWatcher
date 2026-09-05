export interface MoreEditorScope {
  careScopeRevision: number;
  activePetId: string;
  providerHouseholdId: string | null;
  careReady: boolean;
  sourceFingerprint: string;
}

function canonicalizeMoreEditorSource(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeMoreEditorSource(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalizeMoreEditorSource(item)]),
    );
  }
  return value;
}

export function createMoreEditorSourceFingerprint(value: unknown): string {
  return JSON.stringify(canonicalizeMoreEditorSource(value)) ?? "undefined";
}

export function isSameMoreEditorScope(
  captured: MoreEditorScope,
  current: MoreEditorScope,
): boolean {
  return (
    captured.careReady &&
    current.careReady &&
    captured.careScopeRevision === current.careScopeRevision &&
    captured.activePetId === current.activePetId &&
    captured.providerHouseholdId === current.providerHouseholdId &&
    captured.sourceFingerprint === current.sourceFingerprint
  );
}

export function isHouseholdScopeConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 409
  );
}

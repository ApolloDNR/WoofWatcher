export type SetupHydrationStatus = "loading" | "ready" | "failed";

export interface SetupDraftReadiness {
  boundCareScopeRevision: number | null;
  boundActivePetId: string | null;
  boundCareSourceFingerprint: string | null;
  dirty: boolean;
}

export type SetupDraftReadinessEvent =
  | { type: "care-unavailable" }
  | {
      type: "draft-bound";
      careScopeRevision: number;
      activePetId: string;
      careSourceFingerprint: string;
    }
  | {
      type: "draft-rebased";
      careSourceFingerprint: string;
      dirty: boolean;
    }
  | { type: "edited" };

export const INITIAL_SETUP_DRAFT_READINESS: SetupDraftReadiness = {
  boundCareScopeRevision: null,
  boundActivePetId: null,
  boundCareSourceFingerprint: null,
  dirty: false,
};

export function normalizeSetupActivePetId(activePetId: string): string {
  return activePetId.trim() || "primary";
}

export function reduceSetupDraftReadiness(
  current: SetupDraftReadiness,
  event: SetupDraftReadinessEvent,
): SetupDraftReadiness {
  if (event.type === "care-unavailable") {
    return INITIAL_SETUP_DRAFT_READINESS;
  }

  if (event.type === "draft-bound") {
    return {
      boundCareScopeRevision: event.careScopeRevision,
      boundActivePetId: normalizeSetupActivePetId(event.activePetId),
      boundCareSourceFingerprint: event.careSourceFingerprint,
      dirty: false,
    };
  }

  if (event.type === "draft-rebased") {
    if (current.boundCareScopeRevision === null) return current;
    return {
      ...current,
      boundCareSourceFingerprint: event.careSourceFingerprint,
      dirty: event.dirty,
    };
  }

  if (current.boundCareScopeRevision === null) return current;
  if (current.dirty) return current;
  return { ...current, dirty: true };
}

export function isSetupInteractive({
  avatarHydrationStatus,
  careHydrationStatus,
  careScopeRevision,
  activePetId,
  careSourceFingerprint,
  draftReadiness,
}: {
  avatarHydrationStatus: SetupHydrationStatus;
  careHydrationStatus: SetupHydrationStatus;
  careScopeRevision: number;
  activePetId: string;
  careSourceFingerprint: string;
  draftReadiness: SetupDraftReadiness;
}): boolean {
  return (
    avatarHydrationStatus === "ready" &&
    careHydrationStatus === "ready" &&
    draftReadiness.boundCareScopeRevision === careScopeRevision &&
    draftReadiness.boundActivePetId ===
      normalizeSetupActivePetId(activePetId) &&
    draftReadiness.boundCareSourceFingerprint === careSourceFingerprint
  );
}

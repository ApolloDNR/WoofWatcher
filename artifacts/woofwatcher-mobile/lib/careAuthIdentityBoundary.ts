export interface CareAuthIdentityInput {
  clerkLoaded: boolean;
  isSignedIn: boolean;
  userId?: string | null;
  sessionId?: string | null;
  householdId?: string | null;
}

export type CareAuthIdentityPhase =
  | "auth-pending"
  | "household-pending"
  | "signed-out"
  | "signed-in";

export interface CareAuthIdentitySnapshot {
  readonly phase: CareAuthIdentityPhase;
  readonly generation: number;
  readonly dataScope: string | null;
  readonly userId: string | null;
  readonly sessionId: string | null;
  readonly householdId: string | null;
  readonly identityKey: string | null;
}

export interface CareAuthIdentityPermit {
  readonly generation: number;
  readonly dataScope: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly householdId: string;
  readonly identityKey: string;
}

export interface CareMutationOriginPermit {
  readonly generation: number;
  readonly dataScope: string;
  readonly phase: "signed-out" | "signed-in";
  readonly identityKey: string;
}

export interface CareAuthIdentityBoundary {
  observe(input: CareAuthIdentityInput): CareAuthIdentitySnapshot;
  snapshot(): CareAuthIdentitySnapshot;
  captureSignedIn(): CareAuthIdentityPermit | null;
  captureMutationOrigin(): CareMutationOriginPermit | null;
  canContinue(permit: CareAuthIdentityPermit): boolean;
  canInvoke(permit: CareMutationOriginPermit): boolean;
  canDisplay(loadedDataScope: string | null): boolean;
}

function normalize(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.trim() === value ? value : null;
}

function encodeIdentityTuple(parts: readonly string[]): string {
  return JSON.stringify(parts);
}

function deriveSnapshot(
  input: CareAuthIdentityInput,
  generation: number,
): CareAuthIdentitySnapshot {
  if (!input.clerkLoaded) {
    return Object.freeze({
      phase: "auth-pending",
      generation,
      dataScope: null,
      userId: null,
      sessionId: null,
      householdId: null,
      identityKey: null,
    });
  }
  if (!input.isSignedIn) {
    return Object.freeze({
      phase: "signed-out",
      generation,
      dataScope: "local",
      userId: null,
      sessionId: null,
      householdId: null,
      identityKey: "signed-out",
    });
  }
  const userId = normalize(input.userId);
  const sessionId = normalize(input.sessionId);
  // A nominally signed-in auth render without both stable Clerk identifiers is
  // still an auth-pending boundary. It must never inherit another user's data
  // scope or authorize a provider request with an ambiguous identity.
  if (!userId || !sessionId) {
    return Object.freeze({
      phase: "auth-pending",
      generation,
      dataScope: null,
      userId,
      sessionId,
      householdId: null,
      identityKey: null,
    });
  }
  const householdId = normalize(input.householdId);
  if (!householdId) {
    return Object.freeze({
      phase: "household-pending",
      generation,
      dataScope: null,
      userId,
      sessionId,
      householdId: null,
      identityKey: null,
    });
  }
  return Object.freeze({
    phase: "signed-in",
    generation,
    dataScope: `care-v2:${encodeIdentityTuple([userId, householdId])}`,
    userId,
    sessionId,
    householdId,
    identityKey: encodeIdentityTuple([userId, sessionId, householdId]),
  });
}

function transitionKey(snapshot: CareAuthIdentitySnapshot): string {
  return JSON.stringify([
    snapshot.phase,
    snapshot.dataScope,
    snapshot.userId,
    snapshot.sessionId,
    snapshot.householdId,
  ]);
}

/**
 * Synchronous auth authority for Care state and provider mutations.
 *
 * `observe` is intentionally safe to call during render: it mutates only this
 * private controller, never React state. That lets a direct A -> B auth render
 * revoke A's permits and make A's loaded scope undisplayable before effects
 * get a chance to drain or hydrate anything.
 */
export function createCareAuthIdentityBoundary(): CareAuthIdentityBoundary {
  let generation = 0;
  let current = deriveSnapshot(
    { clerkLoaded: false, isSignedIn: false },
    generation,
  );
  let currentKey = transitionKey(current);
  let currentMutationOrigin: CareMutationOriginPermit | null = null;

  return {
    observe(input) {
      const candidate = deriveSnapshot(input, generation);
      const candidateKey = transitionKey(candidate);
      if (candidateKey !== currentKey) {
        generation += 1;
        current = deriveSnapshot(input, generation);
        currentKey = transitionKey(current);
        currentMutationOrigin = null;
      }
      return current;
    },
    snapshot: () => current,
    captureSignedIn() {
      if (
        current.phase !== "signed-in" ||
        !current.dataScope ||
        !current.userId ||
        !current.sessionId ||
        !current.householdId ||
        !current.identityKey
      ) {
        return null;
      }
      return Object.freeze({
        generation: current.generation,
        dataScope: current.dataScope,
        userId: current.userId,
        sessionId: current.sessionId,
        householdId: current.householdId,
        identityKey: current.identityKey,
      });
    },
    captureMutationOrigin() {
      if (
        (current.phase !== "signed-in" && current.phase !== "signed-out") ||
        !current.dataScope ||
        !current.identityKey
      ) {
        return null;
      }
      if (currentMutationOrigin) return currentMutationOrigin;
      currentMutationOrigin = Object.freeze({
        generation: current.generation,
        dataScope: current.dataScope,
        phase: current.phase,
        identityKey: current.identityKey,
      });
      return currentMutationOrigin;
    },
    canContinue(permit) {
      return (
        current.phase === "signed-in" &&
        current.generation === permit.generation &&
        current.dataScope === permit.dataScope &&
        current.userId === permit.userId &&
        current.sessionId === permit.sessionId &&
        current.householdId === permit.householdId &&
        current.identityKey === permit.identityKey
      );
    },
    canInvoke(permit) {
      return (
        current.generation === permit.generation &&
        current.dataScope === permit.dataScope &&
        current.phase === permit.phase &&
        current.identityKey === permit.identityKey
      );
    },
    canDisplay(loadedDataScope) {
      return (
        loadedDataScope !== null &&
        current.dataScope !== null &&
        loadedDataScope === current.dataScope
      );
    },
  };
}

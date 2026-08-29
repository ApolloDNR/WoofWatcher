declare const CARE_HOUSEHOLD_TRANSITION_TOKEN: unique symbol;

/** Exact signed-in authority captured before a household transition starts. */
export interface CareHouseholdTransitionPermit {
  readonly generation: number;
  readonly dataScope: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly householdId: string;
  readonly identityKey: string;
}

/**
 * Opaque and one-shot. Runtime authority is object identity, not these fields,
 * so a structural copy cannot resume a suspended resolver.
 */
export interface CareHouseholdTransitionToken {
  readonly [CARE_HOUSEHOLD_TRANSITION_TOKEN]: true;
}

export interface CareHouseholdTransitionController {
  begin(
    permit: CareHouseholdTransitionPermit,
  ): CareHouseholdTransitionToken | null;
  resume(token: CareHouseholdTransitionToken): boolean;
  canResolveHousehold(): boolean;
  getPermit(
    token: CareHouseholdTransitionToken,
  ): CareHouseholdTransitionPermit | null;
}

function exactOpaqueIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value
  );
}

function freezePermit(
  permit: CareHouseholdTransitionPermit,
): CareHouseholdTransitionPermit | null {
  if (
    !Number.isSafeInteger(permit.generation) ||
    permit.generation < 0 ||
    !exactOpaqueIdentifier(permit.dataScope) ||
    !exactOpaqueIdentifier(permit.userId) ||
    !exactOpaqueIdentifier(permit.sessionId) ||
    !exactOpaqueIdentifier(permit.householdId) ||
    !exactOpaqueIdentifier(permit.identityKey)
  ) {
    return null;
  }
  return Object.freeze({ ...permit });
}

/** Pure synchronous suspension authority used by the mounted Care provider. */
export function createCareHouseholdTransitionController(): CareHouseholdTransitionController {
  let activeToken: CareHouseholdTransitionToken | null = null;
  let activePermit: CareHouseholdTransitionPermit | null = null;

  return Object.freeze({
    begin(
      permit: CareHouseholdTransitionPermit,
    ): CareHouseholdTransitionToken | null {
      if (activeToken) return null;
      const captured = freezePermit(permit);
      if (!captured) return null;
      const token = Object.freeze(
        {},
      ) as CareHouseholdTransitionToken;
      activePermit = captured;
      activeToken = token;
      return token;
    },
    resume(token: CareHouseholdTransitionToken): boolean {
      if (token !== activeToken) return false;
      activeToken = null;
      activePermit = null;
      return true;
    },
    canResolveHousehold() {
      return activeToken === null;
    },
    getPermit(
      token: CareHouseholdTransitionToken,
    ): CareHouseholdTransitionPermit | null {
      return token === activeToken ? activePermit : null;
    },
  });
}

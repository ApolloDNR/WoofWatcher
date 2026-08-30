export interface CareHouseholdIdentityResolutionAuthInput {
  clerkLoaded: boolean;
  isSignedIn: boolean;
  userId?: string | null;
  sessionId?: string | null;
}

export type CareHouseholdIdentityResolutionState =
  | "pending"
  | "resolved"
  | "local"
  | "error";

export interface CareHouseholdIdentityResolutionSnapshot {
  readonly state: CareHouseholdIdentityResolutionState;
  readonly pendingFor: "auth" | "household" | null;
  readonly generation: number;
  readonly userId: string | null;
  readonly sessionId: string | null;
  readonly identityKey: string | null;
  readonly householdId: string | null;
  readonly retryable: boolean;
  readonly message: string | null;
}

export interface CareHouseholdIdentityResolutionAttempt {
  readonly generation: number;
  readonly attemptId: number;
  readonly userId: string;
  readonly sessionId: string;
  readonly identityKey: string;
  /** Monotonic instant immediately before this `/api/me` attempt began. */
  readonly monotonicStartedAtMs: number;
}

export interface CareHouseholdIdentityResolutionRetry {
  readonly generation: number;
  readonly retryId: number;
  readonly userId: string;
  readonly sessionId: string;
  readonly identityKey: string;
}

/** The exact subset of the generated `/api/me` result needed for authority. */
export interface CareHouseholdIdentityMeResult {
  readonly authorityObservedAt?: string | null;
  readonly user?: { readonly id?: string | null } | null;
  readonly household?: { readonly id?: string | null } | null;
  readonly members?:
    | readonly {
        readonly userId?: string | null;
        readonly isSelf?: boolean | null;
        readonly role?: string | null;
        readonly accessPassExpiresAt?: string | null;
        readonly accessPassExpired?: boolean | null;
      }[]
    | null;
}

export interface CareHouseholdIdentityResolutionSettlement {
  readonly accepted: boolean;
  readonly householdId: string | null;
  readonly retryDelayMs: number | null;
  readonly retry: CareHouseholdIdentityResolutionRetry | null;
}

export interface CareHouseholdIdentityResolution {
  /**
   * Observes the raw Clerk render synchronously. Any exact user/session change
   * revokes the previous household, active request, scheduled retry, and error.
   */
  observeAuth(
    input: CareHouseholdIdentityResolutionAuthInput,
  ): CareHouseholdIdentityResolutionSnapshot;
  snapshot(): CareHouseholdIdentityResolutionSnapshot;
  /** Captures the first request in an auth/manual-retry cycle. */
  captureAttempt(): CareHouseholdIdentityResolutionAttempt | null;
  /** Consumes the exact retry ticket returned by `settleFailure`. */
  captureRetry(
    retry: CareHouseholdIdentityResolutionRetry,
  ): CareHouseholdIdentityResolutionAttempt | null;
  canContinue(attempt: CareHouseholdIdentityResolutionAttempt): boolean;
  /**
   * Accepts only a fresh result for the exact Clerk user, with an exact self
   * membership and non-ambiguous household id. Invalid results fail through
   * the same bounded retry policy as transport failures.
   */
  settleFreshMe(
    attempt: CareHouseholdIdentityResolutionAttempt,
    me: CareHouseholdIdentityMeResult | null | undefined,
  ): CareHouseholdIdentityResolutionSettlement;
  settleFailure(
    attempt: CareHouseholdIdentityResolutionAttempt,
    reason?: unknown,
  ): CareHouseholdIdentityResolutionSettlement;
  /** Monotonic deadline for the active temporary Access Pass, otherwise null. */
  activeAccessLeaseDeadlineMonotonicMs(): number | null;
  /** Complete temporary lease, including the last trusted monotonic instant. */
  activeAccessLease(): CareHouseholdMonotonicAccessLease | null;
  /** True only while the resolved authority came from a temporary helper pass. */
  hasActiveTemporaryAccess(): boolean;
  /**
   * Revokes the current same-auth household authority after a provider
   * capability rejection (for example 412/428) and starts fresh resolution.
   */
  restartResolution(): boolean;
  /** Revokes current authority into an actionable terminal shield. */
  rejectAuthority(): boolean;
  /** Reopens an actionable terminal error and restores the full retry budget. */
  requestRetry(): boolean;
}

const AUTO_RETRY_DELAYS_MS = [400, 1200] as const;
const RESOLUTION_ERROR_MESSAGE =
  "WoofWatcher could not confirm the active household for this sign-in. Check your connection and try again.";
const AUTHORITY_REJECTED_MESSAGE =
  "WoofWatcher could not confirm active household access. Retry after reviewing this account's household access.";

const PERMANENT_HOUSEHOLD_ROLES = new Set([
  "owner",
  "adult",
  "teen",
  "kid",
]);
const TEMPORARY_HOUSEHOLD_ROLES = new Set([
  "sitter",
  "trainer",
  "walker",
  "vet viewer",
]);
const MAX_TIMER_DELAY_MS = 2_147_483_647;

export interface CareHouseholdMonotonicAccessLease {
  readonly observedAtMonotonicMs: number;
  readonly deadlineMonotonicMs: number;
}

export interface CareHouseholdExpiryRevocation {
  arm(
    lease: CareHouseholdMonotonicAccessLease | null,
    onExpire: () => void,
  ): void;
  cancel(): void;
}

function defaultMonotonicNow(): number {
  const performanceClock = globalThis.performance;
  return typeof performanceClock?.now === "function"
    ? performanceClock.now()
    : Number.NaN;
}

/**
 * Schedules exact helper-access revocation without trusting a delay larger
 * than the platform timer limit. Re-arming or cancelling invalidates every
 * older callback before it can revoke a replacement identity.
 */
export function createCareHouseholdExpiryRevocation(
  options: {
    readonly monotonicNow?: () => number;
    readonly setTimer?: (callback: () => void, delayMs: number) => unknown;
    readonly clearTimer?: (handle: unknown) => void;
  } = {},
): CareHouseholdExpiryRevocation {
  const monotonicNow = options.monotonicNow ?? defaultMonotonicNow;
  const setTimer =
    options.setTimer ??
    ((callback: () => void, delayMs: number) =>
      globalThis.setTimeout(callback, delayMs));
  const clearTimer =
    options.clearTimer ??
    ((handle: unknown) =>
      globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>));
  let timer: unknown = null;
  let generation = 0;

  const cancel = () => {
    generation += 1;
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  return Object.freeze({
    arm(lease: CareHouseholdMonotonicAccessLease | null, onExpire: () => void) {
      cancel();
      if (lease === null) return;
      const scheduledGeneration = generation;
      let lastObservedMonotonicMs = lease.observedAtMonotonicMs;
      const tick = () => {
        if (scheduledGeneration !== generation) return;
        timer = null;
        const observedMonotonicMs = monotonicNow();
        const clockInvalid =
          !Number.isFinite(observedMonotonicMs) ||
          observedMonotonicMs < lastObservedMonotonicMs;
        lastObservedMonotonicMs = observedMonotonicMs;
        const remainingMs = lease.deadlineMonotonicMs - observedMonotonicMs;
        if (
          clockInvalid ||
          !Number.isFinite(lease.observedAtMonotonicMs) ||
          !Number.isFinite(lease.deadlineMonotonicMs) ||
          lease.deadlineMonotonicMs <= lease.observedAtMonotonicMs ||
          !Number.isFinite(remainingMs) ||
          remainingMs <= 0
        ) {
          generation += 1;
          onExpire();
          return;
        }
        timer = setTimer(tick, Math.min(remainingMs, MAX_TIMER_DELAY_MS));
      };
      tick();
    },
    cancel,
  });
}

function exactIdentifier(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  // Clerk and provider identifiers are opaque. Never trim two distinct raw
  // values into the same authority; whitespace makes the identity ambiguous.
  return value.trim() === value ? value : null;
}

function rawIdentityPart(value: string | null | undefined): string {
  return typeof value === "string" ? value : "";
}

function deriveAuthKey(
  input: CareHouseholdIdentityResolutionAuthInput,
): string {
  if (!input.clerkLoaded) return "loading";
  if (!input.isSignedIn) return "local";
  // JSON preserves boundaries even if an opaque Clerk id contains `:`.
  return `signed-in:${JSON.stringify([
    rawIdentityPart(input.userId),
    rawIdentityPart(input.sessionId),
  ])}`;
}

function publicIdentityKey(userId: string, sessionId: string): string {
  return JSON.stringify([userId, sessionId]);
}

export interface CareHouseholdSelfAdmission {
  readonly householdId: string;
  readonly activeAccessLease: CareHouseholdMonotonicAccessLease | null;
  readonly temporaryAccess: boolean;
}

export interface CareHouseholdAdmissionTiming {
  readonly requestStartedAtMonotonicMs: number;
  readonly responseReceivedAtMonotonicMs: number;
}

/**
 * Admits the exact self row that authorizes a fresh Care identity. Expired,
 * ambiguous, unknown-role, or structurally incomplete rows fail closed.
 */
export function admitCareHouseholdIdentityMe(
  me: unknown,
  expectedUserId: string,
  timing?: CareHouseholdAdmissionTiming,
): CareHouseholdSelfAdmission | null {
  if (!me || typeof me !== "object") return null;
  const responseUser = Reflect.get(me, "user");
  const responseHousehold = Reflect.get(me, "household");
  const members = Reflect.get(me, "members");
  const responseUserId = exactIdentifier(
    responseUser && typeof responseUser === "object"
      ? Reflect.get(responseUser, "id")
      : null,
  );
  const householdId = exactIdentifier(
    responseHousehold && typeof responseHousehold === "object"
      ? Reflect.get(responseHousehold, "id")
      : null,
  );
  if (
    responseUserId !== expectedUserId ||
    !householdId ||
    !Array.isArray(members)
  ) {
    return null;
  }
  const selfMembers = members.filter(
    (member) =>
      typeof member === "object" &&
      member !== null &&
      Reflect.get(member, "isSelf") === true,
  );
  if (
    selfMembers.length !== 1 ||
    Reflect.get(selfMembers[0], "userId") !== expectedUserId
  ) {
    return null;
  }

  const self = selfMembers[0];
  const role = Reflect.get(self, "role");
  const expiresAt = Reflect.get(self, "accessPassExpiresAt");
  if (
    Reflect.get(self, "accessPassExpired") !== false ||
    (typeof role !== "string" ||
      (!PERMANENT_HOUSEHOLD_ROLES.has(role) &&
        !TEMPORARY_HOUSEHOLD_ROLES.has(role)))
  ) {
    return null;
  }

  const authorityObservedAt = Reflect.get(me, "authorityObservedAt");
  if (
    typeof authorityObservedAt !== "string" ||
    authorityObservedAt.trim() !== authorityObservedAt
  ) {
    return null;
  }
  const authorityObservedAtMs = Date.parse(authorityObservedAt);
  if (
    !Number.isFinite(authorityObservedAtMs) ||
    new Date(authorityObservedAtMs).toISOString() !== authorityObservedAt
  ) {
    return null;
  }

  if (PERMANENT_HOUSEHOLD_ROLES.has(role)) {
    if (expiresAt !== null) return null;
    return Object.freeze({
      householdId,
      activeAccessLease: null,
      temporaryAccess: false,
    });
  }

  // Provider-authorized helper memberships may intentionally have no expiry.
  // Exact Me already evaluated that row with the provider clock and returned
  // `accessPassExpired: false`, so no device-time lease is needed for `null`.
  if (expiresAt === null) {
    return Object.freeze({
      householdId,
      activeAccessLease: null,
      temporaryAccess: true,
    });
  }

  if (
    typeof expiresAt !== "string" ||
    expiresAt.trim() !== expiresAt ||
    !timing ||
    !Number.isFinite(timing.requestStartedAtMonotonicMs) ||
    !Number.isFinite(timing.responseReceivedAtMonotonicMs) ||
    timing.responseReceivedAtMonotonicMs <
      timing.requestStartedAtMonotonicMs
  ) {
    return null;
  }
  const expiryMs = Date.parse(expiresAt);
  const providerLeaseMs = expiryMs - authorityObservedAtMs;
  const transitMs =
    timing.responseReceivedAtMonotonicMs -
    timing.requestStartedAtMonotonicMs;
  const remainingLeaseMs = providerLeaseMs - transitMs;
  const deadlineMonotonicMs =
    timing.responseReceivedAtMonotonicMs + remainingLeaseMs;
  if (
    !Number.isFinite(expiryMs) ||
    new Date(expiryMs).toISOString() !== expiresAt ||
    !Number.isFinite(providerLeaseMs) ||
    providerLeaseMs <= 0 ||
    !Number.isFinite(remainingLeaseMs) ||
    remainingLeaseMs <= 0 ||
    !Number.isFinite(deadlineMonotonicMs) ||
    deadlineMonotonicMs <= timing.responseReceivedAtMonotonicMs
  ) {
    return null;
  }
  return Object.freeze({
    householdId,
    activeAccessLease: Object.freeze({
      observedAtMonotonicMs: timing.responseReceivedAtMonotonicMs,
      deadlineMonotonicMs,
    }),
    temporaryAccess: true,
  });
}

function frozenSnapshot(
  snapshot: CareHouseholdIdentityResolutionSnapshot,
): CareHouseholdIdentityResolutionSnapshot {
  return Object.freeze(snapshot);
}

const REJECTED_SETTLEMENT: CareHouseholdIdentityResolutionSettlement =
  Object.freeze({
    accepted: false,
    householdId: null,
    retryDelayMs: null,
    retry: null,
  });

/**
 * Pure household-authority controller for Care's fresh `/api/me` bootstrap.
 *
 * Timers and network calls intentionally remain with the caller. A transient
 * failure returns a generation-bound retry ticket, so an old timeout cannot
 * accidentally start a request for a replacement Clerk identity.
 */
export function createCareHouseholdIdentityResolution(
  options: { readonly monotonicNow?: () => number } = {},
): CareHouseholdIdentityResolution {
  const monotonicNow = options.monotonicNow ?? defaultMonotonicNow;
  let generation = 0;
  let authKey = "loading";
  let state: CareHouseholdIdentityResolutionState = "pending";
  let pendingFor: "auth" | "household" | null = "auth";
  let userId: string | null = null;
  let sessionId: string | null = null;
  let identityKey: string | null = null;
  let householdId: string | null = null;
  let activeTemporaryLease: CareHouseholdMonotonicAccessLease | null = null;
  let activeTemporaryAccess = false;
  let retryable = false;
  let message: string | null = null;
  let failureCount = 0;
  let nextAttemptId = 0;
  let nextRetryId = 0;
  let activeAttempt: CareHouseholdIdentityResolutionAttempt | null = null;
  let pendingRetry: CareHouseholdIdentityResolutionRetry | null = null;

  const snapshot = (): CareHouseholdIdentityResolutionSnapshot =>
    frozenSnapshot({
      state,
      pendingFor,
      generation,
      userId,
      sessionId,
      identityKey,
      householdId,
      retryable,
      message,
    });

  const isCurrentAttempt = (
    attempt: CareHouseholdIdentityResolutionAttempt,
  ): boolean =>
    attempt === activeAttempt &&
    state === "pending" &&
    pendingFor === "household" &&
    generation === attempt.generation &&
    userId === attempt.userId &&
    sessionId === attempt.sessionId &&
    identityKey === attempt.identityKey;

  const captureCurrentAttempt =
    (): CareHouseholdIdentityResolutionAttempt | null => {
      if (
        state !== "pending" ||
        pendingFor !== "household" ||
        !userId ||
        !sessionId ||
        !identityKey ||
        activeAttempt ||
        pendingRetry
      ) {
        return null;
      }
      nextAttemptId += 1;
      activeAttempt = Object.freeze({
        generation,
        attemptId: nextAttemptId,
        userId,
        sessionId,
        identityKey,
        monotonicStartedAtMs: monotonicNow(),
      });
      return activeAttempt;
    };

  const settleCurrentFailure = (
    attempt: CareHouseholdIdentityResolutionAttempt,
  ): CareHouseholdIdentityResolutionSettlement => {
    if (!isCurrentAttempt(attempt)) return REJECTED_SETTLEMENT;
    activeAttempt = null;
    const retryDelayMs = AUTO_RETRY_DELAYS_MS[failureCount] ?? null;
    failureCount += 1;
    householdId = null;
    activeTemporaryLease = null;
    activeTemporaryAccess = false;
    if (retryDelayMs !== null) {
      nextRetryId += 1;
      pendingRetry = Object.freeze({
        generation,
        retryId: nextRetryId,
        userId: attempt.userId,
        sessionId: attempt.sessionId,
        identityKey: attempt.identityKey,
      });
      state = "pending";
      pendingFor = "household";
      retryable = false;
      message = null;
      return Object.freeze({
        accepted: true,
        householdId: null,
        retryDelayMs,
        retry: pendingRetry,
      });
    }
    pendingRetry = null;
    state = "error";
    pendingFor = null;
    retryable = true;
    message = RESOLUTION_ERROR_MESSAGE;
    return Object.freeze({
      accepted: true,
      householdId: null,
      retryDelayMs: null,
      retry: null,
    });
  };

  return {
    observeAuth(input) {
      const nextAuthKey = deriveAuthKey(input);
      if (nextAuthKey === authKey) return snapshot();

      authKey = nextAuthKey;
      generation += 1;
      activeAttempt = null;
      pendingRetry = null;
      householdId = null;
      activeTemporaryLease = null;
      activeTemporaryAccess = false;
      retryable = false;
      message = null;
      failureCount = 0;

      if (!input.clerkLoaded) {
        state = "pending";
        pendingFor = "auth";
        userId = null;
        sessionId = null;
        identityKey = null;
        return snapshot();
      }
      if (!input.isSignedIn) {
        state = "local";
        pendingFor = null;
        userId = null;
        sessionId = null;
        identityKey = null;
        return snapshot();
      }

      userId = exactIdentifier(input.userId);
      sessionId = exactIdentifier(input.sessionId);
      if (!userId || !sessionId) {
        state = "pending";
        pendingFor = "auth";
        userId = null;
        sessionId = null;
        identityKey = null;
        return snapshot();
      }
      identityKey = publicIdentityKey(userId, sessionId);
      state = "pending";
      pendingFor = "household";
      return snapshot();
    },
    snapshot,
    captureAttempt: captureCurrentAttempt,
    captureRetry(retry) {
      if (
        retry !== pendingRetry ||
        state !== "pending" ||
        pendingFor !== "household" ||
        generation !== retry.generation ||
        userId !== retry.userId ||
        sessionId !== retry.sessionId ||
        identityKey !== retry.identityKey ||
        activeAttempt
      ) {
        return null;
      }
      pendingRetry = null;
      return captureCurrentAttempt();
    },
    canContinue: isCurrentAttempt,
    settleFreshMe(attempt, me) {
      if (!isCurrentAttempt(attempt)) return REJECTED_SETTLEMENT;
      const admission = admitCareHouseholdIdentityMe(
        me,
        attempt.userId,
        {
          requestStartedAtMonotonicMs: attempt.monotonicStartedAtMs,
          responseReceivedAtMonotonicMs: monotonicNow(),
        },
      );
      if (!admission) {
        return settleCurrentFailure(attempt);
      }

      activeAttempt = null;
      pendingRetry = null;
      householdId = admission.householdId;
      activeTemporaryLease = admission.activeAccessLease;
      activeTemporaryAccess = admission.temporaryAccess;
      state = "resolved";
      pendingFor = null;
      retryable = false;
      message = null;
      failureCount = 0;
      return Object.freeze({
        accepted: true,
        householdId: admission.householdId,
        retryDelayMs: null,
        retry: null,
      });
    },
    settleFailure(attempt, _reason) {
      return settleCurrentFailure(attempt);
    },
    activeAccessLeaseDeadlineMonotonicMs() {
      return activeTemporaryLease?.deadlineMonotonicMs ?? null;
    },
    activeAccessLease() {
      return activeTemporaryLease;
    },
    hasActiveTemporaryAccess() {
      return activeTemporaryAccess;
    },
    restartResolution() {
      if (!userId || !sessionId || !identityKey) return false;
      generation += 1;
      activeAttempt = null;
      pendingRetry = null;
      failureCount = 0;
      householdId = null;
      activeTemporaryLease = null;
      activeTemporaryAccess = false;
      state = "pending";
      pendingFor = "household";
      retryable = false;
      message = null;
      return true;
    },
    rejectAuthority() {
      if (!userId || !sessionId || !identityKey) return false;
      generation += 1;
      activeAttempt = null;
      pendingRetry = null;
      failureCount = 0;
      householdId = null;
      activeTemporaryLease = null;
      activeTemporaryAccess = false;
      state = "error";
      pendingFor = null;
      retryable = true;
      message = AUTHORITY_REJECTED_MESSAGE;
      return true;
    },
    requestRetry() {
      if (
        state !== "error" ||
        !retryable ||
        !userId ||
        !sessionId ||
        !identityKey
      ) {
        return false;
      }
      activeAttempt = null;
      pendingRetry = null;
      failureCount = 0;
      householdId = null;
      activeTemporaryLease = null;
      activeTemporaryAccess = false;
      state = "pending";
      pendingFor = "household";
      retryable = false;
      message = null;
      return true;
    },
  };
}

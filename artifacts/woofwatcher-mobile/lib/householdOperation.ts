import { admitCareHouseholdIdentityMe } from "./careHouseholdIdentityResolution.ts";

declare const HOUSEHOLD_OPERATION_TOKEN: unique symbol;

export const HOUSEHOLD_INVITATION_LIFETIME_MS = 10 * 60 * 1000;

export type HouseholdOperationKind = "join" | "rename" | "invite" | "switch";

export interface HouseholdOperationPermit {
  readonly generation: number;
  readonly dataScope: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly householdId: string;
  readonly identityKey: string;
}

export interface HouseholdOperationNotice {
  readonly title: string;
  readonly message: string;
}

export interface HouseholdOperationSnapshot {
  readonly revision: number;
  readonly activeKind: HouseholdOperationKind | null;
  readonly notice: HouseholdOperationNotice | null;
}

export interface HouseholdOperationToken {
  readonly [HOUSEHOLD_OPERATION_TOKEN]: true;
}

export interface HouseholdOperationController {
  begin(
    kind: HouseholdOperationKind,
    permit: HouseholdOperationPermit,
  ): HouseholdOperationToken | null;
  complete(
    token: HouseholdOperationToken,
    notice: HouseholdOperationNotice | null,
  ): boolean;
  isCurrent(token: HouseholdOperationToken): boolean;
  getPermit(token: HouseholdOperationToken): HouseholdOperationPermit | null;
  getSnapshot(): HouseholdOperationSnapshot;
  consumeNotice(): HouseholdOperationNotice | null;
  subscribe(listener: () => void): () => void;
}

export type HouseholdTrackedTransportResult<T> =
  | { readonly status: "complete"; readonly value: T }
  | { readonly status: "revoked" };

type RunTrackedTransport = <T>(
  transport: () => Promise<T>,
) => Promise<HouseholdTrackedTransportResult<T>>;

export type HouseholdOperationRunResult =
  | { readonly status: "busy" }
  | { readonly status: "stale" }
  | { readonly status: "settled" };

function exactOpaqueIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value
  );
}

function capturePermit(
  permit: HouseholdOperationPermit,
): HouseholdOperationPermit | null {
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

function freezeNotice(
  notice: HouseholdOperationNotice | null,
): HouseholdOperationNotice | null {
  return notice ? Object.freeze({ ...notice }) : null;
}

function freezeSnapshot(
  revision: number,
  activeKind: HouseholdOperationKind | null,
  notice: HouseholdOperationNotice | null,
): HouseholdOperationSnapshot {
  return Object.freeze({ revision, activeKind, notice });
}

/**
 * One process-wide household-operation lane for the mounted Care provider.
 * `begin` changes authority before it returns, closing button/return races in
 * the same JavaScript turn rather than relying on React mutation loading.
 */
export function createHouseholdOperationController(): HouseholdOperationController {
  let revision = 0;
  let activeToken: HouseholdOperationToken | null = null;
  let activePermit: HouseholdOperationPermit | null = null;
  let snapshot = freezeSnapshot(0, null, null);
  const listeners = new Set<() => void>();

  const publish = (
    activeKind: HouseholdOperationKind | null,
    notice: HouseholdOperationNotice | null,
  ) => {
    revision += 1;
    snapshot = freezeSnapshot(revision, activeKind, freezeNotice(notice));
    for (const listener of listeners) listener();
  };

  return Object.freeze({
    begin(
      kind: HouseholdOperationKind,
      permit: HouseholdOperationPermit,
    ): HouseholdOperationToken | null {
      if (activeToken) return null;
      const captured = capturePermit(permit);
      if (!captured) return null;
      const token = Object.freeze({}) as HouseholdOperationToken;
      activeToken = token;
      activePermit = captured;
      publish(kind, null);
      return token;
    },
    complete(
      token: HouseholdOperationToken,
      notice: HouseholdOperationNotice | null,
    ): boolean {
      if (token !== activeToken) return false;
      activeToken = null;
      activePermit = null;
      publish(null, notice);
      return true;
    },
    isCurrent(token: HouseholdOperationToken): boolean {
      return token === activeToken;
    },
    getPermit(
      token: HouseholdOperationToken,
    ): HouseholdOperationPermit | null {
      return token === activeToken ? activePermit : null;
    },
    getSnapshot() {
      return snapshot;
    },
    consumeNotice() {
      if (!snapshot.notice || activeToken) return null;
      const notice = snapshot.notice;
      publish(null, null);
      return notice;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}

function errorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const status = Reflect.get(error, "status");
  return typeof status === "number" && Number.isFinite(status) ? status : null;
}

export function describeJoinHouseholdFailure(
  error: unknown,
): HouseholdOperationNotice {
  const status = errorStatus(error);
  if (status === 401) {
    return Object.freeze({
      title: "Sign-in changed",
      message:
        "WoofWatcher could not confirm the signed-in session. Sign in again, then review the active household before joining.",
    });
  }
  if (status === 400 || status === 404 || status === 410) {
    return Object.freeze({
      title: "Invite unavailable",
      message:
        "That invite code is invalid or expired. Check the exact code or ask the household owner for a new one.",
    });
  }
  if (status === 403) {
    return Object.freeze({
      title: "Join not allowed",
      message:
        "This account is not allowed to join that household. Ask a household owner to review the invitation.",
    });
  }
  if (status === 409) {
    return Object.freeze({
      title: "Household changed",
      message:
        "The household changed while the join was being completed. WoofWatcher rechecked your active household before reopening personal screens.",
    });
  }
  if (status === 412 || status === 428) {
    return Object.freeze({
      title: "Account changed",
      message:
        "Your active household changed before this join could be authorized. WoofWatcher rechecked the current household; review it before trying again.",
    });
  }
  return Object.freeze({
    title: "Household status rechecked",
    message:
      "The join result could not be confirmed. WoofWatcher rechecked the server's active household before reopening personal screens; review the current household before trying again.",
  });
}

function describeJoinPreparationFailure(): HouseholdOperationNotice {
  return Object.freeze({
    title: "Account data stayed protected",
    message:
      "WoofWatcher could not safely close the current household data before joining. Retry the account-data protection step before trying again.",
  });
}

function describeSwitchHouseholdFailure(
  error: unknown,
): HouseholdOperationNotice {
  const status = errorStatus(error);
  if (status === 401) {
    return Object.freeze({
      title: "Sign-in changed",
      message:
        "WoofWatcher could not confirm the signed-in session. It rechecked your account before reopening personal screens.",
    });
  }
  if (status === 403) {
    return Object.freeze({
      title: "Household access changed",
      message:
        "That household access was removed or expired. WoofWatcher rechecked your current household before reopening personal screens.",
    });
  }
  if (status === 409 || status === 412 || status === 428) {
    return Object.freeze({
      title: "Household changed",
      message:
        "The active household changed before this switch could be authorized. WoofWatcher rechecked the server before reopening your data.",
    });
  }
  return Object.freeze({
    title: "Household status rechecked",
    message:
      "The switch result could not be confirmed. WoofWatcher rechecked the server before reopening your data; review the current household before trying again.",
  });
}

function describeSwitchPreparationFailure(): HouseholdOperationNotice {
  return Object.freeze({
    title: "Account data stayed protected",
    message:
      "WoofWatcher could not safely close the current household data before switching. Retry the account-data protection step before trying again.",
  });
}

function describeRenameFailure(error: unknown): HouseholdOperationNotice {
  const status = errorStatus(error);
  if (status === 401) {
    return Object.freeze({
      title: "Sign-in changed",
      message:
        "WoofWatcher could not confirm the signed-in session. It is rechecking your account before another household change.",
    });
  }
  if (status === 403) {
    return Object.freeze({
      title: "Rename not allowed",
      message:
        "This account is not allowed to rename the active household. Ask a household owner to update it.",
    });
  }
  if (status === 409 || status === 412 || status === 428) {
    return Object.freeze({
      title: "Household changed",
      message:
        "The active household changed before this rename could be applied. WoofWatcher rechecked the current household before continuing.",
    });
  }
  return Object.freeze({
    title: "Household was not renamed",
    message:
      "WoofWatcher could not confirm the rename. The previous household name remains on this device; check your connection and try again.",
  });
}

function describeInvitationFailure(error: unknown): HouseholdOperationNotice {
  const status = errorStatus(error);
  if (status === 401) {
    return Object.freeze({
      title: "Sign-in changed",
      message:
        "WoofWatcher could not confirm the signed-in session. It is rechecking your account, and no code was shared.",
    });
  }
  if (status === 403) {
    return Object.freeze({
      title: "Invitation not allowed",
      message:
        "Only a household owner can create a one-time invitation. Ask the active household owner to share one.",
    });
  }
  if (status === 409 || status === 412 || status === 428) {
    return Object.freeze({
      title: "Household changed",
      message:
        "The active household changed before a one-time invitation could be created. WoofWatcher rechecked the current household, and no code was shared.",
    });
  }
  return Object.freeze({
    title: "Invitation not shared",
    message:
      "WoofWatcher could not create a new one-time invitation. No invite code was saved or shown; check your connection and try again.",
  });
}

function describeUntrustedInvitationResponse(): HouseholdOperationNotice {
  return Object.freeze({
    title: "Invitation not shared",
    message:
      "The invitation response did not confirm an approved one-time code for the active household. WoofWatcher rechecked the household, and no code was shared.",
  });
}

function describeRevokedInvitationShareFailure(): HouseholdOperationNotice {
  return Object.freeze({
    title: "Invitation cancelled",
    message:
      "The share was dismissed or unavailable. WoofWatcher confirmed that invitation was revoked, so its code can no longer be used.",
  });
}

function describeUnconfirmedInvitationCleanup(
  mayHaveShared: boolean,
): HouseholdOperationNotice {
  return Object.freeze({
    title: "Invitation may still be active",
    message: mayHaveShared
      ? "The account or device-data scope changed while sharing. The invitation may have been shared and may still be active until it expires automatically within 10 minutes."
      : "The invitation was not shared, but WoofWatcher could not confirm its revocation. It may still be active until it expires automatically within 10 minutes.",
  });
}

function describeInvitationExpiredDuringShare(): HouseholdOperationNotice {
  return Object.freeze({
    title: "Invitation expired",
    message:
      "The one-time invitation expired before sharing finished, so it can no longer be used. Create a new invitation when you are ready.",
  });
}

interface ApprovedInvitationAuthority {
  readonly id: string;
  readonly inviteCode: string;
  readonly expiresAtMs: number;
}

function approvedInvitationAuthority(
  response: unknown,
  expectedHouseholdId: string,
  expectedUserId: string,
  nowMs: number,
  requestedExpiryMs: number,
): ApprovedInvitationAuthority | null {
  if (!response || typeof response !== "object") return null;
  const invitation = Reflect.get(response, "invitation");
  if (!invitation || typeof invitation !== "object") return null;
  const id = Reflect.get(invitation, "id");
  const code = Reflect.get(invitation, "inviteCode");
  const expiresAt = Reflect.get(invitation, "expiresAt");
  const expiresAtMs =
    typeof expiresAt === "string" ? Date.parse(expiresAt) : Number.NaN;
  if (
    !exactOpaqueIdentifier(id) ||
    Reflect.get(invitation, "householdId") !== expectedHouseholdId ||
    Reflect.get(invitation, "role") !== "adult" ||
    Reflect.get(invitation, "lifecycleState") !== "approved" ||
    Reflect.get(invitation, "runtimeLifecycleState") !== "approved" ||
    Reflect.get(invitation, "expired") !== false ||
    Reflect.get(invitation, "storage") !== "provider-durable" ||
    Reflect.get(invitation, "createdByUserId") !== expectedUserId ||
    Reflect.get(invitation, "approvedByUserId") !== expectedUserId ||
    typeof expiresAt !== "string" ||
    expiresAt.trim() !== expiresAt ||
    !Number.isFinite(expiresAtMs) ||
    new Date(expiresAtMs).toISOString() !== expiresAt ||
    expiresAtMs <= nowMs ||
    expiresAtMs > requestedExpiryMs ||
    !exactOpaqueIdentifier(code)
  ) {
    return null;
  }
  // The server-issued credential is opaque. Never normalize or trim it.
  return Object.freeze({ id, inviteCode: code, expiresAtMs });
}

function confirmsInvitationRevoked(
  response: unknown,
  invitationId: string,
  expectedHouseholdId: string,
  expectedUserId: string,
): boolean {
  if (!response || typeof response !== "object") return false;
  const invitation = Reflect.get(response, "invitation");
  if (!invitation || typeof invitation !== "object") return false;
  return (
    Reflect.get(invitation, "id") === invitationId &&
    Reflect.get(invitation, "householdId") === expectedHouseholdId &&
    Reflect.get(invitation, "lifecycleState") === "revoked" &&
    Reflect.get(invitation, "runtimeLifecycleState") === "revoked" &&
    Reflect.get(invitation, "storage") === "provider-durable" &&
    Reflect.get(invitation, "createdByUserId") === expectedUserId
  );
}

type RunTrackedInvitationTransport = <T>(
  transport: (isLocalDataCurrent: () => boolean) => Promise<T>,
) => Promise<HouseholdTrackedTransportResult<T>>;

type InvitationWorkOutcome =
  | { readonly status: "shared" }
  | { readonly status: "share-revoked" }
  | {
      readonly status: "share-cleanup-unconfirmed";
      readonly mayHaveShared: boolean;
      readonly rediscover: boolean;
    }
  | { readonly status: "share-expired" }
  | { readonly status: "stale-identity" }
  | { readonly status: "reset-revoked" }
  | { readonly status: "untrusted-response" };

export interface RunHouseholdInviteOperationOptions {
  controller: HouseholdOperationController;
  permit: HouseholdOperationPermit;
  isPermitCurrent(permit: HouseholdOperationPermit): boolean;
  runTrackedTransport: RunTrackedInvitationTransport;
  createInvitation(
    expectedHouseholdId: string,
    expiresAt: string,
  ): Promise<unknown>;
  /** Receives the credential transiently; callers must not persist it. */
  shareInvitation(
    inviteCode: string,
  ): Promise<
    boolean | "shared" | "dismissed" | "copied" | "downloaded" | "failed"
  >;
  revokeInvitation?(
    invitationId: string,
    expectedHouseholdId: string,
  ): Promise<unknown>;
  now?: () => number;
  restartIdentityResolution(): void;
}

/**
 * Creates and immediately shares an approved, provider-durable invitation.
 * The code exists only on this async stack and is never placed in controller
 * state, React state, or a query cache.
 */
export function runHouseholdInviteOperation({
  controller,
  permit,
  isPermitCurrent,
  runTrackedTransport,
  createInvitation,
  shareInvitation,
  revokeInvitation,
  now = Date.now,
  restartIdentityResolution,
}: RunHouseholdInviteOperationOptions): Promise<HouseholdOperationRunResult> {
  const operationToken = controller.begin("invite", permit);
  if (!operationToken) return Promise.resolve({ status: "busy" });
  const captured = controller.getPermit(operationToken);
  if (!captured || !isPermitCurrent(captured)) {
    controller.complete(operationToken, null);
    return Promise.resolve({ status: "stale" });
  }

  return (async () => {
    let notice: HouseholdOperationNotice | null = null;
    let rediscover = false;
    try {
      const result = await runTrackedTransport(async (isLocalDataCurrent) => {
        if (
          !isLocalDataCurrent() ||
          !controller.isCurrent(operationToken) ||
          !isPermitCurrent(captured)
        ) {
          return Object.freeze<InvitationWorkOutcome>({
            status: isPermitCurrent(captured)
              ? "reset-revoked"
              : "stale-identity",
          });
        }

        const createdAtMs = now();
        const requestedExpiryMs =
          createdAtMs + HOUSEHOLD_INVITATION_LIFETIME_MS;
        const requestedExpiry = new Date(requestedExpiryMs).toISOString();
        const response = await createInvitation(
          captured.householdId,
          requestedExpiry,
        );
        const invitation = approvedInvitationAuthority(
          response,
          captured.householdId,
          captured.userId,
          now(),
          requestedExpiryMs,
        );
        if (!invitation) {
          return Object.freeze<InvitationWorkOutcome>({
            status: "untrusted-response",
          });
        }

        const operationIsCurrent = () =>
          controller.isCurrent(operationToken) &&
          isPermitCurrent(captured) &&
          isLocalDataCurrent();
        const cleanupInvitation = async (
          mayHaveShared: boolean,
        ): Promise<InvitationWorkOutcome> => {
          if (now() >= invitation.expiresAtMs) {
            return Object.freeze({ status: "share-expired" as const });
          }
          const rediscoverIdentity = !isPermitCurrent(captured);
          if (!operationIsCurrent() || !revokeInvitation) {
            return Object.freeze({
              status: "share-cleanup-unconfirmed" as const,
              mayHaveShared,
              rediscover: rediscoverIdentity,
            });
          }
          try {
            const revoked = await revokeInvitation(
              invitation.id,
              captured.householdId,
            );
            if (
              confirmsInvitationRevoked(
                revoked,
                invitation.id,
                captured.householdId,
                captured.userId,
              )
            ) {
              return Object.freeze({ status: "share-revoked" as const });
            }
          } catch {
            // Fall through to the bounded-live warning.
          }
          return Object.freeze({
            status: "share-cleanup-unconfirmed" as const,
            mayHaveShared,
            rediscover: !isPermitCurrent(captured),
          });
        };

        if (!operationIsCurrent()) {
          return cleanupInvitation(false);
        }
        if (now() >= invitation.expiresAtMs) {
          return Object.freeze<InvitationWorkOutcome>({
            status: "share-expired",
          });
        }

        let shareSucceeded = false;
        try {
          const shareOutcome = await shareInvitation(invitation.inviteCode);
          shareSucceeded =
            shareOutcome === true ||
            shareOutcome === "shared" ||
            shareOutcome === "copied" ||
            shareOutcome === "downloaded";
        } catch {
          shareSucceeded = false;
        }
        if (
          shareSucceeded &&
          operationIsCurrent() &&
          now() < invitation.expiresAtMs
        ) {
          return Object.freeze<InvitationWorkOutcome>({ status: "shared" });
        }
        return cleanupInvitation(shareSucceeded);
      });

      if (result.status === "revoked") return { status: "settled" as const };
      if (result.value.status === "stale-identity") {
        rediscover = true;
        notice = describeUntrustedInvitationResponse();
      } else if (result.value.status === "untrusted-response") {
        rediscover = true;
        notice = describeUntrustedInvitationResponse();
      } else if (result.value.status === "share-revoked") {
        notice = describeRevokedInvitationShareFailure();
      } else if (result.value.status === "share-cleanup-unconfirmed") {
        rediscover = result.value.rediscover;
        notice = describeUnconfirmedInvitationCleanup(
          result.value.mayHaveShared,
        );
      } else if (result.value.status === "share-expired") {
        notice = describeInvitationExpiredDuringShare();
      }
    } catch (error) {
      notice = describeInvitationFailure(error);
      const status = errorStatus(error);
      rediscover =
        status === 401 ||
        status === 403 ||
        status === 409 ||
        status === 412 ||
        status === 428;
    } finally {
      try {
        if (rediscover) restartIdentityResolution();
      } finally {
        controller.complete(operationToken, notice);
      }
    }
    return Object.freeze({ status: "settled" as const });
  })();
}

export interface RunHouseholdJoinOperationOptions<TCareToken extends object> {
  controller: HouseholdOperationController;
  permit: HouseholdOperationPermit;
  inviteCode: string;
  beginCareTransition(
    permit: HouseholdOperationPermit,
  ): TCareToken | null;
  /** Must synchronously block before returning its cleanup promise. */
  prepareQueryTransition(expectedDataScopeKey: string): Promise<void>;
  /** Called only after query cancellation/drain/clear has completed. */
  runTrackedTransport: RunTrackedTransport;
  joinTransport(
    inviteCode: string,
    expectedHouseholdId: string,
  ): Promise<unknown>;
  resumeCareTransition(token: TCareToken): boolean;
}

export function runHouseholdJoinOperation<TCareToken extends object>({
  controller,
  permit,
  inviteCode,
  beginCareTransition,
  prepareQueryTransition,
  runTrackedTransport,
  joinTransport,
  resumeCareTransition,
}: RunHouseholdJoinOperationOptions<TCareToken>): Promise<HouseholdOperationRunResult> {
  const operationToken = controller.begin("join", permit);
  if (!operationToken) return Promise.resolve({ status: "busy" });
  const captured = controller.getPermit(operationToken);
  if (!captured) {
    controller.complete(operationToken, null);
    return Promise.resolve({ status: "stale" });
  }

  const careToken = beginCareTransition(captured);
  if (!careToken) {
    controller.complete(operationToken, null);
    return Promise.resolve({ status: "stale" });
  }

  let preparing: Promise<void>;
  try {
    // This call is intentionally before the first await. Its implementation
    // blocks the query scope synchronously, then awaits real React teardown.
    preparing = prepareQueryTransition(captured.identityKey);
  } catch (error) {
    preparing = Promise.reject(error);
  }

  return (async () => {
    let notice: HouseholdOperationNotice | null = null;
    try {
      await preparing;
      try {
        const result = await runTrackedTransport(() =>
          joinTransport(inviteCode, captured.householdId),
        );
        if (result.status === "revoked") {
          notice = describeJoinHouseholdFailure(
            new TypeError("The local-data operation was revoked."),
          );
        }
      } catch (error) {
        notice = describeJoinHouseholdFailure(error);
      }
    } catch {
      notice = describeJoinPreparationFailure();
    } finally {
      if (!resumeCareTransition(careToken)) {
        notice = describeJoinPreparationFailure();
      }
      controller.complete(operationToken, notice);
    }
    return Object.freeze({ status: "settled" as const });
  })();
}

export interface RunHouseholdSwitchOperationOptions<TCareToken extends object> {
  controller: HouseholdOperationController;
  permit: HouseholdOperationPermit;
  targetHouseholdId: string;
  beginCareTransition(
    permit: HouseholdOperationPermit,
  ): TCareToken | null;
  /** Must synchronously block before returning its cleanup promise. */
  prepareQueryTransition(expectedDataScopeKey: string): Promise<void>;
  /** Called only after A observer teardown, cancellation, drain, and clear. */
  runTrackedTransport: RunTrackedTransport;
  activateTransport(
    targetHouseholdId: string,
    expectedSourceHouseholdId: string,
  ): Promise<unknown>;
  resumeCareTransition(token: TCareToken): boolean;
}

export function runHouseholdSwitchOperation<TCareToken extends object>({
  controller,
  permit,
  targetHouseholdId,
  beginCareTransition,
  prepareQueryTransition,
  runTrackedTransport,
  activateTransport,
  resumeCareTransition,
}: RunHouseholdSwitchOperationOptions<TCareToken>): Promise<HouseholdOperationRunResult> {
  if (
    !exactOpaqueIdentifier(targetHouseholdId) ||
    targetHouseholdId === permit.householdId
  ) {
    return Promise.resolve({ status: "stale" });
  }
  const operationToken = controller.begin("switch", permit);
  if (!operationToken) return Promise.resolve({ status: "busy" });
  const captured = controller.getPermit(operationToken);
  if (!captured) {
    controller.complete(operationToken, null);
    return Promise.resolve({ status: "stale" });
  }

  const careToken = beginCareTransition(captured);
  if (!careToken) {
    controller.complete(operationToken, null);
    return Promise.resolve({ status: "stale" });
  }

  let preparing: Promise<void>;
  try {
    // Like Join, this call blocks synchronously before its real React cleanup
    // acknowledgement/cancel/drain/clear promise can yield.
    preparing = prepareQueryTransition(captured.identityKey);
  } catch (error) {
    preparing = Promise.reject(error);
  }

  return (async () => {
    let notice: HouseholdOperationNotice | null = null;
    try {
      await preparing;
      try {
        const result = await runTrackedTransport(() =>
          activateTransport(targetHouseholdId, captured.householdId),
        );
        // The mutation response is deliberately ignored. Only the fresh /me
        // resolver started by Care resume can admit A, B, or C to the UI.
        if (result.status === "revoked") {
          notice = describeSwitchHouseholdFailure(
            new TypeError("The local-data operation was revoked."),
          );
        }
      } catch (error) {
        notice = describeSwitchHouseholdFailure(error);
      }
    } catch {
      notice = describeSwitchPreparationFailure();
    } finally {
      if (!resumeCareTransition(careToken)) {
        notice = describeSwitchPreparationFailure();
      }
      controller.complete(operationToken, notice);
    }
    return Object.freeze({ status: "settled" as const });
  })();
}

export interface RunHouseholdRenameOperationOptions {
  controller: HouseholdOperationController;
  permit: HouseholdOperationPermit;
  name: string;
  isPermitCurrent(permit: HouseholdOperationPermit): boolean;
  runTrackedTransport: RunTrackedTransport;
  renameTransport(
    name: string,
    expectedHouseholdId: string,
  ): Promise<unknown>;
  restartIdentityResolution(): void;
  acceptResponse?(response: unknown): void;
}

export function runHouseholdRenameOperation({
  controller,
  permit,
  name,
  isPermitCurrent,
  runTrackedTransport,
  renameTransport,
  restartIdentityResolution,
  acceptResponse,
}: RunHouseholdRenameOperationOptions): Promise<HouseholdOperationRunResult> {
  const operationToken = controller.begin("rename", permit);
  if (!operationToken) return Promise.resolve({ status: "busy" });
  const captured = controller.getPermit(operationToken);
  if (!captured || !isPermitCurrent(captured)) {
    controller.complete(operationToken, null);
    return Promise.resolve({ status: "stale" });
  }

  return (async () => {
    let notice: HouseholdOperationNotice | null = null;
    let rediscover = false;
    try {
      const result = await runTrackedTransport(() =>
        renameTransport(name, captured.householdId),
      );
      if (result.status === "revoked" || !isPermitCurrent(captured)) {
        return Object.freeze({ status: "settled" as const });
      }
      const admitted = admitCareHouseholdIdentityMe(
        result.value,
        captured.userId,
      );
      const responseHousehold =
        result.value && typeof result.value === "object"
          ? Reflect.get(result.value, "household")
          : null;
      if (
        !admitted ||
        admitted.householdId !== captured.householdId ||
        !responseHousehold ||
        typeof responseHousehold !== "object" ||
        Reflect.get(responseHousehold, "name") !== name
      ) {
        notice = describeRenameFailure(
          new TypeError("The rename response lacked exact household authority."),
        );
        rediscover = true;
      } else {
        acceptResponse?.(result.value);
      }
    } catch (error) {
      notice = describeRenameFailure(error);
      const status = errorStatus(error);
      rediscover =
        status === 401 ||
        status === 403 ||
        status === 409 ||
        status === 412 ||
        status === 428;
    } finally {
      if (rediscover) restartIdentityResolution();
      controller.complete(operationToken, notice);
    }
    return Object.freeze({ status: "settled" as const });
  })();
}

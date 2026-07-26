export type IsoTimestamp = string;
export type RequestId = string;
export type ChallengeId = string;
export type EffectId = string;
export type ProviderActionId = string;
export type ReceiptId = string;
export type UserId = string;
export type Sha256Hex = string;
export type RecoveryGeneration = number;
export type EffectAttempt = number;

export interface LeaseFence {
  workerId: string;
  leaseToken: string;
  leaseUntil: Date;
}

export type AccountDeletionState =
  | "challenge_required"
  | "reauth_verified"
  | "provider_action_required"
  | "accepted"
  | "apple_revoking"
  | "apple_revoked"
  | "preflight"
  | "cleanup_pending"
  | "cleanup_running"
  | "object_inventory"
  | "object_cleanup_pending"
  | "object_cleanup_running"
  | "object_cleanup_complete"
  | "clerk_deleting"
  | "receipt_finalizing"
  | "retry_required"
  | "blocked"
  | "failed"
  | "succeeded";

export type ProviderEffectKind =
  | "apple_revoke"
  | "object_delete"
  | "clerk_delete";

export type ProviderEffectState =
  | "intent"
  | "claimed"
  | "checkpointed"
  | "committed"
  | "retry_required"
  | "indeterminate";

export interface ClerkReauthAdapterVerification {
  proofId: string;
  subjectUserId: UserId;
  challengeId: ChallengeId;
  purpose: "account_deletion";
  verifiedAt: Date;
  expiresAt: Date;
  rawProofBinding: Uint8Array;
}

export interface ClerkChallengeAdapterResult {
  challengeId: ChallengeId;
  subjectUserId: UserId;
  clientHintEnvelope: string;
  rawProofBinding: Uint8Array;
  expiresAt: Date;
}

export interface ClerkReauthVerification {
  proofId: string;
  subjectUserId: UserId;
  challengeId: ChallengeId;
  purpose: "account_deletion";
  verifiedAt: Date;
  expiresAt: Date;
  proofBindingSha256: Sha256Hex;
}

export interface ClerkChallengeResult {
  challengeId: ChallengeId;
  subjectUserId: UserId;
  clientHintEnvelope: string;
  proofBindingSha256: Sha256Hex;
  expiresAt: Date;
}

export interface AccountDeletionProviderGatewayConfiguration {
  maxClientHintEnvelopeBytes: number;
  now?: () => Date;
}

export interface AuthoritativeIdentity {
  userId: UserId;
  appleApplicable: boolean;
  identityVersion: string;
}

export type AppleOutcome =
  | { kind: "unknown" }
  | { kind: "indeterminate"; reasonCode: string }
  | { kind: "checkpoint"; checkpoint: string }
  | {
      kind: "complete";
      checkpoint: string;
      providerReceipt: string;
      completedAt: Date;
    };

export type ClerkDeletionOutcome =
  | { kind: "unknown" }
  | { kind: "indeterminate"; reasonCode: string }
  | {
      kind: "deleted" | "already_absent";
      providerReceipt: string;
      completedAt: Date;
    };

export interface AccountDeletionProviderAdapters {
  createClerkReauthChallenge(input: {
    userId: UserId;
    purpose: "account_deletion";
  }): Promise<ClerkChallengeAdapterResult>;
  verifyClerkReauth(input: {
    envelope: Uint8Array;
    expectedUserId: UserId;
    expectedChallengeId: ChallengeId;
  }): Promise<ClerkReauthAdapterVerification>;
  getAuthoritativeIdentity(userId: UserId): Promise<AuthoritativeIdentity>;
  lookupAppleRevocationOutcome(input: {
    replayKey: string;
    checkpoint: string | null;
  }): Promise<AppleOutcome>;
  resumeAppleRevocation(input: {
    replayKey: string;
    checkpoint: string | null;
    encryptedCredential: string;
  }): Promise<Exclude<AppleOutcome, { kind: "unknown" | "indeterminate" }>>;
  lookupClerkDeletionOutcome(input: {
    replayKey: string;
    userId: UserId;
  }): Promise<ClerkDeletionOutcome>;
  deleteClerkUser(input: {
    replayKey: string;
    userId: UserId;
  }): Promise<
    Extract<ClerkDeletionOutcome, { kind: "deleted" | "already_absent" }>
  >;
}

export interface AccountDeletionProviderGateway {
  createClerkReauthChallenge(input: {
    userId: UserId;
    purpose: "account_deletion";
  }): Promise<ClerkChallengeResult>;
  verifyClerkReauth(input: {
    envelope: Uint8Array;
    expectedUserId: UserId;
    expectedChallengeId: ChallengeId;
  }): Promise<ClerkReauthVerification>;
  getAuthoritativeIdentity(userId: UserId): Promise<AuthoritativeIdentity>;
  lookupAppleRevocationOutcome(input: {
    replayKey: string;
    checkpoint: string | null;
  }): Promise<AppleOutcome>;
  resumeAppleRevocation(input: {
    replayKey: string;
    checkpoint: string | null;
    encryptedCredential: string;
  }): Promise<Exclude<AppleOutcome, { kind: "unknown" | "indeterminate" }>>;
  lookupClerkDeletionOutcome(input: {
    replayKey: string;
    userId: UserId;
  }): Promise<ClerkDeletionOutcome>;
  deleteClerkUser(input: {
    replayKey: string;
    userId: UserId;
  }): Promise<
    Extract<ClerkDeletionOutcome, { kind: "deleted" | "already_absent" }>
  >;
}

export interface DeletionChallengeRecord {
  id: ChallengeId;
  userId: UserId;
  purpose: "account_deletion";
  rawProofBindingSha256: Sha256Hex;
  clientHintEnvelopeCiphertext: string;
  expiresAt: Date;
  consumedAt: Date | null;
}

export type RetryResumeState =
  | "apple_revoking"
  | "cleanup_pending"
  | "object_inventory"
  | "object_cleanup_running"
  | "clerk_deleting"
  | "receipt_finalizing";

export interface AccountDeletionJobRecord {
  id: RequestId;
  userId: UserId;
  state: AccountDeletionState;
  stateGeneration: number;
  deletionStartsAt: Date;
  appleApplicable: boolean;
  activeProviderActionId: ProviderActionId | null;
  activeRecoveryGeneration: RecoveryGeneration | null;
  recoveryExpiresAt: Date | null;
  recoveryHandoffGeneration: RecoveryGeneration | null;
  blockedCode: "last_owner" | "missing_user" | "provider_unavailable" | null;
  retryCode: string | null;
  retryResumeState: RetryResumeState | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AccountDeletionProviderActionRecord =
  | {
      id: ProviderActionId;
      requestId: RequestId;
      kind: "clerk_reauthentication";
      generation: number;
      clientHintEnvelope: string;
      expiresAt: Date;
      consumedAt: Date | null;
    }
  | {
      id: ProviderActionId;
      requestId: RequestId;
      kind: "apple_reauthorization";
      generation: number;
      nonce: string;
      expiresAt: Date;
      consumedAt: Date | null;
    };

export interface ProviderEffectRecord {
  id: EffectId;
  requestId: RequestId;
  kind: ProviderEffectKind;
  objectInventoryId: string | null;
  replayKey: string;
  state: ProviderEffectState;
  attempt: number;
  claimedJobGeneration: number | null;
  replayMaterialCiphertext: string | null;
  checkpointCiphertext: string | null;
  providerReceiptCiphertext: string | null;
  lastReasonCode: string | null;
  committedAt: Date | null;
}

export interface AccountDeletionIdempotencyRecord {
  userId: UserId;
  operationId: string;
  idempotencyKeyHash: Sha256Hex;
  requestFingerprintSha256: Sha256Hex;
  requestId: RequestId | null;
  encryptedResponseBody: string;
  responseStatus: number;
  createdAt: Date;
}

export interface StoredIdempotentResponse {
  encryptedResponseBody: string;
  responseStatus: number;
}

export interface AccountDeletionReceiptRecord {
  receiptId: string;
  requestId: RequestId;
  terminalState: "blocked" | "failed" | "succeeded";
  dataCleanupState: "not_started" | "partial" | "complete";
  appleState: "not_applicable" | "revoked" | "unresolved";
  clerkState: "present" | "deleted" | "already_absent" | "unresolved";
  objectState: "not_started" | "partial" | "complete";
  terminalCode: string | null;
  finalizedAt: Date;
}

export interface CreateDeletionChallengeInput {
  challengeId: ChallengeId;
  userId: UserId;
  rawProofBindingSha256: Sha256Hex;
  clientHintEnvelopeCiphertext: string;
  expiresAt: Date;
  idempotencyKeyHash: Sha256Hex;
  requestFingerprintSha256: Sha256Hex;
  encryptedResponseBody: string;
  responseStatus: number;
}

export type CreateDeletionChallengeResult =
  | {
      kind: "created";
      record: DeletionChallengeRecord;
      encryptedResponseBody: string;
      responseStatus: number;
    }
  | {
      kind: "replay";
      record: DeletionChallengeRecord;
      encryptedResponseBody: string;
      responseStatus: number;
    }
  | { kind: "conflict" };

export interface CreateDeletionRequestInput {
  requestId: RequestId;
  userId: UserId;
  challengeId: ChallengeId;
  proofId: string;
  proofBindingSha256: Sha256Hex;
  proofExpiresAt: Date;
  exactEnvelopeSha256: Sha256Hex;
  appleApplicable: boolean;
  idempotencyKeyHash: Sha256Hex;
  requestFingerprintSha256: Sha256Hex;
  initialProviderEffectIntent: {
    effectId: EffectId;
    kind: "apple_revoke";
  } | null;
  buildStoredResponse(created: {
    job: AccountDeletionJobRecord;
  }): StoredIdempotentResponse;
}

export type CreateDeletionRequestResult =
  | {
      kind: "created";
      job: AccountDeletionJobRecord;
      encryptedResponseBody: string;
      responseStatus: number;
    }
  | {
      kind: "replay";
      job: AccountDeletionJobRecord;
      encryptedResponseBody: string;
      responseStatus: number;
    }
  | { kind: "conflict" }
  | { kind: "proof_already_consumed" };

export interface LookupRequestIdempotencyInput {
  userId: UserId;
  operationId: "request";
  idempotencyKeyHash: Sha256Hex;
  requestFingerprintSha256: Sha256Hex;
}

export type LookupRequestIdempotencyResult =
  | {
      kind: "replay";
      job: AccountDeletionJobRecord;
      encryptedResponseBody: string;
      responseStatus: number;
    }
  | { kind: "conflict" }
  | { kind: "miss" };

export interface CreateBlockedDeletionInput {
  requestId: RequestId;
  authenticatedSubjectUserId: UserId;
  code: "missing_user" | "last_owner";
  idempotencyKeyHash: Sha256Hex;
  requestFingerprintSha256: Sha256Hex;
  buildStoredResponse(created: {
    job: AccountDeletionJobRecord;
    receipt: AccountDeletionReceiptRecord;
  }): StoredIdempotentResponse;
}

export type CreateBlockedDeletionResult =
  | {
      kind: "created";
      job: AccountDeletionJobRecord;
      receipt: AccountDeletionReceiptRecord;
      encryptedResponseBody: string;
      responseStatus: number;
    }
  | {
      kind: "replay";
      job: AccountDeletionJobRecord;
      receipt: AccountDeletionReceiptRecord;
      encryptedResponseBody: string;
      responseStatus: number;
    }
  | { kind: "conflict" };

export interface ClaimProviderEffectInput {
  effectId: EffectId;
  expectedObjectInventoryId: string | null;
  expectedJobGeneration: number;
  lease: LeaseFence;
}

export interface CreateProviderEffectIntentInput {
  effectId: EffectId;
  requestId: RequestId;
  kind: ProviderEffectKind;
  objectInventoryId: string | null;
  expectedJobGeneration: number;
  replayMaterialCiphertext: string | null;
  lease: LeaseFence;
}

export interface AttachProviderEffectReplayMaterialAndAcceptInput {
  effectId: EffectId;
  requestId: RequestId;
  expectedJobGeneration: number;
  expectedProviderActionId: ProviderActionId;
  replayMaterialCiphertext: string;
}

export interface AttachProviderEffectReplayMaterialAndAcceptResult {
  job: AccountDeletionJobRecord;
  effect: ProviderEffectRecord;
}

export interface CommitProviderEffectInput {
  effectId: EffectId;
  expectedAttempt: number;
  expectedReplayKey: string;
  checkpointCiphertext: string | null;
  providerReceiptCiphertext: string | null;
  outcome: "checkpointed" | "committed" | "retry_required" | "indeterminate";
  reasonCode: string | null;
  lease: LeaseFence;
}

export interface RecordStateTransitionInput {
  requestId: RequestId;
  expectedState: AccountDeletionState;
  expectedGeneration: number;
  nextState: AccountDeletionState;
  retryCode: string | null;
  retryResumeState: RetryResumeState | null;
  blockedCode: AccountDeletionJobRecord["blockedCode"];
  lease: LeaseFence;
}

export interface CompareAndSetProviderActionInput {
  requestId: RequestId;
  expectedJobGeneration: number;
  expectedActionId: ProviderActionId | null;
  nextAction: AccountDeletionProviderActionRecord | null;
  lease: LeaseFence;
}

export interface AccountDeletionStore {
  createChallenge(
    input: CreateDeletionChallengeInput,
  ): Promise<CreateDeletionChallengeResult>;
  createRequestAndConsumeProof(
    input: CreateDeletionRequestInput,
  ): Promise<CreateDeletionRequestResult>;
  lookupRequestIdempotency(
    input: LookupRequestIdempotencyInput,
  ): Promise<LookupRequestIdempotencyResult>;
  createBlockedRequest(
    input: CreateBlockedDeletionInput,
  ): Promise<CreateBlockedDeletionResult>;
  loadRequest(requestId: RequestId): Promise<AccountDeletionJobRecord | null>;
  loadProviderAction(
    requestId: RequestId,
  ): Promise<AccountDeletionProviderActionRecord | null>;
  compareAndSetProviderAction(
    input: CompareAndSetProviderActionInput,
  ): Promise<AccountDeletionProviderActionRecord | null>;
  loadEffect(effectId: EffectId): Promise<ProviderEffectRecord | null>;
  listEffects(
    requestId: RequestId,
    kind: ProviderEffectKind,
  ): Promise<ProviderEffectRecord[]>;
  createProviderEffectIntent(
    input: CreateProviderEffectIntentInput,
  ): Promise<ProviderEffectRecord>;
  attachProviderEffectReplayMaterialAndAccept(
    input: AttachProviderEffectReplayMaterialAndAcceptInput,
  ): Promise<AttachProviderEffectReplayMaterialAndAcceptResult>;
  claimEffect(
    input: ClaimProviderEffectInput,
  ): Promise<ProviderEffectRecord | null>;
  commitEffect(input: CommitProviderEffectInput): Promise<void>;
  transition(
    input: RecordStateTransitionInput,
  ): Promise<AccountDeletionJobRecord>;
  finalizeReceipt(
    record: AccountDeletionReceiptRecord,
    lease: LeaseFence,
  ): Promise<AccountDeletionReceiptRecord>;
}

export type AccountDeletionStepResult =
  | { kind: "advanced"; job: AccountDeletionJobRecord }
  | { kind: "waiting"; job: AccountDeletionJobRecord }
  | { kind: "retry_required"; job: AccountDeletionJobRecord }
  | { kind: "terminal"; job: AccountDeletionJobRecord };

export interface AccountDeletionStepInput {
  requestId: RequestId;
  store: AccountDeletionStore;
  gateway: AccountDeletionProviderGateway;
  lease: LeaseFence;
}

export interface InitiateAccountDeletionRequestInput {
  store: AccountDeletionStore;
  gateway: AccountDeletionProviderGateway;
  request: Omit<
    CreateDeletionRequestInput,
    "appleApplicable" | "initialProviderEffectIntent"
  >;
  appleEffectId: EffectId;
}

export async function initiateAccountDeletionRequest({
  store,
  gateway,
  request,
  appleEffectId,
}: InitiateAccountDeletionRequestInput): Promise<CreateDeletionRequestResult> {
  const persisted = await store.lookupRequestIdempotency({
    userId: request.userId,
    operationId: "request",
    idempotencyKeyHash: request.idempotencyKeyHash,
    requestFingerprintSha256: request.requestFingerprintSha256,
  });
  if (persisted.kind !== "miss") {
    return persisted;
  }
  const identity = await gateway.getAuthoritativeIdentity(request.userId);
  if (identity.userId !== request.userId) {
    throw new TypeError("authoritative identity subject mismatch");
  }
  return store.createRequestAndConsumeProof({
    ...request,
    appleApplicable: identity.appleApplicable,
    initialProviderEffectIntent: identity.appleApplicable
      ? { effectId: appleEffectId, kind: "apple_revoke" }
      : null,
  });
}

export async function runAccountDeletionStep({
  requestId,
  store,
  gateway,
  lease,
}: AccountDeletionStepInput): Promise<AccountDeletionStepResult> {
  const job = await store.loadRequest(requestId);
  if (!job) {
    throw new Error("account deletion request not found");
  }
  if (
    job.state === "blocked" ||
    job.state === "failed" ||
    job.state === "succeeded"
  ) {
    return { kind: "terminal", job };
  }
  if (job.state === "preflight") {
    return { kind: "waiting", job };
  }
  if (job.state === "retry_required") {
    if (!job.retryResumeState) {
      throw new Error("retry request has no durable resume state");
    }
    const resumed = await store.transition({
      requestId,
      expectedState: "retry_required",
      expectedGeneration: job.stateGeneration,
      nextState: job.retryResumeState,
      retryCode: null,
      retryResumeState: null,
      blockedCode: null,
      lease,
    });
    return { kind: "advanced", job: resumed };
  }
  if (job.state === "accepted") {
    if (job.appleApplicable) {
      const effects = await store.listEffects(requestId, "apple_revoke");
      const effect = effects[0];
      if (
        !effect ||
        effect.requestId !== requestId ||
        effect.replayMaterialCiphertext === null
      ) {
        throw new Error(
          "Apple-applicable request has no attached durable effect",
        );
      }
    }
    const nextState = job.appleApplicable ? "apple_revoking" : "preflight";
    const next = await store.transition({
      requestId,
      expectedState: "accepted",
      expectedGeneration: job.stateGeneration,
      nextState,
      retryCode: null,
      retryResumeState: null,
      blockedCode: null,
      lease,
    });
    return { kind: "advanced", job: next };
  }
  if (job.state === "apple_revoking") {
    const effects = await store.listEffects(requestId, "apple_revoke");
    const effect = effects[0];
    if (!effect) {
      throw new Error("Apple revocation has no durable effect intent");
    }
    if (effect.state === "committed") {
      const next = await store.transition({
        requestId,
        expectedState: "apple_revoking",
        expectedGeneration: job.stateGeneration,
        nextState: "apple_revoked",
        retryCode: null,
        retryResumeState: null,
        blockedCode: null,
        lease,
      });
      return { kind: "advanced", job: next };
    }
    if (
      effect.state === "retry_required" ||
      (effect.state === "indeterminate" &&
        effect.claimedJobGeneration === job.stateGeneration)
    ) {
      const next = await store.transition({
        requestId,
        expectedState: "apple_revoking",
        expectedGeneration: job.stateGeneration,
        nextState: "retry_required",
        retryCode: effect.lastReasonCode ?? "provider_outcome_unresolved",
        retryResumeState: "apple_revoking",
        blockedCode: null,
        lease,
      });
      return { kind: "retry_required", job: next };
    }
    const reconciliationOnly = effect.state === "indeterminate";
    const claimed = await store.claimEffect({
      effectId: effect.id,
      expectedObjectInventoryId: null,
      expectedJobGeneration: job.stateGeneration,
      lease,
    });
    if (!claimed) {
      return { kind: "waiting", job };
    }
    const lookup = await gateway.lookupAppleRevocationOutcome({
      replayKey: claimed.replayKey,
      checkpoint: claimed.checkpointCiphertext,
    });
    let outcome: AppleOutcome = lookup;
    if (lookup.kind === "unknown") {
      if (reconciliationOnly) {
        await store.commitEffect({
          effectId: claimed.id,
          expectedAttempt: claimed.attempt,
          expectedReplayKey: claimed.replayKey,
          checkpointCiphertext: claimed.checkpointCiphertext,
          providerReceiptCiphertext: null,
          outcome: "indeterminate",
          reasonCode:
            claimed.lastReasonCode ?? "provider_outcome_still_unknown",
          lease,
        });
        return { kind: "retry_required", job };
      }
      outcome = await gateway.resumeAppleRevocation({
        replayKey: claimed.replayKey,
        checkpoint: claimed.checkpointCiphertext,
        encryptedCredential: claimed.replayMaterialCiphertext as string,
      });
    }
    if (outcome.kind === "checkpoint") {
      await store.commitEffect({
        effectId: claimed.id,
        expectedAttempt: claimed.attempt,
        expectedReplayKey: claimed.replayKey,
        checkpointCiphertext: outcome.checkpoint,
        providerReceiptCiphertext: null,
        outcome: "checkpointed",
        reasonCode: null,
        lease,
      });
      return { kind: "advanced", job };
    }
    if (outcome.kind === "complete") {
      await store.commitEffect({
        effectId: claimed.id,
        expectedAttempt: claimed.attempt,
        expectedReplayKey: claimed.replayKey,
        checkpointCiphertext: outcome.checkpoint,
        providerReceiptCiphertext: outcome.providerReceipt,
        outcome: "committed",
        reasonCode: null,
        lease,
      });
      return { kind: "advanced", job };
    }
    if (outcome.kind === "indeterminate") {
      await store.commitEffect({
        effectId: claimed.id,
        expectedAttempt: claimed.attempt,
        expectedReplayKey: claimed.replayKey,
        checkpointCiphertext: claimed.checkpointCiphertext,
        providerReceiptCiphertext: null,
        outcome: "indeterminate",
        reasonCode: outcome.reasonCode,
        lease,
      });
      return { kind: "retry_required", job };
    }
  }
  return { kind: "waiting", job };
}

export { createAccountDeletionProviderGateway } from "./account-deletion-provider-gateway.ts";

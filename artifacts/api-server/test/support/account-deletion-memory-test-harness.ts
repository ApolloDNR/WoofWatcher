import { createHmac, randomUUID } from "node:crypto";
import type {
  AccountDeletionIdempotencyRecord,
  AccountDeletionJobRecord,
  AccountDeletionProviderActionRecord,
  AccountDeletionReceiptRecord,
  AccountDeletionState,
  AccountDeletionStore,
  AttachProviderEffectReplayMaterialAndAcceptInput,
  AttachProviderEffectReplayMaterialAndAcceptResult,
  ClaimProviderEffectInput,
  CommitProviderEffectInput,
  CompareAndSetProviderActionInput,
  CreateBlockedDeletionInput,
  CreateBlockedDeletionResult,
  CreateDeletionChallengeInput,
  CreateDeletionChallengeResult,
  CreateDeletionRequestInput,
  CreateDeletionRequestResult,
  CreateProviderEffectIntentInput,
  DeletionChallengeRecord,
  LeaseFence,
  LookupRequestIdempotencyInput,
  ProviderEffectKind,
  ProviderEffectRecord,
  RecordStateTransitionInput,
  StoredIdempotentResponse,
} from "../../src/lib/account-deletion.ts";
import { AccountDeletionConflictError } from "../../src/lib/account-deletion-store.ts";

// This process-local Map-backed harness is deliberately test-only. It is not
// durable and is unsafe for process restarts or multiple server replicas.

interface StoredChallenge {
  record: DeletionChallengeRecord;
  idempotency: AccountDeletionIdempotencyRecord;
}

interface StoredRequestResponse {
  fingerprint: string;
  keyHash: string;
  userId: string;
  jobId: string;
  response: StoredIdempotentResponse;
}

export interface InMemoryAccountDeletionTestHarnessConfiguration {
  effectReplayHmacSecret: string;
  now?: () => Date;
  beforeRequestTransaction?: () => Promise<void>;
  generateUuid?: () => string;
  initialRecords?: {
    jobs?: Array<{ job: AccountDeletionJobRecord; lease: LeaseFence }>;
    providerActions?: AccountDeletionProviderActionRecord[];
    providerEffects?: ProviderEffectRecord[];
  };
}

export interface InMemoryAccountDeletionTestHarness extends AccountDeletionStore {
  listProviderActionHistory(
    requestId: string,
  ): Promise<AccountDeletionProviderActionRecord[]>;
}

function cloneJob(job: AccountDeletionJobRecord): AccountDeletionJobRecord {
  return {
    ...job,
    deletionStartsAt: new Date(job.deletionStartsAt),
    recoveryExpiresAt: job.recoveryExpiresAt
      ? new Date(job.recoveryExpiresAt)
      : null,
    createdAt: new Date(job.createdAt),
    updatedAt: new Date(job.updatedAt),
  };
}

function cloneAction(
  action: AccountDeletionProviderActionRecord,
): AccountDeletionProviderActionRecord {
  return {
    ...action,
    expiresAt: new Date(action.expiresAt),
    consumedAt: action.consumedAt ? new Date(action.consumedAt) : null,
  };
}

function cloneEffect(effect: ProviderEffectRecord): ProviderEffectRecord {
  return {
    ...effect,
    committedAt: effect.committedAt ? new Date(effect.committedAt) : null,
  };
}

function cloneChallenge(
  challenge: DeletionChallengeRecord,
): DeletionChallengeRecord {
  return {
    ...challenge,
    expiresAt: new Date(challenge.expiresAt),
    consumedAt: challenge.consumedAt ? new Date(challenge.consumedAt) : null,
  };
}

function assertStoredResponse(
  value: unknown,
): asserts value is StoredIdempotentResponse {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as StoredIdempotentResponse).encryptedResponseBody !==
      "string" ||
    Buffer.byteLength(
      (value as StoredIdempotentResponse).encryptedResponseBody,
      "utf8",
    ) >
      1024 * 1024 ||
    !Number.isInteger((value as StoredIdempotentResponse).responseStatus) ||
    (value as StoredIdempotentResponse).responseStatus < 100 ||
    (value as StoredIdempotentResponse).responseStatus > 599 ||
    typeof (value as { then?: unknown }).then === "function"
  ) {
    throw new AccountDeletionConflictError("invalid synchronous response seal");
  }
}

const successors: Readonly<
  Record<AccountDeletionState, readonly AccountDeletionState[]>
> = {
  challenge_required: ["reauth_verified"],
  reauth_verified: ["provider_action_required", "accepted"],
  provider_action_required: ["reauth_verified"],
  accepted: ["apple_revoking", "preflight"],
  apple_revoking: ["apple_revoked", "retry_required"],
  apple_revoked: ["preflight"],
  preflight: ["cleanup_pending"],
  cleanup_pending: ["cleanup_running"],
  cleanup_running: ["object_inventory", "retry_required"],
  object_inventory: ["object_cleanup_pending", "retry_required"],
  object_cleanup_pending: ["object_cleanup_running", "object_cleanup_complete"],
  object_cleanup_running: ["object_cleanup_complete", "retry_required"],
  object_cleanup_complete: ["clerk_deleting"],
  clerk_deleting: ["receipt_finalizing", "retry_required"],
  receipt_finalizing: ["succeeded", "failed", "retry_required"],
  retry_required: [
    "apple_revoking",
    "cleanup_pending",
    "object_inventory",
    "object_cleanup_running",
    "clerk_deleting",
    "receipt_finalizing",
  ],
  blocked: [],
  failed: [],
  succeeded: [],
};

export function createInMemoryAccountDeletionTestHarness(
  configuration: InMemoryAccountDeletionTestHarnessConfiguration,
): InMemoryAccountDeletionTestHarness {
  if (
    typeof configuration.effectReplayHmacSecret !== "string" ||
    configuration.effectReplayHmacSecret.length < 16
  ) {
    throw new TypeError("effect replay HMAC secret must be configured");
  }
  const replaySecret = configuration.effectReplayHmacSecret;
  const now = configuration.now ?? (() => new Date());
  const generateUuid = configuration.generateUuid ?? randomUUID;
  const jobs = new Map<string, AccountDeletionJobRecord>();
  const leases = new Map<string, LeaseFence>();
  const actions = new Map<string, AccountDeletionProviderActionRecord>();
  const effects = new Map<string, ProviderEffectRecord>();
  const challenges = new Map<string, StoredChallenge>();
  const requestResponses = new Map<string, StoredRequestResponse>();
  const blockedResponses = new Map<string, StoredRequestResponse>();
  const proofClaims = new Map<
    string,
    {
      requestId: string;
      userId: string;
      exactEnvelopeSha256: string;
      consumedAt: Date;
    }
  >();
  const receipts = new Map<string, AccountDeletionReceiptRecord>();
  let sealing = false;

  for (const entry of configuration.initialRecords?.jobs ?? []) {
    jobs.set(entry.job.id, cloneJob(entry.job));
    leases.set(entry.job.id, {
      ...entry.lease,
      leaseUntil: new Date(entry.lease.leaseUntil),
    });
  }
  for (const action of configuration.initialRecords?.providerActions ?? []) {
    actions.set(action.id, cloneAction(action));
  }
  for (const effect of configuration.initialRecords?.providerEffects ?? []) {
    effects.set(effect.id, cloneEffect(effect));
  }

  function requestKey(userId: string, keyHash: string) {
    return `${userId}\0request\0${keyHash}`;
  }

  function blockedKey(userId: string, keyHash: string) {
    return `${userId}\0blocked\0${keyHash}`;
  }

  function assertLease(requestId: string, lease: LeaseFence) {
    const current = leases.get(requestId);
    const clock = now().getTime();
    if (
      !current ||
      current.workerId !== lease.workerId ||
      current.leaseToken !== lease.leaseToken ||
      current.leaseUntil.getTime() !== lease.leaseUntil.getTime() ||
      lease.leaseUntil.getTime() <= clock
    ) {
      throw new AccountDeletionConflictError("stale or changed lease fence");
    }
  }

  function seal(
    callback: () => StoredIdempotentResponse,
  ): StoredIdempotentResponse {
    if (sealing) {
      throw new AccountDeletionConflictError("response sealer re-entry");
    }
    sealing = true;
    try {
      const value = callback();
      assertStoredResponse(value);
      return { ...value };
    } finally {
      sealing = false;
    }
  }

  const store: InMemoryAccountDeletionTestHarness = {
    async createChallenge(input: CreateDeletionChallengeInput) {
      const key = `${input.userId}\0challenge\0${input.idempotencyKeyHash}`;
      const existing = [...challenges.values()].find(
        ({ idempotency }) =>
          `${idempotency.userId}\0${idempotency.operationId}\0${idempotency.idempotencyKeyHash}` ===
          key,
      );
      if (existing) {
        if (
          existing.idempotency.requestFingerprintSha256 !==
          input.requestFingerprintSha256
        ) {
          return { kind: "conflict" };
        }
        return {
          kind: "replay",
          record: cloneChallenge(existing.record),
          encryptedResponseBody: existing.idempotency.encryptedResponseBody,
          responseStatus: existing.idempotency.responseStatus,
        };
      }
      if (challenges.has(input.challengeId)) {
        return { kind: "conflict" };
      }
      const record: DeletionChallengeRecord = {
        id: input.challengeId,
        userId: input.userId,
        purpose: "account_deletion",
        rawProofBindingSha256: input.rawProofBindingSha256,
        clientHintEnvelopeCiphertext: input.clientHintEnvelopeCiphertext,
        expiresAt: new Date(input.expiresAt),
        consumedAt: null,
      };
      const idempotency: AccountDeletionIdempotencyRecord = {
        userId: input.userId,
        operationId: "challenge",
        idempotencyKeyHash: input.idempotencyKeyHash,
        requestFingerprintSha256: input.requestFingerprintSha256,
        requestId: null,
        encryptedResponseBody: input.encryptedResponseBody,
        responseStatus: input.responseStatus,
        createdAt: now(),
      };
      challenges.set(input.challengeId, { record, idempotency });
      return {
        kind: "created",
        record: cloneChallenge(record),
        encryptedResponseBody: input.encryptedResponseBody,
        responseStatus: input.responseStatus,
      };
    },

    async createRequestAndConsumeProof(
      input: CreateDeletionRequestInput,
    ): Promise<CreateDeletionRequestResult> {
      await configuration.beforeRequestTransaction?.();
      const key = requestKey(input.userId, input.idempotencyKeyHash);
      const replay = requestResponses.get(key);
      if (replay) {
        if (replay.fingerprint !== input.requestFingerprintSha256) {
          return { kind: "conflict" };
        }
        const job = jobs.get(replay.jobId);
        if (!job) {
          throw new AccountDeletionConflictError("idempotent job is missing");
        }
        return {
          kind: "replay",
          job: cloneJob(job),
          ...replay.response,
        };
      }
      const storedChallenge = challenges.get(input.challengeId);
      const challenge = storedChallenge?.record;
      if (
        input.appleApplicable !==
        (input.initialProviderEffectIntent !== null)
      ) {
        throw new AccountDeletionConflictError(
          "Apple applicability and initial effect intent disagree",
        );
      }
      if (
        !challenge ||
        challenge.userId !== input.userId ||
        challenge.rawProofBindingSha256 !== input.proofBindingSha256 ||
        challenge.consumedAt !== null ||
        challenge.expiresAt.getTime() <= now().getTime() ||
        input.proofExpiresAt.getTime() <= now().getTime() ||
        proofClaims.has(input.proofId) ||
        jobs.has(input.requestId)
      ) {
        return { kind: "proof_already_consumed" };
      }
      const timestamp = now();
      const job: AccountDeletionJobRecord = {
        id: input.requestId,
        userId: input.userId,
        state: "reauth_verified",
        stateGeneration: 0,
        deletionStartsAt: new Date(timestamp),
        appleApplicable: input.appleApplicable,
        activeProviderActionId: null,
        activeRecoveryGeneration: null,
        recoveryExpiresAt: null,
        recoveryHandoffGeneration: null,
        blockedCode: null,
        retryCode: null,
        retryResumeState: null,
        createdAt: new Date(timestamp),
        updatedAt: new Date(timestamp),
      };
      const response = seal(() =>
        input.buildStoredResponse({ job: cloneJob(job) }),
      );
      challenge.consumedAt = new Date(timestamp);
      proofClaims.set(input.proofId, {
        requestId: input.requestId,
        userId: input.userId,
        exactEnvelopeSha256: input.exactEnvelopeSha256,
        consumedAt: new Date(timestamp),
      });
      jobs.set(input.requestId, job);
      if (input.initialProviderEffectIntent) {
        const effectId = input.initialProviderEffectIntent.effectId;
        effects.set(effectId, {
          id: effectId,
          requestId: input.requestId,
          kind: "apple_revoke",
          objectInventoryId: null,
          replayKey: createHmac("sha256", replaySecret)
            .update(effectId)
            .digest("hex"),
          state: "intent",
          attempt: 0,
          claimedJobGeneration: null,
          replayMaterialCiphertext: null,
          checkpointCiphertext: null,
          providerReceiptCiphertext: null,
          lastReasonCode: null,
          committedAt: null,
        });
      }
      requestResponses.set(key, {
        fingerprint: input.requestFingerprintSha256,
        keyHash: input.idempotencyKeyHash,
        userId: input.userId,
        jobId: input.requestId,
        response,
      });
      return { kind: "created", job: cloneJob(job), ...response };
    },

    async lookupRequestIdempotency(input: LookupRequestIdempotencyInput) {
      const replay = requestResponses.get(
        requestKey(input.userId, input.idempotencyKeyHash),
      );
      if (!replay) {
        return { kind: "miss" };
      }
      if (replay.fingerprint !== input.requestFingerprintSha256) {
        return { kind: "conflict" };
      }
      const job = jobs.get(replay.jobId);
      if (!job) {
        throw new AccountDeletionConflictError("idempotent job is missing");
      }
      return {
        kind: "replay",
        job: cloneJob(job),
        ...replay.response,
      };
    },

    async createBlockedRequest(
      input: CreateBlockedDeletionInput,
    ): Promise<CreateBlockedDeletionResult> {
      const key = blockedKey(
        input.authenticatedSubjectUserId,
        input.idempotencyKeyHash,
      );
      const replay = blockedResponses.get(key);
      if (replay) {
        if (replay.fingerprint !== input.requestFingerprintSha256) {
          return { kind: "conflict" };
        }
        const job = jobs.get(replay.jobId);
        const receipt = receipts.get(replay.jobId);
        if (!job || !receipt) {
          throw new AccountDeletionConflictError(
            "blocked result is incomplete",
          );
        }
        return {
          kind: "replay",
          job: cloneJob(job),
          receipt: { ...receipt, finalizedAt: new Date(receipt.finalizedAt) },
          ...replay.response,
        };
      }
      const timestamp = now();
      const job: AccountDeletionJobRecord = {
        id: input.requestId,
        userId: input.authenticatedSubjectUserId,
        state: "blocked",
        stateGeneration: 0,
        deletionStartsAt: new Date(timestamp),
        appleApplicable: false,
        activeProviderActionId: null,
        activeRecoveryGeneration: null,
        recoveryExpiresAt: null,
        recoveryHandoffGeneration: null,
        blockedCode: input.code,
        retryCode: null,
        retryResumeState: null,
        createdAt: new Date(timestamp),
        updatedAt: new Date(timestamp),
      };
      const receipt: AccountDeletionReceiptRecord = {
        receiptId: generateUuid(),
        requestId: input.requestId,
        terminalState: "blocked",
        dataCleanupState: "not_started",
        appleState: "unresolved",
        clerkState: "present",
        objectState: "not_started",
        terminalCode: input.code,
        finalizedAt: new Date(timestamp),
      };
      const response = seal(() =>
        input.buildStoredResponse({
          job: cloneJob(job),
          receipt: { ...receipt, finalizedAt: new Date(receipt.finalizedAt) },
        }),
      );
      jobs.set(job.id, job);
      receipts.set(job.id, receipt);
      blockedResponses.set(key, {
        fingerprint: input.requestFingerprintSha256,
        keyHash: input.idempotencyKeyHash,
        userId: input.authenticatedSubjectUserId,
        jobId: input.requestId,
        response,
      });
      return {
        kind: "created",
        job: cloneJob(job),
        receipt: { ...receipt, finalizedAt: new Date(receipt.finalizedAt) },
        ...response,
      };
    },

    async loadRequest(requestId) {
      const job = jobs.get(requestId);
      return job ? cloneJob(job) : null;
    },

    async loadProviderAction(requestId) {
      const activeActionId = jobs.get(requestId)?.activeProviderActionId;
      const action = activeActionId ? actions.get(activeActionId) : null;
      return action ? cloneAction(action) : null;
    },

    async listProviderActionHistory(requestId) {
      return [...actions.values()]
        .filter((action) => action.requestId === requestId)
        .sort(
          (left, right) =>
            left.generation - right.generation ||
            left.id.localeCompare(right.id),
        )
        .map(cloneAction);
    },

    async compareAndSetProviderAction(input: CompareAndSetProviderActionInput) {
      assertLease(input.requestId, input.lease);
      const job = jobs.get(input.requestId);
      const current = job?.activeProviderActionId
        ? (actions.get(job.activeProviderActionId) ?? null)
        : null;
      const nextActionStateMatches =
        input.nextAction === null ||
        (input.nextAction.kind === "apple_reauthorization"
          ? job?.state === "reauth_verified"
          : job?.state === "challenge_required" ||
            job?.state === "provider_action_required");
      const nextActionGeneration =
        input.nextAction?.kind === "apple_reauthorization"
          ? input.expectedJobGeneration + 1
          : input.expectedJobGeneration;
      if (
        !job ||
        job.stateGeneration !== input.expectedJobGeneration ||
        (current?.id ?? null) !== input.expectedActionId ||
        (input.nextAction &&
          (input.nextAction.requestId !== input.requestId ||
            input.nextAction.generation !== nextActionGeneration ||
            !nextActionStateMatches))
      ) {
        throw new AccountDeletionConflictError();
      }
      if (input.nextAction) {
        const historical = actions.get(input.nextAction.id);
        if (
          historical &&
          JSON.stringify(historical) !== JSON.stringify(input.nextAction)
        ) {
          throw new AccountDeletionConflictError(
            "provider action history conflict",
          );
        }
        actions.set(input.nextAction.id, cloneAction(input.nextAction));
        job.activeProviderActionId = input.nextAction.id;
      } else {
        job.activeProviderActionId = null;
      }
      return input.nextAction ? cloneAction(input.nextAction) : null;
    },

    async loadEffect(effectId) {
      const effect = effects.get(effectId);
      return effect ? cloneEffect(effect) : null;
    },

    async listEffects(requestId: string, kind: ProviderEffectKind) {
      return [...effects.values()]
        .filter(
          (effect) => effect.requestId === requestId && effect.kind === kind,
        )
        .map(cloneEffect);
    },

    async createProviderEffectIntent(input: CreateProviderEffectIntentInput) {
      assertLease(input.requestId, input.lease);
      const job = jobs.get(input.requestId);
      if (!job || job.stateGeneration !== input.expectedJobGeneration) {
        throw new AccountDeletionConflictError();
      }
      const existing = effects.get(input.effectId);
      if (existing) {
        if (
          existing.requestId !== input.requestId ||
          existing.kind !== input.kind ||
          existing.objectInventoryId !== input.objectInventoryId ||
          existing.replayMaterialCiphertext !== input.replayMaterialCiphertext
        ) {
          throw new AccountDeletionConflictError("effect tuple mismatch");
        }
        return cloneEffect(existing);
      }
      const effect: ProviderEffectRecord = {
        id: input.effectId,
        requestId: input.requestId,
        kind: input.kind,
        objectInventoryId: input.objectInventoryId,
        replayKey: createHmac("sha256", replaySecret)
          .update(input.effectId)
          .digest("hex"),
        state: "intent",
        attempt: 0,
        claimedJobGeneration: null,
        replayMaterialCiphertext: input.replayMaterialCiphertext,
        checkpointCiphertext: null,
        providerReceiptCiphertext: null,
        lastReasonCode: null,
        committedAt: null,
      };
      effects.set(effect.id, effect);
      return cloneEffect(effect);
    },

    async attachProviderEffectReplayMaterialAndAccept(
      input: AttachProviderEffectReplayMaterialAndAcceptInput,
    ): Promise<AttachProviderEffectReplayMaterialAndAcceptResult> {
      const job = jobs.get(input.requestId);
      const effect = effects.get(input.effectId);
      const action = actions.get(input.expectedProviderActionId);
      if (
        job?.state === "accepted" &&
        job.stateGeneration === input.expectedJobGeneration + 1 &&
        job.activeProviderActionId === null &&
        action?.id === input.expectedProviderActionId &&
        action.requestId === input.requestId &&
        action.kind === "apple_reauthorization" &&
        action.generation === input.expectedJobGeneration &&
        action.consumedAt !== null &&
        effect?.requestId === input.requestId &&
        effect.kind === "apple_revoke" &&
        effect.replayMaterialCiphertext === input.replayMaterialCiphertext
      ) {
        return { job: cloneJob(job), effect: cloneEffect(effect) };
      }
      if (
        !job ||
        job.state !== "provider_action_required" ||
        job.stateGeneration !== input.expectedJobGeneration ||
        job.activeProviderActionId !== input.expectedProviderActionId ||
        !action ||
        action.id !== input.expectedProviderActionId ||
        action.kind !== "apple_reauthorization" ||
        action.generation !== input.expectedJobGeneration ||
        action.consumedAt !== null ||
        action.expiresAt.getTime() <= now().getTime() ||
        !effect ||
        effect.requestId !== input.requestId ||
        effect.kind !== "apple_revoke" ||
        (effect.replayMaterialCiphertext !== null &&
          effect.replayMaterialCiphertext !== input.replayMaterialCiphertext)
      ) {
        throw new AccountDeletionConflictError();
      }
      effect.replayMaterialCiphertext = input.replayMaterialCiphertext;
      action.consumedAt = now();
      job.activeProviderActionId = null;
      job.state = "accepted";
      job.stateGeneration += 1;
      job.updatedAt = now();
      return { job: cloneJob(job), effect: cloneEffect(effect) };
    },

    async claimEffect(input: ClaimProviderEffectInput) {
      const effect = effects.get(input.effectId);
      if (!effect) {
        return null;
      }
      assertLease(effect.requestId, input.lease);
      const job = jobs.get(effect.requestId);
      if (
        !job ||
        job.stateGeneration !== input.expectedJobGeneration ||
        effect.objectInventoryId !== input.expectedObjectInventoryId ||
        effect.replayMaterialCiphertext === null ||
        effect.state === "committed" ||
        (effect.state !== "intent" &&
          effect.state !== "claimed" &&
          effect.state !== "checkpointed" &&
          effect.state !== "retry_required" &&
          effect.state !== "indeterminate")
      ) {
        return null;
      }
      effect.state = "claimed";
      effect.attempt += 1;
      effect.claimedJobGeneration = input.expectedJobGeneration;
      return cloneEffect(effect);
    },

    async commitEffect(input: CommitProviderEffectInput) {
      const effect = effects.get(input.effectId);
      if (!effect) {
        throw new AccountDeletionConflictError();
      }
      assertLease(effect.requestId, input.lease);
      const job = jobs.get(effect.requestId);
      if (
        effect.state !== "claimed" ||
        effect.attempt !== input.expectedAttempt ||
        effect.replayKey !== input.expectedReplayKey ||
        effect.claimedJobGeneration === null ||
        job?.stateGeneration !== effect.claimedJobGeneration
      ) {
        throw new AccountDeletionConflictError();
      }
      effect.checkpointCiphertext = input.checkpointCiphertext;
      effect.providerReceiptCiphertext = input.providerReceiptCiphertext;
      effect.state = input.outcome;
      effect.lastReasonCode = input.reasonCode;
      if (input.outcome === "committed") {
        effect.committedAt = now();
      }
    },

    async transition(input: RecordStateTransitionInput) {
      assertLease(input.requestId, input.lease);
      const job = jobs.get(input.requestId);
      if (
        !job ||
        job.state !== input.expectedState ||
        job.stateGeneration !== input.expectedGeneration ||
        !successors[job.state].includes(input.nextState)
      ) {
        throw new AccountDeletionConflictError();
      }
      const taskOneExecutableStates = new Set<AccountDeletionState>([
        "challenge_required",
        "reauth_verified",
        "provider_action_required",
        "accepted",
        "apple_revoking",
        "apple_revoked",
        "retry_required",
      ]);
      if (
        !taskOneExecutableStates.has(job.state) ||
        (job.state === "retry_required" &&
          job.retryResumeState !== "apple_revoking")
      ) {
        throw new AccountDeletionConflictError(
          "post-preflight transitions require a later evidence-bound operation",
        );
      }
      if (
        job.state === "provider_action_required" &&
        input.nextState === "accepted"
      ) {
        throw new AccountDeletionConflictError(
          "Apple acceptance requires atomic replay-material attachment",
        );
      }
      const requiredActionKind =
        job.state === "challenge_required" &&
        input.nextState === "reauth_verified"
          ? "clerk_reauthentication"
          : job.state === "reauth_verified" &&
              input.nextState === "provider_action_required"
            ? "apple_reauthorization"
            : job.state === "provider_action_required" &&
                input.nextState === "reauth_verified"
              ? "clerk_reauthentication"
              : null;
      if (requiredActionKind !== null) {
        const action = job.activeProviderActionId
          ? actions.get(job.activeProviderActionId)
          : undefined;
        if (
          !action ||
          action.id !== job.activeProviderActionId ||
          action.kind !== requiredActionKind ||
          action.generation !==
            (requiredActionKind === "apple_reauthorization"
              ? job.stateGeneration + 1
              : job.stateGeneration) ||
          action.consumedAt !== null ||
          action.expiresAt.getTime() <= now().getTime() ||
          (requiredActionKind === "apple_reauthorization" &&
            !job.appleApplicable)
        ) {
          throw new AccountDeletionConflictError(
            "authorization transition has no exact durable provider action",
          );
        }
      }
      if (
        job.state === "reauth_verified" &&
        input.nextState === "accepted" &&
        job.appleApplicable
      ) {
        throw new AccountDeletionConflictError(
          "Apple-applicable request requires provider action",
        );
      }
      if (
        job.state === "accepted" &&
        ((job.appleApplicable && input.nextState !== "apple_revoking") ||
          (!job.appleApplicable && input.nextState !== "preflight"))
      ) {
        throw new AccountDeletionConflictError("Apple applicability mismatch");
      }
      if (job.state === "retry_required") {
        if (
          !job.retryResumeState ||
          input.nextState !== job.retryResumeState ||
          input.retryResumeState !== null ||
          input.retryCode !== null
        ) {
          throw new AccountDeletionConflictError("retry resume mismatch");
        }
      } else if (input.nextState === "retry_required") {
        const expectedResume =
          job.state === "cleanup_running" ? "cleanup_pending" : job.state;
        if (
          input.retryCode === null ||
          input.retryResumeState !== expectedResume
        ) {
          throw new AccountDeletionConflictError("invalid retry correlation");
        }
      } else if (input.retryCode !== null || input.retryResumeState !== null) {
        throw new AccountDeletionConflictError(
          "retry fields outside retry state",
        );
      }
      job.state = input.nextState;
      job.stateGeneration += 1;
      job.retryCode =
        input.nextState === "retry_required" ? input.retryCode : null;
      job.retryResumeState =
        input.nextState === "retry_required" ? input.retryResumeState : null;
      job.blockedCode = input.blockedCode;
      job.updatedAt = now();
      return cloneJob(job);
    },

    async finalizeReceipt(record, lease) {
      assertLease(record.requestId, lease);
      const existing = receipts.get(record.requestId);
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(record)) {
          throw new AccountDeletionConflictError("receipt is immutable");
        }
        return { ...existing, finalizedAt: new Date(existing.finalizedAt) };
      }
      receipts.set(record.requestId, {
        ...record,
        finalizedAt: new Date(record.finalizedAt),
      });
      return { ...record, finalizedAt: new Date(record.finalizedAt) };
    },
  };
  return new Proxy(store, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") {
        return value;
      }
      return (...args: unknown[]) => {
        if (sealing) {
          throw new AccountDeletionConflictError("response sealer re-entry");
        }
        return Reflect.apply(value, target, args);
      };
    },
  });
}

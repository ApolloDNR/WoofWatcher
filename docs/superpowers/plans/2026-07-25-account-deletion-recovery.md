# Account Deletion Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the lost, previously reviewed account-deletion system from
published commit `6172631d055baea09e84ad93016fdbe4cf9f6410`, then complete
the mobile flow without provider replay, account resurrection, cross-household
data loss, recovery-token privilege escalation, worker split-brain, or
generated-contract drift.

**Architecture:** A durable server state machine owns deletion intent and every
provider or object-store effect. PostgreSQL stores each transition,
idempotency replay, globally one-use reauthentication proof, provider outcome,
worker lease, cleanup fence, object inventory item, recovery-token digest,
tombstone, and terminal receipt. Separate authenticated and recovery-only
routers project allowlisted, state-discriminated DTOs generated from one
OpenAPI 3.1 document. Mobile stores a generation-tagged recovery bearer only in
SecureStore, confirms possession before Clerk deletion can begin, and keeps
provider deletion separate from device-only clearing.

**Tech Stack:** Node 24.14.0, pnpm 10.24.0, TypeScript 5.9, Express,
Clerk, Drizzle/Postgres/PGlite, OpenAPI 3.1, Orval 8.9.1, Zod, React
Query, Expo SDK 54, Expo Router 6, and expo-secure-store.

## Global Constraints

- Start from published commit
  `6172631d055baea09e84ad93016fdbe4cf9f6410`; do not rebuild unrelated
  WoofWatcher surfaces.
- Write each behavior test first, run it, and observe the intended failure
  before its production implementation.
- Keep `0009_account_deletion_protocol.sql` immutable after Task 1. Task 1
  corrections use additive `0010_account_deletion_reauth_proof_claims.sql`;
  Task 2 uses additive `0011_account_deletion_cleanup_locks.sql`.
- No provider or object-store mutation may occur before a durable effect intent
  with a stable replay key exists.
- Delete Clerk last. A crash after any provider response must reconcile through
  a provider-owned outcome lookup without repeating a committed or
  indeterminate upstream mutation.
- Apple applicability is server-derived from provider identity data. The
  client never sends `appleConnected`, platform, sign-in history, or another
  applicability flag.
- Treat Clerk reauthentication proof material as opaque bytes. Copy and hash
  the exact byte sequence; do not parse, canonicalize, reserialize, log, or
  return it.
- Reauthentication proof IDs are globally one-use across users, requests,
  jobs, retries, and concurrent transactions.
- Provider gateways capture adapter function references at construction,
  expose no adapter or setter, and remain unaffected if original adapter
  objects are mutated after construction.
- A household with only the deleting member is deleted. A retained household
  must already contain another owner. Do not silently promote a member.
- A missing durable user creates only a non-mutating durable blocked job,
  immutable redacted receipt, and encrypted idempotent response keyed to the
  authenticated subject. It creates no tombstone, recovery token, cleanup
  plan, provider/object effect, inventory, or provider call.
- Tombstone/account and household locks use one canonical sorted OLD+NEW key
  set. No ad hoc OLD-then-NEW acquisition is allowed.
- The normal application database role cannot invoke cleanup bypass. Cleanup
  bypass is available only through the worker's dedicated cleanup role and
  still validates the exact request, state, generation, and live lease in the
  database.
- A recovery bearer alone authorizes only the dedicated redacted recovery GET.
  It cannot start, authorize, retry, rotate, acknowledge handoff, mutate care,
  or access full owner status.
- Recovery access lasts exactly 30 days from first issue. Rotation does not
  extend expiry. Store only keyed token digests.
- Rotation is allowed only in `reauth_verified`,
  `provider_action_required`, `accepted`, `apple_revoking`, `apple_revoked`,
  `preflight`, `cleanup_pending`, `cleanup_running`, `object_inventory`,
  `object_cleanup_pending`, `object_cleanup_running`, or
  `object_cleanup_complete`. Rotation and the transition to `clerk_deleting`
  take the same canonical account/job locks and compare the same job
  generation, so exactly one commits and the loser must refetch.
- Clerk deletion is forbidden until the currently active recovery generation
  has been saved by the client and acknowledged through a Clerk-authenticated,
  token-possession handoff, and database time remains strictly before its fixed
  expiry. Expiry before Clerk deletion terminalizes truthfully without a Clerk
  call.
- OpenAPI is the public contract source of truth. Generated Zod and React files
  are never hand-edited.
- Strict Zod generation applies only to account-deletion operations. Existing
  open care-document schemas stay open.
- Status/action correlation is a true `oneOf` state-discriminated union in
  server types, OpenAPI, generated Zod, generated React types, the dedicated
  compile fixture, and the nested recovery DTO.
- Production composition fails closed when Clerk, Apple, recovery-pepper,
  response encryption, provider-action AEAD, distinct effect-replay and
  object-locator AEAD/HMAC secrets, the provider-declared client-hint envelope
  byte limit, object-inventory,
  object-deletion, cleanup-role, worker-lease, or shutdown primitives are
  absent.
- The runtime account-deletion protocol remains separate from
  `accountDeletionProof.ts`; launch-proof booleans never enable provider
  deletion.
- Do not edit mobile files before Task 4.
- Publish the exact reviewed tree to GitHub branch
  `recovery/account-deletion-v2` and verify local/remote tree equality before
  starting the next task.

## Shared terminology and time rules

- `IsoTimestamp` is an RFC 3339 UTC string at HTTP/generated boundaries.
  Internal store records use JavaScript `Date`; PostgreSQL decisions use
  database time, never API-process time.
- `Sha256Hex` is a lowercase 64-character SHA-256 hex digest.
- `RequestId`, `ChallengeId`, `EffectId`, and `ReceiptId` are UUID strings.
- `UserId` is the exact durable Clerk subject string.
- `RecoveryGeneration` and `EffectAttempt` are positive safe integers.
- A provider outcome is `unknown` only when the provider can prove no terminal
  outcome for the stable replay key. `indeterminate` means the provider cannot
  prove absence; the state machine records retry/manual reconciliation and
  must not issue a second mutation.

---

### Task 1: Durable lifecycle, replay-safe provider gateway, and immutable protocol history

**Files:**

- Create: `artifacts/api-server/src/lib/account-deletion.ts`
- Create: `artifacts/api-server/src/lib/account-deletion-provider-gateway.ts`
- Create: `artifacts/api-server/src/lib/account-deletion-store.ts`
- Create: `artifacts/api-server/test/accountDeletion.test.ts`
- Create: `artifacts/api-server/test/accountDeletionProviderGateway.test.ts`
- Create: `artifacts/api-server/test/accountDeletionMigration.test.ts`
- Create: `lib/db/src/schema/accountDeletions.ts`
- Modify: `lib/db/src/schema/index.ts`
- Create: `supabase/migrations/0009_account_deletion_protocol.sql`
- Create: `supabase/migrations/0010_account_deletion_reauth_proof_claims.sql`

**Core internal contracts:**

```ts
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
export type AccountDeletionIdempotencyOperationId =
  | "challenge"
  | "request"
  | "recovery_rotate";

export interface LeaseFence {
  workerId: string;
  leaseToken: string;
  leaseUntil: Date;
  leaseAttempt: number;
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

export type RetryResumeState =
  | "apple_revoking"
  | "cleanup_pending"
  | "object_inventory"
  | "object_cleanup_running"
  | "clerk_deleting"
  | "receipt_finalizing";

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
  userId: UserId;
  kind: ProviderEffectKind;
  objectInventoryId: string | null;
  replayKey: string;
  state: ProviderEffectState;
  attempt: number;
  replayMaterialCiphertext: string | null;
  checkpointCiphertext: string | null;
  providerReceiptCiphertext: string | null;
  lastReasonCode: string | null;
  committedAt: Date | null;
}

export interface AccountDeletionIdempotencyRecord {
  userId: UserId;
  operationId: AccountDeletionIdempotencyOperationId;
  idempotencyKeyHash: Sha256Hex;
  requestFingerprintSha256: Sha256Hex;
  challengeId: ChallengeId | null;
  requestId: RequestId | null;
  expectedRecoveryGeneration: RecoveryGeneration | null;
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
  userId: UserId;
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
  operationId: "challenge";
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
  operationId: "request";
  challengeId: ChallengeId;
  proofId: string;
  proofBindingSha256: Sha256Hex;
  proofExpiresAt: Date;
  exactEnvelopeSha256: Sha256Hex;
  appleApplicable: boolean;
  idempotencyKeyHash: Sha256Hex;
  requestFingerprintSha256: Sha256Hex;
  initialProviderEffectIntent:
    | {
        effectId: EffectId;
        kind: "apple_revoke";
      }
    | null;
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

export interface CreateBlockedDeletionInput {
  requestId: RequestId;
  authenticatedSubjectUserId: UserId;
  operationId: "request";
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
  requestId: RequestId;
  expectedObjectInventoryId: string | null;
  expectedJobGeneration: number;
  lease: LeaseFence;
}

export interface CreateProviderEffectIntentInput {
  effectId: EffectId;
  requestId: RequestId;
  kind: "apple_revoke";
  objectInventoryId: null;
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
  requestId: RequestId;
  expectedAttempt: number;
  expectedReplayKey: string;
  checkpointCiphertext: string | null;
  providerReceiptCiphertext: string | null;
  outcome:
    | "checkpointed"
    | "committed"
    | "retry_required"
    | "indeterminate";
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
  loadEffect(
    requestId: RequestId,
    effectId: EffectId,
  ): Promise<ProviderEffectRecord | null>;
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
  transition(input: RecordStateTransitionInput): Promise<AccountDeletionJobRecord>;
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

export declare function createAccountDeletionProviderGateway(
  adapters: AccountDeletionProviderAdapters,
  configuration: AccountDeletionProviderGatewayConfiguration,
): AccountDeletionProviderGateway;

export declare function runAccountDeletionStep(
  input: AccountDeletionStepInput,
): Promise<AccountDeletionStepResult>;
```

`createAccountDeletionProviderGateway(adapters, configuration)` returns a
frozen null-prototype object. Each method closes over a bound provider function
and a copied immutable configuration value. `runAccountDeletionStep({
requestId, store, gateway, lease })` performs at most one database-claimed
transition or effect and returns `AccountDeletionStepResult`.

**Provider replay contract:**

| Effect | Durable evidence before mutation | Reconciliation before any retry | Allowed next mutation |
|---|---|---|---|
| Apple revoke | `apple_revoke` effect intent, stable replay key, encrypted credential, nullable checkpoint | `lookupAppleRevocationOutcome(replayKey, checkpoint)` | Only when lookup is `unknown`; pass the same replay key and latest committed checkpoint |
| Clerk delete | `clerk_delete` effect intent, stable replay key, exact user ID | `lookupClerkDeletionOutcome(replayKey, userId)` | Only when lookup is `unknown`; `indeterminate` is fail-closed and never repeats deletion |

Every provider response is committed before another transition. A crash after
the response but before the local commit is handled by lookup. A lookup result
of `checkpoint`, `complete`, `deleted`, or `already_absent` is committed
locally without a second mutation. No adapter may return an untraceable
success.

**Binding Task 1 contract clarifications:**

- `rawProofBinding` exists only on the trusted provider-adapter result types.
  The sealed gateway rejects anything other than a non-empty `Uint8Array`,
  copies the returned bytes, hashes that exact copy, clears its temporary copy
  on a best-effort basis, and returns only
  `proofBindingSha256`. Neither gateway-safe result type, store input, log,
  serialized response, nor durable row contains the raw bytes. The gateway
  also validates the adapter-returned subject, challenge, purpose, and expiry
  before returning its digest-only verification.
- `clientHintEnvelope` is an opaque provider-owned string. The gateway validates
  the primitive type, rejects a zero-byte UTF-8 encoding, and rejects a UTF-8
  byte length above the required positive-safe-integer
  `maxClientHintEnvelopeBytes` configuration. It does not trim, normalize,
  parse, reserialize, or assume base64/JWT syntax. Task 1 fixtures choose an
  explicit test maximum; production has no default and fails closed until the
  provider integration supplies the maximum.
- Every store implementation captures the same environment-scoped
  effect-replay HMAC secret at construction. The configured secret is shared
  by every replica and worker in that environment, remains stable across
  process restarts and deployments, is distinct from recovery peppers and
  encryption keys, and is never generated per store instance. Secret rotation
  is out of scope until a versioned replay-key protocol exists.
  `createProviderEffectIntent` accepts an effect ID but never a replay key; the
  store derives the stable key from the effect ID plus its captured secret.
  The method is idempotent only for the identical
  effect-ID/request/kind/object tuple and conflicts on any mismatch. Replay
  key, kind, request, object inventory ID, and non-null replay material are
  immutable. `claimEffect` rejects a provider effect whose required replay
  material is absent.
- `attachProviderEffectReplayMaterialAndAccept` is the sole pre-worker Apple
  credential bind. In one locked transaction it validates the exact request in
  `provider_action_required`, expected job generation, active unconsumed Apple
  action ID/generation, and matching existing Apple effect; performs the
  effect replay-material compare-and-set; consumes and clears that action; and
  transitions the job to `accepted` with one generation increment. Only
  `null -> supplied ciphertext` is a new replay-material write. Replaying the
  identical ciphertext against the same now-consumed action and resulting
  accepted generation returns the same job/effect without another transition;
  a different non-null ciphertext, wrong action/effect/request, stale
  generation outside that exact committed replay, wrong source state, or
  non-Apple effect conflicts. It never accepts or changes a replay key, and no
  crash-visible state can contain a consumed Apple action without the accepted
  job transition.
- `createRequestAndConsumeProof` is one transaction. It resolves idempotency
  first; locks the durable challenge; checks its subject, challenge ID, binding
  digest, database-time expiry, and `consumedAt IS NULL`; sets its
  `consumedAt`; claims the globally unique proof ID; creates the job with
  database `transaction_timestamp()` as immutable
  `deletionStartsAt`; inserts the initial Apple intent when and only when
  authoritative identity says Apple applies; calls `buildStoredResponse` only
  after database-generated values exist; stores that exact encrypted body and
  status; and commits. An exact idempotency replay returns before challenge or
  proof consumption. The trusted response sealer is synchronous,
  deterministic, bounded, and side-effect-free: it may serialize/encrypt the
  response but may not return a thenable, call a provider or object store,
  re-enter the store, or open another database transaction. Every required
  database-generated value is passed in its context. It is never called for
  replay or conflict. Created and replay results return the same stored
  response bytes/status. Task 2 may extend the sealer context with recovery
  credential data created inside the same transaction.
- `createChallenge` and `createBlockedRequest` likewise return the exact stored
  response on both create and replay. For blocked creation, the synchronous
  `buildStoredResponse({ job, receipt })` runs only after both database-time
  rows exist in the same transaction. Store/database time, not a
  caller-supplied date, assigns `deletionStartsAt` and receipt finalization
  time. SQL enforces immutability.
- `retryResumeState` is non-null exactly when job state is `retry_required`.
  A transition into retry records one of the enumerated resume states in the
  same compare-and-set. A retry may transition only back to that exact stored
  state, where provider phases perform outcome lookup before any mutation.
  Manual conversion of an indeterminate provider outcome into terminal failure
  requires a future explicit authority/audit contract and is not implemented
  by Task 1.
- The leased worker, not a Clerk session or recovery bearer, autonomously
  performs internal `retry_required -> retryResumeState` transitions. This is
  required for `clerk_deleting` and `receipt_finalizing`, where Clerk may
  already be absent. The later Clerk-authenticated retry endpoint may only
  nudge eligible pre-Clerk work; it is not required for post-Clerk recovery.

The legal state adjacency is:

| From | Legal successor(s) | Binding guard |
|---|---|---|
| `challenge_required` | `reauth_verified` | Exact current Clerk action and generation; matching, unexpired, globally one-use proof |
| `reauth_verified` | `provider_action_required`, `accepted` | Persist an Apple action before the first edge; use the second edge only when authoritative identity says Apple is not applicable |
| `provider_action_required` | `reauth_verified`, `accepted` | Exact unconsumed action ID/kind/generation; Clerk action returns to reauthentication, while the Apple edge occurs atomically inside `attachProviderEffectReplayMaterialAndAccept` |
| `accepted` | `apple_revoking`, `preflight` | Apple-applicable jobs take only the first edge; non-applicable jobs only the second |
| `apple_revoking` | `apple_revoked`, `retry_required` | Committed Apple completion, or a durable retry/indeterminate outcome resuming to `apple_revoking` |
| `apple_revoked` | `preflight` | Committed Apple completion |
| `preflight` | `cleanup_pending` | Valid cleanup plan and fence prerequisites |
| `cleanup_pending` | `cleanup_running` | Fenced cleanup claim |
| `cleanup_running` | `object_inventory`, `retry_required` | Atomic database cleanup completion, or retry resuming to `cleanup_pending` |
| `object_inventory` | `object_cleanup_pending`, `retry_required` | Complete committed snapshot, or retry resuming to `object_inventory` |
| `object_cleanup_pending` | `object_cleanup_running`, `object_cleanup_complete` | All object intents committed; direct completion only for an empty inventory |
| `object_cleanup_running` | `object_cleanup_complete`, `retry_required` | All effects committed and counts reconcile, or retry resuming to `object_cleanup_running` |
| `object_cleanup_complete` | `clerk_deleting`, `failed` | The Clerk edge requires exact cleanup parity, confirmed current handoff, and database time before recovery expiry; the failed edge requires database time at/after expiry and atomically derives the immutable `recovery_expired_before_clerk_deletion` receipt with no Clerk intent/call |
| `clerk_deleting` | `receipt_finalizing`, `retry_required` | Committed deleted/already-absent Clerk outcome, or retry resuming to `clerk_deleting` |
| `receipt_finalizing` | `succeeded`, `failed`, `retry_required` | Immutable receipt committed atomically, or retry resuming to `receipt_finalizing` |
| `retry_required` | the exact stored `retryResumeState` | No caller-selected resume state; provider phases look up outcome before mutation |
| `blocked`, `failed`, `succeeded` | none | Terminal immutability |

Blocked initiation creates `blocked` directly rather than using a generic
transition. `provider_unavailable` remains a reserved public terminal code
until a later task defines its creation authority. Task 1 defines and tests the
complete structural table but executes only the reauthentication/Apple path
through `preflight`. Cleanup/object transitions stay unreachable until Task 2
persists their evidence. Clerk gateway replay is unit-tested in Task 1, but
`object_cleanup_complete -> clerk_deleting` stays unreachable until Task 2
provides cleanup, object, and recovery-handoff evidence; the leased worker
executes Clerk deletion/finalization in Task 3.

- [ ] **Step 1: Write RED state-machine, proof, and idempotency tests**

Create `accountDeletion.test.ts` before production modules. Test the complete
state transition table, illegal transitions, at-most-one transition per call,
Apple-before-cleanup, Clerk-last, no detached work, terminal immutability, and
server-derived Apple applicability. Test that `deletionStartsAt` is written
once and never computed during projection; each authorization state must load
an exact durable provider-action record, and missing, stale-generation, or
consumed action records fail closed rather than producing invented fields.
The transition-table fixture must include
`object_cleanup_complete -> failed` only for the exact database-expiry receipt
branch and reject that edge before expiry or without its derived receipt.

Test proof and request initiation directly:

- exact envelope byte copy remains stable when the caller mutates its input;
- the verified subject and challenge must match the durable user/challenge;
- expired proofs fail;
- a challenge is consumed in the same transaction as its first successful
  request, and another proof ID cannot reuse that challenge;
- two users and two requests concurrently claiming the same `proofId` yield
  exactly one committed claim;
- the same idempotency key plus the same canonical fingerprint returns the
  byte-exact encrypted stored response;
- the same key plus a different fingerprint returns conflict;
- `challenge` and `request` persist their exact operation literals and the
  same raw key cannot replay or substitute one operation's response as the
  other;
- a retry after response persistence does not consume a second proof or
  challenge;
- synchronous response sealers receive database-generated values, while a
  returned thenable or store re-entry fails closed before commit;
- Apple replay material attachment, action consumption/clearing, and the
  transition to `accepted` commit atomically through exact
  action/effect/generation fencing; identical replay is idempotent and
  different ciphertext conflicts.

- [ ] **Step 2: Run state/proof/idempotency tests and verify RED**

```bash
node --experimental-strip-types --test \
  artifacts/api-server/test/accountDeletion.test.ts
```

Expected: FAIL because the store and state-machine modules do not exist.

- [ ] **Step 3: Write RED provider-gateway and crash-replay tests**

Define all provider fixtures locally in
`accountDeletionProviderGateway.test.ts`. Cover:

- byte-exact Clerk binding and raw-byte non-serialization;
- input-buffer mutation after verification begins;
- subject, challenge, expiry, and purpose mismatch;
- copied adapter references and deleted/replaced adapter properties;
- frozen null-prototype gateway shape;
- Apple checkpoint lookup and exact replay-key reuse;
- Apple completion lookup after crash-before-local-commit;
- Clerk deleted/already-absent lookup after crash-before-local-commit;
- provider `indeterminate` preventing a second mutation;
- a hostile adapter attempting to change identity applicability.

- [ ] **Step 4: Run provider tests and verify RED**

```bash
node --experimental-strip-types --test \
  artifacts/api-server/test/accountDeletionProviderGateway.test.ts
```

Expected: FAIL because the provider gateway does not exist.

- [ ] **Step 5: Write RED migration and upgrade tests**

The test applies `0009`, seeds its legacy proof-claim source, applies `0010`,
and reruns `0010`.

`0009` owns this exact legacy source:

```sql
CREATE TABLE account_deletion_reauth_proof_claims_legacy (
  request_id uuid NOT NULL
    REFERENCES account_deletion_jobs(id) ON DELETE RESTRICT,
  proof_id text NOT NULL,
  user_id text NOT NULL,
  envelope_sha256 text NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, proof_id)
);
```

The test must prove `0010` fails atomically, leaving the new destination empty,
for any duplicate `proof_id`, orphaned request, request/user mismatch, malformed
SHA-256 digest, or blank proof/user ID in the legacy source. A valid backfill
must preserve every source field exactly, disable future legacy writes, and
make `proof_id` the destination primary key. Also assert no deletion job
cascades from `users`, no raw recovery bearer column exists, RLS is enabled on
every deletion table, and `anon`/`authenticated` have zero privileges.

- [ ] **Step 6: Run migration tests and verify RED**

```bash
node --experimental-strip-types --test \
  artifacts/api-server/test/accountDeletionMigration.test.ts
```

Expected: FAIL because migrations `0009` and `0010` do not exist.

- [ ] **Step 7: Implement the sealed gateway, durable state machine, and store**

Implement only after Steps 1–6 have produced the intended failures.

- Copy opaque bytes before awaiting, digest with Node `crypto`, and never expose
  `rawProofBinding`.
- Validate provider-owned challenge envelope length and type independently from
  the server-only raw binding.
- Derive stable replay keys from effect IDs plus a server secret, not from
  caller input.
- Insert effect intent and encrypted replay material before the provider call.
- Lookup every claimed effect before considering a provider mutation.
- Commit checkpoint/outcome through compare-and-set on effect ID, attempt, and
  replay key.
- Persist `deletionStartsAt` and each provider action before exposing the
  corresponding state. Load actions by request and replace/clear them only
  through action-ID plus job-generation compare-and-set.
- Pass the same `LeaseFence` through effect claim, provider-action CAS, effect
  commit, state transition, and receipt finalization. Every mutation rejects a
  changed owner/token or expired lease; no worker-scoped method accepts only a
  request ID.
- Record `indeterminate` as a durable non-mutating stop.
- Keep Clerk deletion unreachable until later Tasks provide cleanup, object,
  and recovery-handoff evidence.

- [ ] **Step 8: Implement `0009`, fail-closed additive `0010`, and Drizzle schema**

`0009` creates server-only jobs (including immutable
`deletion_starts_at` and constrained nullable `retry_resume_state`),
provider-action records, effects (including nullable encrypted replay material),
legacy proof claims, idempotency records, recovery-token digest rows, worker
lease fields, and immutable receipts. Provider actions store an action ID,
request ID, kind, generation, encrypted client-safe payload, expiry, and
consumed timestamp. It stores request/user identity without cascading from
`users`,
enforces unique `(user_id, operation_id, idempotency_key_hash)`, unique replay
keys, and encrypted replayable bodies for bearer-issuing responses.

`0010` runs in one transaction, takes an exclusive lock on the legacy source,
and validates the entire source before creating usable destination data. It
creates:

```sql
CREATE TABLE account_deletion_reauth_proof_claims (
  proof_id text PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE
    REFERENCES account_deletion_jobs(id) ON DELETE RESTRICT,
  user_id text NOT NULL,
  envelope_sha256 text NOT NULL,
  consumed_at timestamptz NOT NULL
);
```

Use a staging query plus explicit `DO` assertions to reject duplicates,
orphans, user mismatches, blanks, malformed digests, or count mismatches before
copy. Verify source and destination counts and an ordered content digest after
copy. Revoke all writes to the legacy table and add a rejecting legacy-write
trigger. Enable RLS and revoke client roles on every new table. After Task 1
review starts, never alter `0009`; all corrections remain in `0010`.

- [ ] **Step 9: Verify Task 1**

```bash
node --experimental-strip-types --test \
  artifacts/api-server/test/accountDeletion.test.ts \
  artifacts/api-server/test/accountDeletionProviderGateway.test.ts \
  artifacts/api-server/test/accountDeletionMigration.test.ts
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm run typecheck:libs
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm \
  --filter @workspace/api-server run typecheck
git diff --check
```

- [ ] **Step 10: Commit, review, and publish**

Commit production files and tests as one coherent Task 1 range. Run a fresh
read-only task reviewer and all required fix/re-review rounds. Re-run Step 9 on
the approved commit. Publish that exact tree to
`recovery/account-deletion-v2`, fetch it, and compare local/remote tree hashes
before Task 2 starts.

---

### Task 2: Cleanup policy, write fencing, recovery access, object effects, and PostgreSQL store

**Files:**

- Create: `artifacts/api-server/src/lib/account-deletion-cleanup.ts`
- Create: `artifacts/api-server/src/lib/account-deletion-object-gateway.ts`
- Create: `artifacts/api-server/src/lib/account-deletion-postgres-store.ts`
- Create: `artifacts/api-server/src/lib/account-deletion-recovery.ts`
- Modify: `artifacts/api-server/src/lib/account-deletion.ts`
- Modify: `artifacts/api-server/src/lib/account-deletion-store.ts`
- Modify: `artifacts/api-server/src/lib/household.ts`
- Modify: `lib/db/src/schema/accountDeletions.ts`
- Create: `supabase/migrations/0011_account_deletion_cleanup_locks.sql`
- Create: `artifacts/api-server/test/accountDeletionCleanup.test.ts`
- Create: `artifacts/api-server/test/accountDeletionObjectGateway.test.ts`
- Create: `artifacts/api-server/test/accountDeletionPostgres.test.ts`
- Create: `artifacts/api-server/test/accountDeletionRecovery.test.ts`
- Create: `artifacts/api-server/test/accountDeletionWriteGuard.test.ts`
- Modify: `artifacts/api-server/test/accountDeletion.test.ts`
- Modify: `artifacts/api-server/test/accountDeletionMigration.test.ts`
- Modify: `artifacts/api-server/test/support/account-deletion-memory-test-harness.ts`
- Modify: `.github/workflows/verify.yml`

**Cleanup, recovery, and object contracts:**

```ts
export type HouseholdDeletionAction =
  | "delete_household"
  | "retain_redact_detach";

export interface AccountDeletionCleanupPlan {
  requestId: RequestId;
  userId: UserId;
  generation: number;
  planDigestSha256: Sha256Hex;
  households: Array<{
    householdId: string;
    action: HouseholdDeletionAction;
    memberCount: number;
    otherOwnerCount: number;
  }>;
}

export interface CleanupFence extends LeaseFence {
  requestId: RequestId;
  expectedState: "cleanup_running";
  generation: number;
}

export type RecoveryAccessRecord =
  | { state: "unavailable" }
  | {
      state: "active";
      generation: RecoveryGeneration;
      tokenDigest: Sha256Hex;
      issuedAt: Date;
      expiresAt: Date;
      handoffConfirmedAt: Date | null;
    }
  | {
      state: "expired";
      generation: RecoveryGeneration;
      expiredAt: Date;
    };

export interface IssuedRecoveryCredential {
  requestId: RequestId;
  generation: RecoveryGeneration;
  bearer: string;
  issuedAt: Date;
  expiresAt: Date;
}

export interface AccountDeletionObjectRef {
  inventoryId: string;
  snapshotId: string;
  requestId: RequestId;
  userId: UserId;
  cleanupGeneration: number;
  planDigestSha256: Sha256Hex;
  storageProvider: string;
  bucket: string;
  objectKeyCiphertext: string;
  objectVersionCiphertext: string | null;
  locatorDigestSha256: Sha256Hex;
}

export interface DiscoveredAccountObject {
  storageProvider: string;
  bucket: string;
  objectKey: string;
  objectVersion: string | null;
}

export interface ObjectInventorySnapshot {
  requestId: RequestId;
  snapshotId: string;
  complete: true;
  objects: DiscoveredAccountObject[];
  capturedAt: Date;
}

export type ObjectDeletionOutcome =
  | { kind: "unknown" }
  | { kind: "indeterminate"; reasonCode: string }
  | {
      kind: "deleted" | "already_absent";
      providerReceipt: string;
      completedAt: Date;
    };

export interface AccountDeletionObjectAdapters {
  inventoryAccountObjects(input: {
    requestId: RequestId;
    userId: UserId;
  }): Promise<ObjectInventorySnapshot>;
  lookupObjectDeletionOutcome(input: {
    replayKey: string;
    object: DiscoveredAccountObject;
  }): Promise<ObjectDeletionOutcome>;
  deleteObject(input: {
    replayKey: string;
    object: DiscoveredAccountObject;
  }): Promise<
    Extract<ObjectDeletionOutcome, { kind: "deleted" | "already_absent" }>
  >;
}

export interface AccountDeletionObjectGateway {
  inventoryAccountObjects(input: {
    requestId: RequestId;
    userId: UserId;
  }): Promise<CompleteObjectInventorySnapshot>;
  lookupObjectDeletionOutcome(input: {
    replayKey: string;
    object: AccountDeletionObjectRef;
  }): Promise<ObjectDeletionOutcome>;
  deleteObject(input: {
    replayKey: string;
    object: AccountDeletionObjectRef;
  }): Promise<
    Extract<ObjectDeletionOutcome, { kind: "deleted" | "already_absent" }>
  >;
}

export interface CleanupCompletionReceipt {
  cleanupReceiptId: string;
  requestId: RequestId;
  userId: UserId;
  cleanupGeneration: number;
  planDigestSha256: Sha256Hex;
  databaseRowsComplete: true;
  databaseCleanupEvidenceId: string;
  objectInventorySnapshotId: string;
  objectManifestDigestSha256: Sha256Hex;
  objectCount: number;
  objectDeleteCount: number;
  objectAlreadyAbsentCount: number;
  completedAt: Date;
}

export declare function createAccountDeletionObjectGateway(
  adapters: AccountDeletionObjectAdapters,
  locatorCodec: AccountDeletionObjectLocatorCodec,
): AccountDeletionObjectGateway;

export interface CreateObjectEffectIntentsInput {
  requestId: RequestId;
  snapshotId: string;
  expectedJobGeneration: number;
  inventoryIds: string[];
  lease: LeaseFence;
}

export interface ClaimObjectEffectInput {
  effectId: EffectId;
  requestId: RequestId;
  inventoryId: string;
  expectedJobGeneration: number;
  lease: LeaseFence;
}
```

#### Task 2 binding clarification

The following contracts are normative for Task 2. They replace any looser
wording later in this task and preserve the Task 1 public names unless an
explicit extension is shown here.

**Start and idempotency boundary**

Accepted and blocked starts use the same idempotency operation,
`operationId: "request"`, and the same unique key
`(user_id, operation_id, idempotency_key_hash)`. There is no separate blocked
operation. `lookupRequestIdempotency` remains the first store call and returns
the encrypted byte-exact response for both accepted and blocked requests
before a provider call.

`recovery_rotate` is the sole durable operation ID for
`rotateAccountDeletionRecovery`
(`POST /account-deletions/{requestId}/recovery/rotate`). It is not an alias for
`request`, and route code passes the literal rather than deriving arbitrary
operation text from the URL or caller input.

`0011` additively adds nullable `challenge_id` and
`expected_recovery_generation integer` to
`account_deletion_idempotency`, with `ON DELETE RESTRICT` foreign-key binding.
The challenge and job tables expose exact unique `(id, user_id)` keys, and the
recovery-token table exposes targetable unique
`(request_id, user_id, generation)`. The idempotency table uses
`ON DELETE RESTRICT` composite foreign keys
`(challenge_id, user_id) -> account_deletion_challenges(id, user_id)` and
`(request_id, user_id) -> account_deletion_jobs(id, user_id)`, plus
`(request_id, user_id, expected_recovery_generation) ->
account_deletion_recovery_token_digests(request_id, user_id, generation)`.
A validated check allows only these three shapes:

- `operation_id = 'challenge'`, `challenge_id IS NOT NULL`, and
  both request/generation columns null;
- `operation_id = 'request'`, `request_id IS NOT NULL`, and both
  challenge/generation columns null; or
- `operation_id = 'recovery_rotate'`, `request_id IS NOT NULL`,
  `challenge_id IS NULL`, and `expected_recovery_generation > 0`.

A partial unique index permits only one idempotency row for a non-null
`challenge_id`; a second permits only one `request` row per non-null
`request_id`; and a third permits only one `recovery_rotate` row per
`(request_id, expected_recovery_generation)`. Challenge creation writes the
challenge and that exact correlation in one transaction. Challenge replay follows the stored
`challenge_id` foreign key and loads that original row; it never joins by
timestamp/user alone and never returns a newly generated candidate challenge.
A missing row or any request/user/challenge mismatch conflicts without calling
the provider. Because `0009` has no safe way to infer this relation, `0011`'s
read-only preflight rejects any pre-existing `operation_id = 'challenge'`
idempotency row before mutation rather than guessing a backfill. The intended
prelaunch upgrade therefore requires zero such legacy rows; a nonzero count is
an operator stop requiring a separate, audited data-mapping migration.

The idempotency collision domain is exactly
`(user_id, operation_id, idempotency_key_hash)`. A fingerprint is SHA-256 over
the ASCII protocol tag `WWAD-IDEMP-v1` followed by four-byte big-endian
length-prefixed UTF-8 fields; positive integers use canonical base-10 ASCII
without a sign or leading zero. The operation-specific fields are:

- `challenge`: operation ID, authenticated user ID, and
  `account_deletion` purpose; the newly generated challenge ID is excluded;
- `request`: operation ID, authenticated user ID, durable challenge ID, and
  lowercase SHA-256 of the exact decoded reauthentication-envelope bytes; the
  newly generated request ID is excluded;
- `recovery_rotate`: operation ID, authenticated user ID, durable request ID,
  and expected recovery generation.

Each store path recomputes this digest from its typed fields and
constant-time-compares it with `requestFingerprintSha256`; a caller-supplied
digest is never authoritative.

The operation ID is therefore present in both the uniqueness domain and the
fingerprint. Reusing a raw idempotency key across different operations creates
separate rows, never a cross-operation replay. Reusing it within one operation
with a different request, challenge, envelope digest, or generation conflicts.
For rotation, exact replay additionally requires the stored request/user tuple
and `expected_recovery_generation`; a different key for an already occupied
request/generation slot also conflicts. Every conflict returns before bearer
issuance, response sealing, proof/challenge consumption, or state mutation.
Before decrypting or returning stored rotation bytes, replay joins the
idempotency row through that three-column foreign-key tuple to the immutable
historical source recovery-token row and validates exactly one matching
request, user, and generation. A missing or substituted historical tuple is an
invariant failure, never a replay.

```ts
export interface LookupRequestIdempotencyInput {
  authenticatedSubjectUserId: UserId;
  operationId: "request";
  idempotencyKeyHash: Sha256Hex;
  requestFingerprintSha256: Sha256Hex;
}

export type LookupRequestIdempotencyResult =
  | { kind: "miss" }
  | {
      kind: "replay";
      job: AccountDeletionJobRecord;
      encryptedResponseBody: string;
      responseStatus: number;
    }
  | { kind: "conflict" };

export interface StartDeletionPreflightInput {
  requestId: RequestId;
  authenticatedSubjectUserId: UserId;
  operationId: "request";
  idempotencyKeyHash: Sha256Hex;
  requestFingerprintSha256: Sha256Hex;
  buildBlockedStoredResponse(created: {
    job: AccountDeletionJobRecord;
    receipt: AccountDeletionReceiptRecord;
  }): StoredIdempotentResponse;
}

export type StartDeletionPreflightResult =
  | { kind: "ready" }
  | {
      kind: "blocked";
      job: AccountDeletionJobRecord;
      receipt: AccountDeletionReceiptRecord;
      encryptedResponseBody: string;
      responseStatus: number;
    }
  | {
      kind: "replay";
      job: AccountDeletionJobRecord;
      encryptedResponseBody: string;
      responseStatus: number;
    }
  | { kind: "conflict" };

export interface RecoveryCredentialIssuer {
  issueAndSeal(input: {
    requestId: RequestId;
    generation: RecoveryGeneration;
    issuedAt: Date;
    expiresAt: Date;
    seal(credential: IssuedRecoveryCredential): StoredIdempotentResponse;
  }): {
    tokenDigestSha256: Sha256Hex;
    storedResponse: StoredIdempotentResponse;
  };
  digest(input: {
    requestId: RequestId;
    generation: RecoveryGeneration;
    bearer: string;
  }): Sha256Hex;
}

export interface CommitDeletionStartInput
  extends Omit<
    CreateDeletionRequestInput,
    "appleApplicable" | "initialProviderEffectIntent" | "buildStoredResponse"
  > {
  authenticatedSubjectUserId: UserId;
  authoritativeIdentity: AuthoritativeIdentity;
  appleEffectId: EffectId;
  recoveryIssuer: RecoveryCredentialIssuer;
  buildStoredResponse(created: {
    job: AccountDeletionJobRecord;
    recoveryCredential: IssuedRecoveryCredential;
  }): StoredIdempotentResponse;
  buildBlockedStoredResponse(created: {
    job: AccountDeletionJobRecord;
    receipt: AccountDeletionReceiptRecord;
  }): StoredIdempotentResponse;
}

export type CommitDeletionStartResult =
  | CreateDeletionRequestResult
  | {
      kind: "blocked";
      job: AccountDeletionJobRecord;
      receipt: AccountDeletionReceiptRecord;
      encryptedResponseBody: string;
      responseStatus: number;
    };

export interface AccountDeletionStartStore {
  lookupRequestIdempotency(
    input: LookupRequestIdempotencyInput,
  ): Promise<LookupRequestIdempotencyResult>;
  preflightDeletionStart(
    input: StartDeletionPreflightInput,
  ): Promise<StartDeletionPreflightResult>;
  commitDeletionStart(
    input: CommitDeletionStartInput,
  ): Promise<CommitDeletionStartResult>;
}

// Replace the Task 1 initiation input with this Task 2 contract; do not add
// an alternate entry point.
export interface InitiateAccountDeletionRequestInput {
  store: AccountDeletionTask2Store;
  gateway: AccountDeletionProviderGateway;
  request: Omit<CommitDeletionStartInput, "authoritativeIdentity">;
}

export declare function initiateAccountDeletionRequest(
  input: InitiateAccountDeletionRequestInput,
): Promise<CommitDeletionStartResult>;
```

`RecoveryCredentialIssuer.issueAndSeal` is synchronous. It creates exactly 32
cryptographically random bytes, base64url-encodes them only for the synchronous
`seal` callback, computes an HMAC-SHA-256 digest with the configured recovery
pepper over the length-delimited tuple
`requestId + generation + bearer bytes`, clears the mutable byte buffer in a
`finally`, rejects a thenable sealer result, and returns only the digest and
encrypted stored response. A raw bearer is never a store result, row, log, or
async value.

The start sequence is exact:

1. Reject unless `request.userId` and
   `request.authenticatedSubjectUserId` are byte-identical, then call
   `lookupRequestIdempotency`. Replay or conflict returns immediately.
2. `preflightDeletionStart` acquires the `a:<subject>` lock and all current
   `h:<household>` locks, uses database time, and selects the durable user and
   memberships `FOR UPDATE`. A missing user or all-households policy failure
   writes only the blocked job, immutable terminal receipt, and encrypted
   idempotent response, then returns `blocked`.
3. Only a `ready` result permits
   `getAuthoritativeIdentity(authenticatedSubjectUserId)`.
4. `commitDeletionStart` reacquires the same canonical lock set, repeats the
   idempotency check, repeats the durable user/membership policy check, and
   rejects identity subject substitution. If the user or policy changed, it
   writes the same blocked-only shape and does not consume the challenge or
   proof.
5. On the accepted path, the same transaction consumes the challenge, claims
   the globally unique proof, inserts the job, normalized cleanup plan,
   tombstone, generation-1 recovery digest with
   `expires_at = database_now + interval '30 days'`, optional Apple effect
   intent, and byte-exact encrypted response.
6. No provider effect runs before commit. A race that removes the user between
   Steps 2 and 4 may have performed the one authoritative identity read, but
   it still commits only the blocked shape and consumes no proof.

No response builder or credential sealer may perform I/O, return a promise or
thenable, re-enter the store, or observe an uncommitted object after its
transaction callback returns.

**Normalized cleanup and canonical redaction**

`0011` creates these server-only rows:

- `account_deletion_deployment_identity`: exactly one immutable singleton row
  with a database-local random `deployment_id` and the fixed schema marker
  `account-deletion-store-v1`;
- `account_deletion_cleanup_plans`: one immutable header per request with
  `request_id`, `user_id`, immutable `plan_generation`,
  `plan_digest_sha256`, and `created_at`;
- `account_deletion_cleanup_plan_households`: one immutable row per
  `(request_id, household_id)` with `action`, `member_count`, and
  `other_owner_count`;
- `account_deletion_cleanup_executions`: one privileged execution record
  containing `execution_id`, request/generation/lease attempt, PostgreSQL
  transaction ID and backend PID, start/completion timestamps, and the
  resulting database-cleanup evidence ID; every field is immutable except the
  one-way null-to-value completion/evidence finalization performed by the same
  routine transaction;
- `account_deletion_database_cleanup_evidence`: one row per request with
  `evidence_id`, `user_id`, cleanup generation, plan digest,
  deleted/redacted row counts, and database completion time.

`0011` also closes the relational identity graph left open by the earlier
migrations. All foreign keys below are `ON DELETE RESTRICT`, every referenced
tuple has a matching unique constraint, and immutable-row triggers reject
updates that would rebind any component:

- jobs expose unique `(id, user_id)`. Challenges expose unique
  `(id, user_id)`. Proof claims, recovery-token digests, tombstones, and
  terminal receipts carry `user_id` and reference the exact job tuple
  `(request_id, user_id)`. Recovery rows expose unique
  `(request_id, user_id, generation)` as the rotation-idempotency source
  target, in addition to request/generation uniqueness;
- provider actions expose unique `(id, request_id)` and reference their job.
  They are also unique by `(request_id, kind, generation)`.
  The job's nullable active-action relation is the composite foreign key
  `(active_provider_action_id, id) ->
  account_deletion_provider_actions(id, request_id)`, so an action from
  another request cannot be made active. Every store load joins action to job
  on both columns and rejects a loaded
  `action.requestId !== job.id` before opening or projecting its payload;
- provider effects carry `user_id`, reference the exact job tuple, expose
  unique `(id, request_id)`, and are loaded, claimed, checkpointed, and
  committed only by both request and effect ID. Idempotency rows use the exact
  challenge/request/rotation correlation defined above, including the
  rotation's `ON DELETE RESTRICT` historical recovery-token source FK; no
  protocol load accepts a caller-supplied ID without joining its owning
  request;
- cleanup plans expose unique
  `(request_id, user_id, plan_generation, plan_digest_sha256)`. Every
  plan-household row repeats those four columns and has that composite foreign
  key in addition to its unique `(request_id, household_id)`;
- cleanup executions repeat request, user, cleanup generation, and plan
  digest, reference the exact plan tuple, and expose unique
  `(execution_id, request_id, user_id, cleanup_generation,
  plan_digest_sha256)`. Database-cleanup evidence additionally carries the
  unique `execution_id`, references that execution tuple, and exposes unique
  `(evidence_id, request_id, user_id, cleanup_generation,
  plan_digest_sha256)`. The execution's nullable resulting evidence ID is
  filled only after that evidence insert and then uses the reverse composite
  foreign key; completion time and evidence ID are either both null or both
  non-null;
- every object-snapshot header carries evidence ID, request, user, cleanup
  generation, plan digest, `complete boolean NOT NULL CHECK (complete)`,
  manifest digest, and object count. It references the exact evidence tuple,
  is unique by request, exposes routing unique
  `(snapshot_id, request_id, user_id, cleanup_generation,
  plan_digest_sha256)`, and exposes the canonical count/manifest key
  `(snapshot_id, request_id, user_id, cleanup_generation,
  plan_digest_sha256, database_cleanup_evidence_id,
  manifest_digest_sha256, object_count)`. Exactly one complete header is
  therefore the canonical snapshot, including for zero objects;
- every inventory row repeats the snapshot ID, request, user, cleanup
  generation, and plan digest and references that complete header tuple. It
  exposes unique `(inventory_id, request_id, user_id, cleanup_generation,
  plan_digest_sha256)` and unique `(request_id, locator_digest_sha256)`;
- an `object_delete` effect repeats the inventory request/user/generation/plan
  tuple and references the exact inventory composite key. Its inventory ID is
  unique. A `clerk_delete` effect instead carries
  `cleanup_receipt_id`, request, user, cleanup generation, and plan digest and
  references the exact committed cleanup-receipt tuple. An Apple effect has
  neither binding. A validated kind check makes those three nullable-column
  shapes mutually exclusive;
- each cleanup receipt carries request, user, cleanup generation, plan digest,
  database-evidence ID, snapshot ID, object-manifest digest, and all counts.
  Composite foreign keys bind it to the exact evidence and snapshot tuples; it
  uses the snapshot's full canonical count/manifest key, is unique by request,
  and exposes unique
  `(cleanup_receipt_id, request_id, user_id, cleanup_generation,
  plan_digest_sha256)`. Validated checks require nonnegative counts and
  `object_delete_count + object_already_absent_count = object_count`.

For additive binding columns on pre-existing `0009`/`0010` rows, the valid
first-install path stages values only through the unique locked parent joins,
rejects every orphan/ambiguity/mismatch before the first update, then verifies
source/destination counts and an ordered tuple digest before validating the
constraints. It never accepts caller data for a backfill. Challenge
idempotency is the stated exception because no unique legacy relation exists:
any such row stops the preflight instead of being inferred.

The locked store transaction does not rely on foreign keys alone. Before
create, load, replay, claim, or finalize, it joins the complete tuple, requires
one row at every link, recomputes the normalized plan and object-manifest
digests, and proves header count equals distinct inventory count equals
persisted inventory count. Finalization additionally proves exactly one
object effect per inventory row, no extra effect, and derived outcome counts
equal both the receipt and header. Any absent, duplicate, cross-request,
cross-user, cross-generation, cross-digest, cross-snapshot, or
cross-inventory link conflicts without mutation.

The household rows, not an opaque JSON plan, are the canonical household lock
and policy inventory. The plan header digest is the SHA-256 of the
length-delimited, byte-sorted `(household_id, action, member_count,
other_owner_count)` rows plus the request ID, user ID, and immutable
`plan_generation`. `AccountDeletionCleanupPlan.generation` and
`planDigestSha256` are loaded from that header; neither is derived from the
mutable job state generation. The cleanup routine recomputes and verifies the
digest before mutation.

Every cleanup boundary revalidates this chain rather than trusting a supplied
evidence ID. `executeDatabaseCleanup` requires the plan request/user to equal
the locked job, a positive safe plan generation, and the canonical digest of
the exact normalized rows to equal the header digest before any mutation. Its
evidence row copies that exact request, user, plan generation, and digest.
`finalizeObjectCleanup` joins and requires exact parity among job, plan,
evidence, snapshot, inventory, and effects: request/user, plan generation and
digest, evidence ID, snapshot ID/manifest/count, and one immutable effect per
inventory row. It derives receipt counts from committed outcomes. Loading or
replaying an existing evidence/receipt row repeats the same checks and accepts
only a byte-identical result; any mismatched user, request, generation, digest,
snapshot, inventory/effect tuple, or count conflicts without a state change.

`0011` owns and seeds the deployment-identity singleton once with
`gen_random_uuid()`. A primary-key/check constraint permits only the literal
singleton key, a unique constraint protects `deployment_id`, and immutable
triggers reject every update, delete, truncate, or second insert. Rerunning
the exact migration preserves the original ID. The table has no direct grant
to either runtime login. Instead,
`public.ww_account_deletion_deployment_identity()` is a zero-argument
`SECURITY DEFINER` function owned by the cleanup owner, fixed to
`search_path = pg_catalog, public`, which returns the one UUID and raises
unless the singleton and schema marker are exact. `PUBLIC`, `anon`, and
`authenticated` receive no execution right; only the app and cleanup-worker
roles may execute it.

```ts
export interface SubjectRedactionValues {
  userIds: readonly string[];
  emails: readonly string[];
  displayNames: readonly string[];
}

export declare function redactExactSubjectScalars(
  value: unknown,
  subject: SubjectRedactionValues,
): unknown;

export interface DatabaseCleanupEvidence {
  evidenceId: string;
  requestId: RequestId;
  userId: UserId;
  cleanupGeneration: number;
  planDigestSha256: Sha256Hex;
  deletedRowCount: number;
  redactedRowCount: number;
  completedAt: Date;
}

export interface AccountDeletionCleanupStore {
  loadCleanupPlan(
    requestId: RequestId,
  ): Promise<AccountDeletionCleanupPlan | null>;
  executeDatabaseCleanup(
    fence: CleanupFence,
  ): Promise<DatabaseCleanupEvidence>;
  loadDatabaseCleanupEvidence(
    requestId: RequestId,
  ): Promise<DatabaseCleanupEvidence | null>;
}
```

The canonical redactor walks JSON arrays and object values recursively,
preserves keys, order, numbers, booleans, and null, and replaces a string only
when it is byte-for-byte equal to a member of the captured subject scalar set.
The replacement is exactly `"deleted_account"`. It never case-folds,
normalizes, or substring-matches. Before deleting the user row, the privileged
routine captures the user ID, stored email/display name, and every
subject-linked membership display name under row locks. Directly
subject-authored private rows are deleted; shared rows use the canonical
redactor and clear direct attribution columns. The TypeScript and SQL
implementations must run the same fixture vectors from
`accountDeletionCleanup.test.ts`; SQL is the mutation authority and the pure
TypeScript function is the independently testable specification.

Write guards use a separate migration-installed SQL predicate,
`ww_jsonb_contains_exact_subject_scalar(value jsonb, subjects text[])`.
It recursively visits only JSON array elements and object values, never object
keys; compares string scalars by exact UTF-8 bytes; and ignores numbers,
booleans, null, substrings, differently cased/normalized text, and composite
strings. It rejects a null/malformed subject set rather than broadening a
match. UPDATE and DELETE triggers inspect every named JSONB column from `OLD`;
INSERT and UPDATE triggers inspect the corresponding `NEW` value. UPDATE
therefore evaluates both full scalar/reference sets and takes the distinct
union of every `a:` and `h:` lock derived from OLD and NEW before deciding.
Removing a protected OLD identity and introducing a protected NEW identity are
separate guarded cases.

For household fences, an active deletion is exactly a related job whose state
is not `blocked`, `failed`, or `succeeded`. Normal-role household, membership,
care, invitation, and audit guards consult immutable normalized plan rows only
while that related job is active. A terminal state releases those household
fences so unrelated retained-household work can resume; the plan/evidence rows
remain immutable history. Account tombstones are different: once created on
an accepted start they remain authoritative for both active and terminal jobs
and permanently reject durable/JIT user resurrection or a new subject
reference. Cleanup bypass remains limited to the exact active
`cleanup_running` worker transaction and never applies merely because a
tombstone exists.

**Privileged cleanup routine and bypass evidence**

The deployment provisions the normal application login
`woofwatcher_app`
(`LOGIN NOINHERIT BYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE
NOREPLICATION`) and two non-inheriting cleanup roles:
`woofwatcher_account_deletion_cleanup_owner`
(`NOLOGIN NOINHERIT BYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE
NOREPLICATION`)
and `woofwatcher_account_deletion_cleanup_worker`
(`LOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE
NOREPLICATION`). `0011` compares every listed flag exactly and rejects any row
in `pg_auth_members` whose member or granted role is one of these three
protocol roles. Therefore none can inherit or `SET ROLE` to the owner, to one
another, or through a transitive membership path. `PUBLIC`, `anon`, and
`authenticated` also have no membership in a cleanup role.

```sql
public.ww_execute_account_deletion_cleanup(
  p_request_id uuid,
  p_expected_generation integer,
  p_worker_id text,
  p_lease_token text,
  p_lease_attempt integer
) returns table (
  evidence_id uuid,
  deleted_row_count integer,
  redacted_row_count integer,
  completed_at timestamptz
)
```

The routine is `SECURITY DEFINER`, owned by the cleanup owner, fixes
`search_path = pg_catalog, public`, and is executable only by the cleanup
worker. It locks and validates the exact job, `cleanup_running` state,
generation, worker, lease token, lease attempt, and
`lease_until > clock_timestamp()`. It inserts an execution row bound to
`pg_current_xact_id()` and `pg_backend_pid()`, sets the transaction-local
execution ID, and performs all cleanup in that transaction.

Every guarded trigger calls `ww_account_deletion_cleanup_bypass_allowed`.
The helper is `SECURITY DEFINER`, owned by the cleanup owner, and fixes
`search_path = pg_catalog, public`. Bypass succeeds only when
`session_user = 'woofwatcher_account_deletion_cleanup_worker'`, the helper's
`current_user` is the cleanup owner, the transaction-local execution ID
resolves to an in-progress execution row for the same PostgreSQL
transaction/backend, the row identifies the exact
request/generation/lease attempt, and the normalized plan covers the affected
user/household. A caller-set GUC without that row and worker session identity
never bypasses. Guard trigger functions are migration-installed
`SECURITY DEFINER` functions owned by the cleanup owner with fixed
`search_path = pg_catalog, public`; all direct execution is revoked. They call
the helper as owner, but ordinary app writes retain
`session_user = 'woofwatcher_app'` and therefore receive `false`. Writes
inside the cleanup routine retain the cleanup worker `session_user`, and the
helper additionally proves the exact same transaction/backend execution row.
The routine writes
database-cleanup evidence and atomically moves
`cleanup_running -> object_inventory`; callers cannot supply row counts or
the next state.

`REVOKE ALL` applies first to every new table, sequence, and function for
`PUBLIC`, `anon`, and `authenticated`. It also removes default
`PUBLIC EXECUTE` from `ww_lock_keys`,
`ww_account_deletion_deployment_identity`,
`ww_account_deletion_cleanup_bypass_allowed`, every trigger function, and the
cleanup routine. Exact grants then apply:

The migration/admin ownership principal—not any of the three runtime protocol
roles—owns the `public` schema and every account-deletion table, sequence,
index, trigger, and existing care table; that principal is never supplied to
the running application or worker. `0011` requires its direct
`session_user = current_user` identity to equal that existing owner on rerun.
The cleanup owner owns only the named
`SECURITY DEFINER` cleanup/deployment/guard functions. Because it owns no
relation or schema, it has no implicit table power; all of its access is the
enumerated grant set below. The manifest rejects a table, sequence, or schema
owned by the app, cleanup worker, or cleanup owner and rejects a cleanup
function owned by any role other than the cleanup owner.

- `woofwatcher_app` receives only the table/column
  `SELECT`/`INSERT`/compare-and-set `UPDATE` privileges needed by the
  PostgreSQL store on protocol, plan, recovery, inventory, effect, evidence,
  and receipt tables; it receives no `DELETE`/`TRUNCATE`, no execution-row
  insert/finalize privilege, no cleanup-routine execution, and no membership
  in a cleanup role;
- `woofwatcher_app` receives `EXECUTE` on `ww_lock_keys`; that helper
  accepts at most 256 distinct keys matching `a:[^[:space:]]+` or
  `h:[0-9a-f-]{36}`, rejects every other value before acquiring a lock, and
  sorts the accepted keys in database byte order;
- `woofwatcher_app` receives `EXECUTE` on
  `ww_account_deletion_deployment_identity`;
- neither the app nor cleanup worker receives direct `EXECUTE` on
  `ww_account_deletion_cleanup_bypass_allowed` or any guard trigger function;
  only the cleanup-owner trigger/routine call chain can reach the helper, and
  it returns true only for the transaction-bound worker routine evidence
  described above;
- the cleanup worker receives only deployment-identity and cleanup-routine
  execution and no direct table, sequence, bypass-helper, lock-helper, or
  trigger-function privilege;
- the cleanup owner receives the exact `SELECT`/`INSERT`/`UPDATE`/`DELETE`
  table and sequence privileges each named routine/guard needs, including
  read-only deployment-identity and plan/evidence lookups; it receives no
  schema ownership, `TRUNCATE`, `REFERENCES`, `TRIGGER`, or unrelated table
  privilege. Its `BYPASSRLS` attribute is the explicit reason the
  `SECURITY DEFINER` routine can mutate existing RLS-protected care tables;
  function definer status alone is never treated as an RLS bypass.

Tests prove the application connection can execute every non-cleanup store
operation but cannot set role directly or transitively, insert/finalize
execution evidence, call the cleanup routine, invoke trigger functions
directly, invoke the bypass helper, or spoof the transaction-local setting.
An app write that fires the migration-installed guard must observe false bypass
and reject the guarded mutation. Tests also prove the cleanup connection can
call only the routine, cannot call the bypass helper directly, cannot
`SET ROLE`, and cannot directly select or mutate tables. Catalog tests assert
zero unexpected incoming/outgoing memberships for all three protocol roles
and all exact
`NOSUPERUSER`/`NOCREATEDB`/`NOCREATEROLE`/`NOREPLICATION` flags. Hostile
fixtures that transfer any relation/schema to the cleanup owner or add one
extra owner ACL privilege must fail the read-only manifest preflight without
repair.

**Recovery access and handoff**

`account_deletion_recovery_token_digests` is the only recovery-token table
name. `0011` adds `handoff_confirmed_at`; `consumed_at` means invalidated by
rotation. The job's `active_recovery_generation`, fixed
`recovery_expires_at`, and `recovery_handoff_generation` are the current
summary. Rotation never changes the first issuance expiry.

```ts
export interface RotateRecoveryInput {
  requestId: RequestId;
  authenticatedSubjectUserId: UserId;
  operationId: "recovery_rotate";
  expectedJobGeneration: number;
  expectedRecoveryGeneration: RecoveryGeneration;
  idempotencyKeyHash: Sha256Hex;
  requestFingerprintSha256: Sha256Hex;
  recoveryIssuer: RecoveryCredentialIssuer;
  buildStoredResponse(created: {
    job: AccountDeletionJobRecord;
    recoveryCredential: IssuedRecoveryCredential;
  }): StoredIdempotentResponse;
}

export interface ConfirmRecoveryHandoffInput {
  requestId: RequestId;
  authenticatedSubjectUserId: UserId;
  expectedJobGeneration: number;
  expectedRecoveryGeneration: RecoveryGeneration;
  bearer: string;
  recoveryIssuer: RecoveryCredentialIssuer;
}

export interface TransitionToClerkDeletingInput {
  requestId: RequestId;
  expectedJobGeneration: number;
  expectedRecoveryGeneration: RecoveryGeneration;
  cleanupReceiptId: string;
  lease: LeaseFence;
}

export interface AccountDeletionRecoveryStore {
  validateRecoveryBearer(input: {
    requestId: RequestId;
    bearer: string;
    recoveryIssuer: RecoveryCredentialIssuer;
  }): Promise<RecoveryAccessRecord>;
  rotateRecovery(
    input: RotateRecoveryInput,
  ): Promise<
    | {
        kind: "rotated" | "replay";
        job: AccountDeletionJobRecord;
        encryptedResponseBody: string;
        responseStatus: number;
      }
    | { kind: "conflict" | "expired" | "state_forbidden" }
  >;
  confirmRecoveryHandoff(
    input: ConfirmRecoveryHandoffInput,
  ): Promise<AccountDeletionJobRecord>;
  transitionToClerkDeleting(
    input: TransitionToClerkDeletingInput,
  ): Promise<
    | { kind: "transitioned"; job: AccountDeletionJobRecord }
    | { kind: "waiting_for_handoff"; job: AccountDeletionJobRecord }
    | {
        kind: "recovery_expired";
        job: AccountDeletionJobRecord;
        receipt: AccountDeletionReceiptRecord;
      }
    | { kind: "conflict" }
  >;
}
```

`rotateRecovery` hard-codes `operationId = "recovery_rotate"`; no route,
caller, or adapter may choose another value. It first resolves the exact
collision-domain row, joins its exact request/user/source-generation foreign
key to the immutable historical recovery-token row, and only then decrypts and
returns its byte-exact stored response before current state validation. On a
miss, the locked transaction repeats that lookup,
requires the row's request/user composite parent and
`expectedRecoveryGeneration` to match the locked current generation, calls
`RecoveryCredentialIssuer.issueAndSeal` exactly once, rotates N to N+1, and
inserts the encrypted response plus operation/source-generation correlation
atomically. `expectedJobGeneration` is an internal state CAS, not an HTTP
fingerprint field; the canonical source recovery generation is. A replay never
issues a new bearer, reseals a response, advances generation, or changes the
idempotency row.

Validation and handoff select the active digest using database time, recompute
the request-and-generation-bound digest only through the supplied
`RecoveryCredentialIssuer`, and compare it in constant time. The store and
store factory never receive or retain the recovery pepper. Rotation and
`transitionToClerkDeleting` acquire the same sorted `a:<user>` plus job-row
locks before validating state or generation. Rotation consumes generation N,
inserts N+1 with the original expiry, updates the active generation, and clears
handoff in one transaction. Handoff requires both the owning authenticated
subject and the current bearer; it stamps the active digest row and job
summary. The Clerk transition validates the current handoff, committed cleanup
receipt, reconciled inventory/effects, live lease, and state-generation CAS in
one transaction. On the successful edge, that transaction also inserts the
sole `clerk_delete` intent with a database-generated effect ID, binds it to the
exact cleanup receipt tuple, derives its replay key through the store-owned
secret, and moves the job to `clerk_deleting`; no generic
effect-intent method accepts `kind = 'clerk_delete'`. Exact replay may load
only that identical committed intent. A conflict or rollback leaves neither
the intent nor the state edge. Exactly one of a concurrent rotation or Clerk
transition can commit. It also requires database time to be strictly before
the fixed recovery expiry. At `database_now >= recovery_expires_at`, whether or not handoff was
previously confirmed, that same fenced transaction performs no Clerk effect or
provider call; it writes one immutable failed account-deletion receipt and
moves `object_cleanup_complete -> failed`, returning `recovery_expired`.
The receipt is derived—not caller supplied—with terminal code
`recovery_expired_before_clerk_deletion`, complete data/object cleanup, Clerk
still present, Apple state proven by the committed Apple effect or
`not_applicable`, and database `finalizedAt`. A wait/retry is forbidden because
the fixed expiry cannot be extended. The owner-authenticated status may expose
the failed receipt while Clerk remains; recovery GET returns expired and never
authorizes access after the boundary.

**Sealed object locators, snapshots, effects, and receipts**

Plaintext object keys and versions exist only inside the sealed object
gateway. Adapters inventory and mutate plaintext locators; the gateway encrypts
inventory results before returning them to the store and decrypts persisted
refs only immediately before adapter lookup/delete.

```ts
export interface AccountDeletionObjectLocatorCodec {
  seal(input: {
    requestId: RequestId;
    storageProvider: string;
    bucket: string;
    objectKey: string;
    objectVersion: string | null;
  }): {
    objectKeyCiphertext: string;
    objectVersionCiphertext: string | null;
    locatorDigestSha256: Sha256Hex;
  };
  open(input: AccountDeletionObjectRef): {
    objectKey: string;
    objectVersion: string | null;
  };
}

export interface CompleteObjectInventorySnapshot {
  requestId: RequestId;
  snapshotId: string;
  complete: true;
  manifestDigestSha256: Sha256Hex;
  objectCount: number;
  objects: Array<
    Omit<
      AccountDeletionObjectRef,
      | "inventoryId"
      | "snapshotId"
      | "userId"
      | "cleanupGeneration"
      | "planDigestSha256"
    >
  >;
  capturedAt: Date;
}

export interface ObjectInventorySnapshotRecord {
  snapshotId: string;
  requestId: RequestId;
  userId: UserId;
  cleanupGeneration: number;
  planDigestSha256: Sha256Hex;
  databaseCleanupEvidenceId: string;
  complete: true;
  manifestDigestSha256: Sha256Hex;
  objectCount: number;
  completedAt: Date;
}

export type ProviderEffectTerminalOutcome =
  | "deleted"
  | "already_absent";

export interface ProviderEffectRecord {
  id: EffectId;
  requestId: RequestId;
  userId: UserId;
  kind: ProviderEffectKind;
  objectInventoryId: string | null;
  cleanupReceiptId: string | null;
  cleanupGeneration: number | null;
  planDigestSha256: Sha256Hex | null;
  replayKey: string;
  state: ProviderEffectState;
  attempt: number;
  claimedJobGeneration: number | null;
  replayMaterialCiphertext: string | null;
  checkpointCiphertext: string | null;
  providerReceiptCiphertext: string | null;
  terminalProviderOutcome: ProviderEffectTerminalOutcome | null;
  lastReasonCode: string | null;
  committedAt: Date | null;
}

export interface CommitProviderEffectInput {
  effectId: EffectId;
  requestId: RequestId;
  expectedAttempt: number;
  expectedReplayKey: string;
  checkpointCiphertext: string | null;
  providerReceiptCiphertext: string | null;
  terminalProviderOutcome: ProviderEffectTerminalOutcome | null;
  outcome: "checkpointed" | "committed" | "retry_required" | "indeterminate";
  reasonCode: string | null;
  lease: LeaseFence;
}

export interface FinalizeObjectCleanupInput {
  requestId: RequestId;
  expectedJobGeneration: number;
  databaseCleanupEvidenceId: string;
  snapshotId: string;
  lease: LeaseFence;
}

export interface AccountDeletionObjectStore {
  persistCompleteObjectInventory(input: {
    snapshot: CompleteObjectInventorySnapshot;
    expectedUserId: UserId;
    cleanupGeneration: number;
    planDigestSha256: Sha256Hex;
    databaseCleanupEvidenceId: string;
    expectedJobGeneration: number;
    lease: LeaseFence;
  }): Promise<{
    snapshot: ObjectInventorySnapshotRecord;
    objects: AccountDeletionObjectRef[];
  }>;
  loadObjectInventorySnapshot(
    requestId: RequestId,
  ): Promise<ObjectInventorySnapshotRecord | null>;
  loadObjectInventoryItem(
    requestId: RequestId,
    inventoryId: string,
  ): Promise<AccountDeletionObjectRef | null>;
  listObjectInventory(requestId: RequestId): Promise<AccountDeletionObjectRef[]>;
  createObjectEffectIntents(
    input: CreateObjectEffectIntentsInput,
  ): Promise<ProviderEffectRecord[]>;
  listObjectEffects(requestId: RequestId): Promise<ProviderEffectRecord[]>;
  claimObjectEffect(
    input: ClaimObjectEffectInput,
  ): Promise<ProviderEffectRecord | null>;
  finalizeObjectCleanup(
    input: FinalizeObjectCleanupInput,
  ): Promise<CleanupCompletionReceipt>;
  loadCleanupCompletionReceipt(
    requestId: RequestId,
  ): Promise<CleanupCompletionReceipt | null>;
}
```

`0011` creates `account_deletion_object_inventory_snapshots` separately from
`account_deletion_object_inventory`. A committed header with
`complete = true`, `object_count = 0`, and the empty-manifest digest is durable
evidence of a complete empty inventory. Zero rows without that header is never
complete. Each inventory row references the header and is unique by
`(request_id, locator_digest_sha256)`. Replaying the same snapshot ID and
manifest returns the original rows; a different manifest for a committed
request conflicts.

The locator codec computes `locatorDigestSha256` as a keyed HMAC over the
versioned canonical bytes
`"WWAD-OBJLOC-v1" || field(requestId) || field(storageProvider) ||
field(bucket) || field(objectKey) || nullableField(objectVersion)`. `field`
is a four-byte unsigned big-endian UTF-8 byte length followed by those bytes;
`nullableField` begins with `0x00` for null or `0x01` followed by `field` for a
present value, so null and empty are distinct. No platform string
concatenation is a cryptographic frame.

`objectKeyCiphertext` and a present `objectVersionCiphertext` use
AES-256-GCM with fresh 96-bit nonces. Their authenticated additional data is
the same protocol version plus canonically framed request ID, provider,
bucket, locator digest, and field tag (`key` or `version`). `open` first
authenticates/decrypts both fields with that AAD, then recomputes the locator
HMAC from the recovered canonical plaintext and compares the 32 digest bytes
with `timingSafeEqual` before returning a locator to an adapter. Any malformed
frame, changed routing column, null/empty substitution, AEAD failure, or digest
mismatch throws `AccountDeletionObjectLocatorIntegrityError`; lookup or delete
is never called.

The manifest digest is SHA-256 over the byte-sorted locator digests plus
canonically framed request and snapshot IDs. `objectCount` must equal both the
distinct digest count and persisted row count. These rules make randomized
locator encryption compatible with deterministic replay checks. The AEAD key
and locator-HMAC key are distinct configuration secrets.

Task 2 adds `terminal_provider_outcome` to `ProviderEffectRecord`,
`CommitProviderEffectInput`, SQL, and Drizzle. A committed `object_delete` or
`clerk_delete` effect requires exactly one of `deleted` or `already_absent`;
Apple effects require null. For object and Clerk effects,
`state = 'committed'` is equivalent to
`terminal_provider_outcome IS NOT NULL`; every intent, claimed, checkpointed,
retry-required, or indeterminate row requires null. The locked stored effect
kind and requested next state determine the valid value—callers cannot label
an uncommitted effect terminal or choose a value for Apple. PostgreSQL checks,
the store CAS, Drizzle parity, and negative tests enforce both directions.
Receipt counts come from committed effects, never caller input.

`terminal_provider_outcome` is immutable after its first non-null value. The
only permitted write is `NULL -> deleted|already_absent` in the same fenced
compare-and-set that changes the matching object/Clerk effect to `committed`.
No later update may change it, clear it, or rewrite any committed effect
column; replay returns the original row. Apple completion remains committed
with a null terminal-provider outcome and is protected by the same
committed-row immutability trigger.

Two partial unique indexes enforce at most one Apple effect and at most one
Clerk effect per request:
`UNIQUE (request_id) WHERE kind = 'apple_revoke'` and
`UNIQUE (request_id) WHERE kind = 'clerk_delete'`. Claim is also
kind-to-state fenced under the locked job row: Apple requires the exact request
in `apple_revoking`, authoritative Apple applicability, and bound replay
material; object deletion requires `object_cleanup_running` and the exact
complete snapshot/inventory tuple; Clerk requires `clerk_deleting`, the
current confirmed handoff, and the exact cleanup-receipt-bound intent created
atomically by `transitionToClerkDeleting`. A kind in any other state, an
effect/request mismatch, or a missing companion returns no claim and performs
no provider lookup or mutation.

`account_deletion_database_cleanup_evidence` proves only relational cleanup.
`account_deletion_cleanup_receipts` is separate and is written by
`finalizeObjectCleanup` after the complete snapshot and complete intent set
exist and every non-empty object effect is committed. It references the
database evidence and snapshot and stores reconciled object counts. An empty
snapshot may move directly from `object_cleanup_pending` to
`object_cleanup_complete` only while writing the zero-count cleanup receipt in
the same transaction. `account_deletion_receipts` remains the later immutable
terminal account-deletion receipt.

**PostgreSQL store and lease ownership**

`createAccountDeletionPostgresStore` is the sole production store constructor
and implements the complete Task 1 store plus
`AccountDeletionStartStore`, `AccountDeletionCleanupStore`,
`AccountDeletionRecoveryStore`, `AccountDeletionObjectStore`, and
`AccountDeletionWorkerStore`. It accepts the normal application pool and a
separate cleanup-role pool; construction fails if either is absent.

```ts
import type { Pool } from "pg";

export type AccountDeletionProviderActionClientPayload =
  | {
      kind: "clerk_reauthentication";
      clientHintEnvelope: string;
    }
  | {
      kind: "apple_reauthorization";
      nonce: string;
    };

export interface AccountDeletionProviderActionPayloadCodec {
  seal<K extends AccountDeletionProviderActionClientPayload["kind"]>(input: {
    actionId: ProviderActionId;
    requestId: RequestId;
    kind: K;
    generation: number;
    expiresAt: Date;
    payload: Extract<AccountDeletionProviderActionClientPayload, { kind: K }>;
  }): string;
  open<K extends AccountDeletionProviderActionClientPayload["kind"]>(input: {
    actionId: ProviderActionId;
    requestId: RequestId;
    kind: K;
    generation: number;
    expiresAt: Date;
    clientPayloadCiphertext: string;
  }): Extract<AccountDeletionProviderActionClientPayload, { kind: K }>;
}

export interface CreateAccountDeletionPostgresStoreInput {
  applicationPool: Pool;
  cleanupPool: Pool;
  effectReplayHmacSecret: Uint8Array;
  providerActionPayloadCodec: AccountDeletionProviderActionPayloadCodec;
  leaseTokenFactory(): string;
  attestationLockKeyFactory?(): bigint;
}

export interface WorkerLease extends LeaseFence {
  requestId: RequestId;
  leasedAt: Date;
}

export interface AccountDeletionWorkerStore {
  claimNextLease(input: {
    workerId: string;
    leaseTtlSeconds: number;
  }): Promise<WorkerLease | null>;
  renewLease(input: {
    requestId: RequestId;
    workerId: string;
    leaseToken: string;
    leaseAttempt: number;
    leaseTtlSeconds: number;
  }): Promise<WorkerLease>;
  releaseLease(input: {
    requestId: RequestId;
    workerId: string;
    leaseToken: string;
    leaseAttempt: number;
  }): Promise<void>;
}

export type AccountDeletionTask2Store =
  AccountDeletionStore &
  AccountDeletionStartStore &
  AccountDeletionCleanupStore &
  AccountDeletionRecoveryStore &
  AccountDeletionObjectStore &
  AccountDeletionWorkerStore;

export interface AccountDeletionPostgresStoreLifecycle {
  close(): Promise<void>;
}

export type AccountDeletionPostgresStore =
  AccountDeletionTask2Store &
  AccountDeletionPostgresStoreLifecycle;

export declare function createAccountDeletionPostgresStore(
  input: CreateAccountDeletionPostgresStoreInput,
): Promise<AccountDeletionPostgresStore>;

// Replace the Task 1 step input with this exact intersection.
export interface AccountDeletionStepInput {
  requestId: RequestId;
  store: AccountDeletionTask2Store;
  gateway: AccountDeletionProviderGateway;
  objectGateway: AccountDeletionObjectGateway;
  lease: LeaseFence;
}

export declare function runAccountDeletionStep(
  input: AccountDeletionStepInput,
): Promise<AccountDeletionStepResult>;
```

Construction copies `effectReplayHmacSecret` into private store-owned memory
and rejects a non-`Uint8Array`, fewer than 32 bytes, or an all-zero value. It
is the required environment-stable dedicated secret used only for framed
provider-effect replay HMACs; every process and replica for that database uses
the same value across restarts. The store never generates, persists, returns,
or logs it. Task 3 composition compares key material before construction and
fails unless it is byte-distinct from the recovery pepper, response-encryption
key, provider-action AEAD key, and both object-locator AEAD/HMAC keys.

The factory captures bound `seal` and `open` functions from the required
provider-action payload codec. They are synchronous, deterministic except for
the codec's fresh AEAD nonce on a new seal, bounded, and I/O-free; a thrown
error, non-string seal result, thenable, or malformed open result fails closed.
`seal` authenticates canonical framed AAD containing at least action ID,
request ID, kind, positive-safe generation, and the exact
`expiresAt.toISOString()` bytes. `open` must authenticate those same locked
columns and return the one matching discriminated payload; a decrypt failure
or kind/tuple mismatch is an invariant error. The PostgreSQL column remains
`client_payload_ciphertext`. The store seals before insertion and opens only
inside the allowlisted server projection load path. It never aliases that
ciphertext to `clientHintEnvelope` or `nonce`, and no row/debug/store result
returns ciphertext as a client payload. Exact action replay reuses and opens
the immutable stored ciphertext; it never reseals the payload or changes its
nonce.

The async factory acquires one original client from each pool and performs one
attestation query per client that returns exactly one row containing
`session_user`, `current_user`, `current_database()`, and
`ww_account_deletion_deployment_identity()`. On the application client, both
user fields must equal `woofwatcher_app`; on the cleanup client, both must
equal `woofwatcher_account_deletion_cleanup_worker`. This rejects a superuser
or other login that merely selected the expected role. The database names and
nonblank deployment UUIDs must also be byte-identical across both rows. The
factory captures that exact database/deployment tuple as the process binding.

`attestationLockKeyFactory` is an optional deterministic test seam. When it is
absent, the factory obtains fresh cryptographically random bytes for each key,
interprets eight bytes as a signed 64-bit integer, and redraws a decoded zero.
When it is supplied, every result is still required to be a nonzero signed
64-bit `bigint`; an out-of-range, repeated, non-`bigint`, or throwing result
rejects construction. No production composition supplies the test seam.

Because a physical database clone copies both names and stored UUIDs, the
factory first performs the existing live cross-pool challenge with the first
fresh key. It begins a transaction on the original app client and requires
`pg_try_advisory_xact_lock(key)` to return exactly one `true` row. The original
cleanup client's autocommit call for the same key must then return exactly one
`false` row. After the app client rolls back and thereby releases the
transaction-scoped lock, the cleanup client's second autocommit call must
return exactly one `true` row; that statement's transaction releases the
xact-scoped lock. This startup proof is retained even though the process also
keeps the longer-lived anchor below.

After rollback is proven, the originally attested app client acquires a second
fresh key with `pg_try_advisory_lock(anchor_key)`, which must return exactly
one `true` row. The factory holds that application connection and its
session-level advisory lock for the store lifetime; it never begins another
transaction on the anchor and never returns the anchor client to the pool
while the store is open. This is an idle-session anchor, not an
idle-in-transaction anchor. Before resolving, the factory releases the
original cleanup client and exercises the wrapper below once with a newly
acquired non-anchor app client and once with a newly acquired cleanup client;
the app PID must differ from the anchor PID. This proves both pool capacity
and the post-construction checkout path.

Every later application or cleanup pool checkout goes through one private
store wrapper before `BEGIN` or any protocol SQL. The wrapper reruns the exact
one-row attestation, checks the role-specific session/current users, and
compares database and deployment identity byte-for-byte with the captured
startup binding. It then calls `pg_try_advisory_lock(anchor_key)`, which must
return exactly one `false` row because the original process-held connection
still owns that lock in the same live lock namespace. If it unexpectedly
returns true, the wrapper calls `pg_advisory_unlock(anchor_key)`, requires one
true result, destroys that checked-out client, and fails closed; every other
attestation/query/malformed-row mismatch also destroys the client. No store
method can bypass this wrapper or issue protocol SQL on an unattested
checkout. Thus moving both pools together to a copied database after startup
is detected even when its name and deployment singleton were cloned.

`close()` is an idempotent awaited lifecycle operation: the first call rejects
new store work, waits for all wrapper-tracked in-flight checkouts to settle,
then calls `pg_advisory_unlock(anchor_key)` on the original anchor client and
requires exactly one true row followed by an exactly-false verification call.
It releases that client only after verification. A connection/query/result
failure destroys the anchor client and makes the shared close promise reject;
the close path clears the store-owned HMAC-secret copy in `finally`, and all
later calls await that same settled promise. A partially constructed
factory runs the same rollback/unlock/destroy cleanup before rejecting. Task 3
composition awaits `store.close()` before either pool's `end()` during normal
shutdown and every startup rollback path.

The factory rejects on a missing pool, a pool unable to provide the anchor plus
an independent operation checkout, acquisition/query/rollback/unlock failure,
malformed or extra row, role mismatch, database mismatch,
deployment-identity mismatch, invalid/reused key, or either lock-proof
mismatch. It never exposes a store before all checks pass. Every call site
must await the factory; Task 3 composition must await it before worker startup
or HTTP listening. Tests prove fail-closed behavior for role-only
impersonation, different databases, different deployment IDs, two independent
fake backends that report the same copied database name and marker, both pools
moving together after startup, a dropped anchor, pool exhaustion,
close-during-work, repeated close, and all acquisition/query/rollback/unlock
failures.

Task 2 extends `runAccountDeletionStep` rather than creating a second worker
entry point:

- `preflight` loads and verifies the immutable cleanup plan, then performs the
  fenced transition to `cleanup_pending`;
- `cleanup_pending` claims `cleanup_running`;
- `cleanup_running` reloads and validates the canonical plan, then calls
  `executeDatabaseCleanup`; the privileged routine itself writes exact
  request/user/generation/digest-bound evidence and transitions to
  `object_inventory`;
- `object_inventory` inventories through `objectGateway`, persists a complete
  snapshot header and rows, then transitions to `object_cleanup_pending`;
- `object_cleanup_pending` commits the exact effect-intent set. An empty
  snapshot atomically writes the zero-count cleanup receipt and transitions to
  `object_cleanup_complete`; a non-empty set transitions to
  `object_cleanup_running`;
- `object_cleanup_running` processes at most one exact claimed object effect
  using lookup-before-mutation. Once every effect is committed,
  `finalizeObjectCleanup` reconciles counts, writes the cleanup receipt, and
  transitions to `object_cleanup_complete`;
- `object_cleanup_complete` reloads the committed cleanup receipt by request
  after every fresh step or restart, revalidates its request/evidence/snapshot
  binding, and passes its exact `cleanupReceiptId` to
  `transitionToClerkDeleting`. A missing or mismatched receipt fails closed;
  no prior-step in-memory value or test-only inspector is authoritative. An
  unconfirmed current handoff returns `waiting` without mutation, while a
  successful unexpired CAS returns `advanced`; an expired result returns
  `terminal` with the transaction's immutable failed receipt.

Every branch remains one bounded step and retains Task 1's crash-reconciliation
rule: a claimed or indeterminate effect is looked up by its stable replay key
before another mutation is permitted.

Task 2 adds `lease_attempt integer not null default 0` to jobs and
`leaseAttempt` to `LeaseFence`. It updates every Task 1 in-memory harness call
and every PostgreSQL mutation predicate. `claimNextLease` uses
`FOR UPDATE SKIP LOCKED`, PostgreSQL `clock_timestamp()`, a fresh random lease
token, and increments `lease_attempt` on each new or reclaimed claim.
`renewLease` retains worker/token/attempt and extends from database time.
`releaseLease` clears worker/token/until only when all three identifiers match.
Every state, action, effect, cleanup, recovery-to-Clerk, and receipt mutation
validates worker, token, attempt, and an unexpired database lease. Caller
`leaseUntil` is descriptive; database time is authoritative.

Task 2 implements `claimNextLease`, `renewLease`, and `releaseLease` in the
PostgreSQL store. Task 3 implements only polling, bounded-step orchestration,
startup, and shutdown over those methods; it does not reopen store SQL or
lease schema.

**Database proof split**

`0011` is rerunnable only by exact identity, never by blind
`IF NOT EXISTS`. Its first phase takes only the migration transaction and
migration advisory lock, then performs catalog `SELECT`s. Before any
`CREATE`/`ALTER`/`DROP`, DML, grant/revoke, comment, seed, or other repair
mutation, it builds one byte-sorted canonical manifest of every expected or
same-prefix relation, column, constraint, index, trigger, policy, function,
overload, owner, ACL, comment/version digest, extension dependency, protocol
role, role flag, and role-membership edge. It validates every entry and hashes
the complete definition manifest. The only accepted starting shapes are:

1. the exact published `0009`/`0010` catalog plus a complete absence of every
   `0011`-owned object, zero uncorrelated legacy challenge-idempotency rows,
   and no legacy idempotency operation other than exactly shaped `request`
   rows; or
2. one exact, fully installed `0011` catalog, including the valid immutable
   deployment singleton, for a no-op rerun.

A partial installation, unexpected object, unknown overload, mixed
present/absent set, definition-hash mismatch, role/membership mismatch, or
invalid singleton raises during this read-only phase. The transaction then
leaves the catalog, data, ACLs, comments, and singleton byte-for-byte
unchanged. No validation branch first “repairs” an object and checks it later.
After a valid first-install preflight, creation uses fixed definitions; after
creation it rebuilds the same full manifest and requires the installed form's
exact hashes before commit. Before accepting any object, the manifest
validates:

- table/schema/owner/persistence, exact columns and defaults, validated checks,
  unique constraints, restrictive foreign keys, indexes, RLS/force-RLS state,
  expected triggers, absence of policies, and exact effective ACLs;
- function name, argument and return types, function kind, volatility,
  parallel/leakproof/security-definer attributes, fixed `search_path`, owner,
  ACL, a migration-owned version digest stored in the object comment, and the
  matching normalized `pg_get_functiondef` SHA-256;
- role existence; exact
  LOGIN/INHERIT/BYPASSRLS/SUPERUSER/CREATEDB/CREATEROLE/REPLICATION
  attributes; and zero unexpected direct or transitive membership/`SET ROLE`
  paths involving any protocol role;
- absence of unexpected overloads, policies, user triggers, helper functions,
  or same-prefix relations.

The migration test seeds, one at a time, a wrong table owner/column/check,
permissive policy, unexpected trigger, wrong function body/version marker,
unexpected overload, default `PUBLIC EXECUTE`, wrong function owner/search
path, wrong role flag, membership edge, one-object partial install, stale
comment hash, uncorrelated challenge idempotency row, and unknown/malformed
rotation idempotency operation. It also removes or alters the exact recovery
token triple unique and rotation-source composite FK one at a time. Every case
must fail
in the read-only preflight and leave the complete pre-existing fixture
unchanged. A second run of the exact clean migration must produce one copy of
every object, identical canonical catalog hashes, and the original deployment
singleton.

PGlite remains the fast migration/catalog and deterministic service-test
layer. It cannot satisfy concurrency or role-isolation acceptance. The command

```bash
ACCOUNT_DELETION_TEST_ADMIN_DATABASE_URL="$ACCOUNT_DELETION_TEST_ADMIN_DATABASE_URL" \
ACCOUNT_DELETION_TEST_APP_DATABASE_URL="$ACCOUNT_DELETION_TEST_APP_DATABASE_URL" \
ACCOUNT_DELETION_TEST_CLEANUP_DATABASE_URL="$ACCOUNT_DELETION_TEST_CLEANUP_DATABASE_URL" \
  node --experimental-strip-types --test \
  artifacts/api-server/test/accountDeletionPostgres.test.ts \
  artifacts/api-server/test/accountDeletionWriteGuard.test.ts
```

must open the admin, app, and cleanup DSNs concurrently against real
PostgreSQL. Those suites fail closed when any of the three DSNs is absent,
malformed, or unreachable; they do not skip or fall back to PGlite. All three
DSNs must target the same exclusive disposable database named
`woofwatcher_account_deletion_test_<run-id>` in a disposable PostgreSQL
cluster. The database comment must equal
`woofwatcher-account-deletion-disposable-v1`. The suite refuses to run unless
the name/comment match and the admin connection proves no unexpected sessions
exist. Schema-only isolation is forbidden because migrations qualify
`public.*` and the three named roles are cluster-wide.

Cluster bootstrap creates the exact roles and credentials before the Node
suite. The admin connection drops/recreates the disposable database's entire
`public` schema, validates the cluster-wide role attributes, runs migrations,
and performs fixture teardown only after app and cleanup pools close. The
cluster/database is never reused after an interrupted run. Application
operations connect through the app DSN and cleanup calls through the cleanup
DSN; neither test pool may `SET ROLE`. Initial acceptance holds one connection
from each of all three DSNs simultaneously, proves their
`pg_backend_pid()` values are pairwise distinct, verifies exact roles and one
database/deployment identity, and uses an advisory-lock barrier to prove all
three are live concurrent backends rather than serialized aliases. Every
concurrency case likewise uses distinct PIDs and an explicit barrier while one
transaction holds its lock, and proves the competing connection blocks before
the first commits.

The harness tests each DSN independently in absent, syntactically invalid, and
unreachable forms. For the unreachable case it reserves and closes a
runner-local TCP port, substitutes that bounded-timeout endpoint into only the
DSN under test, and requires setup/store construction to reject before
migration or fixture mutation. Any environment-sensitive inability to perform
that proof fails the suite; it is not a skip condition.

Every parameterized store query goes through one internal `queryExact` helper.
Its PostgreSQL-aware lexer ignores quoted strings, identifiers, comments, and
dollar-quoted bodies, then requires the positional bind-marker set to be
exactly contiguous `$1..$N` and `N === values.length`; `$0`, a missing index,
an out-of-range/unknown index, or unused extra value rejects before checkout.
Real-PostgreSQL tests run valid repeated-marker queries plus hostile skipped
and unknown-marker probes through this helper and mutation-test production SQL
to prove a placeholder gap cannot silently pass. The suites then prove
advisory-lock blocking/order, OLD+NEW races in both directions,
rotation-versus-Clerk exactly-one-commit, lease
reclamation/attempt fencing, cleanup-owner versus normal-role separation, and
trigger-verified bypass.
PGlite separately proves rerunnable `0011`, exact Drizzle/catalog parity, RLS,
and revocation of `PUBLIC`, `anon`, and `authenticated`, including hostile
default grants.

Task 2 also makes this real-PostgreSQL gate reproducible in
`.github/workflows/verify.yml`. The existing GitHub-hosted `verify` job gains a
`postgres:17.10-bookworm` service, declares workflow-level
`permissions: contents: read` with no write scope, and also runs on pushes to
`recovery/account-deletion-v2`; this job must never use `pull_request_target`
or a self-hosted/reused runner under the CI credential model below. The
service starts as `postgres` against database `postgres`, publishes
runner-local port 5432, and must pass
`pg_isready -U postgres -d postgres` with a two-second interval, five-second
timeout, and 30 retries. After checkout, toolchain setup, and frozen install
but before any focused test, an `ON_ERROR_STOP` bootstrap step creates one
database named
`woofwatcher_account_deletion_test_${GITHUB_RUN_ID}_${GITHUB_RUN_ATTEMPT}`,
sets its comment to `woofwatcher-account-deletion-disposable-v1`, and creates
the three exact protocol roles:

- `woofwatcher_app LOGIN NOINHERIT BYPASSRLS NOSUPERUSER NOCREATEDB
  NOCREATEROLE NOREPLICATION PASSWORD 'wwad_ci_app_v1'`;
- `woofwatcher_account_deletion_cleanup_owner NOLOGIN NOINHERIT BYPASSRLS
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`;
- `woofwatcher_account_deletion_cleanup_worker LOGIN NOINHERIT NOBYPASSRLS
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD
  'wwad_ci_cleanup_v1'`.

Bootstrap also creates the test-only Supabase client roles `anon` and
`authenticated`, each as `NOLOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEDB
NOCREATEROLE NOREPLICATION`. They are required because committed migrations
revoke privileges from those role names; neither receives database `CONNECT`,
a password, or a DSN.

Before interpolating the database name into SQL or a URI, bootstrap requires
both GitHub values to match `[0-9]+` and the complete identifier to match
`[a-z0-9_]+` and remain within PostgreSQL's 63-byte identifier limit. A
validation failure stops the job before any SQL.

The database remains owned by `postgres`; bootstrap revokes database privileges
from `PUBLIC` and grants only `CONNECT` to the app and cleanup-worker roles.
It then asserts the database comment, exact `pg_roles` flags for all five
roles, zero membership edges involving the three protocol roles, and
simultaneously proves distinct backend PIDs plus `SELECT current_user` over all
three connections. It exports these DSNs for the same database through
`GITHUB_ENV` before invoking `pnpm run test:focused`:

- admin:
  `postgresql://postgres:wwad_ci_admin_v1@127.0.0.1:5432/<database>?sslmode=disable`;
- app:
  `postgresql://woofwatcher_app:wwad_ci_app_v1@127.0.0.1:5432/<database>?sslmode=disable`;
- cleanup:
  `postgresql://woofwatcher_account_deletion_cleanup_worker:wwad_ci_cleanup_v1@127.0.0.1:5432/<database>?sslmode=disable`.

The service uses `wwad_ci_admin_v1` as its bootstrap password, and the app and
cleanup-worker role declarations use the corresponding passwords shown in the
DSNs. These static values authorize only this disposable, runner-local service;
they are not production secrets, may not be reused by deployment
configuration, and are forbidden for an externally reachable cluster. A
health pass alone is not bootstrap success, and no test runs after partial
role/database setup. The test harness—not the workflow—owns public-schema
reset, migrations, catalog checks, fixtures, pool shutdown, and teardown.

The object gateway follows the same sealed, captured-function construction as
the provider gateway. The store first persists and commits the complete
snapshot, assigning each object an inventory ID. Only a subsequent fenced
transaction may create exactly one `object_delete` effect per inventory ID.
Each effect has its own effect ID, a non-null foreign key to that inventory
row, and is loaded and claimed by the `(effectId, inventoryId)` pair before it
performs lookup or mutation. Apple/Clerk effects must have a null inventory ID;
object effects must have a non-null unique inventory ID. No object deletion
starts until the snapshot and complete intent set are committed. Clerk
deletion is unreachable until the cleanup receipt exists, every object effect
is terminal `committed`, the receipt counts reconcile with inventory, and the
current recovery generation has a confirmed handoff.

- [ ] **Step 1: Write RED cleanup-policy and recursive-redaction tests**

Cover a sole-member household, a retained household with another owner, a
retained household with no other owner, multiple households where one blocks,
missing durable user, and no implicit role promotion. Assert a blocked
preflight has zero tombstones, cleanup rows, effect intents, object inventory,
provider calls, recovery tokens, or role mutations. For an absent durable
user, assert one blocked job, one immutable `missing_user` receipt, and one
encrypted idempotent response persist without a foreign key to `users`; exact
request replay returns that stored response and a fingerprint mismatch returns
conflict. Model the race by creating a valid challenge, removing the local
durable user, then starting: start must re-check the user under the account
lock before proof verification, must not consume the proof, and must not make
another provider call.

Test a pure recursive redactor over nested objects and arrays. It replaces only
exact scalar subject IDs, email addresses, and known display names with
`"deleted_account"`; it must not substring-match unrelated text. Delete
subject-authored private entries. Retain shared evidence with attribution
removed. Include nested care-state docs, care-entry details, invitation
metadata, audit metadata, names, notes, and household names.

- [ ] **Step 2: Run cleanup tests and verify RED**

```bash
node --experimental-strip-types --test \
  artifacts/api-server/test/accountDeletionCleanup.test.ts
```

Expected: FAIL because cleanup/preflight modules do not exist.

- [ ] **Step 3: Write RED recovery-access and handoff tests**

Before implementing recovery, prove:

- issuance uses 32 random bytes and stores only a keyed digest;
- rotation persists only `operation_id = 'recovery_rotate'` with the exact
  request/user/source-generation tuple and canonical framed fingerprint;
- replaying the same rotation key/fingerprint returns the byte-identical
  encrypted bearer response without issuing bytes or advancing generation;
- the same key with another request or generation conflicts, a different key
  cannot occupy the same request/source-generation slot, and the same raw key
  used for `challenge`, `request`, and `recovery_rotate` never cross-replays;
- a hostile rotation idempotency row with a substituted user, request,
  operation, or source generation is rejected before response decryption or
  mutation;
- nonexistent historical recovery-token source rows and cross-user,
  cross-request, or substituted-generation source tuples fail the composite FK
  or replay join before stored bytes are decrypted or returned;
- the first database timestamp fixes the exact 30-day expiry;
- rotation N to N+1 is transactional, invalidates N, and retains the original
  expiry;
- rotation at `database_now = expires_at` fails;
- Clerk transition at `database_now = expires_at` atomically terminalizes with
  `recovery_expired_before_clerk_deletion`, a truthful failed receipt, and no
  Clerk effect/provider call; the same holds for an earlier confirmed handoff;
- old-token replay and generation rollback fail;
- rotation succeeds in each globally enumerated pre-Clerk state and is
  rejected from `challenge_required`, `retry_required`, `clerk_deleting`,
  `receipt_finalizing`, and every terminal state;
- concurrent rotation versus transition to `clerk_deleting` under two
  connections yields exactly one commit: a winning rotation invalidates the
  old handoff and forces the transition to refetch, while a winning transition
  makes rotation fail without changing generation or expiry;
- recovery GET can validate the active bearer after Clerk is absent;
- bearer-only calls cannot start, authorize, retry, rotate, acknowledge
  handoff, or call care APIs;
- handoff confirmation requires both owning Clerk auth and the current bearer;
- a stale generation cannot confirm handoff;
- state transition to `clerk_deleting` fails until the current recovery
  generation is confirmed.

- [ ] **Step 4: Run recovery tests and verify RED**

```bash
node --experimental-strip-types --test \
  artifacts/api-server/test/accountDeletionRecovery.test.ts
```

Expected: FAIL because recovery issuance, rotation, validation, and handoff do
not exist.

- [ ] **Step 5: Write RED object-inventory and provider-effect tests**

Test a sealed object gateway, complete inventory persistence before deletion,
no intent before the complete snapshot commits, one durable effect ID per
inventory ID, load/list/claim by exact effect and inventory IDs,
lookup-before-mutation, replay after a crash response, already-absent success,
indeterminate fail-closed behavior, inventory/effect count mismatch, and no
Clerk effect claim before a committed cleanup receipt. Test that private
objects and request-scoped export artifacts are included. Explicitly persist
and reload a complete zero-object snapshot header, prove that zero rows without
the header are incomplete, reject a mismatched empty-manifest digest, and
prove the empty path atomically writes a zero-count cleanup receipt while
transitioning `object_cleanup_pending -> object_cleanup_complete`. Mutation
proof: remove only the header insert and require that empty-path test to fail.

- [ ] **Step 6: Run object tests and verify RED**

```bash
node --experimental-strip-types --test \
  artifacts/api-server/test/accountDeletionObjectGateway.test.ts
```

Expected: FAIL because the object gateway and inventory store do not exist.

- [ ] **Step 7: Write RED migration, lock, bypass, and write-guard tests**

Test canonical locks from both OLD and NEW identities, JIT-versus-tombstone
races, care-state writes, care-entry create/update/delete, invitations, Access
Pass, household rename, profile writes, audit/tombstone writes, cleanup-fence
mismatch, spoofed cleanup context under the normal app role, and
post-terminal account resurrection. Prove exact recursive JSONB scalar matches
from both OLD and NEW are blocked, object keys/substrings/case or normalization
variants are ignored, household fences release only after a terminal job, and
the accepted-request tombstone remains effective afterward.

Create two candidate challenges around an idempotency replay and prove the
replay follows only the persisted `challenge_id` to the original challenge.
Reject missing/cross-user/cross-operation challenge correlations, and prove the
`0011` preflight rejects an uncorrelated legacy challenge idempotency row
without changing it.

Prove store construction rejects `SET ROLE` impersonation, mismatched
session/current users, different database names, different deployment IDs,
same-name/same-marker independent fake backends, lock-challenge result
mismatches, invalid/reused supplied lock keys,
missing/duplicate/malformed attestation rows, and pool
acquisition/query/rollback failures before exposing a store. After successful
construction, move one and then both pools to a same-name/same-marker copied
backend; per-checkout anchor proof must fail and destroy the client. Cover
anchor loss, unexpected anchor acquisition/unlock, pool exhaustion,
close-during-work, two concurrent/repeated `close()` calls, and Task 3 startup
rollback/shutdown ordering before pool end.

Round-trip each provider-action kind through the captured payload codec. Assert
fresh ciphertext, no plaintext/ciphertext alias in store or projection values,
and fail-closed tamper, wrong action ID, wrong request, wrong kind, wrong
generation, wrong expiry, action swap, malformed payload, thrown codec, and
thenable/non-string result. Prove `jobs.active_provider_action_id` cannot
reference another request and that the load path independently rejects such a
hostile tuple before decrypting.

Seed hostile protocol and cleanup relations with wrong user, request,
generation, digest, action, effect, evidence, snapshot, inventory, manifest,
or receipt component and require create/load/claim/finalization/replay to fail
without state change. Mutate snapshot manifests/counts and inventory/effect
tuples independently and require the same fail-closed result. Prove duplicate
Apple/Clerk intents fail, kind-to-state claim fencing is exact, and the sole
Clerk intent appears only in the handoff-gated state-transition transaction.
Cover immutable non-null terminal-provider outcomes. Cover the exact app,
cleanup-owner, and cleanup-worker role attributes and
grants, default `PUBLIC EXECUTE` denial for every new function, hostile
pre-existing table/function/policy/trigger/owner/ACL rollback, and
the full read-only catalog preflight. Run the three-DSN, unreachable-DSN, and
contiguous/hostile bind-placeholder cases from the real-PostgreSQL contract
above.

Use this exact matrix as the implementation inventory:

| Table | OLD+NEW account lock inputs | OLD+NEW household lock inputs | Active-deletion/tombstone guard | Cleanup bypass |
|---|---|---|---|---|
| `users` | `id` | `active_household_id` | Reject insert/update for tombstoned `id`; reject moving from or to a locked household | Exact fenced redact/delete only |
| `households` | none | `id` | Reject update/delete while involved in another active deletion | Exact fenced delete or redacted rename |
| `household_members` | `user_id` | `household_id` | Reject insert/update/delete that moves either OLD or NEW identity around a lock | Exact fenced deleting-member detach |
| `household_invitations` | `invited_user_id`, `created_by_user_id`, `approved_by_user_id`, `accepted_by_user_id`, `revoked_by_user_id`, `rejected_by_user_id`, plus exact scalar IDs in `metadata` | `household_id` | Reject references to tombstoned/active users and locked households | Exact fenced delete/redact |
| `care_state` | `updated_by`, plus exact scalar IDs in `doc` | `household_id` | Reject OLD or NEW subject references and locked-household writes | Exact fenced recursive redact/delete |
| `care_entries` | `caregiver_user_id`, plus exact scalar IDs in `details` | `household_id` | Reject create/update/delete that moves OLD or NEW identities | Exact fenced private delete/shared redact |
| `care_entry_tombstones` | `caregiver_user_id`, `deleted_by_user_id` | `household_id` | Reject resurrecting or moving references around a lock | Exact fenced redact |
| `household_audit_events` | `actor_user_id`, `target_user_id`, plus exact scalar IDs in `metadata` | `household_id` | Reject new/moved subject references; normal-role rows remain immutable | Exact fenced in-place PII redaction while preserving non-PII audit facts |
| `account_deletion_jobs` | `user_id` | cleanup-plan household IDs | Only compare-and-set state transitions | No trigger bypass; store methods only |
| `account_deletion_provider_actions` | request-derived `user_id` | none | Immutable action payload/generation; action-ID plus job-generation CAS consume/replace | No |
| `account_deletion_provider_effects` | request-derived `user_id` | request-derived household IDs | Immutable intent/replay key; CAS outcome | No |
| `account_deletion_idempotency` | `user_id` | none | Immutable operation/challenge-or-request/source-generation fingerprint and stored response | No |
| `account_deletion_reauth_proof_claims` | `user_id` | none | Immutable globally unique proof ID | No |
| `account_deletion_recovery_token_digests` | request-derived `user_id` | none | Monotonic generation, immutable original expiry | No |
| `account_deletion_receipts` | request-derived `user_id` | none | Immutable terminal row | No |
| `account_deletion_tombstones` | `user_id` | cleanup-plan household IDs | Prevent JIT and durable writes for active or terminal deletion | No |
| `account_deletion_deployment_identity` | none | none | Immutable singleton deployment UUID and schema marker | No |
| `account_deletion_cleanup_plans` | `user_id` | none | Immutable plan header and digest after initiation | No |
| `account_deletion_cleanup_plan_households` | request-derived `user_id` | `household_id` | Immutable normalized plan row after initiation | No |
| `account_deletion_cleanup_executions` | request-derived `user_id` | plan household rows | Immutable privileged transaction evidence | Owner-only insert/finalize |
| `account_deletion_database_cleanup_evidence` | request-derived `user_id` | plan household rows | Immutable relational-cleanup evidence | Owner-only insert |
| `account_deletion_object_inventory_snapshots` | request-derived `user_id` | none | One immutable complete manifest per request, including empty | No |
| `account_deletion_object_inventory` | request-derived `user_id` | none | Complete snapshot and unique provider locator | Exact effect-driven outcome only |
| `account_deletion_cleanup_receipts` | request-derived `user_id` | none | Immutable reconciled database/object cleanup evidence | No |

For every UPDATE matrix row, test moving a protected value both out of OLD and
into NEW. Lock keys are the distinct union of the literal prefix `a:` plus a
user ID and the literal prefix `h:` plus a household UUID, sorted in database
byte order before any advisory lock.

Cleanup bypass may not be a caller-controlled boolean or a custom GUC alone.
The worker uses a separate cleanup role to invoke one database routine. That
routine locks the job and lease rows, validates
`request_id + cleanup_running + generation + lease_owner + lease_token` using
database time, and establishes transaction-local bypass evidence that triggers
also verify. The normal app role has no membership or execute path that can
establish bypass.

- [ ] **Step 8: Run migration/write-guard tests and verify RED**

```bash
node --experimental-strip-types --test \
  artifacts/api-server/test/accountDeletionMigration.test.ts
ACCOUNT_DELETION_TEST_ADMIN_DATABASE_URL="$ACCOUNT_DELETION_TEST_ADMIN_DATABASE_URL" \
ACCOUNT_DELETION_TEST_APP_DATABASE_URL="$ACCOUNT_DELETION_TEST_APP_DATABASE_URL" \
ACCOUNT_DELETION_TEST_CLEANUP_DATABASE_URL="$ACCOUNT_DELETION_TEST_CLEANUP_DATABASE_URL" \
  node --experimental-strip-types --test \
  artifacts/api-server/test/accountDeletionWriteGuard.test.ts \
  artifacts/api-server/test/accountDeletionPostgres.test.ts
```

Expected: FAIL because `0011`, the PostgreSQL store, guarded JIT, and exact
cleanup routine do not exist.

- [ ] **Step 9: Implement pure cleanup, recovery, and sealed object gateway**

Implement only the behavior established in Steps 1–8. Keep recursive redaction
pure and independently tested. Persist and commit the complete object snapshot,
then create and commit all per-inventory-ID effects before deleting an object.
Hash recovery bearer bytes with a keyed digest, compare
digests in constant time, and perform issuance/rotation/handoff against
database time. Rotation and the `clerk_deleting` transition acquire the same
sorted account/job lock set, lock the job row, and CAS the same state
generation; neither path may validate before the lock and mutate afterward.

- [ ] **Step 10: Implement additive `0011` and PostgreSQL store**

`0011` must:

- build and validate the complete read-only catalog/role/membership manifest
  before mutation, then reject every partial or mismatched pre-existing table,
  function, overload, owner, ACL, policy, trigger, role attribute,
  membership, comment, or version/body digest;
- add the challenge ID and rotation source-generation idempotency columns,
  exact `challenge`/`request`/`recovery_rotate` shape checks, collision-domain
  and per-operation unique indexes, the targetable recovery-token
  `(request_id, user_id, generation)` unique, its `ON DELETE RESTRICT`
  rotation-source FK, and protocol composite keys for challenge, job, active
  provider action, effect, proof, recovery, tombstone, and terminal receipt
  without changing `0009` or `0010`;
- create account tombstones, cleanup plans, object inventory, recovery handoff,
  cleanup executions, database-cleanup evidence, object-inventory snapshot
  headers, cleanup receipts, the immutable deployment-identity singleton and
  attestation function, and lease/outcome columns/tables;
- install the exact plan/execution/evidence/snapshot/inventory/effect/receipt
  composite keys and locked parity checks, including one complete canonical
  snapshot header with exact manifest/count;
- constrain `object_delete` effects to a non-null unique inventory foreign key,
  constrain Apple/Clerk effects to a null inventory key, and expose fenced
  load/list/claim queries by exact effect and inventory IDs;
- constrain one Apple and one Clerk effect per request, make terminal provider
  outcomes write-once, fence claims by kind/job state, and create the only
  Clerk intent atomically inside the confirmed-handoff transition;
- add `ww_lock_keys(text[])`, sorting distinct namespaced keys before
  `pg_advisory_xact_lock(hashtextextended(key, 0))`;
- compute one lock set from both `to_jsonb(OLD)` and `to_jsonb(NEW)` according
  to the matrix;
- guard every matrix table and recursively inspect both OLD and NEW named
  JSONB values for exact UTF-8 scalar subject references, applying household
  fences only for active jobs while retaining accepted account tombstones
  through terminal state;
- reject new references to active or terminal deletion tombstones;
- expose the cleanup routine only to the cleanup role and validate the exact
  fence, lease attempt, transaction/backend evidence, and live lease in the
  database;
- bind cleanup execution, evidence, snapshots, effects, and receipts to the
  exact job user, canonical plan generation/digest, and derived counts at every
  create/load/replay boundary;
- preserve immutable effects, idempotency records, proof claims, recovery
  expiry, and terminal receipts;
- atomically terminalize an expired pre-Clerk request with the truthful
  `recovery_expired_before_clerk_deletion` receipt and no Clerk effect;
- update the history-generation trigger to use canonical locking;
- enable RLS, revoke `PUBLIC`/`anon`/`authenticated`, and install the exact
  full role flags, zero-membership rules, app/cleanup owner/cleanup worker
  grants, helper call chain, and function ACLs defined by the binding
  clarification;
- add `lease_attempt` and terminal provider outcome parity to PostgreSQL,
  Drizzle, and the Task 1 in-memory harness;
- require the stable effect-replay HMAC secret and synchronous provider-action
  payload codec, and never project `client_payload_ciphertext` as plaintext;
- implement exact parameter binding, startup cross-pool proof, process-held
  session anchor, per-checkout identity/anchor attestation, client destruction
  on mismatch, and idempotent awaited store close;
- add the production `claimNextLease`, `renewLease`, and `releaseLease`
  methods that Task 3's worker consumes;
- update `WoofWatcher Verify` with the PostgreSQL 17 service, exact role and
  disposable-database bootstrap, three concurrently proven job-level test
  DSNs, unreachable/placeholder failure probes, and recovery branch trigger
  defined above.

The initiation transaction locks the deleting user's `a:` key and every
involved household's `h:` key in sorted order, then selects the durable user
and memberships `FOR UPDATE`. When the durable user is absent, the transaction
persists only a blocked job keyed to the authenticated subject, immutable
`missing_user` receipt, and encrypted idempotent response; it does not create a
tombstone, recovery token, cleanup plan, inventory, or effect. When household
policy blocks, use the same non-mutating blocked-job/receipt/idempotency shape
with `last_owner`. Otherwise, atomically write the request, cleanup plan,
tombstone, first recovery-token digest, Apple effect intent when applicable,
and idempotent response before any provider mutation. The sole provider call
permitted between preflight and this final transaction is the authoritative
identity read defined by the start sequence. Object effects are not created
during initiation.

- [ ] **Step 11: Verify Task 2**

```bash
node --experimental-strip-types --test artifacts/api-server/test/accountDeletion*.test.ts
ACCOUNT_DELETION_TEST_ADMIN_DATABASE_URL="$ACCOUNT_DELETION_TEST_ADMIN_DATABASE_URL" \
ACCOUNT_DELETION_TEST_APP_DATABASE_URL="$ACCOUNT_DELETION_TEST_APP_DATABASE_URL" \
ACCOUNT_DELETION_TEST_CLEANUP_DATABASE_URL="$ACCOUNT_DELETION_TEST_CLEANUP_DATABASE_URL" \
  node --experimental-strip-types --test \
  artifacts/api-server/test/accountDeletionPostgres.test.ts \
  artifacts/api-server/test/accountDeletionWriteGuard.test.ts
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm \
  --filter @workspace/api-server run typecheck
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm run typecheck:libs
git diff --check
```

- [ ] **Step 12: Commit, review, and publish**

Commit Task 2. Review the exact Task 2 range with concurrency, database-role,
cleanup-boundary, object-inventory, and recovery emphasis. Fix and re-review
every Critical/Important issue. Re-run Step 11 on the approved commit, publish
that exact tree, fetch it, and verify remote/local tree equality. The
`WoofWatcher Verify` run triggered by that exact published SHA must finish
successfully, including the PostgreSQL-backed tests; a skipped, stale-SHA,
cancelled, or failed run does not approve Task 2.

---

### Task 3: Generated public contract, authenticated/recovery HTTP, and leased worker

**Files:**

- Create: `artifacts/api-server/src/routes/account-deletion-router.ts`
- Create: `artifacts/api-server/src/routes/account-deletion-recovery-router.ts`
- Create: `artifacts/api-server/src/routes/account-deletion.ts`
- Create: `artifacts/api-server/src/lib/account-deletion-composition.ts`
- Create: `artifacts/api-server/src/lib/account-deletion-projection.ts`
- Create: `artifacts/api-server/src/lib/account-deletion-worker.ts`
- Modify: `artifacts/api-server/src/app.ts`
- Modify: `artifacts/api-server/src/index.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Modify: `lib/api-spec/orval.config.ts`
- Regenerate: `lib/api-zod/src/generated/**`
- Regenerate: `lib/api-client-react/src/generated/**`
- Create: `artifacts/api-server/test/accountDeletionContracts.test.ts`
- Create: `artifacts/api-server/test/accountDeletionProjection.test.ts`
- Create: `artifacts/api-server/test/accountDeletionRoutes.test.ts`
- Create: `artifacts/api-server/test/accountDeletionComposition.test.ts`
- Create: `artifacts/api-server/test/accountDeletionWorker.test.ts`
- Create: `artifacts/api-server/test/contracts/accountDeletionContracts.compile.ts`
- Create: `artifacts/api-server/test/contracts/tsconfig.account-deletion.json`
- Modify: `artifacts/api-server/test/apiReadiness.test.ts`

**Public DTOs and total projection:**

```ts
export interface RedactedAccountDeletionReceipt {
  receiptId: string;
  requestId: string;
  outcome: "blocked" | "failed" | "succeeded";
  dataCleanup: "not_started" | "partial" | "complete";
  providerCleanup: "not_applicable" | "partial" | "complete";
  terminalCode:
    | "last_owner"
    | "missing_user"
    | "provider_unavailable"
    | "cleanup_failed"
    | "provider_indeterminate"
    | "recovery_expired_before_clerk_deletion"
    | null;
  finalizedAt: string;
}

export type DeletionProviderAction =
  | {
      kind: "clerk_reauthentication";
      generation: number;
      clientHintEnvelope: string;
      expiresAt: string;
    }
  | {
      kind: "apple_reauthorization";
      generation: number;
      nonce: string;
      expiresAt: string;
    };

export type AccountDeletionStatus =
  | {
      state: "authorization_required";
      requestId: string;
      providerAction: DeletionProviderAction;
    }
  | {
      state: "scheduled";
      requestId: string;
      providerAction: null;
      deletionStartsAt: string;
      recovery: {
        state: "active";
        generation: number;
        expiresAt: string;
        handoff: "required" | "confirmed";
      };
    }
  | {
      state: "processing";
      requestId: string;
      providerAction: null;
      stage:
        | "apple_revocation"
        | "database_cleanup"
        | "object_cleanup"
        | "clerk_deletion"
        | "receipt_finalization";
    }
  | {
      state: "retry_required";
      requestId: string;
      providerAction: null;
      code: string;
      retryEligible: true;
    }
  | {
      state: "blocked";
      requestId: string;
      providerAction: null;
      code: "last_owner" | "missing_user" | "provider_unavailable";
      receipt: RedactedAccountDeletionReceipt;
    }
  | {
      state: "completed";
      requestId: string;
      providerAction: null;
      receipt: RedactedAccountDeletionReceipt;
    };

export type AccountDeletionRecoveryStatus =
  | {
      state: "authorization_required";
      requestId: string;
      providerAction: DeletionProviderAction;
      recovery: { generation: number; expiresAt: string };
    }
  | {
      state: "scheduled";
      requestId: string;
      providerAction: null;
      recovery: {
        generation: number;
        expiresAt: string;
        handoff: "required" | "confirmed";
      };
    }
  | {
      state: "processing";
      requestId: string;
      providerAction: null;
      stage:
        | "apple_revocation"
        | "database_cleanup"
        | "object_cleanup"
        | "clerk_deletion"
        | "receipt_finalization";
      recovery: { generation: number; expiresAt: string };
    }
  | {
      state: "retry_required";
      requestId: string;
      providerAction: null;
      code: string;
      recovery: { generation: number; expiresAt: string };
    }
  | {
      state: "blocked";
      requestId: string;
      providerAction: null;
      code: "last_owner" | "missing_user" | "provider_unavailable";
      receipt: RedactedAccountDeletionReceipt;
    }
  | {
      state: "completed";
      requestId: string;
      providerAction: null;
      receipt: RedactedAccountDeletionReceipt;
    };

export interface AccountDeletionChallengeRequest {
  purpose: "account_deletion";
}

export interface AccountDeletionChallengeResponse {
  challengeId: string;
  clientHintEnvelope: string;
  expiresAt: string;
}

export interface StartAccountDeletionRequest {
  challengeId: string;
  // Base64 transports opaque bytes; decoded bytes are never parsed as JSON.
  reauthEnvelope: string;
}

export interface AuthorizeAccountDeletionRequest {
  provider: "clerk" | "apple";
  generation: number;
  credentialEnvelope: string;
}

export interface ConfirmRecoveryHandoffRequest {
  generation: number;
}

export interface RetryAccountDeletionRequest {
  expectedStateGeneration: number;
}

export interface RotateRecoveryRequest {
  expectedGeneration: number;
}

export interface RecoveryCredentialResponse {
  requestId: string;
  generation: number;
  bearer: string;
  issuedAt: string;
  expiresAt: string;
}

export type StartAccountDeletionResponse =
  | {
      kind: "accepted";
      status: Exclude<AccountDeletionStatus, { state: "blocked" }>;
      recoveryCredential: RecoveryCredentialResponse;
    }
  | {
      kind: "blocked";
      status: Extract<AccountDeletionStatus, { state: "blocked" }>;
      recoveryCredential: null;
    };

export interface AccountDeletionMutationResponse {
  status: AccountDeletionStatus;
}

export interface RotateRecoveryResponse {
  status: AccountDeletionStatus;
  recoveryCredential: RecoveryCredentialResponse;
}

export interface ConfirmRecoveryHandoffResponse {
  status: AccountDeletionStatus;
  confirmedGeneration: number;
}

export interface AccountDeletionErrorResponse {
  error:
    | "unauthorized"
    | "forbidden"
    | "not_found"
    | "idempotency_conflict"
    | "recovery_expired"
    | "validation_failed"
    | "provider_unavailable";
  requestId: string | null;
  retryable: boolean;
}
```

`getAccountDeletionStatus` returns `AccountDeletionStatus`;
`getAccountDeletionRecoveryStatus` returns
`AccountDeletionRecoveryStatus`; authorize/retry return
`AccountDeletionMutationResponse`. Bearer-bearing start/rotate responses are
encrypted in the idempotency table and replayed byte-for-byte. No status GET
returns the bearer.

Implement two pure exhaustive functions with `assertNever` and no default:

```ts
export declare function assertNever(value: never): never;

export declare function projectOwnerStatus(input: {
  job: AccountDeletionJobRecord;
  providerAction: AccountDeletionProviderActionRecord | null;
  receipt: AccountDeletionReceiptRecord | null;
}): AccountDeletionStatus;

export declare function projectRecoveryStatus(input: {
  job: AccountDeletionJobRecord;
  providerAction: AccountDeletionProviderActionRecord | null;
  receipt: AccountDeletionReceiptRecord | null;
}): AccountDeletionRecoveryStatus;
```

The recovery projection is a separately constructed allowlist. It never
contains user ID, email, household ID/name, raw provider receipt, replay key,
checkpoint, encrypted credential, proof ID/binding, object locator, lease
owner/token, stack, or internal error.

The projection implements this explicit total mapping:

| Internal state | Owner/recovery projection | Required durable companion |
|---|---|---|
| `challenge_required` | `authorization_required` with Clerk action | provider-owned client hint and exact generation |
| `reauth_verified` | `scheduled` | durable `deletionStartsAt` and issued current recovery generation |
| `provider_action_required` | `authorization_required` with Clerk or Apple action | action generation equals job generation |
| `accepted` | `scheduled` | durable `deletionStartsAt`, active recovery generation, and handoff state |
| `apple_revoking` | `processing/apple_revocation` | Apple effect |
| `apple_revoked`, `preflight`, `cleanup_pending`, `cleanup_running` | `processing/database_cleanup` | cleanup plan/fence as applicable |
| `object_inventory`, `object_cleanup_pending`, `object_cleanup_running`, `object_cleanup_complete` | `processing/object_cleanup` | complete inventory/effects as applicable |
| `clerk_deleting` | `processing/clerk_deletion` | committed cleanup receipt and confirmed current handoff |
| `receipt_finalizing` | `processing/receipt_finalization` | provider and cleanup outcomes |
| `retry_required` | `retry_required` | redacted stable retry code |
| `blocked` | `blocked` | immutable redacted blocked receipt |
| `failed`, `succeeded` | `completed` | immutable redacted terminal receipt |

Projection throws a typed invariant error, which the route converts to
fail-closed `503`, when a required companion is absent or contradictory. It
copies `deletionStartsAt` and provider-action fields only from the loaded
durable records and never invents an action, receipt, generation, or timestamp.
The `missing_user` and `last_owner` jobs always project to `blocked` with their
stored receipt; their start response uses `kind: "blocked"` and never contains
a recovery credential.

**HTTP operations:**

| Operation ID | Method/path | Authority |
|---|---|---|
| `createAccountDeletionChallenge` | `POST /account-deletions/challenge` | Clerk |
| `startAccountDeletion` | `POST /account-deletions` | Clerk |
| `authorizeAccountDeletion` | `POST /account-deletions/{requestId}/authorize` | fresh Clerk |
| `retryAccountDeletion` | `POST /account-deletions/{requestId}/retry` | Clerk |
| `getAccountDeletionStatus` | `GET /account-deletions/{requestId}` | owning Clerk |
| `rotateAccountDeletionRecovery` | `POST /account-deletions/{requestId}/recovery/rotate` | owning Clerk |
| `confirmAccountDeletionRecoveryHandoff` | `POST /account-deletions/{requestId}/recovery/handoff` | owning Clerk plus current recovery bearer |
| `getAccountDeletionRecoveryStatus` | `GET /account-deletions/{requestId}/recovery` | recovery bearer only |

Every POST requires `Idempotency-Key`. Same key and canonical request returns
the exact stored status/body; the same key with another fingerprint returns
`409 idempotency_conflict`.

**Worker lease contract:**

```ts
export interface WorkerLease extends LeaseFence {
  requestId: RequestId;
  leasedAt: Date;
}

export interface AccountDeletionWorkerStore {
  claimNextLease(input: {
    workerId: string;
    leaseTtlSeconds: number;
  }): Promise<WorkerLease | null>;
  renewLease(input: {
    requestId: RequestId;
    workerId: string;
    leaseToken: string;
    leaseAttempt: number;
    leaseTtlSeconds: number;
  }): Promise<WorkerLease>;
  releaseLease(input: {
    requestId: RequestId;
    workerId: string;
    leaseToken: string;
    leaseAttempt: number;
  }): Promise<void>;
}

export interface AccountDeletionWorker {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

export interface CreateAccountDeletionWorkerInput {
  workerId: string;
  leaseTtlSeconds: number;
  pollIntervalMilliseconds: number;
  store: AccountDeletionTask2Store;
  gateway: AccountDeletionProviderGateway;
  objectGateway: AccountDeletionObjectGateway;
  abortController: AbortController;
}

export declare function createAccountDeletionWorker(
  input: CreateAccountDeletionWorkerInput,
): AccountDeletionWorker;
```

Lease claim, expiry, renewal, and reclamation use PostgreSQL
`clock_timestamp()` inside the transaction. `claimNextLease` uses
`FOR UPDATE SKIP LOCKED`, reclaims rows where `lease_until <=
clock_timestamp()`, creates a fresh random lease token, and increments
`lease_attempt`. Every state/effect/cleanup commit validates owner, token,
attempt, and unexpired lease against database time. The claimed `WorkerLease`
is passed unchanged as the
`LeaseFence` in `AccountDeletionStepInput`, provider-action CAS, effect claim,
effect commit, state transition, and receipt finalization. A process clock is
never an authority.

Startup order in `src/index.ts` is exact: compose and validate all required
resources, await `worker.start()`, and only then call HTTP `listen`. A worker
startup failure closes already-created resources and the process never begins
listening. Shutdown order is also exact: stop accepting HTTP connections,
await the HTTP server's close/drain callback, await `worker.stop()`, and only
then close provider/object/database resources. Database teardown specifically
awaits `postgresStore.close()` before calling `end()` on either application or
cleanup pool. Every startup rollback after store construction uses that same
ordering, including worker-start rejection before HTTP listen. `stop()` stops polling, aborts
new provider work, awaits the current bounded step, and releases its
still-owned lease when safe. This sequence is idempotent and awaited on
`SIGTERM`, `SIGINT`, startup rollback, and explicit server shutdown. If the
process dies, another worker reclaims only after database TTL.

- [ ] **Step 1: Write RED projection, OpenAPI, generated-runtime, and compile-only contract tests**

Write contract tests before routers. Cover all six owner variants and all five
recovery variants, exact provider-action/state correlation, safe integer
generations, strict account-deletion objects, separately allowlisted recovery
fields, redacted receipt shape, and unchanged openness of existing health/care
responses. Projection fixtures must use the plaintext action produced by the
validated codec-open path; assert `client_payload_ciphertext` and tampered,
cross-request, or action-swapped payloads never reach an HTTP DTO or log.

Create
`artifacts/api-server/test/contracts/accountDeletionContracts.compile.ts`
with valid assignments and `@ts-expect-error` contradictory assignments for
both generated React and generated Zod-inferred types. The dedicated
`tsconfig.account-deletion.json` includes only this fixture, generated
declarations, and required shared type libraries; it sets `noEmit: true`,
`strict: true`, and cannot be satisfied by the API server's handwritten types.

- [ ] **Step 2: Run contract gates and verify RED**

```bash
node --experimental-strip-types --test \
  artifacts/api-server/test/accountDeletionContracts.test.ts \
  artifacts/api-server/test/accountDeletionProjection.test.ts
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm exec tsc \
  -p artifacts/api-server/test/contracts/tsconfig.account-deletion.json
```

Expected: runtime tests fail for missing generated schemas/projection and the
compile fixture fails for missing generated union types.

- [ ] **Step 3: Add OpenAPI `oneOf`, targeted strict generation, and public projection**

Define named object variants with `additionalProperties: false`, `oneOf`, and
explicit discriminator mappings. Avoid `allOf` intersections. Configure
operation-level strict Zod generation only for the eight account-deletion
operation IDs and generate every declared HTTP response. Implement the
exhaustive owner/recovery projection against those exact DTOs.

- [ ] **Step 4: Generate twice and prove deterministic contract output**

```bash
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm \
  --filter @workspace/api-spec run codegen
find lib/api-zod/src/generated lib/api-client-react/src/generated -type f -print0 \
  | sort -z | xargs -0 sha256sum > /tmp/woofwatcher-codegen-first.sha256
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm \
  --filter @workspace/api-spec run codegen
find lib/api-zod/src/generated lib/api-client-react/src/generated -type f -print0 \
  | sort -z | xargs -0 sha256sum > /tmp/woofwatcher-codegen-second.sha256
diff -u \
  /tmp/woofwatcher-codegen-first.sha256 \
  /tmp/woofwatcher-codegen-second.sha256
```

Expected: no hash difference. Re-run Step 2; runtime and compile-only contract
gates must now pass before route production code begins.

- [ ] **Step 5: Write RED route-authority and recovery-handoff tests**

Prove 401/403/409/410/422/503 boundaries, challenge purpose validation,
provider-owned client-envelope passthrough, raw-proof non-leakage,
server-authoritative Apple applicability, exact Apple generation, stale
capture rejection, authenticated ownership, byte-exact idempotency replay,
recovery bearer read-only scope, and post-Clerk recovery reads.

Explicitly prove:

- start returns a bearer only in the encrypted idempotent response;
- missing-user/last-owner start returns the stored `kind: "blocked"` status
  and receipt with `recoveryCredential: null`, while exact replay is
  byte-identical and performs no deletion-side work;
- handoff requires Clerk plus current bearer and is idempotent;
- current bearer alone receives 401/403 on every POST;
- the worker cannot enter `clerk_deleting` before handoff confirmation;
- rotation invalidates prior handoff and requires confirmation for the new
  generation;
- the recovery router is mounted outside Clerk bearer consumption.

- [ ] **Step 6: Run route tests and verify RED**

```bash
node --experimental-strip-types --test \
  artifacts/api-server/test/accountDeletionRoutes.test.ts \
  artifacts/api-server/test/accountDeletionComposition.test.ts
```

Expected: FAIL because routers and production composition do not exist.

- [ ] **Step 7: Write RED worker lease/lifecycle tests**

Test two workers racing for one job, DB-time TTL, no early process-clock
reclamation, exact-boundary reclamation, stale-token commit rejection,
heartbeat renewal, crash reclamation, idempotent start, awaited startup,
no HTTP listen before worker start resolves, no HTTP listen after worker start
rejects, HTTP close/drain before worker stop, worker stop before resource
close, store close before both pool ends, the same order on every startup
rollback, repeated close, graceful stop, provider abortion between bounded
steps, signal shutdown, and fail-closed composition when lease/shutdown
primitives are absent.

- [ ] **Step 8: Run worker tests and verify RED**

```bash
node --experimental-strip-types --test \
  artifacts/api-server/test/accountDeletionWorker.test.ts
```

Expected: FAIL because the leased worker does not exist.

- [ ] **Step 9: Implement separate routers, fail-closed composition, and worker**

Implement only after contract, route, and worker RED evidence exists. Mount the
one-method recovery router where Clerk middleware cannot consume its bearer.
Parse only selected headers. Validate every request and response with generated
account-deletion schemas. Capture production provider functions during
composition. Register awaited startup and shutdown hooks. Never expose mutable
adapters or start a detached effect after returning an HTTP response. Retain
the concrete PostgreSQL-store lifecycle handle and await its `close()` before
ending either pool on normal shutdown or startup rollback.

- [ ] **Step 10: Verify Task 3**

```bash
node --experimental-strip-types --test artifacts/api-server/test/accountDeletion*.test.ts
node --experimental-strip-types --test artifacts/api-server/test/*.test.ts
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm exec tsc \
  -p artifacts/api-server/test/contracts/tsconfig.account-deletion.json
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm run typecheck
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm \
  --filter @workspace/api-server run build
git diff --check
```

- [ ] **Step 11: Commit, review, and publish**

Commit source, OpenAPI, generated clients, and tests together. Review the exact
range for route authority, DTO projection, generated correlation, lease
reclamation, and shutdown. Resolve all Critical/Important issues, re-run Steps
2, 4, and 10 on the approved commit, publish it, fetch it, and verify
remote/local tree equality.

---

### Task 4: Mobile provider-deletion and recovery experience

**Files:**

- Create: `artifacts/woofwatcher-mobile/lib/accountDeletionFlow.ts`
- Create: `artifacts/woofwatcher-mobile/lib/accountDeletionRecovery.ts`
- Create: `artifacts/woofwatcher-mobile/lib/accountDeletionFlow.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/accountDeletionRecovery.test.ts`
- Create: `artifacts/woofwatcher-mobile/app/account-deletion-recovery.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/privacy.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/_layout.tsx`
- Modify: `artifacts/woofwatcher-mobile/context/CareContext.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/careDeviceWipe.ts`

**Mobile contracts:**

```ts
export interface StoredRecoveryCredential {
  requestId: string;
  generation: number;
  bearer: string;
  issuedAt: string;
  expiresAt: string;
}

export type RecoveryVaultWriteResult =
  | { kind: "stored"; credential: StoredRecoveryCredential }
  | { kind: "idempotent"; credential: StoredRecoveryCredential }
  | {
      kind: "rejected_stale_generation";
      currentGeneration: number;
      attemptedGeneration: number;
    }
  | { kind: "conflict_same_generation" };

export interface RecoveryTokenVault {
  load(requestId: string): Promise<StoredRecoveryCredential | null>;
  storeMonotonic(
    credential: StoredRecoveryCredential,
  ): Promise<RecoveryVaultWriteResult>;
  removeIfGeneration(
    requestId: string,
    expectedGeneration: number,
  ): Promise<boolean>;
}

export type DeletionFlowCommand =
  | { kind: "show_reauthentication"; clientHintEnvelope: string }
  | { kind: "show_apple"; generation: number; nonce: string }
  | {
      kind: "confirm_recovery_handoff";
      requestId: string;
      generation: number;
    }
  | {
      kind: "show_progress";
      stage:
        | "apple_revocation"
        | "database_cleanup"
        | "object_cleanup"
        | "clerk_deletion"
        | "receipt_finalization";
    }
  | { kind: "show_retry"; code: string }
  | {
      kind: "show_blocked";
      code: "last_owner" | "missing_user" | "provider_unavailable";
    }
  | {
      kind: "show_receipt";
      receipt: RedactedAccountDeletionReceipt;
    };
```

`storeMonotonic` serializes writes per request, reads before and after the
SecureStore write, accepts exact same-generation/same-token replay
idempotently, rejects same-generation/different-token conflict, rejects any
lower generation, and never overwrites N with N-1. It validates that expiry
does not move later across generations. No interface accepts `oldToken` as the
only concurrency control.

- [ ] **Step 1: Write RED mobile-flow and monotonic-vault tests**

Prove stable idempotency keys across Clerk step-up retries, exhaustive generated
status handling, exact Apple generation forwarding, SecureStore-only bearer
storage, same-generation conflict, N to N+1 replacement, N+1 to N rollback
rejection, expiry non-extension, reload/read-back verification, recovery-route
access after Clerk deletion, `410` containment, and partial device-wipe receipt
honesty.

Prove the client sequence:

1. receive a bearer-bearing start/rotate response;
2. `storeMonotonic`;
3. reload and verify the exact request/generation/bearer;
4. call the Clerk-authenticated handoff endpoint with that generation and
   bearer;
5. only then allow background status polling toward Clerk deletion.

A storage failure, read-back mismatch, stale generation, or handoff failure
must stop progression and retain a recoverable signed-in state.

- [ ] **Step 2: Run mobile tests and verify RED**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/accountDeletionFlow.test.ts \
  artifacts/woofwatcher-mobile/lib/accountDeletionRecovery.test.ts
```

Expected: FAIL because the flow and vault modules do not exist.

- [ ] **Step 3: Implement pure flow and generation-aware SecureStore vault**

Use one deterministic SecureStore key per request and store the typed record as
an opaque credential. Never place a bearer in AsyncStorage, care state,
exports, URLs, logs, analytics, error messages, or React Query keys. Pass it
only in the explicit recovery Authorization header or the authenticated
handoff possession header; the existing custom fetch must override global
Clerk injection for recovery GET.

- [ ] **Step 4: Wire Privacy and standalone recovery UI**

Keep “Clear care from this device” separate. The signed-in provider-deletion
action uses generated operations, displays only server actions, drains
lifecycle writes, persists and confirms recovery before Clerk deletion, wipes
device stores/files with a truthful receipt, clears query cache, then signs out
after terminal success. The recovery route remains reachable when Clerk is
absent and can call only the recovery GET.

- [ ] **Step 5: Verify Task 4**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/accountDeletion*.test.ts \
  artifacts/woofwatcher-mobile/lib/careDeviceWipe.test.ts
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm \
  --filter @workspace/woofwatcher-mobile run typecheck
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm run test:focused
git diff --check
```

- [ ] **Step 6: Commit, review, and publish**

Commit the mobile flow separately from server Tasks 1–3. Review it for token
leakage, generation rollback, handoff ordering, auth-guard reachability, and
truthful wipe receipts. Resolve all Critical/Important issues, re-run Step 5 on
the approved commit, publish it, fetch it, and verify remote/local tree
equality.

---

### Task 5: Whole-branch verification, independent review, CodeRabbit, CI, and release handoff

**Files:**

- Modify only evidence/handoff documents required by observed results.

**Output contract:**

Task 5 produces one immutable final candidate commit, a reviewed GitHub branch,
a PR targeting `codex/woofwatcher-premium-renovation`, successful CI for that
exact commit, local/remote tree equality, and an evidence-backed list of
external provider/store gates. It does not claim live Clerk, Apple, Supabase,
object-storage, EAS, TestFlight, or App Store readiness without real
credentials and platform evidence.

- [ ] **Step 1: Run the initial complete local verification boundary**

```bash
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm run test:focused
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm run typecheck
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm \
  --filter @workspace/api-server run build
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm \
  --filter @workspace/api-spec run codegen
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm exec tsc \
  -p artifacts/api-server/test/contracts/tsconfig.account-deletion.json
git diff --check
git status --short
```

Read full output and record exact pass/fail counts, generated hashes, and
external blockers.

- [ ] **Step 2: Run the broad independent code review and fix loop**

Create a full review package from `6172631d..HEAD`. Dispatch the most capable
fresh read-only reviewer. One implementation agent fixes the complete findings
list. A fresh reviewer evaluates only the exact fix range. Repeat until every
Critical/Important finding is closed. Commit each approved fix range; do not
publish an unreviewed worktree.

- [ ] **Step 3: Run CodeRabbit and its fix/re-review loop**

After genuine CodeRabbit authentication succeeds, run on the committed
recovery range:

```bash
CODERABBIT_LOG_FILE=/tmp/woofwatcher-coderabbit.log \
/tmp/coderabbit-home/.local/bin/coderabbit review --agent \
  --base-commit 6172631d055baea09e84ad93016fdbe4cf9f6410
```

Treat authentication, CLI, and filesystem errors as infrastructure failures,
not approval. Validate every CodeRabbit finding against the exact source. A
single writer fixes all real Critical/Major findings, then rerun CodeRabbit or
perform a scoped fresh independent re-review of that exact fix range until no
blocking issue remains.

- [ ] **Step 4: Freeze the final candidate and rerun the entire boundary**

After all independent-review and CodeRabbit fixes are committed, record
`FINAL_SHA=$(git rev-parse HEAD)` in the evidence log. From a clean worktree at
that exact commit, rerun every command from Step 1 plus:

```bash
node --experimental-strip-types --test artifacts/api-server/test/*.test.ts
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/accountDeletion*.test.ts
COREPACK_HOME=/tmp/woofwatcher-corepack corepack pnpm \
  --filter @workspace/api-spec run codegen
git diff --exit-code
test "$(git rev-parse HEAD)" = "$FINAL_SHA"
```

Regenerate twice and compare hashes as in Task 3. Any failure or generated
drift reopens implementation and review; after a fix, repeat this entire step
on the new exact commit.

- [ ] **Step 5: Publish exact final state, open PR, and require CI success**

Publish `FINAL_SHA` to `recovery/account-deletion-v2`, fetch it, and require:

```bash
test \
  "$(git rev-parse "$FINAL_SHA^{tree}")" = \
  "$(git rev-parse "origin/recovery/account-deletion-v2^{tree}")"
```

Open a PR to `codex/woofwatcher-premium-renovation`. Wait for
`WoofWatcher Verify` and every required check to finish successfully for the
same `FINAL_SHA`. A skipped, cancelled, stale-SHA, or failed required check is
not success. If CI requires a code change, return to Step 2, review the fix,
then repeat Steps 4–5 in full.

- [ ] **Step 6: Report only observed completion**

Report the exact final SHA, test counts, typechecks, builds, deterministic
generation hashes, independent-review verdict, CodeRabbit verdict or explicit
infrastructure blocker, branch/PR, remote tree equality, CI run/check URLs and
status, and remaining external provider/store actions. Do not label external
configuration complete until its real proof exists.

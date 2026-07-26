import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  initiateAccountDeletionRequest,
  runAccountDeletionStep,
  type AccountDeletionJobRecord,
  type AccountDeletionProviderActionRecord,
  type AccountDeletionProviderGateway,
  type AccountDeletionStore,
  type AccountDeletionState,
  type AppleOutcome,
  type LeaseFence,
  type ProviderEffectRecord,
  type RetryResumeState,
} from "../src/lib/account-deletion.ts";
import { AccountDeletionConflictError } from "../src/lib/account-deletion-store.ts";
import { createInMemoryAccountDeletionTestHarness } from "./support/account-deletion-memory-test-harness.ts";

const NOW = new Date("2026-07-25T12:00:00.000Z");
const LATER = new Date("2026-07-25T12:05:00.000Z");
const LEASE: LeaseFence = {
  workerId: "worker-a",
  leaseToken: "lease-a",
  leaseUntil: LATER,
};
const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const MIGRATION_0009 = readFileSync(
  new URL(
    "../../../supabase/migrations/0009_account_deletion_protocol.sql",
    import.meta.url,
  ),
  "utf8",
);

function createStore(input?: {
  jobs?: AccountDeletionJobRecord[];
  providerActions?: AccountDeletionProviderActionRecord[];
  beforeRequestTransaction?: () => Promise<void>;
}) {
  const configuration = {
    effectReplayHmacSecret: "environment-stable-replay-secret",
    now: () => new Date(NOW),
    initialRecords: {
      jobs: input?.jobs?.map((job) => ({ job, lease: LEASE })),
      providerActions: input?.providerActions,
    },
    beforeRequestTransaction: input?.beforeRequestTransaction,
  };
  return createInMemoryAccountDeletionTestHarness(
    configuration as Parameters<
      typeof createInMemoryAccountDeletionTestHarness
    >[0] & {
      beforeRequestTransaction?: () => Promise<void>;
    },
  );
}

function createJob(
  state: AccountDeletionState,
  overrides: Partial<AccountDeletionJobRecord> = {},
): AccountDeletionJobRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "user-a",
    state,
    stateGeneration: 0,
    deletionStartsAt: new Date(NOW),
    appleApplicable: false,
    activeProviderActionId: null,
    activeRecoveryGeneration: null,
    recoveryExpiresAt: null,
    recoveryHandoffGeneration: null,
    blockedCode: null,
    retryCode: null,
    retryResumeState: null,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    ...overrides,
  };
}

async function seedPersistedRequestReplay() {
  const store = createStore();
  const requestId = "15151515-1515-4515-8515-151515151515";
  const userId = "user-replay";
  const challengeId = "challenge-pre-provider-replay";
  await store.createChallenge({
    challengeId,
    userId,
    rawProofBindingSha256: SHA_A,
    clientHintEnvelopeCiphertext: "encrypted-hint",
    expiresAt: LATER,
    idempotencyKeyHash: SHA_A,
    requestFingerprintSha256: SHA_A,
    encryptedResponseBody: "challenge-response",
    responseStatus: 201,
  });
  const created = await store.createRequestAndConsumeProof({
    requestId,
    userId,
    challengeId,
    proofId: "proof-pre-provider-replay",
    proofBindingSha256: SHA_A,
    proofExpiresAt: LATER,
    exactEnvelopeSha256: SHA_B,
    appleApplicable: false,
    idempotencyKeyHash: SHA_B,
    requestFingerprintSha256: SHA_B,
    initialProviderEffectIntent: null,
    buildStoredResponse: () => ({
      encryptedResponseBody: "persisted-byte-exact-response",
      responseStatus: 202,
    }),
  });
  assert.equal(created.kind, "created");
  return { store, requestId, userId };
}

function gatewayFixture(
  appleOutcome: AppleOutcome = { kind: "unknown" },
  overrides: Partial<AccountDeletionProviderGateway> = {},
): AccountDeletionProviderGateway {
  return Object.freeze(
    Object.assign(Object.create(null) as AccountDeletionProviderGateway, {
      async createClerkReauthChallenge() {
        throw new Error("not used");
      },
      async verifyClerkReauth() {
        throw new Error("not used");
      },
      async getAuthoritativeIdentity(userId: string) {
        return {
          userId,
          appleApplicable: false,
          identityVersion: "identity-v1",
        };
      },
      async lookupAppleRevocationOutcome() {
        return appleOutcome;
      },
      async resumeAppleRevocation() {
        return {
          kind: "complete" as const,
          checkpoint: "checkpoint-1",
          providerReceipt: "apple-receipt",
          completedAt: new Date(NOW),
        };
      },
      async lookupClerkDeletionOutcome() {
        return { kind: "unknown" as const };
      },
      async deleteClerkUser() {
        return {
          kind: "deleted" as const,
          providerReceipt: "clerk-receipt",
          completedAt: new Date(NOW),
        };
      },
      ...overrides,
    }),
  );
}

test("generic transitions enforce the executable Task 1 adjacency through preflight and terminal immutability", async () => {
  const cases: Array<{
    from: AccountDeletionState;
    to: AccountDeletionState;
    retryResumeState?: RetryResumeState;
  }> = [
    { from: "challenge_required", to: "reauth_verified" },
    { from: "reauth_verified", to: "provider_action_required" },
    { from: "reauth_verified", to: "accepted" },
    { from: "provider_action_required", to: "reauth_verified" },
    { from: "accepted", to: "apple_revoking" },
    { from: "accepted", to: "preflight" },
    { from: "apple_revoking", to: "apple_revoked" },
    {
      from: "apple_revoking",
      to: "retry_required",
      retryResumeState: "apple_revoking",
    },
    {
      from: "retry_required",
      to: "apple_revoking",
    },
    { from: "apple_revoked", to: "preflight" },
  ];

  for (const [index, entry] of cases.entries()) {
    const id = `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    const actionKind =
      entry.from === "challenge_required" && entry.to === "reauth_verified"
        ? "clerk_reauthentication"
        : entry.from === "reauth_verified" &&
            entry.to === "provider_action_required"
          ? "apple_reauthorization"
          : entry.from === "provider_action_required" &&
              entry.to === "reauth_verified"
            ? "clerk_reauthentication"
            : null;
    const action: AccountDeletionProviderActionRecord | null =
      actionKind === "clerk_reauthentication"
        ? {
            id: `action-${index}`,
            requestId: id,
            kind: actionKind,
            generation: 0,
            clientHintEnvelope: "encrypted-hint",
            expiresAt: LATER,
            consumedAt: null,
          }
        : actionKind === "apple_reauthorization"
          ? {
              id: `action-${index}`,
              requestId: id,
              kind: actionKind,
              generation: 1,
              nonce: "nonce",
              expiresAt: LATER,
              consumedAt: null,
            }
          : null;
    const store = createStore({
      jobs: [
        createJob(entry.from, {
          id,
          activeProviderActionId: action?.id ?? null,
          appleApplicable:
            (entry.from === "accepted" && entry.to === "apple_revoking") ||
            actionKind === "apple_reauthorization",
          retryResumeState:
            entry.from === "retry_required"
              ? (entry.to as RetryResumeState)
              : null,
        }),
      ],
      providerActions: action ? [action] : [],
    });
    const updated = await store.transition({
      requestId: id,
      expectedState: entry.from,
      expectedGeneration: 0,
      nextState: entry.to,
      retryCode: entry.to === "retry_required" ? "provider_timeout" : null,
      retryResumeState: entry.retryResumeState ?? null,
      blockedCode: null,
      lease: LEASE,
    });
    assert.equal(updated.state, entry.to);
    assert.equal(updated.stateGeneration, 1);
  }

  for (const terminalState of ["blocked", "failed", "succeeded"] as const) {
    const store = createStore({ jobs: [createJob(terminalState)] });
    await assert.rejects(
      store.transition({
        requestId: createJob(terminalState).id,
        expectedState: terminalState,
        expectedGeneration: 0,
        nextState: "preflight",
        retryCode: null,
        retryResumeState: null,
        blockedCode: null,
        lease: LEASE,
      }),
      AccountDeletionConflictError,
    );
  }
});

test("Clerk actions installed by CAS use the current generation for both legal reauthentication transitions", async () => {
  const cases = [
    {
      state: "challenge_required" as const,
      nextState: "reauth_verified" as const,
      generation: 4,
    },
    {
      state: "provider_action_required" as const,
      nextState: "reauth_verified" as const,
      generation: 7,
    },
  ];

  for (const [index, fixture] of cases.entries()) {
    const requestId = `16161616-1616-4616-8616-${String(index).padStart(12, "0")}`;
    const action: AccountDeletionProviderActionRecord = {
      id: `clerk-action-${index}`,
      requestId,
      kind: "clerk_reauthentication",
      generation: fixture.generation,
      clientHintEnvelope: "encrypted-clerk-hint",
      expiresAt: LATER,
      consumedAt: null,
    };
    const store = createStore({
      jobs: [
        createJob(fixture.state, {
          id: requestId,
          stateGeneration: fixture.generation,
          appleApplicable: fixture.state === "provider_action_required",
        }),
      ],
    });

    assert.deepEqual(
      await store.compareAndSetProviderAction({
        requestId,
        expectedJobGeneration: fixture.generation,
        expectedActionId: null,
        nextAction: action,
        lease: LEASE,
      }),
      action,
    );
    const transitioned = await store.transition({
      requestId,
      expectedState: fixture.state,
      expectedGeneration: fixture.generation,
      nextState: fixture.nextState,
      retryCode: null,
      retryResumeState: null,
      blockedCode: null,
      lease: LEASE,
    });
    assert.equal(transitioned.state, "reauth_verified");
    assert.equal(transitioned.stateGeneration, fixture.generation + 1);
  }
});

test("generic transitions reject every post-preflight edge until evidence-bound Task 2 and Task 3 operations exist", async () => {
  const unsupported: Array<{
    from: AccountDeletionState;
    to: AccountDeletionState;
    retryResumeState?: RetryResumeState;
  }> = [
    { from: "preflight", to: "cleanup_pending" },
    { from: "cleanup_pending", to: "cleanup_running" },
    { from: "cleanup_running", to: "object_inventory" },
    {
      from: "cleanup_running",
      to: "retry_required",
      retryResumeState: "cleanup_pending",
    },
    { from: "object_inventory", to: "object_cleanup_pending" },
    {
      from: "object_inventory",
      to: "retry_required",
      retryResumeState: "object_inventory",
    },
    { from: "object_cleanup_pending", to: "object_cleanup_running" },
    { from: "object_cleanup_pending", to: "object_cleanup_complete" },
    { from: "object_cleanup_running", to: "object_cleanup_complete" },
    {
      from: "object_cleanup_running",
      to: "retry_required",
      retryResumeState: "object_cleanup_running",
    },
    { from: "object_cleanup_complete", to: "clerk_deleting" },
    { from: "clerk_deleting", to: "receipt_finalizing" },
    {
      from: "clerk_deleting",
      to: "retry_required",
      retryResumeState: "clerk_deleting",
    },
    { from: "receipt_finalizing", to: "succeeded" },
    { from: "receipt_finalizing", to: "failed" },
    {
      from: "receipt_finalizing",
      to: "retry_required",
      retryResumeState: "receipt_finalizing",
    },
    { from: "retry_required", to: "cleanup_pending" },
    { from: "retry_required", to: "object_inventory" },
    { from: "retry_required", to: "object_cleanup_running" },
    { from: "retry_required", to: "clerk_deleting" },
    { from: "retry_required", to: "receipt_finalizing" },
  ];

  for (const [index, entry] of unsupported.entries()) {
    const id = `90000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    const retryResumeState =
      entry.from === "retry_required" ? (entry.to as RetryResumeState) : null;
    const store = createStore({
      jobs: [
        createJob(entry.from, {
          id,
          retryCode: entry.from === "retry_required" ? "durable-retry" : null,
          retryResumeState,
        }),
      ],
    });
    await assert.rejects(
      store.transition({
        requestId: id,
        expectedState: entry.from,
        expectedGeneration: 0,
        nextState: entry.to,
        retryCode: entry.to === "retry_required" ? "durable-retry" : null,
        retryResumeState: entry.retryResumeState ?? null,
        blockedCode: null,
        lease: LEASE,
      }),
      AccountDeletionConflictError,
    );
  }
});

test("generic transition rejects illegal, caller-selected retry, Apple-bypass, and provider-action acceptance edges", async () => {
  const store = createStore({
    jobs: [createJob("accepted", { appleApplicable: true })],
  });

  await assert.rejects(
    store.transition({
      requestId: createJob("accepted").id,
      expectedState: "accepted",
      expectedGeneration: 0,
      nextState: "preflight",
      retryCode: null,
      retryResumeState: null,
      blockedCode: null,
      lease: LEASE,
    }),
    AccountDeletionConflictError,
  );

  const actionStore = createStore({
    jobs: [
      createJob("provider_action_required", {
        activeProviderActionId: "action-a",
      }),
    ],
  });
  await assert.rejects(
    actionStore.transition({
      requestId: createJob("provider_action_required").id,
      expectedState: "provider_action_required",
      expectedGeneration: 0,
      nextState: "accepted",
      retryCode: null,
      retryResumeState: null,
      blockedCode: null,
      lease: LEASE,
    }),
    AccountDeletionConflictError,
  );

  const retryStore = createStore({
    jobs: [
      createJob("retry_required", {
        retryCode: "timeout",
        retryResumeState: "apple_revoking",
      }),
    ],
  });
  await assert.rejects(
    retryStore.transition({
      requestId: createJob("retry_required").id,
      expectedState: "retry_required",
      expectedGeneration: 0,
      nextState: "clerk_deleting",
      retryCode: null,
      retryResumeState: null,
      blockedCode: null,
      lease: LEASE,
    }),
    AccountDeletionConflictError,
  );
});

test("authorization transitions fail closed when the exact durable provider action is missing", async () => {
  for (const [from, to] of [
    ["challenge_required", "reauth_verified"],
    ["reauth_verified", "provider_action_required"],
    ["provider_action_required", "reauth_verified"],
  ] as const) {
    const job = createJob(from, {
      activeProviderActionId: "missing-action",
      appleApplicable: to === "provider_action_required",
    });
    const store = createStore({ jobs: [job] });
    await assert.rejects(
      store.transition({
        requestId: job.id,
        expectedState: from,
        expectedGeneration: 0,
        nextState: to,
        retryCode: null,
        retryResumeState: null,
        blockedCode: null,
        lease: LEASE,
      }),
      AccountDeletionConflictError,
    );
  }
});

test("transition and effect mutations require the unchanged live lease fence", async () => {
  const store = createStore({ jobs: [createJob("preflight")] });
  const stale = { ...LEASE, leaseUntil: new Date("2026-07-25T11:59:59Z") };
  const changed = { ...LEASE, leaseToken: "different" };
  for (const lease of [stale, changed]) {
    await assert.rejects(
      store.transition({
        requestId: createJob("preflight").id,
        expectedState: "preflight",
        expectedGeneration: 0,
        nextState: "cleanup_pending",
        retryCode: null,
        retryResumeState: null,
        blockedCode: null,
        lease,
      }),
      AccountDeletionConflictError,
    );
  }
});

test("request creation consumes challenge and globally unique proof atomically after idempotency resolution", async () => {
  const store = createStore();
  const response = "ciphertext-response";
  const challenge = await store.createChallenge({
    challengeId: "challenge-a",
    userId: "user-a",
    rawProofBindingSha256: SHA_A,
    clientHintEnvelopeCiphertext: "encrypted-hint",
    expiresAt: LATER,
    idempotencyKeyHash: SHA_A,
    requestFingerprintSha256: SHA_B,
    encryptedResponseBody: "challenge-response",
    responseStatus: 201,
  });
  assert.equal(challenge.kind, "created");

  const created = await store.createRequestAndConsumeProof({
    requestId: "11111111-1111-4111-8111-111111111111",
    userId: "user-a",
    challengeId: "challenge-a",
    proofId: "proof-global",
    proofBindingSha256: SHA_A,
    proofExpiresAt: LATER,
    exactEnvelopeSha256: SHA_B,
    appleApplicable: false,
    idempotencyKeyHash: SHA_A,
    requestFingerprintSha256: SHA_B,
    initialProviderEffectIntent: null,
    buildStoredResponse({ job }) {
      assert.equal(job.deletionStartsAt.toISOString(), NOW.toISOString());
      return { encryptedResponseBody: response, responseStatus: 202 };
    },
  });
  assert.equal(created.kind, "created");
  assert.equal(created.encryptedResponseBody, response);

  const replay = await store.createRequestAndConsumeProof({
    requestId: "22222222-2222-4222-8222-222222222222",
    userId: "user-a",
    challengeId: "challenge-a",
    proofId: "another-proof",
    proofBindingSha256: SHA_A,
    proofExpiresAt: LATER,
    exactEnvelopeSha256: SHA_B,
    appleApplicable: false,
    idempotencyKeyHash: SHA_A,
    requestFingerprintSha256: SHA_B,
    initialProviderEffectIntent: null,
    buildStoredResponse() {
      throw new Error("replay must not reseal");
    },
  });
  assert.equal(replay.kind, "replay");
  assert.equal(replay.encryptedResponseBody, response);

  const conflict = await store.createRequestAndConsumeProof({
    requestId: "33333333-3333-4333-8333-333333333333",
    userId: "user-a",
    challengeId: "challenge-a",
    proofId: "another-proof",
    proofBindingSha256: SHA_A,
    proofExpiresAt: LATER,
    exactEnvelopeSha256: SHA_B,
    appleApplicable: false,
    idempotencyKeyHash: SHA_A,
    requestFingerprintSha256: "c".repeat(64),
    initialProviderEffectIntent: null,
    buildStoredResponse() {
      throw new Error("conflict must not reseal");
    },
  });
  assert.equal(conflict.kind, "conflict");
});

test("proof subject, challenge binding, expiry, one-use challenge, and global proof claim fail closed", async () => {
  const store = createStore();
  await store.createChallenge({
    challengeId: "challenge-a",
    userId: "user-a",
    rawProofBindingSha256: SHA_A,
    clientHintEnvelopeCiphertext: "encrypted-hint",
    expiresAt: LATER,
    idempotencyKeyHash: SHA_A,
    requestFingerprintSha256: SHA_A,
    encryptedResponseBody: "challenge-response",
    responseStatus: 201,
  });

  const base = {
    requestId: "11111111-1111-4111-8111-111111111111",
    userId: "user-a",
    challengeId: "challenge-a",
    proofId: "proof-global",
    proofBindingSha256: SHA_A,
    proofExpiresAt: LATER,
    exactEnvelopeSha256: SHA_B,
    appleApplicable: false,
    idempotencyKeyHash: SHA_B,
    requestFingerprintSha256: SHA_B,
    initialProviderEffectIntent: null,
    buildStoredResponse: () => ({
      encryptedResponseBody: "response",
      responseStatus: 202,
    }),
  } as const;

  assert.equal(
    (
      await store.createRequestAndConsumeProof({
        ...base,
        userId: "user-b",
      })
    ).kind,
    "proof_already_consumed",
  );
  assert.equal(
    (
      await store.createRequestAndConsumeProof({
        ...base,
        proofExpiresAt: new Date("2026-07-25T11:59:59Z"),
      })
    ).kind,
    "proof_already_consumed",
  );

  const winner = await store.createRequestAndConsumeProof(base);
  assert.equal(winner.kind, "created");
  const loser = await store.createRequestAndConsumeProof({
    ...base,
    requestId: "22222222-2222-4222-8222-222222222222",
    idempotencyKeyHash: "c".repeat(64),
  });
  assert.equal(loser.kind, "proof_already_consumed");
});

test("two valid concurrent requests race on one global proof and the losing challenge remains usable", async () => {
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const store = createStore({
    async beforeRequestTransaction() {
      arrivals += 1;
      if (arrivals === 2) {
        release();
      }
      await gate;
    },
  });
  for (const [userId, challengeId, keyHash] of [
    ["user-a", "challenge-race-a", SHA_A],
    ["user-b", "challenge-race-b", SHA_B],
  ] as const) {
    await store.createChallenge({
      challengeId,
      userId,
      rawProofBindingSha256: SHA_A,
      clientHintEnvelopeCiphertext: `hint-${userId}`,
      expiresAt: LATER,
      idempotencyKeyHash: keyHash,
      requestFingerprintSha256: SHA_A,
      encryptedResponseBody: `challenge-response-${userId}`,
      responseStatus: 201,
    });
  }
  const inputs = [
    {
      requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      userId: "user-a",
      challengeId: "challenge-race-a",
      proofId: "proof-raced-globally",
      proofBindingSha256: SHA_A,
      proofExpiresAt: LATER,
      exactEnvelopeSha256: SHA_A,
      appleApplicable: false,
      idempotencyKeyHash: SHA_A,
      requestFingerprintSha256: SHA_B,
      initialProviderEffectIntent: null,
      buildStoredResponse: () => ({
        encryptedResponseBody: "response-user-a",
        responseStatus: 202,
      }),
    },
    {
      requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      userId: "user-b",
      challengeId: "challenge-race-b",
      proofId: "proof-raced-globally",
      proofBindingSha256: SHA_A,
      proofExpiresAt: LATER,
      exactEnvelopeSha256: SHA_B,
      appleApplicable: false,
      idempotencyKeyHash: SHA_B,
      requestFingerprintSha256: SHA_A,
      initialProviderEffectIntent: null,
      buildStoredResponse: () => ({
        encryptedResponseBody: "response-user-b",
        responseStatus: 202,
      }),
    },
  ] as const;
  const results = await Promise.all(
    inputs.map((input) => store.createRequestAndConsumeProof(input)),
  );
  assert.equal(arrivals, 2);
  assert.equal(results.filter((result) => result.kind === "created").length, 1);
  assert.equal(
    results.filter((result) => result.kind === "proof_already_consumed").length,
    1,
  );
  const loserIndex = results.findIndex(
    (result) => result.kind === "proof_already_consumed",
  );
  const loser = inputs[loserIndex]!;
  const retry = await store.createRequestAndConsumeProof({
    ...loser,
    proofId: "proof-loser-retry",
    buildStoredResponse: () => ({
      encryptedResponseBody: `retry-${loser.userId}`,
      responseStatus: 202,
    }),
  });
  assert.equal(retry.kind, "created");
});

test("request creation requires an initial Apple intent exactly when authoritative identity says Apple applies", async () => {
  for (const appleApplicable of [false, true]) {
    const store = createStore();
    await store.createChallenge({
      challengeId: `challenge-${appleApplicable}`,
      userId: "user-a",
      rawProofBindingSha256: SHA_A,
      clientHintEnvelopeCiphertext: "hint",
      expiresAt: LATER,
      idempotencyKeyHash: appleApplicable ? SHA_A : SHA_B,
      requestFingerprintSha256: SHA_A,
      encryptedResponseBody: "challenge-response",
      responseStatus: 201,
    });
    await assert.rejects(
      store.createRequestAndConsumeProof({
        requestId: appleApplicable
          ? "44444444-4444-4444-8444-444444444444"
          : "55555555-5555-4555-8555-555555555555",
        userId: "user-a",
        challengeId: `challenge-${appleApplicable}`,
        proofId: `proof-${appleApplicable}`,
        proofBindingSha256: SHA_A,
        proofExpiresAt: LATER,
        exactEnvelopeSha256: SHA_B,
        appleApplicable,
        idempotencyKeyHash: appleApplicable ? SHA_B : SHA_A,
        requestFingerprintSha256: SHA_B,
        initialProviderEffectIntent: appleApplicable
          ? null
          : { effectId: "effect-unexpected", kind: "apple_revoke" },
        buildStoredResponse: () => ({
          encryptedResponseBody: "must-not-commit",
          responseStatus: 202,
        }),
      }),
      AccountDeletionConflictError,
    );
  }
});

test("request initiation derives Apple applicability from authoritative identity and ignores client substitution", async () => {
  const module =
    (await import("../src/lib/account-deletion.ts")) as typeof import("../src/lib/account-deletion.ts") & {
      initiateAccountDeletionRequest: (input: {
        store: AccountDeletionStore;
        gateway: AccountDeletionProviderGateway;
        request: {
          requestId: string;
          userId: string;
          challengeId: string;
          proofId: string;
          proofBindingSha256: string;
          proofExpiresAt: Date;
          exactEnvelopeSha256: string;
          idempotencyKeyHash: string;
          requestFingerprintSha256: string;
          buildStoredResponse: (created: { job: AccountDeletionJobRecord }) => {
            encryptedResponseBody: string;
            responseStatus: number;
          };
        };
        appleEffectId: string;
      }) => Promise<
        | {
            kind: "created";
            job: AccountDeletionJobRecord;
            encryptedResponseBody: string;
            responseStatus: number;
          }
        | { kind: string }
      >;
    };

  for (const appleApplicable of [false, true]) {
    const store = createStore();
    const suffix = appleApplicable ? "apple" : "password";
    await store.createChallenge({
      challengeId: `challenge-derived-${suffix}`,
      userId: `user-${suffix}`,
      rawProofBindingSha256: SHA_A,
      clientHintEnvelopeCiphertext: "encrypted-hint",
      expiresAt: LATER,
      idempotencyKeyHash: appleApplicable ? SHA_A : SHA_B,
      requestFingerprintSha256: SHA_A,
      encryptedResponseBody: "challenge-response",
      responseStatus: 201,
    });
    const request = {
      requestId: appleApplicable
        ? "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
        : "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      userId: `user-${suffix}`,
      challengeId: `challenge-derived-${suffix}`,
      proofId: `proof-derived-${suffix}`,
      proofBindingSha256: SHA_A,
      proofExpiresAt: LATER,
      exactEnvelopeSha256: SHA_B,
      idempotencyKeyHash: appleApplicable ? SHA_B : SHA_A,
      requestFingerprintSha256: SHA_B,
      buildStoredResponse: ({ job }: { job: AccountDeletionJobRecord }) => ({
        encryptedResponseBody: `response:${job.appleApplicable}`,
        responseStatus: 202,
      }),
      appleApplicable: !appleApplicable,
    };
    const result = await module.initiateAccountDeletionRequest({
      store,
      gateway: gatewayFixture(
        { kind: "unknown" },
        {
          async getAuthoritativeIdentity(userId) {
            return {
              userId,
              appleApplicable,
              identityVersion: "identity-authoritative",
            };
          },
        },
      ),
      request,
      appleEffectId: appleApplicable
        ? "ffffffff-ffff-4fff-8fff-ffffffffffff"
        : "12121212-1212-4212-8212-121212121212",
    });
    assert.equal(result.kind, "created");
    if (result.kind !== "created") {
      assert.fail("request initiation did not create");
    }
    assert.equal(result.job.appleApplicable, appleApplicable);
    assert.equal(
      (await store.listEffects(result.job.id, "apple_revoke")).length,
      appleApplicable ? 1 : 0,
    );
  }
});

test("request initiation rejects authoritative identity substitution before proof consumption", async () => {
  const module =
    (await import("../src/lib/account-deletion.ts")) as typeof import("../src/lib/account-deletion.ts") & {
      initiateAccountDeletionRequest: (input: {
        store: AccountDeletionStore;
        gateway: AccountDeletionProviderGateway;
        request: {
          requestId: string;
          userId: string;
          challengeId: string;
          proofId: string;
          proofBindingSha256: string;
          proofExpiresAt: Date;
          exactEnvelopeSha256: string;
          idempotencyKeyHash: string;
          requestFingerprintSha256: string;
          buildStoredResponse: (created: { job: AccountDeletionJobRecord }) => {
            encryptedResponseBody: string;
            responseStatus: number;
          };
        };
        appleEffectId: string;
      }) => Promise<unknown>;
    };
  const store = createStore();
  await store.createChallenge({
    challengeId: "challenge-substitution",
    userId: "user-victim",
    rawProofBindingSha256: SHA_A,
    clientHintEnvelopeCiphertext: "hint",
    expiresAt: LATER,
    idempotencyKeyHash: SHA_A,
    requestFingerprintSha256: SHA_A,
    encryptedResponseBody: "challenge-response",
    responseStatus: 201,
  });
  const request = {
    requestId: "13131313-1313-4313-8313-131313131313",
    userId: "user-victim",
    challengeId: "challenge-substitution",
    proofId: "proof-substitution",
    proofBindingSha256: SHA_A,
    proofExpiresAt: LATER,
    exactEnvelopeSha256: SHA_B,
    idempotencyKeyHash: SHA_B,
    requestFingerprintSha256: SHA_B,
    buildStoredResponse: () => ({
      encryptedResponseBody: "must-not-create",
      responseStatus: 202,
    }),
  };
  await assert.rejects(
    module.initiateAccountDeletionRequest({
      store,
      gateway: {
        ...gatewayFixture(),
        async getAuthoritativeIdentity() {
          return {
            userId: "attacker",
            appleApplicable: true,
            identityVersion: "substituted",
          };
        },
      },
      request,
      appleEffectId: "14141414-1414-4414-8414-141414141414",
    }),
    /authoritative identity subject mismatch/,
  );
  const retry = await module.initiateAccountDeletionRequest({
    store,
    gateway: gatewayFixture(),
    request,
    appleEffectId: "14141414-1414-4414-8414-141414141414",
  });
  assert.deepEqual((retry as { kind: string }).kind, "created");
});

test("exact initiation replay returns the stored response before an unavailable identity provider is called", async () => {
  const { store, requestId, userId } = await seedPersistedRequestReplay();
  let identityProviderCalls = 0;
  const replay = await initiateAccountDeletionRequest({
    store,
    gateway: gatewayFixture(
      { kind: "unknown" },
      {
        async getAuthoritativeIdentity() {
          identityProviderCalls += 1;
          throw new Error("identity provider unavailable");
        },
      },
    ),
    request: {
      requestId,
      userId,
      challengeId: "unavailable-provider-must-not-reach-challenge",
      proofId: "unavailable-provider-must-not-reach-proof",
      proofBindingSha256: SHA_A,
      proofExpiresAt: LATER,
      exactEnvelopeSha256: SHA_B,
      idempotencyKeyHash: SHA_B,
      requestFingerprintSha256: SHA_B,
      buildStoredResponse: () => ({
        encryptedResponseBody: "must-not-reseal",
        responseStatus: 500,
      }),
    },
    appleEffectId: "17171717-1717-4717-8717-171717171717",
  });

  assert.equal(identityProviderCalls, 0);
  assert.equal(replay.kind, "replay");
  if (replay.kind !== "replay") {
    assert.fail("persisted request did not replay");
  }
  assert.equal(replay.job.id, requestId);
  assert.equal(replay.encryptedResponseBody, "persisted-byte-exact-response");
  assert.equal(replay.responseStatus, 202);
});

test("initiation fingerprint conflict returns before an unavailable identity provider is called", async () => {
  const { store, requestId, userId } = await seedPersistedRequestReplay();
  let identityProviderCalls = 0;
  const conflict = await initiateAccountDeletionRequest({
    store,
    gateway: gatewayFixture(
      { kind: "unknown" },
      {
        async getAuthoritativeIdentity() {
          identityProviderCalls += 1;
          throw new Error("identity provider unavailable");
        },
      },
    ),
    request: {
      requestId,
      userId,
      challengeId: "conflict-must-not-reach-challenge",
      proofId: "conflict-must-not-reach-proof",
      proofBindingSha256: SHA_A,
      proofExpiresAt: LATER,
      exactEnvelopeSha256: SHA_B,
      idempotencyKeyHash: SHA_B,
      requestFingerprintSha256: SHA_A,
      buildStoredResponse: () => ({
        encryptedResponseBody: "must-not-reseal",
        responseStatus: 500,
      }),
    },
    appleEffectId: "18181818-1818-4818-8818-181818181818",
  });

  assert.equal(identityProviderCalls, 0);
  assert.deepEqual(conflict, { kind: "conflict" });
});

test("response sealer thenables and re-entry fail before proof consumption", async () => {
  const store = createStore();
  await store.createChallenge({
    challengeId: "challenge-a",
    userId: "user-a",
    rawProofBindingSha256: SHA_A,
    clientHintEnvelopeCiphertext: "hint",
    expiresAt: LATER,
    idempotencyKeyHash: SHA_A,
    requestFingerprintSha256: SHA_A,
    encryptedResponseBody: "challenge-response",
    responseStatus: 201,
  });
  const input = {
    requestId: "11111111-1111-4111-8111-111111111111",
    userId: "user-a",
    challengeId: "challenge-a",
    proofId: "proof-a",
    proofBindingSha256: SHA_A,
    proofExpiresAt: LATER,
    exactEnvelopeSha256: SHA_B,
    appleApplicable: false,
    idempotencyKeyHash: SHA_B,
    requestFingerprintSha256: SHA_B,
    initialProviderEffectIntent: null,
  } as const;
  await assert.rejects(
    store.createRequestAndConsumeProof({
      ...input,
      buildStoredResponse: (() =>
        Promise.resolve({
          encryptedResponseBody: "bad",
          responseStatus: 202,
        })) as never,
    }),
    AccountDeletionConflictError,
  );
  await assert.rejects(
    store.createRequestAndConsumeProof({
      ...input,
      buildStoredResponse: () => {
        void store.loadRequest(input.requestId);
        return {
          encryptedResponseBody: "bad-reentry",
          responseStatus: 202,
        };
      },
    }),
    AccountDeletionConflictError,
  );
  const created = await store.createRequestAndConsumeProof({
    ...input,
    buildStoredResponse: () => ({
      encryptedResponseBody: "good",
      responseStatus: 202,
    }),
  });
  assert.equal(created.kind, "created");
});

test("a missing-user blocked receipt is UUID-compatible and persists without effect or recovery artifacts", async () => {
  const store = createStore();
  const created = await store.createBlockedRequest({
    requestId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    authenticatedSubjectUserId: "missing-user",
    code: "missing_user",
    idempotencyKeyHash: SHA_A,
    requestFingerprintSha256: SHA_B,
    buildStoredResponse: ({ receipt }) => ({
      encryptedResponseBody: `blocked:${receipt.receiptId}`,
      responseStatus: 409,
    }),
  });
  assert.equal(created.kind, "created");
  if (created.kind !== "created") {
    assert.fail("blocked request was not created");
  }
  assert.match(
    created.receipt.receiptId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );

  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create table public.users (id text primary key);
    `);
    await db.exec(MIGRATION_0009);
    await db.query(
      `
        insert into public.account_deletion_jobs
          (id, user_id, state, state_generation, deletion_starts_at,
           apple_applicable, blocked_code, created_at, updated_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        created.job.id,
        created.job.userId,
        created.job.state,
        created.job.stateGeneration,
        created.job.deletionStartsAt.toISOString(),
        created.job.appleApplicable,
        created.job.blockedCode,
        created.job.createdAt.toISOString(),
        created.job.updatedAt.toISOString(),
      ],
    );
    await db.query(
      `
        insert into public.account_deletion_receipts
          (receipt_id, request_id, terminal_state, data_cleanup_state,
           apple_state, clerk_state, object_state, terminal_code, finalized_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        created.receipt.receiptId,
        created.receipt.requestId,
        created.receipt.terminalState,
        created.receipt.dataCleanupState,
        created.receipt.appleState,
        created.receipt.clerkState,
        created.receipt.objectState,
        created.receipt.terminalCode,
        created.receipt.finalizedAt.toISOString(),
      ],
    );
    const artifacts = await db.query<{
      effects: number;
      recoveryTokens: number;
    }>(`
      select
        (select count(*)::int
         from public.account_deletion_provider_effects) as effects,
        (select count(*)::int
         from public.account_deletion_recovery_token_digests)
          as "recoveryTokens"
    `);
    assert.deepEqual(artifacts.rows, [{ effects: 0, recoveryTokens: 0 }]);
  } finally {
    await db.close();
  }
});

test("effect intent derives a stable secret replay key, is tuple-idempotent, and rejects missing replay material on claim", async () => {
  const store = createStore({
    jobs: [createJob("apple_revoking", { appleApplicable: true })],
  });
  const input = {
    effectId: "effect-a",
    requestId: createJob("apple_revoking").id,
    kind: "apple_revoke" as const,
    objectInventoryId: null,
    expectedJobGeneration: 0,
    replayMaterialCiphertext: null,
    lease: LEASE,
  };
  const first = await store.createProviderEffectIntent(input);
  const second = await store.createProviderEffectIntent(input);
  assert.equal(first.replayKey, second.replayKey);
  assert.notEqual(first.replayKey, first.id);
  await assert.rejects(
    store.createProviderEffectIntent({
      ...input,
      kind: "clerk_delete",
    }),
    AccountDeletionConflictError,
  );
  assert.equal(
    await store.claimEffect({
      effectId: first.id,
      expectedObjectInventoryId: null,
      expectedJobGeneration: 0,
      lease: LEASE,
    }),
    null,
  );
});

test("effect claim and commit reject every attempt, replay, generation, object, and lease fence mismatch", async () => {
  const requestId = createJob("apple_revoking").id;
  const store = createStore({
    jobs: [
      createJob("apple_revoking", {
        appleApplicable: true,
        stateGeneration: 2,
      }),
    ],
  });
  const effect = await store.createProviderEffectIntent({
    effectId: "effect-fence",
    requestId,
    kind: "apple_revoke",
    objectInventoryId: null,
    expectedJobGeneration: 2,
    replayMaterialCiphertext: "encrypted-credential",
    lease: LEASE,
  });
  assert.equal(
    await store.claimEffect({
      effectId: effect.id,
      expectedObjectInventoryId: "wrong-object",
      expectedJobGeneration: 2,
      lease: LEASE,
    }),
    null,
  );
  assert.equal(
    await store.claimEffect({
      effectId: effect.id,
      expectedObjectInventoryId: null,
      expectedJobGeneration: 1,
      lease: LEASE,
    }),
    null,
  );
  for (const lease of [
    { ...LEASE, workerId: "wrong-worker" },
    { ...LEASE, leaseToken: "wrong-token" },
    { ...LEASE, leaseUntil: new Date("2026-07-25T11:59:59Z") },
  ]) {
    await assert.rejects(
      store.claimEffect({
        effectId: effect.id,
        expectedObjectInventoryId: null,
        expectedJobGeneration: 2,
        lease,
      }),
      AccountDeletionConflictError,
    );
  }
  const claimed = await store.claimEffect({
    effectId: effect.id,
    expectedObjectInventoryId: null,
    expectedJobGeneration: 2,
    lease: LEASE,
  });
  assert.ok(claimed);
  const commit = {
    effectId: effect.id,
    expectedAttempt: claimed.attempt,
    expectedReplayKey: claimed.replayKey,
    checkpointCiphertext: "checkpoint",
    providerReceiptCiphertext: "receipt",
    outcome: "committed" as const,
    reasonCode: null,
    lease: LEASE,
  };
  await assert.rejects(
    store.commitEffect({ ...commit, expectedAttempt: claimed.attempt + 1 }),
    AccountDeletionConflictError,
  );
  await assert.rejects(
    store.commitEffect({ ...commit, expectedReplayKey: "wrong-replay-key" }),
    AccountDeletionConflictError,
  );
  for (const lease of [
    { ...LEASE, workerId: "wrong-worker" },
    { ...LEASE, leaseToken: "wrong-token" },
    { ...LEASE, leaseUntil: new Date("2026-07-25T11:59:59Z") },
  ]) {
    await assert.rejects(
      store.commitEffect({ ...commit, lease }),
      AccountDeletionConflictError,
    );
  }
  await store.transition({
    requestId,
    expectedState: "apple_revoking",
    expectedGeneration: 2,
    nextState: "retry_required",
    retryCode: "provider-timeout",
    retryResumeState: "apple_revoking",
    blockedCode: null,
    lease: LEASE,
  });
  await assert.rejects(
    store.commitEffect(commit),
    AccountDeletionConflictError,
  );
});

test("Apple replay-material attachment consumes the exact action and accepts atomically with idempotent replay", async () => {
  const requestId = createJob("provider_action_required").id;
  const action: AccountDeletionProviderActionRecord = {
    id: "action-apple",
    requestId,
    kind: "apple_reauthorization",
    generation: 0,
    nonce: "nonce-a",
    expiresAt: LATER,
    consumedAt: null,
  };
  const store = createStore({
    jobs: [
      createJob("provider_action_required", {
        appleApplicable: true,
        activeProviderActionId: action.id,
      }),
    ],
    providerActions: [action],
  });
  await store.createProviderEffectIntent({
    effectId: "effect-apple",
    requestId,
    kind: "apple_revoke",
    objectInventoryId: null,
    expectedJobGeneration: 0,
    replayMaterialCiphertext: null,
    lease: LEASE,
  });
  const input = {
    effectId: "effect-apple",
    requestId,
    expectedJobGeneration: 0,
    expectedProviderActionId: action.id,
    replayMaterialCiphertext: "encrypted-apple-credential",
  };
  const first = await store.attachProviderEffectReplayMaterialAndAccept(input);
  assert.equal(first.job.state, "accepted");
  assert.equal(first.job.stateGeneration, 1);
  assert.equal(first.job.activeProviderActionId, null);
  assert.equal(
    first.effect.replayMaterialCiphertext,
    input.replayMaterialCiphertext,
  );
  assert.equal(await store.loadProviderAction(requestId), null);

  const replay = await store.attachProviderEffectReplayMaterialAndAccept(input);
  assert.equal(replay.job.stateGeneration, 1);
  await assert.rejects(
    store.attachProviderEffectReplayMaterialAndAccept({
      ...input,
      replayMaterialCiphertext: "different",
    }),
    AccountDeletionConflictError,
  );
});

test("the real Apple provider-action chain uses the target generation and retains exact consumed history", async () => {
  const requestId = "66666666-6666-4666-8666-666666666666";
  const actionId = "77777777-7777-4777-8777-777777777777";
  const effectId = "88888888-8888-4888-8888-888888888888";
  const store = createStore({
    jobs: [
      createJob("reauth_verified", {
        id: requestId,
        appleApplicable: true,
      }),
    ],
  });
  await store.createProviderEffectIntent({
    effectId,
    requestId,
    kind: "apple_revoke",
    objectInventoryId: null,
    expectedJobGeneration: 0,
    replayMaterialCiphertext: null,
    lease: LEASE,
  });
  const action: AccountDeletionProviderActionRecord = {
    id: actionId,
    requestId,
    kind: "apple_reauthorization",
    generation: 1,
    nonce: "apple-nonce",
    expiresAt: LATER,
    consumedAt: null,
  };
  await store.compareAndSetProviderAction({
    requestId,
    expectedJobGeneration: 0,
    expectedActionId: null,
    nextAction: action,
    lease: LEASE,
  });
  const waiting = await store.transition({
    requestId,
    expectedState: "reauth_verified",
    expectedGeneration: 0,
    nextState: "provider_action_required",
    retryCode: null,
    retryResumeState: null,
    blockedCode: null,
    lease: LEASE,
  });
  assert.equal(waiting.stateGeneration, 1);

  const input = {
    effectId,
    requestId,
    expectedJobGeneration: 1,
    expectedProviderActionId: actionId,
    replayMaterialCiphertext: "encrypted-apple-credential",
  };
  const accepted =
    await store.attachProviderEffectReplayMaterialAndAccept(input);
  assert.equal(accepted.job.state, "accepted");
  assert.equal(accepted.job.stateGeneration, 2);
  assert.equal(await store.loadProviderAction(requestId), null);

  const history = await (
    store as AccountDeletionStore & {
      listProviderActionHistory(
        requestId: string,
      ): Promise<AccountDeletionProviderActionRecord[]>;
    }
  ).listProviderActionHistory(requestId);
  assert.deepEqual(history, [
    {
      ...action,
      consumedAt: NOW,
    },
  ]);

  await assert.rejects(
    store.attachProviderEffectReplayMaterialAndAccept({
      ...input,
      expectedProviderActionId: "99999999-9999-4999-8999-999999999999",
    }),
    AccountDeletionConflictError,
  );
  const replay = await store.attachProviderEffectReplayMaterialAndAccept(input);
  assert.equal(replay.job.stateGeneration, 2);
  assert.deepEqual(
    await (
      store as AccountDeletionStore & {
        listProviderActionHistory(
          requestId: string,
        ): Promise<AccountDeletionProviderActionRecord[]>;
      }
    ).listProviderActionHistory(requestId),
    history,
  );
});

test("runAccountDeletionStep performs one advancement, respects Apple-before-preflight, and stops at preflight", async () => {
  const directStore = createStore({ jobs: [createJob("accepted")] });
  const direct = await runAccountDeletionStep({
    requestId: createJob("accepted").id,
    store: directStore,
    gateway: gatewayFixture(),
    lease: LEASE,
  });
  assert.equal(direct.kind, "advanced");
  assert.equal(direct.job.state, "preflight");
  assert.equal(direct.job.stateGeneration, 1);
  const stopped = await runAccountDeletionStep({
    requestId: direct.job.id,
    store: directStore,
    gateway: gatewayFixture(),
    lease: LEASE,
  });
  assert.equal(stopped.kind, "waiting");
  assert.equal(stopped.job.state, "preflight");

  const appleStore = createStore({
    jobs: [createJob("accepted", { appleApplicable: true })],
  });
  await appleStore.createProviderEffectIntent({
    effectId: "effect-accepted",
    requestId: createJob("accepted").id,
    kind: "apple_revoke",
    objectInventoryId: null,
    expectedJobGeneration: 0,
    replayMaterialCiphertext: "encrypted-credential",
    lease: LEASE,
  });
  const apple = await runAccountDeletionStep({
    requestId: createJob("accepted").id,
    store: appleStore,
    gateway: gatewayFixture(),
    lease: LEASE,
  });
  assert.equal(apple.job.state, "apple_revoking");
});

test("Apple-applicable jobs fail closed before detached work when durable replay material is absent", async () => {
  const requestId = createJob("accepted").id;
  const store = createStore({
    jobs: [createJob("accepted", { appleApplicable: true })],
  });
  await assert.rejects(
    runAccountDeletionStep({
      requestId,
      store,
      gateway: gatewayFixture(),
      lease: LEASE,
    }),
    /no attached durable effect/,
  );
  assert.equal((await store.loadRequest(requestId))?.state, "accepted");
});

test("runAccountDeletionStep reconciles claimed Apple effects before mutation and commits durable outcomes", async () => {
  const store = createStore({
    jobs: [
      createJob("apple_revoking", {
        appleApplicable: true,
        stateGeneration: 2,
      }),
    ],
  });
  await store.createProviderEffectIntent({
    effectId: "effect-apple",
    requestId: createJob("apple_revoking").id,
    kind: "apple_revoke",
    objectInventoryId: null,
    expectedJobGeneration: 2,
    replayMaterialCiphertext: "encrypted-credential",
    lease: LEASE,
  });
  let mutationCalls = 0;
  const gateway = gatewayFixture(
    {
      kind: "complete",
      checkpoint: "checkpoint-a",
      providerReceipt: "receipt-a",
      completedAt: new Date(NOW),
    },
    {
      async resumeAppleRevocation() {
        mutationCalls += 1;
        throw new Error("must not mutate after reconciliation");
      },
    },
  );
  const result = await runAccountDeletionStep({
    requestId: createJob("apple_revoking").id,
    store,
    gateway,
    lease: LEASE,
  });
  assert.equal(result.kind, "advanced");
  assert.equal(mutationCalls, 0);
  const effect = (await store.loadEffect(
    "effect-apple",
  )) as ProviderEffectRecord;
  assert.equal(effect.state, "committed");
  assert.equal(effect.providerReceiptCiphertext, "receipt-a");
});

test("a crash-left claimed Apple effect is reclaimed with a fresh attempt and reconciled before mutation", async () => {
  const requestId = createJob("apple_revoking").id;
  const store = createStore({
    jobs: [
      createJob("apple_revoking", {
        appleApplicable: true,
        stateGeneration: 2,
      }),
    ],
  });
  await store.createProviderEffectIntent({
    effectId: "effect-crash-midpoint",
    requestId,
    kind: "apple_revoke",
    objectInventoryId: null,
    expectedJobGeneration: 2,
    replayMaterialCiphertext: "encrypted-credential",
    lease: LEASE,
  });
  await assert.rejects(
    runAccountDeletionStep({
      requestId,
      store,
      gateway: gatewayFixture(
        { kind: "unknown" },
        {
          async lookupAppleRevocationOutcome() {
            throw new Error("simulated crash after durable claim");
          },
        },
      ),
      lease: LEASE,
    }),
    /simulated crash/,
  );
  assert.equal(
    (await store.loadEffect("effect-crash-midpoint"))?.state,
    "claimed",
  );
  assert.equal((await store.loadEffect("effect-crash-midpoint"))?.attempt, 1);

  for (const lease of [
    { ...LEASE, workerId: "stale-worker" },
    { ...LEASE, leaseToken: "stale-token" },
    { ...LEASE, leaseUntil: new Date("2026-07-25T11:59:59Z") },
  ]) {
    await assert.rejects(
      store.claimEffect({
        effectId: "effect-crash-midpoint",
        expectedObjectInventoryId: null,
        expectedJobGeneration: 2,
        lease,
      }),
      AccountDeletionConflictError,
    );
  }

  let mutations = 0;
  const reconciled = await runAccountDeletionStep({
    requestId,
    store,
    gateway: gatewayFixture(
      {
        kind: "complete",
        checkpoint: "checkpoint-after-crash",
        providerReceipt: "receipt-after-crash",
        completedAt: NOW,
      },
      {
        async resumeAppleRevocation() {
          mutations += 1;
          throw new Error("reconciliation must not repeat mutation");
        },
      },
    ),
    lease: LEASE,
  });
  assert.equal(reconciled.kind, "advanced");
  assert.equal(mutations, 0);
  assert.deepEqual(await store.loadEffect("effect-crash-midpoint"), {
    id: "effect-crash-midpoint",
    requestId,
    kind: "apple_revoke",
    objectInventoryId: null,
    replayKey:
      "b62ef885510b26c6ccdc7183e8de1e14c7c4fda626af59e3256961588f3c9dd8",
    state: "committed",
    attempt: 2,
    claimedJobGeneration: 2,
    replayMaterialCiphertext: "encrypted-credential",
    checkpointCiphertext: "checkpoint-after-crash",
    providerReceiptCiphertext: "receipt-after-crash",
    lastReasonCode: null,
    committedAt: NOW,
  });
});

test("indeterminate Apple lookup is durable and a later step enters retry without repeating mutation", async () => {
  const requestId = createJob("apple_revoking").id;
  const store = createStore({
    jobs: [
      createJob("apple_revoking", {
        appleApplicable: true,
        stateGeneration: 2,
      }),
    ],
  });
  await store.createProviderEffectIntent({
    effectId: "effect-indeterminate",
    requestId,
    kind: "apple_revoke",
    objectInventoryId: null,
    expectedJobGeneration: 2,
    replayMaterialCiphertext: "encrypted-credential",
    lease: LEASE,
  });
  let mutations = 0;
  const gateway = gatewayFixture(
    { kind: "indeterminate", reasonCode: "provider_ambiguous" },
    {
      async resumeAppleRevocation() {
        mutations += 1;
        throw new Error("indeterminate lookup must prevent mutation");
      },
    },
  );
  const first = await runAccountDeletionStep({
    requestId,
    store,
    gateway,
    lease: LEASE,
  });
  assert.equal(first.kind, "retry_required");
  assert.equal(first.job.state, "apple_revoking");
  assert.equal(
    (await store.loadEffect("effect-indeterminate"))?.state,
    "indeterminate",
  );
  const second = await runAccountDeletionStep({
    requestId,
    store,
    gateway,
    lease: LEASE,
  });
  assert.equal(second.kind, "retry_required");
  assert.equal(second.job.state, "retry_required");
  assert.equal(second.job.retryResumeState, "apple_revoking");
  assert.equal(mutations, 0);
});

test("a later lookup can reconcile an indeterminate Apple effect without a second mutation", async () => {
  const requestId = createJob("apple_revoking").id;
  const store = createStore({
    jobs: [
      createJob("apple_revoking", {
        appleApplicable: true,
        stateGeneration: 2,
      }),
    ],
  });
  await store.createProviderEffectIntent({
    effectId: "effect-later-reconciliation",
    requestId,
    kind: "apple_revoke",
    objectInventoryId: null,
    expectedJobGeneration: 2,
    replayMaterialCiphertext: "encrypted-credential",
    lease: LEASE,
  });
  const indeterminateGateway = gatewayFixture({
    kind: "indeterminate",
    reasonCode: "provider_ambiguous",
  });
  await runAccountDeletionStep({
    requestId,
    store,
    gateway: indeterminateGateway,
    lease: LEASE,
  });
  await runAccountDeletionStep({
    requestId,
    store,
    gateway: indeterminateGateway,
    lease: LEASE,
  });
  await runAccountDeletionStep({
    requestId,
    store,
    gateway: indeterminateGateway,
    lease: LEASE,
  });

  let mutations = 0;
  const result = await runAccountDeletionStep({
    requestId,
    store,
    gateway: gatewayFixture(
      {
        kind: "complete",
        checkpoint: "checkpoint-reconciled",
        providerReceipt: "receipt-reconciled",
        completedAt: NOW,
      },
      {
        async resumeAppleRevocation() {
          mutations += 1;
          throw new Error("must not mutate after an indeterminate outcome");
        },
      },
    ),
    lease: LEASE,
  });
  assert.equal(result.kind, "advanced");
  assert.equal(mutations, 0);
  assert.equal(
    (await store.loadEffect("effect-later-reconciliation"))?.state,
    "committed",
  );
});

test("deletionStartsAt remains the database-time value across transitions and projections", async () => {
  const store = createStore({ jobs: [createJob("accepted")] });
  const before = await store.loadRequest(createJob("accepted").id);
  await store.transition({
    requestId: createJob("accepted").id,
    expectedState: "accepted",
    expectedGeneration: 0,
    nextState: "preflight",
    retryCode: null,
    retryResumeState: null,
    blockedCode: null,
    lease: LEASE,
  });
  const after = await store.loadRequest(createJob("accepted").id);
  assert.equal(before?.deletionStartsAt.toISOString(), NOW.toISOString());
  assert.equal(
    after?.deletionStartsAt.toISOString(),
    before?.deletionStartsAt.toISOString(),
  );
  assert.equal(
    createHash("sha256")
      .update(after?.deletionStartsAt.toISOString() ?? "")
      .digest("hex"),
    "8b978d9764c0ac42d13fb0b916bef98c467db6db1b29ee82380d5875e87c63af",
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  createAccountDeletionProviderGateway,
  type AccountDeletionProviderAdapters,
} from "../src/lib/account-deletion-provider-gateway.ts";

const NOW = new Date("2030-07-25T12:00:00.000Z");
const LATER = new Date("2030-07-25T12:05:00.000Z");
const GATEWAY_CLOCK = new Date("2030-07-25T11:59:00.000Z");
const PROOF_BYTES = new TextEncoder().encode("proof-binding");
const PROOF_SHA256 =
  "ea7a8e231f0dbf9640d4e7f6ae6c18fb9d4512f329f3e2af8bb8297f5b550217";

function gatewayConfiguration(maxClientHintEnvelopeBytes = 64) {
  return {
    maxClientHintEnvelopeBytes,
    now: () => new Date(GATEWAY_CLOCK),
  };
}

function adaptersFixture(
  overrides: Partial<AccountDeletionProviderAdapters> = {},
): AccountDeletionProviderAdapters {
  return {
    async createClerkReauthChallenge({ userId, purpose }) {
      return {
        challengeId: "challenge-a",
        subjectUserId: userId,
        clientHintEnvelope: "opaque-provider-envelope",
        rawProofBinding: PROOF_BYTES.slice(),
        expiresAt: LATER,
      };
    },
    async verifyClerkReauth({
      envelope: _envelope,
      expectedUserId,
      expectedChallengeId,
    }) {
      return {
        proofId: "proof-a",
        subjectUserId: expectedUserId,
        challengeId: expectedChallengeId,
        purpose: "account_deletion",
        verifiedAt: NOW,
        expiresAt: LATER,
        rawProofBinding: PROOF_BYTES.slice(),
      };
    },
    async getAuthoritativeIdentity(userId) {
      return {
        userId,
        appleApplicable: false,
        identityVersion: "identity-v1",
      };
    },
    async lookupAppleRevocationOutcome() {
      return { kind: "unknown" };
    },
    async resumeAppleRevocation() {
      return {
        kind: "complete",
        checkpoint: "checkpoint-a",
        providerReceipt: "apple-receipt",
        completedAt: NOW,
      };
    },
    async lookupClerkDeletionOutcome() {
      return { kind: "unknown" };
    },
    async deleteClerkUser() {
      return {
        kind: "deleted",
        providerReceipt: "clerk-receipt",
        completedAt: NOW,
      };
    },
    ...overrides,
  };
}

test("gateway is a frozen null-prototype facade over copied bound adapter references", async () => {
  const calls: string[] = [];
  const adapters = adaptersFixture({
    async getAuthoritativeIdentity(userId) {
      calls.push(`original:${userId}`);
      return {
        userId,
        appleApplicable: true,
        identityVersion: "identity-original",
      };
    },
  });
  const configuration = gatewayConfiguration();
  const gateway = createAccountDeletionProviderGateway(adapters, configuration);
  configuration.maxClientHintEnvelopeBytes = 1;
  adapters.getAuthoritativeIdentity = async (userId) => ({
    userId,
    appleApplicable: false,
    identityVersion: "replacement",
  });
  delete (adapters as Partial<AccountDeletionProviderAdapters>)
    .lookupAppleRevocationOutcome;

  assert.equal(Object.getPrototypeOf(gateway), null);
  assert.equal(Object.isFrozen(gateway), true);
  assert.deepEqual(await gateway.getAuthoritativeIdentity("user-a"), {
    userId: "user-a",
    appleApplicable: true,
    identityVersion: "identity-original",
  });
  assert.deepEqual(calls, ["original:user-a"]);
  assert.equal(
    (
      await gateway.createClerkReauthChallenge({
        userId: "user-a",
        purpose: "account_deletion",
      })
    ).clientHintEnvelope,
    "opaque-provider-envelope",
  );
  assert.deepEqual(
    await gateway.lookupAppleRevocationOutcome({
      replayKey: "replay-a",
      checkpoint: null,
    }),
    { kind: "unknown" },
  );
});

test("gateway methods observe an immutable adapter receiver snapshot", async () => {
  const adapters = Object.assign(adaptersFixture(), {
    identityVersion: "receiver-original",
    appleApplicable: true,
  });
  adapters.getAuthoritativeIdentity = async function (userId) {
    return {
      userId,
      appleApplicable: this.appleApplicable,
      identityVersion: this.identityVersion,
    };
  };
  const gateway = createAccountDeletionProviderGateway(
    adapters,
    gatewayConfiguration(),
  );
  adapters.identityVersion = "receiver-mutated";
  adapters.appleApplicable = false;

  assert.deepEqual(await gateway.getAuthoritativeIdentity("user-a"), {
    userId: "user-a",
    appleApplicable: true,
    identityVersion: "receiver-original",
  });
});

test("gateway rejects receiver state that cannot be copied without sharing", () => {
  const adapters = Object.assign(adaptersFixture(), {
    unsafeNestedState: {
      callback() {
        return "not structured-cloneable";
      },
    },
  });

  assert.throws(
    () =>
      createAccountDeletionProviderGateway(adapters, gatewayConfiguration()),
    /adapter receiver state cannot be snapshotted/,
  );
});

test("verification copies caller bytes before awaiting and exposes only the byte-exact digest", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let adapterEnvelope: Uint8Array | undefined;
  const gateway = createAccountDeletionProviderGateway(
    adaptersFixture({
      async verifyClerkReauth(input) {
        await gate;
        adapterEnvelope = input.envelope.slice();
        return {
          proofId: "proof-a",
          subjectUserId: input.expectedUserId,
          challengeId: input.expectedChallengeId,
          purpose: "account_deletion",
          verifiedAt: NOW,
          expiresAt: LATER,
          rawProofBinding: PROOF_BYTES.slice(),
        };
      },
    }),
    gatewayConfiguration(),
  );
  const callerEnvelope = new Uint8Array([1, 2, 3, 4]);
  const pending = gateway.verifyClerkReauth({
    envelope: callerEnvelope,
    expectedUserId: "user-a",
    expectedChallengeId: "challenge-a",
  });
  callerEnvelope.fill(9);
  release();
  const result = await pending;

  assert.deepEqual(adapterEnvelope, new Uint8Array([1, 2, 3, 4]));
  assert.equal(result.proofBindingSha256, PROOF_SHA256);
  assert.equal("rawProofBinding" in result, false);
  assert.equal(JSON.stringify(result).includes("proof-binding"), false);
});

test("verification copies Buffer input into an independent Uint8Array before awaiting", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let adapterEnvelope: Uint8Array | undefined;
  const gateway = createAccountDeletionProviderGateway(
    adaptersFixture({
      async verifyClerkReauth(input) {
        await gate;
        adapterEnvelope = Uint8Array.from(input.envelope);
        return {
          proofId: "proof-a",
          subjectUserId: input.expectedUserId,
          challengeId: input.expectedChallengeId,
          purpose: "account_deletion",
          verifiedAt: NOW,
          expiresAt: LATER,
          rawProofBinding: PROOF_BYTES.slice(),
        };
      },
    }),
    gatewayConfiguration(),
  );
  const callerEnvelope = Buffer.from([1, 2, 3, 4]);
  const pending = gateway.verifyClerkReauth({
    envelope: callerEnvelope,
    expectedUserId: "user-a",
    expectedChallengeId: "challenge-a",
  });
  callerEnvelope.fill(9);
  release();
  await pending;
  assert.deepEqual(adapterEnvelope, new Uint8Array([1, 2, 3, 4]));
});

test("gateway proof hashing and best-effort clearing never mutate an adapter-owned Buffer", async () => {
  const adapterOwned = Buffer.from("proof-binding");
  const gateway = createAccountDeletionProviderGateway(
    adaptersFixture({
      async createClerkReauthChallenge({ userId }) {
        return {
          challengeId: "challenge-buffer",
          subjectUserId: userId,
          clientHintEnvelope: "opaque",
          rawProofBinding: adapterOwned,
          expiresAt: LATER,
        };
      },
    }),
    gatewayConfiguration(),
  );
  const result = await gateway.createClerkReauthChallenge({
    userId: "user-a",
    purpose: "account_deletion",
  });
  assert.equal(result.proofBindingSha256, PROOF_SHA256);
  assert.equal(adapterOwned.toString("utf8"), "proof-binding");
});

test("challenge seals the raw binding and preserves an opaque envelope byte-for-byte", async () => {
  const opaque = " \topaque.非JWT\n";
  const gateway = createAccountDeletionProviderGateway(
    adaptersFixture({
      async createClerkReauthChallenge({ userId }) {
        return {
          challengeId: "challenge-a",
          subjectUserId: userId,
          clientHintEnvelope: opaque,
          rawProofBinding: PROOF_BYTES.slice(),
          expiresAt: LATER,
        };
      },
    }),
    gatewayConfiguration(),
  );
  const result = await gateway.createClerkReauthChallenge({
    userId: "user-a",
    purpose: "account_deletion",
  });
  assert.equal(result.clientHintEnvelope, opaque);
  assert.equal(result.proofBindingSha256, PROOF_SHA256);
  assert.equal("rawProofBinding" in result, false);
});

test("gateway rejects invalid configuration and empty, oversized, or non-string client envelopes", async () => {
  for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () =>
        createAccountDeletionProviderGateway(
          adaptersFixture(),
          gatewayConfiguration(value),
        ),
      TypeError,
    );
  }

  for (const envelope of ["", "éé", 42]) {
    const gateway = createAccountDeletionProviderGateway(
      adaptersFixture({
        async createClerkReauthChallenge({ userId }) {
          return {
            challengeId: "challenge-a",
            subjectUserId: userId,
            clientHintEnvelope: envelope as string,
            rawProofBinding: PROOF_BYTES.slice(),
            expiresAt: LATER,
          };
        },
      }),
      gatewayConfiguration(3),
    );
    await assert.rejects(
      gateway.createClerkReauthChallenge({
        userId: "user-a",
        purpose: "account_deletion",
      }),
      TypeError,
    );
  }
});

test("gateway expiry validation uses its injected deterministic clock", async () => {
  const clock = new Date("2040-07-25T12:00:00.000Z");
  const gateway = createAccountDeletionProviderGateway(
    adaptersFixture({
      async createClerkReauthChallenge({ userId }) {
        return {
          challengeId: "challenge-expired-by-clock",
          subjectUserId: userId,
          clientHintEnvelope: "opaque",
          rawProofBinding: PROOF_BYTES.slice(),
          expiresAt: new Date("2040-07-25T11:59:59.000Z"),
        };
      },
    }),
    {
      maxClientHintEnvelopeBytes: 64,
      now: () => new Date(clock),
    } as {
      maxClientHintEnvelopeBytes: number;
      now: () => Date;
    },
  );
  await assert.rejects(
    gateway.createClerkReauthChallenge({
      userId: "user-a",
      purpose: "account_deletion",
    }),
    /challenge is expired/,
  );
});

test("verification rejects subject, challenge, purpose, expiry, and raw-binding mismatches", async () => {
  const invalid = [
    { subjectUserId: "user-b" },
    { challengeId: "challenge-b" },
    { purpose: "other" },
    { expiresAt: NOW },
    { rawProofBinding: new Uint8Array() },
    { rawProofBinding: "raw" },
  ];
  for (const override of invalid) {
    const gateway = createAccountDeletionProviderGateway(
      adaptersFixture({
        async verifyClerkReauth() {
          return {
            proofId: "proof-a",
            subjectUserId: "user-a",
            challengeId: "challenge-a",
            purpose: "account_deletion",
            verifiedAt: NOW,
            expiresAt: LATER,
            rawProofBinding: PROOF_BYTES.slice(),
            ...override,
          } as never;
        },
      }),
      gatewayConfiguration(),
    );
    await assert.rejects(
      gateway.verifyClerkReauth({
        envelope: new Uint8Array([1]),
        expectedUserId: "user-a",
        expectedChallengeId: "challenge-a",
      }),
      TypeError,
    );
  }
});

test("challenge and authoritative identity reject hostile provider identity substitution", async () => {
  const challengeGateway = createAccountDeletionProviderGateway(
    adaptersFixture({
      async createClerkReauthChallenge() {
        return {
          challengeId: "challenge-a",
          subjectUserId: "attacker",
          clientHintEnvelope: "opaque",
          rawProofBinding: PROOF_BYTES.slice(),
          expiresAt: LATER,
        };
      },
    }),
    gatewayConfiguration(),
  );
  await assert.rejects(
    challengeGateway.createClerkReauthChallenge({
      userId: "user-a",
      purpose: "account_deletion",
    }),
    TypeError,
  );

  const identityGateway = createAccountDeletionProviderGateway(
    adaptersFixture({
      async getAuthoritativeIdentity() {
        return {
          userId: "attacker",
          appleApplicable: true,
          identityVersion: "hostile",
        };
      },
    }),
    gatewayConfiguration(),
  );
  await assert.rejects(
    identityGateway.getAuthoritativeIdentity("user-a"),
    TypeError,
  );
});

test("Apple replay methods preserve the exact replay key and checkpoint and reject untraceable outcomes", async () => {
  const seen: unknown[] = [];
  const gateway = createAccountDeletionProviderGateway(
    adaptersFixture({
      async lookupAppleRevocationOutcome(input) {
        seen.push(["lookup", input]);
        return { kind: "checkpoint", checkpoint: "checkpoint-b" };
      },
      async resumeAppleRevocation(input) {
        seen.push(["resume", input]);
        return {
          kind: "complete",
          checkpoint: "checkpoint-c",
          providerReceipt: "receipt-c",
          completedAt: NOW,
        };
      },
    }),
    gatewayConfiguration(),
  );
  assert.deepEqual(
    await gateway.lookupAppleRevocationOutcome({
      replayKey: "stable-replay-key",
      checkpoint: "checkpoint-a",
    }),
    { kind: "checkpoint", checkpoint: "checkpoint-b" },
  );
  await gateway.resumeAppleRevocation({
    replayKey: "stable-replay-key",
    checkpoint: "checkpoint-b",
    encryptedCredential: "encrypted",
  });
  assert.deepEqual(seen, [
    [
      "lookup",
      {
        replayKey: "stable-replay-key",
        checkpoint: "checkpoint-a",
      },
    ],
    [
      "resume",
      {
        replayKey: "stable-replay-key",
        checkpoint: "checkpoint-b",
        encryptedCredential: "encrypted",
      },
    ],
  ]);
});

test("Clerk reconciliation preserves deleted/already-absent outcomes and indeterminate prevents mutation by contract", async () => {
  for (const kind of ["deleted", "already_absent"] as const) {
    let deletes = 0;
    const gateway = createAccountDeletionProviderGateway(
      adaptersFixture({
        async lookupClerkDeletionOutcome() {
          return {
            kind,
            providerReceipt: `receipt-${kind}`,
            completedAt: NOW,
          };
        },
        async deleteClerkUser() {
          deletes += 1;
          return {
            kind: "deleted",
            providerReceipt: "unexpected",
            completedAt: NOW,
          };
        },
      }),
      gatewayConfiguration(),
    );
    const outcome = await gateway.lookupClerkDeletionOutcome({
      replayKey: "stable-replay",
      userId: "user-a",
    });
    assert.equal(outcome.kind, kind);
    assert.equal(deletes, 0);
  }

  const gateway = createAccountDeletionProviderGateway(
    adaptersFixture({
      async lookupClerkDeletionOutcome() {
        return { kind: "indeterminate", reasonCode: "provider_ambiguous" };
      },
      async deleteClerkUser() {
        throw new Error("must not mutate after indeterminate lookup");
      },
    }),
    gatewayConfiguration(),
  );
  assert.deepEqual(
    await gateway.lookupClerkDeletionOutcome({
      replayKey: "stable-replay",
      userId: "user-a",
    }),
    { kind: "indeterminate", reasonCode: "provider_ambiguous" },
  );
});

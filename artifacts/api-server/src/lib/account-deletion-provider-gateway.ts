import { createHash } from "node:crypto";
import type {
  AccountDeletionProviderAdapters,
  AccountDeletionProviderGateway,
  AccountDeletionProviderGatewayConfiguration,
  AppleOutcome,
  AuthoritativeIdentity,
  ClerkChallengeAdapterResult,
  ClerkChallengeResult,
  ClerkDeletionOutcome,
  ClerkReauthAdapterVerification,
  ClerkReauthVerification,
} from "./account-deletion.ts";

function requireNonBlank(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-blank string`);
  }
}

function requireDate(value: unknown, field: string): asserts value is Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError(`${field} must be a valid Date`);
  }
}

function digestRawProofBinding(value: unknown): string {
  if (!(value instanceof Uint8Array) || value.byteLength === 0) {
    throw new TypeError("rawProofBinding must be a non-empty Uint8Array");
  }
  const privateCopy = Uint8Array.from(value);
  try {
    return createHash("sha256").update(privateCopy).digest("hex");
  } finally {
    try {
      privateCopy.fill(0);
    } catch {
      // Best-effort clearing must never replace the validation result.
    }
  }
}

function sealChallenge(
  result: ClerkChallengeAdapterResult,
  expectedUserId: string,
  maxClientHintEnvelopeBytes: number,
  clock: Date,
): ClerkChallengeResult {
  requireNonBlank(result.challengeId, "challengeId");
  if (result.subjectUserId !== expectedUserId) {
    throw new TypeError("challenge subject does not match requested user");
  }
  if (typeof result.clientHintEnvelope !== "string") {
    throw new TypeError("clientHintEnvelope must be a string");
  }
  const byteLength = Buffer.byteLength(result.clientHintEnvelope, "utf8");
  if (byteLength === 0 || byteLength > maxClientHintEnvelopeBytes) {
    throw new TypeError("clientHintEnvelope UTF-8 length is outside bounds");
  }
  requireDate(result.expiresAt, "expiresAt");
  if (result.expiresAt.getTime() <= clock.getTime()) {
    throw new TypeError("challenge is expired");
  }
  const proofBindingSha256 = digestRawProofBinding(result.rawProofBinding);
  return {
    challengeId: result.challengeId,
    subjectUserId: result.subjectUserId,
    clientHintEnvelope: result.clientHintEnvelope,
    proofBindingSha256,
    expiresAt: new Date(result.expiresAt),
  };
}

function sealVerification(
  result: ClerkReauthAdapterVerification,
  expectedUserId: string,
  expectedChallengeId: string,
  clock: Date,
): ClerkReauthVerification {
  requireNonBlank(result.proofId, "proofId");
  if (result.subjectUserId !== expectedUserId) {
    throw new TypeError("verified subject does not match expected user");
  }
  if (result.challengeId !== expectedChallengeId) {
    throw new TypeError("verified challenge does not match expected challenge");
  }
  if (result.purpose !== "account_deletion") {
    throw new TypeError("verified proof has the wrong purpose");
  }
  requireDate(result.verifiedAt, "verifiedAt");
  requireDate(result.expiresAt, "expiresAt");
  if (
    result.expiresAt.getTime() <= result.verifiedAt.getTime() ||
    result.expiresAt.getTime() <= clock.getTime()
  ) {
    throw new TypeError("verified proof is expired");
  }
  const proofBindingSha256 = digestRawProofBinding(result.rawProofBinding);
  return {
    proofId: result.proofId,
    subjectUserId: result.subjectUserId,
    challengeId: result.challengeId,
    purpose: "account_deletion",
    verifiedAt: new Date(result.verifiedAt),
    expiresAt: new Date(result.expiresAt),
    proofBindingSha256,
  };
}

function validateIdentity(
  identity: AuthoritativeIdentity,
  expectedUserId: string,
): AuthoritativeIdentity {
  if (identity.userId !== expectedUserId) {
    throw new TypeError("authoritative identity subject mismatch");
  }
  if (typeof identity.appleApplicable !== "boolean") {
    throw new TypeError("appleApplicable must be boolean");
  }
  requireNonBlank(identity.identityVersion, "identityVersion");
  return Object.freeze({ ...identity });
}

function validateAppleOutcome(outcome: AppleOutcome): AppleOutcome {
  if (!outcome || typeof outcome !== "object") {
    throw new TypeError("invalid Apple outcome");
  }
  switch (outcome.kind) {
    case "unknown":
      return { kind: "unknown" };
    case "indeterminate":
      requireNonBlank(outcome.reasonCode, "reasonCode");
      return { kind: "indeterminate", reasonCode: outcome.reasonCode };
    case "checkpoint":
      requireNonBlank(outcome.checkpoint, "checkpoint");
      return { kind: "checkpoint", checkpoint: outcome.checkpoint };
    case "complete":
      requireNonBlank(outcome.checkpoint, "checkpoint");
      requireNonBlank(outcome.providerReceipt, "providerReceipt");
      requireDate(outcome.completedAt, "completedAt");
      return {
        kind: "complete",
        checkpoint: outcome.checkpoint,
        providerReceipt: outcome.providerReceipt,
        completedAt: new Date(outcome.completedAt),
      };
    default:
      throw new TypeError("invalid Apple outcome kind");
  }
}

function validateClerkOutcome(
  outcome: ClerkDeletionOutcome,
): ClerkDeletionOutcome {
  if (!outcome || typeof outcome !== "object") {
    throw new TypeError("invalid Clerk outcome");
  }
  switch (outcome.kind) {
    case "unknown":
      return { kind: "unknown" };
    case "indeterminate":
      requireNonBlank(outcome.reasonCode, "reasonCode");
      return { kind: "indeterminate", reasonCode: outcome.reasonCode };
    case "deleted":
    case "already_absent":
      requireNonBlank(outcome.providerReceipt, "providerReceipt");
      requireDate(outcome.completedAt, "completedAt");
      return {
        kind: outcome.kind,
        providerReceipt: outcome.providerReceipt,
        completedAt: new Date(outcome.completedAt),
      };
    default:
      throw new TypeError("invalid Clerk outcome kind");
  }
}

export function createAccountDeletionProviderGateway(
  adapters: AccountDeletionProviderAdapters,
  configuration: AccountDeletionProviderGatewayConfiguration,
): AccountDeletionProviderGateway {
  const maxClientHintEnvelopeBytes = configuration?.maxClientHintEnvelopeBytes;
  if (
    !Number.isSafeInteger(maxClientHintEnvelopeBytes) ||
    maxClientHintEnvelopeBytes <= 0
  ) {
    throw new TypeError(
      "maxClientHintEnvelopeBytes must be a positive safe integer",
    );
  }

  const now = configuration.now ?? (() => new Date());
  const receiver = Object.create(null) as Record<PropertyKey, unknown>;
  for (const key of Reflect.ownKeys(adapters)) {
    const value = Reflect.get(adapters, key);
    if (typeof value === "function") {
      receiver[key] = value;
      continue;
    }
    try {
      receiver[key] = structuredClone(value);
    } catch (cause) {
      throw new TypeError(
        "adapter receiver state cannot be snapshotted without sharing",
        { cause },
      );
    }
  }
  Object.freeze(receiver);
  const createChallenge = adapters.createClerkReauthChallenge.bind(receiver);
  const verifyReauth = adapters.verifyClerkReauth.bind(receiver);
  const getIdentity = adapters.getAuthoritativeIdentity.bind(receiver);
  const lookupApple = adapters.lookupAppleRevocationOutcome.bind(receiver);
  const resumeApple = adapters.resumeAppleRevocation.bind(receiver);
  const lookupClerk = adapters.lookupClerkDeletionOutcome.bind(receiver);
  const deleteClerk = adapters.deleteClerkUser.bind(receiver);

  function readClock(): Date {
    const value = now();
    requireDate(value, "configuration.now()");
    return new Date(value);
  }

  const gateway = Object.create(null) as AccountDeletionProviderGateway;
  Object.assign(gateway, {
    async createClerkReauthChallenge(input: {
      userId: string;
      purpose: "account_deletion";
    }) {
      requireNonBlank(input.userId, "userId");
      if (input.purpose !== "account_deletion") {
        throw new TypeError("invalid challenge purpose");
      }
      return sealChallenge(
        await createChallenge({
          userId: input.userId,
          purpose: "account_deletion",
        }),
        input.userId,
        maxClientHintEnvelopeBytes,
        readClock(),
      );
    },
    async verifyClerkReauth(input: {
      envelope: Uint8Array;
      expectedUserId: string;
      expectedChallengeId: string;
    }) {
      if (!(input.envelope instanceof Uint8Array)) {
        throw new TypeError("envelope must be a Uint8Array");
      }
      requireNonBlank(input.expectedUserId, "expectedUserId");
      requireNonBlank(input.expectedChallengeId, "expectedChallengeId");
      const envelope = Uint8Array.from(input.envelope);
      const result = await verifyReauth({
        envelope,
        expectedUserId: input.expectedUserId,
        expectedChallengeId: input.expectedChallengeId,
      });
      return sealVerification(
        result,
        input.expectedUserId,
        input.expectedChallengeId,
        readClock(),
      );
    },
    async getAuthoritativeIdentity(userId: string) {
      requireNonBlank(userId, "userId");
      return validateIdentity(await getIdentity(userId), userId);
    },
    async lookupAppleRevocationOutcome(input: {
      replayKey: string;
      checkpoint: string | null;
    }) {
      requireNonBlank(input.replayKey, "replayKey");
      return validateAppleOutcome(
        await lookupApple({
          replayKey: input.replayKey,
          checkpoint: input.checkpoint,
        }),
      );
    },
    async resumeAppleRevocation(input: {
      replayKey: string;
      checkpoint: string | null;
      encryptedCredential: string;
    }) {
      requireNonBlank(input.replayKey, "replayKey");
      requireNonBlank(input.encryptedCredential, "encryptedCredential");
      const outcome = validateAppleOutcome(
        await resumeApple({
          replayKey: input.replayKey,
          checkpoint: input.checkpoint,
          encryptedCredential: input.encryptedCredential,
        }),
      );
      if (outcome.kind === "unknown" || outcome.kind === "indeterminate") {
        throw new TypeError("Apple mutation returned an untraceable outcome");
      }
      return outcome;
    },
    async lookupClerkDeletionOutcome(input: {
      replayKey: string;
      userId: string;
    }) {
      requireNonBlank(input.replayKey, "replayKey");
      requireNonBlank(input.userId, "userId");
      return validateClerkOutcome(
        await lookupClerk({
          replayKey: input.replayKey,
          userId: input.userId,
        }),
      );
    },
    async deleteClerkUser(input: { replayKey: string; userId: string }) {
      requireNonBlank(input.replayKey, "replayKey");
      requireNonBlank(input.userId, "userId");
      const outcome = validateClerkOutcome(
        await deleteClerk({
          replayKey: input.replayKey,
          userId: input.userId,
        }),
      );
      if (outcome.kind !== "deleted" && outcome.kind !== "already_absent") {
        throw new TypeError("Clerk deletion returned an untraceable outcome");
      }
      return outcome;
    },
  } satisfies AccountDeletionProviderGateway);
  return Object.freeze(gateway);
}

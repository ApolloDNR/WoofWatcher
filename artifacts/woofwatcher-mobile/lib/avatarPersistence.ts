import {
  createSerializedCareSyncWriter,
  type SerializedCareSyncWriter,
} from "./serializedCareSyncWriter.ts";

export const AVATAR_SET_STORAGE_KEY = "woofwatcher.avatarSet.v1";
export const AVATAR_CONFIG_STORAGE_KEY = "woofwatcher.petAvatarConfig.v1";
export const AVATAR_SET_RECOVERY_KEY = `${AVATAR_SET_STORAGE_KEY}.recovery`;
export const AVATAR_CONFIG_RECOVERY_KEY = `${AVATAR_CONFIG_STORAGE_KEY}.recovery`;
export const AVATAR_LEGACY_LOCAL_CLAIM_KEY =
  "woofwatcher.avatarLegacyV1.localClaim";

const SCOPED_AVATAR_SET_STORAGE_PREFIX = "woofwatcher.avatarSet.v2.scope";
const SCOPED_AVATAR_CONFIG_STORAGE_PREFIX =
  "woofwatcher.petAvatarConfig.v2.scope";

export type AvatarPayloadKey = "avatar-set" | "avatar-config";

export interface AvatarPersistenceScope {
  ownerUserId: string | null;
  householdId: string | null;
  activePetId: string;
}

export interface AvatarStorageKeys {
  scopeKey: string;
  avatarSet: string;
  avatarConfig: string;
  avatarSetRecovery: string;
  avatarConfigRecovery: string;
  mayClaimLegacy: boolean;
}

function encodeAvatarScopeSegment(value: string): string {
  return encodeURIComponent(value).replace(/\./g, "%2E");
}

export function buildAvatarStorageKeys(
  scope: AvatarPersistenceScope,
): AvatarStorageKeys {
  const ownerUserId = scope.ownerUserId?.trim() || null;
  const householdId = scope.householdId?.trim() || null;
  const activePetId = scope.activePetId?.trim();
  if (!activePetId) {
    throw new Error("Avatar persistence requires an active dog identity.");
  }
  if ((ownerUserId === null) !== (householdId === null)) {
    throw new Error(
      "Avatar persistence requires both owner and household identity for an authenticated scope.",
    );
  }

  const encodedPetId = encodeAvatarScopeSegment(activePetId);
  const scopeKey = ownerUserId
    ? `account.${encodeAvatarScopeSegment(ownerUserId)}.household.${encodeAvatarScopeSegment(householdId!)}.pet.${encodedPetId}`
    : `local.pet.${encodedPetId}`;
  const avatarSet = `${SCOPED_AVATAR_SET_STORAGE_PREFIX}.${scopeKey}`;
  const avatarConfig = `${SCOPED_AVATAR_CONFIG_STORAGE_PREFIX}.${scopeKey}`;
  return {
    scopeKey,
    avatarSet,
    avatarConfig,
    avatarSetRecovery: `${avatarSet}.recovery`,
    avatarConfigRecovery: `${avatarConfig}.recovery`,
    mayClaimLegacy: ownerUserId === null,
  };
}

export interface AvatarKeyValueStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export interface ParsedAvatarPayload<T> {
  value: T;
  /**
   * A verified migration to persist before hydration becomes writable. Use
   * null to remove a payload whose last invalid reference was pruned.
   */
  rewrite?: string | null;
}

export type AvatarPayloadParser<T> = (
  decoded: Record<string, unknown>,
  raw: string,
) => ParsedAvatarPayload<T> | Promise<ParsedAvatarPayload<T>>;

interface AvatarHydrationValues<TAvatarSet, TAvatarConfig> {
  avatarSet: TAvatarSet | null;
  avatarConfig: TAvatarConfig | null;
}

export type AvatarHydrationResult<TAvatarSet, TAvatarConfig> =
  | ({
      status: "ready";
      recoveredKeys: [];
    } & AvatarHydrationValues<TAvatarSet, TAvatarConfig>)
  | ({
      status: "recovered-corrupt-data";
      recoveredKeys: AvatarPayloadKey[];
    } & AvatarHydrationValues<TAvatarSet, TAvatarConfig>)
  | { status: "read-failed"; error: unknown }
  | { status: "processing-failed"; error: unknown }
  | { status: "recovery-failed"; error: unknown }
  | { status: "superseded" };

export interface AvatarPersistence<TAvatarSet, TAvatarConfig> {
  hydrate: () => Promise<AvatarHydrationResult<TAvatarSet, TAvatarConfig>>;
  saveAvatarSet: (serialized: string) => Promise<void>;
  clearAvatarSet: () => Promise<void>;
  saveAvatarConfig: (serialized: string) => Promise<void>;
  eraseAvatarData: () => Promise<"erased" | "superseded">;
  activate: () => void;
  deactivate: () => void;
}

interface CreateAvatarPersistenceOptions<TAvatarSet, TAvatarConfig> {
  storage: AvatarKeyValueStorage;
  scope: AvatarPersistenceScope;
  parseAvatarSet: AvatarPayloadParser<TAvatarSet>;
  parseAvatarConfig: AvatarPayloadParser<TAvatarConfig>;
}

type AvatarStorageStep =
  | { type: "set"; key: string; value: string }
  | { type: "remove"; key: string };

interface AvatarStorageMutation {
  steps: AvatarStorageStep[];
  isCurrent?: () => boolean;
  continueAfterError?: boolean;
  legacyClaim?: {
    key: string;
    scopeKey: string;
    onRejected: () => void;
  };
}

class AvatarStorageMutationSupersededError extends Error {
  constructor() {
    super("Avatar storage mutation was superseded by a scope change.");
  }
}

interface AvatarStorageCoordinator {
  generation: number;
  writer: SerializedCareSyncWriter<AvatarStorageMutation>;
}

const coordinatorsByStorage = new WeakMap<
  AvatarKeyValueStorage,
  AvatarStorageCoordinator
>();

function getAvatarStorageCoordinator(
  storage: AvatarKeyValueStorage,
): AvatarStorageCoordinator {
  const existing = coordinatorsByStorage.get(storage);
  if (existing) return existing;

  const coordinator = {} as AvatarStorageCoordinator;
  coordinator.generation = 0;
  coordinator.writer = createSerializedCareSyncWriter<AvatarStorageMutation>(
    async ({ steps, isCurrent, continueAfterError = false, legacyClaim }) => {
      let firstError: unknown;
      if (legacyClaim) {
        const existingClaim = await storage.getItem(legacyClaim.key);
        const pendingClaim = `pending:${legacyClaim.scopeKey}`;
        const completedClaim = `complete:${legacyClaim.scopeKey}`;
        if (
          existingClaim !== null &&
          existingClaim !== pendingClaim &&
          existingClaim !== completedClaim &&
          // Treat the original raw-scope marker as a completed claim so a
          // future upgrade never re-adopts legacy data.
          existingClaim !== legacyClaim.scopeKey
        ) {
          legacyClaim.onRejected();
          return;
        }
        if (existingClaim === null) {
          if (isCurrent && !isCurrent()) {
            throw new AvatarStorageMutationSupersededError();
          }
          // Reserve ownership before copying. If a later step is interrupted,
          // this same scope can resume while every other dog stays fenced out.
          await storage.setItem(legacyClaim.key, pendingClaim);
          if (isCurrent && !isCurrent()) {
            throw new AvatarStorageMutationSupersededError();
          }
        }
      }
      for (const step of steps) {
        if (isCurrent && !isCurrent()) {
          throw new AvatarStorageMutationSupersededError();
        }
        try {
          if (step.type === "set") {
            await storage.setItem(step.key, step.value);
          } else {
            await storage.removeItem(step.key);
          }
        } catch (error) {
          if (!continueAfterError) throw error;
          firstError ??= error;
        }
      }
      if (isCurrent && !isCurrent()) {
        throw new AvatarStorageMutationSupersededError();
      }
      if (firstError !== undefined) throw firstError;
      if (legacyClaim) {
        await storage.setItem(
          legacyClaim.key,
          `complete:${legacyClaim.scopeKey}`,
        );
        if (isCurrent && !isCurrent()) {
          throw new AvatarStorageMutationSupersededError();
        }
      }
    },
  );
  coordinatorsByStorage.set(storage, coordinator);
  return coordinator;
}

export async function fenceAvatarPersistenceWrites(
  storage: AvatarKeyValueStorage,
): Promise<"fenced" | "superseded"> {
  const coordinator = getAvatarStorageCoordinator(storage);
  const generation = coordinator.generation + 1;
  coordinator.generation = generation;
  const result = await coordinator.writer.supersede({
    steps: [],
    isCurrent: () => coordinator.generation === generation,
  });
  return result === "applied" ? "fenced" : "superseded";
}

type ParsedSlot<T> =
  | { status: "absent" }
  | { status: "valid"; payload: ParsedAvatarPayload<T> }
  | { status: "corrupt"; raw: string }
  | { status: "processing-failed"; error: unknown };

interface AvatarStorageSnapshot {
  avatarSet: string | null;
  avatarConfig: string | null;
  avatarSetFromLegacy: boolean;
  avatarConfigFromLegacy: boolean;
  legacyClaimNeeded: boolean;
}

async function readAvatarStorageSnapshot(
  storage: AvatarKeyValueStorage,
  keys: AvatarStorageKeys,
): Promise<AvatarStorageSnapshot> {
  const [scopedAvatarSet, scopedAvatarConfig] = await Promise.all([
    storage.getItem(keys.avatarSet),
    storage.getItem(keys.avatarConfig),
  ]);
  if (!keys.mayClaimLegacy) {
    return {
      avatarSet: scopedAvatarSet,
      avatarConfig: scopedAvatarConfig,
      avatarSetFromLegacy: false,
      avatarConfigFromLegacy: false,
      legacyClaimNeeded: false,
    };
  }

  const [legacyClaim, legacyAvatarSet, legacyAvatarConfig] = await Promise.all([
    storage.getItem(AVATAR_LEGACY_LOCAL_CLAIM_KEY),
    storage.getItem(AVATAR_SET_STORAGE_KEY),
    storage.getItem(AVATAR_CONFIG_STORAGE_KEY),
  ]);
  const claimIsPendingForCurrentScope =
    legacyClaim === `pending:${keys.scopeKey}`;
  // A pending reservation lets only its original dog resume an interrupted
  // migration. A completed claim turns v1 into a non-rendered recovery backup;
  // reading it again would repeatedly announce corruption or resurrect data.
  const mayUseLegacy = legacyClaim === null || claimIsPendingForCurrentScope;
  return {
    avatarSet: scopedAvatarSet ?? (mayUseLegacy ? legacyAvatarSet : null),
    avatarConfig:
      scopedAvatarConfig ?? (mayUseLegacy ? legacyAvatarConfig : null),
    avatarSetFromLegacy:
      mayUseLegacy && scopedAvatarSet === null && legacyAvatarSet !== null,
    avatarConfigFromLegacy:
      mayUseLegacy &&
      scopedAvatarConfig === null &&
      legacyAvatarConfig !== null,
    legacyClaimNeeded:
      mayUseLegacy && (legacyAvatarSet !== null || legacyAvatarConfig !== null),
  };
}

function appendValidSlotStorageSteps<T>(
  steps: AvatarStorageStep[],
  payload: ParsedAvatarPayload<T>,
  raw: string,
  fromLegacy: boolean,
  scopedKey: string,
) {
  if (fromLegacy) {
    const migrated = payload.rewrite === undefined ? raw : payload.rewrite;
    if (migrated !== null) {
      steps.push({ type: "set", key: scopedKey, value: migrated });
    }
    return;
  }
  if (payload.rewrite === undefined) return;
  steps.push(
    payload.rewrite === null
      ? { type: "remove", key: scopedKey }
      : { type: "set", key: scopedKey, value: payload.rewrite },
  );
}

function appendCorruptSlotStorageSteps(
  steps: AvatarStorageStep[],
  raw: string,
  fromLegacy: boolean,
  scopedKey: string,
  scopedRecoveryKey: string,
) {
  steps.push(
    { type: "set", key: scopedRecoveryKey, value: raw },
    ...(fromLegacy ? [] : [{ type: "remove" as const, key: scopedKey }]),
  );
}

/**
 * JSON syntax alone is insufficient for avatar persistence. Arrays, null, and
 * primitives cannot be valid avatar records and must enter recovery instead
 * of being accepted as empty defaults.
 */
export function parseAvatarObjectPayload(raw: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Stored avatar payload must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

async function parseSlot<T>(
  raw: string | null,
  parser: AvatarPayloadParser<T>,
): Promise<ParsedSlot<T>> {
  if (raw === null) return { status: "absent" };
  let decoded: Record<string, unknown>;
  try {
    decoded = parseAvatarObjectPayload(raw);
  } catch {
    return { status: "corrupt", raw };
  }
  try {
    return { status: "valid", payload: await parser(decoded, raw) };
  } catch (error) {
    // Verification and migration can depend on the filesystem. A failure at
    // that layer is not evidence that the owner's stored JSON is corrupt.
    return { status: "processing-failed", error };
  }
}

/**
 * Owns the avatar storage lifecycle independently of React so transport,
 * corruption recovery, write ordering, and privacy erase races can be tested
 * with deterministic injected storage.
 */
export function createAvatarPersistence<TAvatarSet, TAvatarConfig>({
  storage,
  scope,
  parseAvatarSet,
  parseAvatarConfig,
}: CreateAvatarPersistenceOptions<
  TAvatarSet,
  TAvatarConfig
>): AvatarPersistence<TAvatarSet, TAvatarConfig> {
  const keys = buildAvatarStorageKeys(scope);
  const coordinator = getAvatarStorageCoordinator(storage);
  const writer = coordinator.writer;
  let acceptedStorageGeneration = coordinator.generation;
  let lifecycleGeneration = 0;
  let hydrationSucceeded = false;
  let active = true;
  let activeErase: Promise<"erased" | "superseded"> | null = null;

  const lifecycleIsCurrent = (generation: number) =>
    active &&
    generation === lifecycleGeneration &&
    acceptedStorageGeneration === coordinator.generation;

  const enqueueHydratedWrite = async (steps: AvatarStorageStep[]) => {
    if (!hydrationSucceeded || !active) {
      throw new Error(
        "Avatar data cannot be changed until local storage loads successfully.",
      );
    }
    const generation = lifecycleGeneration;
    if (!lifecycleIsCurrent(generation)) {
      throw new Error("Avatar scope changed before the write could start.");
    }
    const expectedEpoch = writer.currentEpoch();
    const result = await writer.enqueue(
      {
        steps,
        isCurrent: () => lifecycleIsCurrent(generation),
      },
      expectedEpoch,
    );
    if (result === "superseded" || !lifecycleIsCurrent(generation)) {
      throw new Error("Avatar write was superseded by a scope change.");
    }
  };

  return {
    async hydrate() {
      const generation = lifecycleGeneration + 1;
      lifecycleGeneration = generation;
      hydrationSucceeded = false;
      if (!lifecycleIsCurrent(generation)) return { status: "superseded" };

      // A retry cannot take a snapshot from the middle of an older save or
      // erase. Once idle, the epoch fences any erase that begins during reads.
      await writer.drain();
      if (!lifecycleIsCurrent(generation)) return { status: "superseded" };
      const readEpoch = writer.currentEpoch();

      let snapshot: AvatarStorageSnapshot;
      try {
        snapshot = await readAvatarStorageSnapshot(storage, keys);
      } catch (error) {
        if (!lifecycleIsCurrent(generation)) {
          return { status: "superseded" };
        }
        return { status: "read-failed", error };
      }

      if (!lifecycleIsCurrent(generation)) return { status: "superseded" };

      const [avatarSetSlot, avatarConfigSlot] = await Promise.all([
        parseSlot(snapshot.avatarSet, parseAvatarSet),
        parseSlot(snapshot.avatarConfig, parseAvatarConfig),
      ]);
      if (!lifecycleIsCurrent(generation)) return { status: "superseded" };

      const recoveredKeys: AvatarPayloadKey[] = [];
      const scopedCleanupSteps: AvatarStorageStep[] = [];
      const legacyMigrationSteps: AvatarStorageStep[] = [];
      let avatarSet: TAvatarSet | null = null;
      let avatarConfig: TAvatarConfig | null = null;
      let processingError: unknown;

      if (avatarSetSlot.status === "corrupt") {
        recoveredKeys.push("avatar-set");
        appendCorruptSlotStorageSteps(
          snapshot.avatarSetFromLegacy
            ? legacyMigrationSteps
            : scopedCleanupSteps,
          avatarSetSlot.raw,
          snapshot.avatarSetFromLegacy,
          keys.avatarSet,
          keys.avatarSetRecovery,
        );
      } else if (avatarSetSlot.status === "valid") {
        avatarSet = avatarSetSlot.payload.value;
        appendValidSlotStorageSteps(
          snapshot.avatarSetFromLegacy
            ? legacyMigrationSteps
            : scopedCleanupSteps,
          avatarSetSlot.payload,
          snapshot.avatarSet!,
          snapshot.avatarSetFromLegacy,
          keys.avatarSet,
        );
      } else if (avatarSetSlot.status === "processing-failed") {
        processingError = avatarSetSlot.error;
      }

      if (avatarConfigSlot.status === "corrupt") {
        recoveredKeys.push("avatar-config");
        appendCorruptSlotStorageSteps(
          snapshot.avatarConfigFromLegacy
            ? legacyMigrationSteps
            : scopedCleanupSteps,
          avatarConfigSlot.raw,
          snapshot.avatarConfigFromLegacy,
          keys.avatarConfig,
          keys.avatarConfigRecovery,
        );
      } else if (avatarConfigSlot.status === "valid") {
        avatarConfig = avatarConfigSlot.payload.value;
        appendValidSlotStorageSteps(
          snapshot.avatarConfigFromLegacy
            ? legacyMigrationSteps
            : scopedCleanupSteps,
          avatarConfigSlot.payload,
          snapshot.avatarConfig!,
          snapshot.avatarConfigFromLegacy,
          keys.avatarConfig,
        );
      } else if (avatarConfigSlot.status === "processing-failed") {
        processingError ??= avatarConfigSlot.error;
      }

      const enqueueCleanup = async (mutation: AvatarStorageMutation) => {
        const result = await writer.enqueue(mutation, readEpoch);
        if (result === "superseded" || !lifecycleIsCurrent(generation)) {
          throw new AvatarStorageMutationSupersededError();
        }
      };

      if (scopedCleanupSteps.length > 0) {
        try {
          await enqueueCleanup({
            steps: scopedCleanupSteps,
            isCurrent: () => lifecycleIsCurrent(generation),
          });
        } catch (error) {
          if (
            error instanceof AvatarStorageMutationSupersededError ||
            !lifecycleIsCurrent(generation)
          ) {
            return { status: "superseded" };
          }
          return { status: "recovery-failed", error };
        }
      }

      // A filesystem-dependent parser failure must not partially adopt legacy
      // data. Leaving the marker absent makes the whole claim safely retryable.
      if (processingError !== undefined && snapshot.legacyClaimNeeded) {
        return { status: "processing-failed", error: processingError };
      }

      let legacyClaimAccepted = true;
      if (snapshot.legacyClaimNeeded) {
        try {
          await enqueueCleanup({
            steps: legacyMigrationSteps,
            isCurrent: () => lifecycleIsCurrent(generation),
            legacyClaim: {
              key: AVATAR_LEGACY_LOCAL_CLAIM_KEY,
              scopeKey: keys.scopeKey,
              onRejected: () => {
                legacyClaimAccepted = false;
              },
            },
          });
        } catch (error) {
          if (
            error instanceof AvatarStorageMutationSupersededError ||
            !lifecycleIsCurrent(generation)
          ) {
            return { status: "superseded" };
          }
          return { status: "recovery-failed", error };
        }
      }

      if (!legacyClaimAccepted) {
        if (snapshot.avatarSetFromLegacy) avatarSet = null;
        if (snapshot.avatarConfigFromLegacy) avatarConfig = null;
        for (let index = recoveredKeys.length - 1; index >= 0; index -= 1) {
          if (
            (recoveredKeys[index] === "avatar-set" &&
              snapshot.avatarSetFromLegacy) ||
            (recoveredKeys[index] === "avatar-config" &&
              snapshot.avatarConfigFromLegacy)
          ) {
            recoveredKeys.splice(index, 1);
          }
        }
      }

      if (!lifecycleIsCurrent(generation)) return { status: "superseded" };
      if (processingError !== undefined) {
        return { status: "processing-failed", error: processingError };
      }
      hydrationSucceeded = true;
      const values = { avatarSet, avatarConfig };
      if (recoveredKeys.length > 0) {
        return {
          status: "recovered-corrupt-data",
          recoveredKeys,
          ...values,
        };
      }
      return { status: "ready", recoveredKeys: [], ...values };
    },

    saveAvatarSet(serialized) {
      return enqueueHydratedWrite([
        { type: "set", key: keys.avatarSet, value: serialized },
      ]);
    },

    clearAvatarSet() {
      return enqueueHydratedWrite([{ type: "remove", key: keys.avatarSet }]);
    },

    saveAvatarConfig(serialized) {
      return enqueueHydratedWrite([
        { type: "set", key: keys.avatarConfig, value: serialized },
      ]);
    },

    eraseAvatarData() {
      if (activeErase) return activeErase;
      if (!active) return Promise.resolve("superseded");
      const generation = lifecycleGeneration + 1;
      lifecycleGeneration = generation;
      hydrationSucceeded = false;
      const storageGeneration = coordinator.generation + 1;
      coordinator.generation = storageGeneration;
      acceptedStorageGeneration = storageGeneration;
      const eraseIsCurrent = () => lifecycleIsCurrent(generation);
      const operation = (async (): Promise<"erased" | "superseded"> => {
        try {
          // Reserve any surviving v1 payload before deletion starts. The
          // tombstone remains if a platform removal fails, so another local
          // dog can never claim data that the owner tried to erase.
          const reservation = await writer.supersede({
            isCurrent: eraseIsCurrent,
            steps: [
              {
                type: "set",
                key: AVATAR_LEGACY_LOCAL_CLAIM_KEY,
                value: `complete:${keys.scopeKey}`,
              },
            ],
          });
          if (reservation === "superseded" || !eraseIsCurrent()) {
            return "superseded";
          }

          const removal = await writer.enqueue(
            {
              continueAfterError: true,
              isCurrent: eraseIsCurrent,
              steps: [
                { type: "remove", key: AVATAR_SET_STORAGE_KEY },
                { type: "remove", key: AVATAR_CONFIG_STORAGE_KEY },
                { type: "remove", key: AVATAR_SET_RECOVERY_KEY },
                { type: "remove", key: AVATAR_CONFIG_RECOVERY_KEY },
                { type: "remove", key: keys.avatarSet },
                { type: "remove", key: keys.avatarConfig },
                { type: "remove", key: keys.avatarSetRecovery },
                { type: "remove", key: keys.avatarConfigRecovery },
              ],
            },
            writer.currentEpoch(),
          );
          if (removal === "superseded" || !eraseIsCurrent()) {
            return "superseded";
          }

          // Release the tombstone only after every data-bearing removal has
          // succeeded. A failed release is reported and safely leaves a
          // non-rendered marker for a later owner retry.
          const release = await writer.enqueue(
            {
              isCurrent: eraseIsCurrent,
              steps: [{ type: "remove", key: AVATAR_LEGACY_LOCAL_CLAIM_KEY }],
            },
            writer.currentEpoch(),
          );
          if (release === "superseded" || !eraseIsCurrent()) {
            return "superseded";
          }
          hydrationSucceeded = true;
          return "erased";
        } catch (error) {
          if (
            error instanceof AvatarStorageMutationSupersededError ||
            !eraseIsCurrent()
          ) {
            return "superseded";
          }
          throw error;
        }
      })();
      activeErase = operation;
      void operation.then(
        () => {
          if (activeErase === operation) activeErase = null;
        },
        () => {
          if (activeErase === operation) activeErase = null;
        },
      );
      return operation;
    },

    activate() {
      if (active) return;
      active = true;
      lifecycleGeneration += 1;
      hydrationSucceeded = false;
    },

    deactivate() {
      active = false;
      lifecycleGeneration += 1;
      hydrationSucceeded = false;
    },
  };
}

import type { LocalDataResetParticipant } from "./localDataResetCoordinator.ts";
import {
  LocalDataResetInProgressError,
} from "./removableLocalDataStorage.ts";
import type {
  TrackedLocalDataWork,
  TrackedLocalDataWorkScope,
} from "./trackedLocalDataWork.ts";

export const AVATAR_KEY = "woofwatcher.avatarSet.v1";
export const AVATAR_CONFIG_KEY = "woofwatcher.petAvatarConfig.v1";

export const AVATAR_LOCAL_DATA_KEYS = [
  AVATAR_KEY,
  AVATAR_CONFIG_KEY,
] as const;

export type AvatarLocalDataKey = (typeof AVATAR_LOCAL_DATA_KEYS)[number];

export interface AvatarLocalDataResetController {
  participant: Omit<LocalDataResetParticipant, "id">;
}

export interface AvatarLocalDataResetControllerOptions {
  removeItem(key: AvatarLocalDataKey): Promise<void>;
  finalizeSuccessfulCommit(): void;
}

export class AvatarLocalDataResetCommitError extends Error {
  readonly failedKeys: readonly AvatarLocalDataKey[];

  constructor(failedKeys: readonly AvatarLocalDataKey[]) {
    super(`Could not remove Avatar local data keys: ${failedKeys.join(", ")}.`);
    this.name = "AvatarLocalDataResetCommitError";
    this.failedKeys = Object.freeze([...failedKeys]);
  }
}

function invokeAsync<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return Promise.resolve(operation());
  } catch (error) {
    return Promise.reject(error);
  }
}

export function createAvatarLocalDataResetController(
  options: AvatarLocalDataResetControllerOptions,
): AvatarLocalDataResetController {
  let preparationAttempt = 0;
  let preparedAttempt: number | null = null;

  const participant: Omit<LocalDataResetParticipant, "id"> = {
    prepare() {
      const attempt = ++preparationAttempt;
      preparedAttempt = attempt;
      return Promise.resolve();
    },
    async commit() {
      if (preparedAttempt === null) {
        throw new Error("Avatar local data reset was not prepared.");
      }
      preparedAttempt = null;

      const results = await Promise.allSettled(
        AVATAR_LOCAL_DATA_KEYS.map((key) =>
          invokeAsync(() => options.removeItem(key)),
        ),
      );
      const failedKeys = AVATAR_LOCAL_DATA_KEYS.filter(
        (_key, index) => results[index]?.status === "rejected",
      );
      if (failedKeys.length > 0) {
        throw new AvatarLocalDataResetCommitError(failedKeys);
      }

      options.finalizeSuccessfulCommit();
    },
  };

  return {
    participant: Object.freeze(participant),
  };
}

export interface RunTrackedAvatarMutationOptions {
  runTrackedLocalDataWork: TrackedLocalDataWork["run"];
  beginCurrentMutation(): void;
  persist(): Promise<void>;
  applyCurrent(): void;
}

export async function runTrackedAvatarMutation(
  options: RunTrackedAvatarMutationOptions,
): Promise<void> {
  const result = await options.runTrackedLocalDataWork(async (scope) => {
    options.beginCurrentMutation();
    await options.persist();
    if (!scope.isCurrent()) {
      throw new LocalDataResetInProgressError();
    }
    options.applyCurrent();
  });

  if (result.status === "revoked") {
    throw new LocalDataResetInProgressError();
  }
}

export interface AvatarHydrationResolution<T> {
  value: T;
  repair?: () => Promise<void>;
}

export interface AvatarHydrationField<T> {
  captureRevision(): number;
  isRevisionCurrent(revision: number): boolean;
  read(): Promise<string | null>;
  resolve(
    raw: string | null,
  ): AvatarHydrationResolution<T> | Promise<AvatarHydrationResolution<T>>;
  apply(value: T): void;
}

export interface RunAvatarHydrationAttemptOptions<TAvatarSet, TAvatarConfig> {
  runTrackedLocalDataWork: TrackedLocalDataWork["run"];
  drainPendingWrites(): Promise<void>;
  isCancelled(): boolean;
  avatarSet: AvatarHydrationField<TAvatarSet>;
  avatarConfig: AvatarHydrationField<TAvatarConfig>;
  markLoaded(): void;
  requestRetry(): void;
}

export interface AvatarHydrationRetryScheduler {
  request(): void;
  reset(): void;
  activate(): void;
  deactivate(): void;
}

export interface AvatarHydrationRetrySchedulerOptions {
  schedule(run: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
  onRetry(): void;
}

const AVATAR_HYDRATION_RETRY_DELAYS_MS = [
  250,
  500,
  1_000,
  2_000,
  4_000,
  8_000,
  16_000,
  30_000,
] as const;

export function createAvatarHydrationRetryScheduler(
  options: AvatarHydrationRetrySchedulerOptions,
): AvatarHydrationRetryScheduler {
  let attempt = 0;
  let scheduledHandle: unknown | null = null;
  let scheduleGeneration = 0;
  let active = true;

  const cancelScheduled = () => {
    scheduleGeneration += 1;
    if (scheduledHandle === null) return;
    options.cancel(scheduledHandle);
    scheduledHandle = null;
  };

  return {
    request() {
      if (!active || scheduledHandle !== null) return;
      const delayIndex = Math.min(
        attempt,
        AVATAR_HYDRATION_RETRY_DELAYS_MS.length - 1,
      );
      const delayMs = AVATAR_HYDRATION_RETRY_DELAYS_MS[delayIndex]!;
      attempt += 1;
      const acceptedGeneration = ++scheduleGeneration;
      scheduledHandle = options.schedule(() => {
        if (!active || acceptedGeneration !== scheduleGeneration) return;
        scheduledHandle = null;
        options.onRetry();
      }, delayMs);
    },
    reset() {
      cancelScheduled();
      attempt = 0;
    },
    activate() {
      active = true;
    },
    deactivate() {
      if (!active) return;
      active = false;
      cancelScheduled();
      attempt = 0;
    },
  };
}

function ensureAttemptCurrent(
  scope: TrackedLocalDataWorkScope,
  isCancelled: () => boolean,
): boolean {
  if (isCancelled()) return false;
  if (!scope.isCurrent()) throw new LocalDataResetInProgressError();
  return true;
}

export async function runAvatarHydrationAttempt<TAvatarSet, TAvatarConfig>(
  options: RunAvatarHydrationAttemptOptions<TAvatarSet, TAvatarConfig>,
): Promise<void> {
  let retryRequested = false;
  const requestRetry = () => {
    if (retryRequested || options.isCancelled()) return;
    retryRequested = true;
    options.requestRetry();
  };

  const result = await options.runTrackedLocalDataWork(async (scope) => {
    const avatarSetRevision = options.avatarSet.captureRevision();
    const avatarConfigRevision = options.avatarConfig.captureRevision();

    try {
      await invokeAsync(options.drainPendingWrites);
    } catch {
      requestRetry();
      return;
    }
    if (!ensureAttemptCurrent(scope, options.isCancelled)) return;
    if (
      !options.avatarSet.isRevisionCurrent(avatarSetRevision) ||
      !options.avatarConfig.isRevisionCurrent(avatarConfigRevision)
    ) {
      requestRetry();
      return;
    }

    const avatarSetRead = invokeAsync(options.avatarSet.read);
    const avatarConfigRead = invokeAsync(options.avatarConfig.read);
    const reads = await Promise.allSettled([avatarSetRead, avatarConfigRead]);

    if (!ensureAttemptCurrent(scope, options.isCancelled)) return;
    if (reads.some((read) => read.status === "rejected")) {
      requestRetry();
      return;
    }

    const avatarSetRaw = (reads[0] as PromiseFulfilledResult<string | null>).value;
    const avatarConfigRaw = (reads[1] as PromiseFulfilledResult<string | null>).value;
    const resolutions = await Promise.allSettled([
      invokeAsync(() => Promise.resolve(options.avatarSet.resolve(avatarSetRaw))),
      invokeAsync(() => Promise.resolve(options.avatarConfig.resolve(avatarConfigRaw))),
    ]);

    if (!ensureAttemptCurrent(scope, options.isCancelled)) return;

    const applyField = async <T>(
      field: AvatarHydrationField<T>,
      capturedRevision: number,
      resolution: PromiseSettledResult<AvatarHydrationResolution<T>>,
    ): Promise<boolean> => {
      if (resolution.status === "rejected") {
        requestRetry();
        return false;
      }
      if (!ensureAttemptCurrent(scope, options.isCancelled)) return false;
      if (!field.isRevisionCurrent(capturedRevision)) return false;

      if (resolution.value.repair) {
        try {
          await invokeAsync(resolution.value.repair);
        } catch {
          requestRetry();
          return false;
        }
        if (!ensureAttemptCurrent(scope, options.isCancelled)) return false;
        if (!field.isRevisionCurrent(capturedRevision)) return false;
      }

      field.apply(resolution.value.value);
      return true;
    };

    const avatarSetApplied = await applyField(
      options.avatarSet,
      avatarSetRevision,
      resolutions[0] as PromiseSettledResult<
        AvatarHydrationResolution<TAvatarSet>
      >,
    );
    const avatarConfigApplied = await applyField(
      options.avatarConfig,
      avatarConfigRevision,
      resolutions[1] as PromiseSettledResult<
        AvatarHydrationResolution<TAvatarConfig>
      >,
    );

    if (!avatarSetApplied || !avatarConfigApplied) return;
    if (!ensureAttemptCurrent(scope, options.isCancelled)) return;
    if (
      !options.avatarSet.isRevisionCurrent(avatarSetRevision) ||
      !options.avatarConfig.isRevisionCurrent(avatarConfigRevision)
    ) {
      requestRetry();
      return;
    }
    options.markLoaded();
  });

  if (result.status === "revoked") {
    throw new LocalDataResetInProgressError();
  }
}

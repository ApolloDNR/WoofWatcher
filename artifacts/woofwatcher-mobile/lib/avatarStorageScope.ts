import {
  getCareStorageKey,
  type CareStorageScope,
} from "./careStorageScope.ts";
import {
  normalizeAvatarConfig,
  type PetAvatarConfig,
} from "./avatarStudio.ts";
import type { Mood } from "./phoenixStatus.ts";

export const AVATAR_MOODS: readonly Mood[] = [
  "happy",
  "excited",
  "calm",
  "anxious",
  "unwell",
];

export type AvatarSet = Partial<Record<Mood, string>>;

export interface AvatarStoredState {
  avatarSet: AvatarSet | null;
  avatarConfig: PetAvatarConfig;
}

export type AvatarStorageInspection =
  | { status: "missing"; state: null }
  | { status: "valid"; state: AvatarStoredState }
  | { status: "invalid"; state: null };

export type LegacyAvatarValue<T> =
  | { status: "missing"; value: null }
  | { status: "valid"; value: T }
  | { status: "invalid"; value: null };

export type LegacyAvatarPairInspection =
  | { status: "missing"; state: null }
  | { status: "valid"; state: AvatarStoredState }
  | { status: "invalid"; state: null };

export interface AvatarWriteCoordinator {
  enqueue(
    update: (current: AvatarStoredState) => AvatarStoredState,
    persist: (next: AvatarStoredState) => Promise<void>,
  ): Promise<AvatarStoredState>;
}

export const LEGACY_AVATAR_STORAGE_KEYS = {
  avatarSet: "woofwatcher.avatarSet.v1",
  avatarConfig: "woofwatcher.petAvatarConfig.v1",
} as const;

const AVATAR_STORAGE_VERSION = 1;

export function getAvatarStorageKey(scope: CareStorageScope): string {
  return `${getCareStorageKey(scope)}.avatar.v1`;
}

function cleanAvatarSet(value: unknown): AvatarSet | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const clean: AvatarSet = {};
  for (const mood of AVATAR_MOODS) {
    const uri = (value as Record<string, unknown>)[mood];
    if (typeof uri === "string" && uri.trim()) clean[mood] = uri;
  }
  return Object.keys(clean).length ? clean : null;
}

export function inspectLegacyAvatarSet(
  raw: string | null,
): LegacyAvatarValue<AvatarSet | null> {
  if (raw == null) return { status: "missing", value: null };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { status: "invalid", value: null };
    }
    return { status: "valid", value: cleanAvatarSet(parsed) };
  } catch {
    return { status: "invalid", value: null };
  }
}

export function inspectLegacyAvatarConfig(
  raw: string | null,
  petName: string,
): LegacyAvatarValue<PetAvatarConfig> {
  if (raw == null) return { status: "missing", value: null };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { status: "invalid", value: null };
    }
    return {
      status: "valid",
      value: { ...normalizeAvatarConfig(parsed, petName), petName },
    };
  } catch {
    return { status: "invalid", value: null };
  }
}

/**
 * The two old global values were one logical care-twin record. Never import
 * only the readable half into an authenticated household: a partial import
 * would silently substitute defaults while claiming that the older twin was
 * restored. Both originals remain untouched when the pair is incomplete.
 */
export function inspectLegacyAvatarPair(
  avatarSet: LegacyAvatarValue<AvatarSet | null>,
  avatarConfig: LegacyAvatarValue<PetAvatarConfig>,
): LegacyAvatarPairInspection {
  if (avatarSet.status === "missing" && avatarConfig.status === "missing") {
    return { status: "missing", state: null };
  }
  if (avatarSet.status !== "valid" || avatarConfig.status !== "valid") {
    return { status: "invalid", state: null };
  }
  return {
    status: "valid",
    state: {
      avatarSet: avatarSet.value,
      avatarConfig: avatarConfig.value,
    },
  };
}

export function serializeAvatarState(state: AvatarStoredState): string {
  return JSON.stringify({
    version: AVATAR_STORAGE_VERSION,
    avatarSet: state.avatarSet ?? {},
    avatarConfig: state.avatarConfig,
  });
}

export function inspectAvatarStorage(
  raw: string | null,
  petName: string,
): AvatarStorageInspection {
  if (raw == null) return { status: "missing", state: null };
  try {
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      (parsed as Record<string, unknown>).version !== AVATAR_STORAGE_VERSION
    ) {
      return { status: "invalid", state: null };
    }
    const envelope = parsed as Record<string, unknown>;
    if (
      !envelope.avatarConfig ||
      typeof envelope.avatarConfig !== "object" ||
      Array.isArray(envelope.avatarConfig) ||
      !envelope.avatarSet ||
      typeof envelope.avatarSet !== "object" ||
      Array.isArray(envelope.avatarSet)
    ) {
      return { status: "invalid", state: null };
    }
    return {
      status: "valid",
      state: {
        avatarSet: cleanAvatarSet(envelope.avatarSet),
        avatarConfig: {
          ...normalizeAvatarConfig(envelope.avatarConfig, petName),
          petName,
        },
      },
    };
  } catch {
    return { status: "invalid", state: null };
  }
}

export function createAvatarWriteCoordinator(
  initialState: AvatarStoredState,
): AvatarWriteCoordinator {
  let confirmedState = initialState;
  let tail: Promise<void> = Promise.resolve();
  return {
    enqueue(update, persist) {
      const result = tail.then(async () => {
        const next = update(confirmedState);
        await persist(next);
        confirmedState = next;
        return next;
      });
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}

export function assertAvatarWriteAllowed(
  legacyCandidate: AvatarStoredState | null,
  allowLegacyDecision = false,
): void {
  if (legacyCandidate && !allowLegacyDecision) {
    throw new Error(
      "Review the older device care twin before changing this household's avatar.",
    );
  }
}

export function resolveAvatarLegacyDecision(
  current: AvatarStoredState,
  candidate: AvatarStoredState,
  decision: "import" | "keep-current",
): AvatarStoredState {
  return decision === "import" ? candidate : current;
}

export async function filterAvatarSetByUriExistence(
  set: AvatarSet,
  exists: (uri: string) => Promise<boolean>,
): Promise<AvatarSet | null> {
  const checks = await Promise.all(
    AVATAR_MOODS.map(async (mood) => {
      const uri = set[mood];
      return [mood, uri, uri ? await exists(uri) : false] as const;
    }),
  );
  const verified: AvatarSet = {};
  for (const [mood, uri, isPresent] of checks) {
    if (uri && isPresent) verified[mood] = uri;
  }
  return Object.keys(verified).length ? verified : null;
}

export function commitAvatarMemoryIfCurrent(
  next: AvatarStoredState,
  isCurrent: () => boolean,
  commit: (state: AvatarStoredState) => void,
): boolean {
  if (!isCurrent()) return false;
  commit(next);
  return true;
}

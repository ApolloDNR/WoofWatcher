import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, type ImageSourcePropType } from "react-native";
import {
  createDefaultAvatarConfig,
  normalizeAvatarConfig,
  type PetAvatarConfig,
} from "@/lib/avatarStudio";
import {
  buildAvatarStorageKeys,
  createAvatarPersistence,
  fenceAvatarPersistenceWrites,
  type AvatarPersistence,
  type AvatarPersistenceScope,
} from "@/lib/avatarPersistence";
import {
  createAvatarConfigWriteGate,
  type AvatarConfigWriteSnapshot,
} from "@/lib/avatarConfigWriteGate";
import type { Mood } from "@/lib/phoenixStatus";
import { useCare } from "@/context/CareContext";

export {
  AVATAR_SET_STORAGE_KEY as AVATAR_KEY,
  AVATAR_CONFIG_STORAGE_KEY as AVATAR_CONFIG_KEY,
} from "@/lib/avatarPersistence";

export const MOODS: Mood[] = ["happy", "excited", "calm", "anxious", "unwell"];

// Default mood portraits use the storybook German Shepherd so every avatar
// surface matches the mock-board room environment out of the box.
const DEFAULT_SOURCES: Record<Mood, ImageSourcePropType> = {
  happy: require("@/assets/avatar/phoenix/storybook/storybook-still-sit.png"),
  excited: require("@/assets/avatar/phoenix/storybook/storybook-still-sit.png"),
  calm: require("@/assets/avatar/phoenix/storybook/storybook-still-sit.png"),
  anxious: require("@/assets/avatar/phoenix/storybook/storybook-still-sit.png"),
  unwell: require("@/assets/avatar/phoenix/storybook/storybook-still-sleep.png"),
};

export type AvatarSet = Partial<Record<Mood, string>>;
export type AvatarHydrationStatus = "loading" | "ready" | "failed";
export type AvatarEraseResult = "erased" | "superseded";
export type ConditionalAvatarConfigSaveResult =
  | { status: "saved"; revision: number }
  | { status: "stale"; revision: number }
  | { status: "failed"; revision: number; error: unknown };

async function uriExists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    // A transient filesystem error is not proof the file is gone. Treat it
    // as present so a flaky check can never permanently prune a custom
    // avatar reference - a genuinely missing file is confirmed (exists:
    // false resolves, not throws) on a later launch.
    return true;
  }
}

async function verifyAvatarSet(
  set: AvatarSet,
): Promise<{ set: AvatarSet; changed: boolean }> {
  // Bundled defaults are always available on web; only file URIs need checking.
  if (Platform.OS === "web") {
    return { set, changed: false };
  }

  const entries = MOODS.map((mood) => [mood, set[mood]] as const).filter(
    ([, uri]) => typeof uri === "string" && uri.length > 0,
  );

  const checks = await Promise.all(
    entries.map(async ([mood, uri]) => [mood, await uriExists(uri!)] as const),
  );

  const next: AvatarSet = {};
  let changed = false;
  for (const [mood, exists] of checks) {
    if (exists) {
      next[mood] = set[mood];
    } else {
      changed = true;
    }
  }

  return { set: next, changed };
}

interface AvatarContextValue {
  avatarSet: AvatarSet | null;
  avatarConfig: PetAvatarConfig;
  hasCustomAvatar: boolean;
  hasConfiguredAvatar: boolean;
  hydrationStatus: AvatarHydrationStatus;
  isLoaded: boolean;
  avatarConfigWriteRevision: number;
  avatarConfigWritePending: boolean;
  getAvatarConfigWriteState: () => AvatarConfigWriteSnapshot;
  retryHydration: () => void;
  eraseAvatarData: () => Promise<AvatarEraseResult>;
  getAvatarSource: (mood: Mood) => ImageSourcePropType;
  saveAvatarSet: (set: AvatarSet) => Promise<void>;
  clearAvatarSet: () => Promise<void>;
  saveAvatarConfig: (config: PetAvatarConfig) => Promise<void>;
  saveAvatarConfigIfCurrent: (
    config: PetAvatarConfig,
    expectedRevision: number,
  ) => Promise<ConditionalAvatarConfigSaveResult>;
  resetAvatarConfig: (petName?: string) => Promise<void>;
}

const AvatarContext = createContext<AvatarContextValue | null>(null);

export function AvatarProvider({ children }: { children: React.ReactNode }) {
  const { avatarStorageScope } = useCare();
  const retainedAvatarStorageSessionKeyRef = useRef<string | null>(null);
  if (avatarStorageScope) {
    retainedAvatarStorageSessionKeyRef.current =
      buildAvatarStorageKeys(avatarStorageScope).scopeKey;
  }
  // Care temporarily hides its scope while an owner wipe or exact rehydrate
  // is in flight. Retaining the last exact key keeps the Privacy screen
  // mounted long enough to report the durable result. A genuinely different
  // non-null owner/household/dog scope still changes the key and remounts all
  // Avatar state before that scope can render.
  const avatarStorageSessionKey =
    retainedAvatarStorageSessionKeyRef.current ?? "unavailable";

  return (
    <AvatarProviderSession
      key={avatarStorageSessionKey}
      scope={avatarStorageScope}
    >
      {children}
    </AvatarProviderSession>
  );
}

function AvatarProviderSession({
  children,
  scope,
}: {
  children: React.ReactNode;
  scope: AvatarPersistenceScope | null;
}) {
  const [avatarSet, setAvatarSet] = useState<AvatarSet | null>(null);
  const [avatarConfig, setAvatarConfig] = useState<PetAvatarConfig>(() =>
    createDefaultAvatarConfig("Phoenix"),
  );
  const [avatarHydrationStatus, setAvatarHydrationStatus] =
    useState<AvatarHydrationStatus>("loading");
  const avatarHydrationStatusRef = useRef<AvatarHydrationStatus>("loading");
  const hydrationAttemptRef = useRef(0);
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const avatarStateGenerationRef = useRef(0);
  const [avatarConfigWriteGate] = useState(createAvatarConfigWriteGate);
  const [avatarConfigWriteState, setAvatarConfigWriteState] =
    useState<AvatarConfigWriteSnapshot>(() => avatarConfigWriteGate.snapshot());
  const publishAvatarConfigWriteState = useCallback(() => {
    setAvatarConfigWriteState(avatarConfigWriteGate.snapshot());
  }, [avatarConfigWriteGate]);
  const getAvatarConfigWriteState = useCallback(
    () => avatarConfigWriteGate.snapshot(),
    [avatarConfigWriteGate],
  );
  const avatarPersistenceRef = useRef<AvatarPersistence<
    AvatarSet,
    PetAvatarConfig
  > | null>(null);
  if (scope && !avatarPersistenceRef.current) {
    avatarPersistenceRef.current = createAvatarPersistence({
      scope,
      storage: AsyncStorage,
      parseAvatarSet: async (decoded) => {
        const verified = await verifyAvatarSet(decoded as AvatarSet);
        return {
          value: verified.set,
          ...(verified.changed
            ? {
                rewrite:
                  Object.keys(verified.set).length > 0
                    ? JSON.stringify(verified.set)
                    : null,
              }
            : {}),
        };
      },
      parseAvatarConfig: (decoded) => ({
        value: normalizeAvatarConfig(decoded, "Phoenix"),
      }),
    });
  }
  const avatarPersistence = avatarPersistenceRef.current;
  const scopeAvailable = scope !== null;
  const visibleAvatarSet = scopeAvailable ? avatarSet : null;
  const visibleAvatarConfig = scopeAvailable
    ? avatarConfig
    : createDefaultAvatarConfig("Phoenix");
  const visibleHydrationStatus = scopeAvailable
    ? avatarHydrationStatus
    : "loading";
  const isLoaded = visibleHydrationStatus === "ready";

  const retryHydration = useCallback(() => {
    const nextAttempt = hydrationAttemptRef.current + 1;
    hydrationAttemptRef.current = nextAttempt;
    avatarStateGenerationRef.current += 1;
    avatarConfigWriteGate.invalidate();
    publishAvatarConfigWriteState();
    avatarHydrationStatusRef.current = "loading";
    setAvatarHydrationStatus("loading");
    setHydrationAttempt(nextAttempt);
  }, [avatarConfigWriteGate, publishAvatarConfigWriteState]);

  useEffect(() => {
    if (!scopeAvailable) {
      avatarPersistence?.deactivate();
      return;
    }
    avatarPersistence?.activate();
    return () => {
      avatarPersistence?.deactivate();
    };
  }, [avatarPersistence, scopeAvailable]);

  useEffect(() => {
    if (scopeAvailable) return;
    // Mask the prior scope synchronously through the derived context values
    // above, then retire every async publisher before the same key can be
    // reactivated and hydrated again.
    avatarStateGenerationRef.current += 1;
    avatarConfigWriteGate.invalidate();
    publishAvatarConfigWriteState();
    avatarHydrationStatusRef.current = "loading";
    setAvatarHydrationStatus("loading");
    setAvatarSet(null);
    setAvatarConfig(createDefaultAvatarConfig("Phoenix"));
  }, [avatarConfigWriteGate, publishAvatarConfigWriteState, scopeAvailable]);

  useEffect(() => {
    if (!scopeAvailable || !avatarPersistence) return;
    let cancelled = false;
    // The erase path advances the synchronous attempt ref without scheduling
    // a redundant load. When the same exact scope returns, capture that
    // current ref so the reactivation hydrate cannot reject itself as stale.
    const attempt = hydrationAttemptRef.current;
    const isCurrentAttempt = () =>
      !cancelled && hydrationAttemptRef.current === attempt;

    const load = async () => {
      try {
        const result = await avatarPersistence.hydrate();
        if (!isCurrentAttempt() || result.status === "superseded") return;
        if (
          result.status === "ready" ||
          result.status === "recovered-corrupt-data"
        ) {
          setAvatarSet(
            result.avatarSet && Object.keys(result.avatarSet).length > 0
              ? result.avatarSet
              : null,
          );
          setAvatarConfig(
            result.avatarConfig ?? createDefaultAvatarConfig("Phoenix"),
          );
          avatarHydrationStatusRef.current = "ready";
          setAvatarHydrationStatus("ready");
          return;
        }
        avatarHydrationStatusRef.current = "failed";
        setAvatarHydrationStatus("failed");
      } catch {
        if (!isCurrentAttempt()) return;
        avatarHydrationStatusRef.current = "failed";
        setAvatarHydrationStatus("failed");
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [avatarPersistence, hydrationAttempt, scopeAvailable]);

  const requireSuccessfulHydration = useCallback(() => {
    if (
      !scopeAvailable ||
      avatarHydrationStatusRef.current !== "ready" ||
      !avatarPersistence
    ) {
      throw new Error(
        "Avatar data cannot be changed until local storage loads successfully.",
      );
    }
    return avatarPersistence;
  }, [avatarPersistence, scopeAvailable]);

  const getAvatarSource = useCallback(
    (mood: Mood): ImageSourcePropType => {
      const uri = visibleAvatarSet?.[mood];
      if (uri) return { uri };
      return DEFAULT_SOURCES[mood] ?? DEFAULT_SOURCES.calm;
    },
    [visibleAvatarSet],
  );

  const saveAvatarSet = useCallback(
    async (set: AvatarSet) => {
      const persistence = requireSuccessfulHydration();
      const stateGeneration = avatarStateGenerationRef.current;
      const clean: AvatarSet = {};
      for (const m of MOODS) {
        if (set[m]) clean[m] = set[m];
      }
      await persistence.saveAvatarSet(JSON.stringify(clean));
      if (stateGeneration !== avatarStateGenerationRef.current) return;
      setAvatarSet(clean);
    },
    [avatarPersistence, requireSuccessfulHydration],
  );

  const clearAvatarSet = useCallback(async () => {
    const persistence = requireSuccessfulHydration();
    const stateGeneration = avatarStateGenerationRef.current;
    await persistence.clearAvatarSet();
    if (stateGeneration !== avatarStateGenerationRef.current) return;
    setAvatarSet(null);
  }, [avatarPersistence, requireSuccessfulHydration]);

  const persistAvatarConfig = useCallback(
    async (
      config: PetAvatarConfig,
      expectedRevision?: number,
    ): Promise<ConditionalAvatarConfigSaveResult> => {
      const persistence = requireSuccessfulHydration();
      const reservation =
        expectedRevision === undefined
          ? avatarConfigWriteGate.begin()
          : avatarConfigWriteGate.beginIfCurrent(expectedRevision);
      if (!reservation) {
        return {
          status: "stale",
          revision: avatarConfigWriteGate.snapshot().revision,
        };
      }
      publishAvatarConfigWriteState();
      const stateGeneration = avatarStateGenerationRef.current;
      const clean = normalizeAvatarConfig(
        {
          ...config,
          updatedAt: new Date().toISOString(),
        },
        config.petName || "Phoenix",
      );
      try {
        await persistence.saveAvatarConfig(JSON.stringify(clean));
        if (stateGeneration !== avatarStateGenerationRef.current) {
          return {
            status: "stale",
            revision: avatarConfigWriteGate.snapshot().revision,
          };
        }
        setAvatarConfig(clean);
        return { status: "saved", revision: reservation.revision };
      } catch (error) {
        if (stateGeneration !== avatarStateGenerationRef.current) {
          return {
            status: "stale",
            revision: avatarConfigWriteGate.snapshot().revision,
          };
        }
        return { status: "failed", revision: reservation.revision, error };
      } finally {
        avatarConfigWriteGate.finish(reservation);
        publishAvatarConfigWriteState();
      }
    },
    [
      avatarConfigWriteGate,
      publishAvatarConfigWriteState,
      requireSuccessfulHydration,
    ],
  );

  const saveAvatarConfig = useCallback(
    async (config: PetAvatarConfig) => {
      const result = await persistAvatarConfig(config);
      if (result.status === "failed") throw result.error;
    },
    [persistAvatarConfig],
  );

  const saveAvatarConfigIfCurrent = useCallback(
    (config: PetAvatarConfig, expectedRevision: number) =>
      persistAvatarConfig(config, expectedRevision),
    [persistAvatarConfig],
  );

  const resetAvatarConfig = useCallback(
    async (petName = "Phoenix") => {
      const result = await persistAvatarConfig(
        createDefaultAvatarConfig(petName),
      );
      if (result.status === "failed") throw result.error;
    },
    [persistAvatarConfig],
  );

  const eraseAvatarData = useCallback(async () => {
    hydrationAttemptRef.current += 1;
    const stateGeneration = avatarStateGenerationRef.current + 1;
    avatarStateGenerationRef.current = stateGeneration;
    avatarConfigWriteGate.invalidate();
    publishAvatarConfigWriteState();
    avatarHydrationStatusRef.current = "loading";
    setAvatarHydrationStatus("loading");
    setAvatarSet(null);
    setAvatarConfig(createDefaultAvatarConfig("Phoenix"));
    try {
      if (!avatarPersistence) {
        const result = await fenceAvatarPersistenceWrites(AsyncStorage);
        return result === "fenced" ? "erased" : "superseded";
      }
      const result = await avatarPersistence.eraseAvatarData();
      if (
        result === "superseded" ||
        stateGeneration !== avatarStateGenerationRef.current
      ) {
        return "superseded";
      }
      avatarHydrationStatusRef.current = "ready";
      setAvatarHydrationStatus("ready");
      return "erased";
    } catch (error) {
      if (stateGeneration === avatarStateGenerationRef.current) {
        avatarHydrationStatusRef.current = "failed";
        setAvatarHydrationStatus("failed");
      }
      throw error;
    }
  }, [avatarConfigWriteGate, avatarPersistence, publishAvatarConfigWriteState]);

  const hasCustomAvatar =
    !!visibleAvatarSet && Object.keys(visibleAvatarSet).length > 0;
  const hasConfiguredAvatar =
    visibleAvatarConfig.scanAssisted ||
    visibleAvatarConfig.templateId !== "shepherd" ||
    visibleAvatarConfig.collarId !== "forest-bandana" ||
    visibleAvatarConfig.faceMarkingId !== "mask" ||
    visibleAvatarConfig.coatPrimary !== "#1B1714" ||
    visibleAvatarConfig.coatSecondary !== "#C99052";

  const value = useMemo(
    () => ({
      avatarSet: visibleAvatarSet,
      avatarConfig: visibleAvatarConfig,
      hasCustomAvatar,
      hasConfiguredAvatar,
      hydrationStatus: visibleHydrationStatus,
      isLoaded,
      avatarConfigWriteRevision: avatarConfigWriteState.revision,
      avatarConfigWritePending: avatarConfigWriteState.pending,
      getAvatarConfigWriteState,
      retryHydration,
      eraseAvatarData,
      getAvatarSource,
      saveAvatarSet,
      clearAvatarSet,
      saveAvatarConfig,
      saveAvatarConfigIfCurrent,
      resetAvatarConfig,
    }),
    [
      visibleAvatarSet,
      visibleAvatarConfig,
      hasCustomAvatar,
      hasConfiguredAvatar,
      visibleHydrationStatus,
      isLoaded,
      avatarConfigWriteState,
      getAvatarConfigWriteState,
      retryHydration,
      eraseAvatarData,
      getAvatarSource,
      saveAvatarSet,
      clearAvatarSet,
      saveAvatarConfig,
      saveAvatarConfigIfCurrent,
      resetAvatarConfig,
    ],
  );

  return (
    <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>
  );
}

export function useAvatar() {
  const ctx = useContext(AvatarContext);
  if (!ctx) throw new Error("useAvatar must be used within AvatarProvider");
  return ctx;
}

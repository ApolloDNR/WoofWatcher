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
import { useLocalDataReset } from "@/context/LocalDataResetContext";
import {
  AVATAR_CONFIG_KEY,
  AVATAR_KEY,
  createAvatarLocalDataResetController,
  createAvatarHydrationRetryScheduler,
  runAvatarHydrationAttempt,
  runTrackedAvatarMutation,
  type AvatarHydrationRetryScheduler,
  type AvatarLocalDataResetController,
} from "@/lib/avatarLocalDataReset";
import {
  createDefaultAvatarConfig,
  hasManualAvatarConfiguration,
  normalizeAvatarConfig,
  type PetAvatarConfig,
} from "@/lib/avatarStudio";
import { LocalDataResetInProgressError } from "@/lib/removableLocalDataStorage";
import { DEFAULT_PET_PLACEHOLDER } from "@/lib/petIdentity";
import type { Mood } from "@/lib/phoenixStatus";

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
  isLoaded: boolean;
  getAvatarSource: (mood: Mood) => ImageSourcePropType;
  saveAvatarSet: (set: AvatarSet) => Promise<void>;
  clearAvatarSet: () => Promise<void>;
  saveAvatarConfig: (config: PetAvatarConfig) => Promise<void>;
  resetAvatarConfig: (petName?: string) => Promise<void>;
}

const AvatarContext = createContext<AvatarContextValue | null>(null);

export function AvatarProvider({ children }: { children: React.ReactNode }) {
  const [avatarSet, setAvatarSet] = useState<AvatarSet | null>(null);
  const [avatarConfig, setAvatarConfig] = useState<PetAvatarConfig>(() =>
    createDefaultAvatarConfig(DEFAULT_PET_PLACEHOLDER),
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const [hydrationReloadNonce, setHydrationReloadNonce] = useState(0);
  const avatarSetHydrationRevisionRef = useRef(0);
  const avatarConfigHydrationRevisionRef = useRef(0);
  const avatarSetLoadedRef = useRef(false);
  const avatarConfigLoadedRef = useRef(false);
  const {
    attachRequiredParticipant,
    operationSettledEpoch,
    removableStorage,
    runTrackedLocalDataWork,
  } = useLocalDataReset();

  const hydrationRetrySchedulerRef =
    useRef<AvatarHydrationRetryScheduler | null>(null);
  if (hydrationRetrySchedulerRef.current === null) {
    hydrationRetrySchedulerRef.current = createAvatarHydrationRetryScheduler({
      schedule: (run, delayMs) => setTimeout(run, delayMs),
      cancel: (handle) =>
        clearTimeout(handle as ReturnType<typeof setTimeout>),
      onRetry: () => setHydrationReloadNonce((nonce) => nonce + 1),
    });
  }
  const hydrationRetryScheduler = hydrationRetrySchedulerRef.current;
  const requestHydrationRetry = useCallback(
    () => hydrationRetryScheduler.request(),
    [hydrationRetryScheduler],
  );
  const resetHydrationRetry = useCallback(
    () => hydrationRetryScheduler.reset(),
    [hydrationRetryScheduler],
  );

  const markAvatarSetLoaded = useCallback(() => {
    avatarSetLoadedRef.current = true;
    if (avatarConfigLoadedRef.current) {
      setIsLoaded(true);
    }
  }, []);

  const markAvatarConfigLoaded = useCallback(() => {
    avatarConfigLoadedRef.current = true;
    if (avatarSetLoadedRef.current) {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    hydrationRetryScheduler.activate();
    return () => hydrationRetryScheduler.deactivate();
  }, [hydrationRetryScheduler]);

  const avatarLocalDataResetControllerRef =
    useRef<AvatarLocalDataResetController | null>(null);
  if (avatarLocalDataResetControllerRef.current === null) {
    avatarLocalDataResetControllerRef.current =
      createAvatarLocalDataResetController({
        removeItem: (key) => AsyncStorage.removeItem(key),
        finalizeSuccessfulCommit: () => {
          avatarSetHydrationRevisionRef.current += 1;
          avatarConfigHydrationRevisionRef.current += 1;
          avatarSetLoadedRef.current = true;
          avatarConfigLoadedRef.current = true;
          resetHydrationRetry();
          setAvatarSet(null);
          setAvatarConfig(createDefaultAvatarConfig(DEFAULT_PET_PLACEHOLDER));
          setIsLoaded(true);
        },
      });
  }
  const avatarLocalDataResetController =
    avatarLocalDataResetControllerRef.current;

  useEffect(
    () =>
      attachRequiredParticipant(
        "avatar",
        avatarLocalDataResetController.participant,
      ),
    [attachRequiredParticipant, avatarLocalDataResetController],
  );

  useEffect(() => {
    let cancelled = false;

    void runAvatarHydrationAttempt({
      runTrackedLocalDataWork,
      drainPendingWrites: removableStorage.drain,
      isCancelled: () => cancelled,
      avatarSet: {
        captureRevision: () => avatarSetHydrationRevisionRef.current,
        isRevisionCurrent: (revision) =>
          avatarSetHydrationRevisionRef.current === revision,
        read: () => removableStorage.getItem(AVATAR_KEY),
        resolve: async (raw) => {
          if (!raw) return { value: null };

          let parsed: AvatarSet | null = null;
          try {
            const data: unknown = JSON.parse(raw);
            if (data && typeof data === "object" && !Array.isArray(data)) {
              parsed = data as AvatarSet;
            }
          } catch {
            return {
              value: null,
              repair: () => removableStorage.removeItem(AVATAR_KEY),
            };
          }
          if (!parsed) {
            return {
              value: null,
              repair: () => removableStorage.removeItem(AVATAR_KEY),
            };
          }

          const verified = await verifyAvatarSet(parsed);
          const verifiedSet =
            Object.keys(verified.set).length > 0 ? verified.set : null;
          if (!verified.changed) return { value: verifiedSet };
          return {
            value: verifiedSet,
            repair: () =>
              verifiedSet
                ? removableStorage.setItem(
                    AVATAR_KEY,
                    JSON.stringify(verifiedSet),
                  )
                : removableStorage.removeItem(AVATAR_KEY),
          };
        },
        apply: (next) => {
          setAvatarSet(next);
          markAvatarSetLoaded();
        },
      },
      avatarConfig: {
        captureRevision: () => avatarConfigHydrationRevisionRef.current,
        isRevisionCurrent: (revision) =>
          avatarConfigHydrationRevisionRef.current === revision,
        read: () => removableStorage.getItem(AVATAR_CONFIG_KEY),
        resolve: (raw) => {
          if (!raw) {
            return { value: createDefaultAvatarConfig(DEFAULT_PET_PLACEHOLDER) };
          }
          try {
            return {
              value: normalizeAvatarConfig(
                JSON.parse(raw),
                DEFAULT_PET_PLACEHOLDER,
              ),
            };
          } catch {
            return { value: createDefaultAvatarConfig(DEFAULT_PET_PLACEHOLDER) };
          }
        },
        apply: (next) => {
          setAvatarConfig(next);
          markAvatarConfigLoaded();
        },
      },
      markLoaded: () => {
        resetHydrationRetry();
        setIsLoaded(true);
      },
      requestRetry: requestHydrationRetry,
    }).catch((error: unknown) => {
      if (cancelled || error instanceof LocalDataResetInProgressError) return;
      requestHydrationRetry();
    });

    return () => {
      cancelled = true;
    };
  }, [
    hydrationReloadNonce,
    markAvatarConfigLoaded,
    markAvatarSetLoaded,
    operationSettledEpoch,
    removableStorage,
    requestHydrationRetry,
    resetHydrationRetry,
    runTrackedLocalDataWork,
  ]);

  const getAvatarSource = useCallback(
    (mood: Mood): ImageSourcePropType => {
      const uri = avatarSet?.[mood];
      if (uri) return { uri };
      return DEFAULT_SOURCES[mood] ?? DEFAULT_SOURCES.calm;
    },
    [avatarSet],
  );

  const saveAvatarSet = useCallback(
    async (set: AvatarSet) => {
      const clean: AvatarSet = {};
      for (const mood of MOODS) {
        if (set[mood]) clean[mood] = set[mood];
      }
      try {
        await runTrackedAvatarMutation({
          runTrackedLocalDataWork,
          beginCurrentMutation: () => {
            avatarSetHydrationRevisionRef.current += 1;
            avatarSetLoadedRef.current = false;
            setIsLoaded(false);
          },
          persist: () =>
            removableStorage.setItem(AVATAR_KEY, JSON.stringify(clean)),
          applyCurrent: () => {
            setAvatarSet(clean);
            markAvatarSetLoaded();
          },
        });
      } catch (error) {
        requestHydrationRetry();
        throw error;
      }
    },
    [
      markAvatarSetLoaded,
      removableStorage,
      requestHydrationRetry,
      runTrackedLocalDataWork,
    ],
  );

  const clearAvatarSet = useCallback(async () => {
    try {
      await runTrackedAvatarMutation({
        runTrackedLocalDataWork,
        beginCurrentMutation: () => {
          avatarSetHydrationRevisionRef.current += 1;
          avatarSetLoadedRef.current = false;
          setIsLoaded(false);
        },
        persist: () => removableStorage.removeItem(AVATAR_KEY),
        applyCurrent: () => {
          setAvatarSet(null);
          markAvatarSetLoaded();
        },
      });
    } catch (error) {
      requestHydrationRetry();
      throw error;
    }
  }, [
    markAvatarSetLoaded,
    removableStorage,
    requestHydrationRetry,
    runTrackedLocalDataWork,
  ]);

  const saveAvatarConfig = useCallback(
    async (config: PetAvatarConfig) => {
      const clean = normalizeAvatarConfig(
        {
          ...config,
          updatedAt: new Date().toISOString(),
        },
        config.petName || DEFAULT_PET_PLACEHOLDER,
      );
      try {
        await runTrackedAvatarMutation({
          runTrackedLocalDataWork,
          beginCurrentMutation: () => {
            avatarConfigHydrationRevisionRef.current += 1;
            avatarConfigLoadedRef.current = false;
            setIsLoaded(false);
          },
          persist: () =>
            removableStorage.setItem(
              AVATAR_CONFIG_KEY,
              JSON.stringify(clean),
            ),
          applyCurrent: () => {
            setAvatarConfig(clean);
            markAvatarConfigLoaded();
          },
        });
      } catch (error) {
        requestHydrationRetry();
        throw error;
      }
    },
    [
      markAvatarConfigLoaded,
      removableStorage,
      requestHydrationRetry,
      runTrackedLocalDataWork,
    ],
  );

  const resetAvatarConfig = useCallback(
    async (petName = DEFAULT_PET_PLACEHOLDER) => {
      const clean = createDefaultAvatarConfig(petName);
      try {
        await runTrackedAvatarMutation({
          runTrackedLocalDataWork,
          beginCurrentMutation: () => {
            avatarConfigHydrationRevisionRef.current += 1;
            avatarConfigLoadedRef.current = false;
            setIsLoaded(false);
          },
          persist: () =>
            removableStorage.setItem(
              AVATAR_CONFIG_KEY,
              JSON.stringify(clean),
            ),
          applyCurrent: () => {
            setAvatarConfig(clean);
            markAvatarConfigLoaded();
          },
        });
      } catch (error) {
        requestHydrationRetry();
        throw error;
      }
    },
    [
      markAvatarConfigLoaded,
      removableStorage,
      requestHydrationRetry,
      runTrackedLocalDataWork,
    ],
  );

  const hasCustomAvatar = !!avatarSet && Object.keys(avatarSet).length > 0;
  const hasConfiguredAvatar = hasManualAvatarConfiguration(avatarConfig);

  const value = useMemo(
    () => ({
      avatarSet,
      avatarConfig,
      hasCustomAvatar,
      hasConfiguredAvatar,
      isLoaded,
      getAvatarSource,
      saveAvatarSet,
      clearAvatarSet,
      saveAvatarConfig,
      resetAvatarConfig,
    }),
    [
      avatarSet,
      avatarConfig,
      hasCustomAvatar,
      hasConfiguredAvatar,
      isLoaded,
      getAvatarSource,
      saveAvatarSet,
      clearAvatarSet,
      saveAvatarConfig,
      resetAvatarConfig,
    ],
  );

  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>;
}

export function useAvatar() {
  const ctx = useContext(AvatarContext);
  if (!ctx) throw new Error("useAvatar must be used within AvatarProvider");
  return ctx;
}

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

import { useCare } from "@/context/CareContext";
import {
  AVATAR_MOODS,
  assertAvatarWriteAllowed,
  commitAvatarMemoryIfCurrent,
  createAvatarWriteCoordinator,
  filterAvatarSetByUriExistence,
  getAvatarStorageKey,
  inspectAvatarStorage,
  inspectLegacyAvatarConfig,
  inspectLegacyAvatarPair,
  inspectLegacyAvatarSet,
  LEGACY_AVATAR_STORAGE_KEYS,
  resolveAvatarLegacyDecision,
  serializeAvatarState,
  type AvatarSet,
  type AvatarStoredState,
  type AvatarWriteCoordinator,
} from "@/lib/avatarStorageScope";
import {
  createDefaultAvatarConfig,
  normalizeAvatarConfig,
  type PetAvatarConfig,
} from "@/lib/avatarStudio";
import { resolvePetName } from "@/lib/petIdentity";
import type { Mood } from "@/lib/phoenixStatus";

export const MOODS: Mood[] = [...AVATAR_MOODS];
export type { AvatarSet } from "@/lib/avatarStorageScope";

const DEFAULT_SOURCES: Record<Mood, ImageSourcePropType> = {
  happy: require("@/assets/avatar/phoenix/storybook/storybook-still-sit.png"),
  excited: require("@/assets/avatar/phoenix/storybook/storybook-still-sit.png"),
  calm: require("@/assets/avatar/phoenix/storybook/storybook-still-sit.png"),
  anxious: require("@/assets/avatar/phoenix/storybook/storybook-still-sit.png"),
  unwell: require("@/assets/avatar/phoenix/storybook/storybook-still-sleep.png"),
};

async function uriExists(uri: string): Promise<boolean> {
  try {
    return (await FileSystem.getInfoAsync(uri)).exists;
  } catch {
    // A transient filesystem error is not proof that a custom image vanished.
    return true;
  }
}

async function verifyAvatarSet(set: AvatarSet): Promise<AvatarSet | null> {
  if (Platform.OS === "web") return Object.keys(set).length ? set : null;
  return filterAvatarSetByUriExistence(set, uriExists);
}

interface AvatarContextValue {
  avatarSet: AvatarSet | null;
  avatarConfig: PetAvatarConfig;
  hasCustomAvatar: boolean;
  hasConfiguredAvatar: boolean;
  isLoaded: boolean;
  storageError: string | null;
  legacyAvatarAvailable: boolean;
  getAvatarSource: (mood: Mood) => ImageSourcePropType;
  saveAvatarSet: (set: AvatarSet) => Promise<void>;
  clearAvatarSet: () => Promise<void>;
  saveAvatarConfig: (config: PetAvatarConfig) => Promise<void>;
  resetAvatarConfig: (petName?: string) => Promise<void>;
  importLegacyAvatar: () => Promise<void>;
  keepScopedAvatar: () => Promise<void>;
  retryAvatarStorage: () => void;
  resetAvatarMemoryAfterDeviceWipe: () => void;
}

const AvatarContext = createContext<AvatarContextValue | null>(null);

export function AvatarProvider({ children }: { children: React.ReactNode }) {
  const {
    state,
    storageScope,
    isLoaded: careScopeLoaded,
    runDeviceOperation,
  } = useCare();
  const petName = resolvePetName(state.profile.name);
  const renderedStorageKey = storageScope
    ? getAvatarStorageKey(storageScope)
    : null;
  const renderedStorageKeyRef = useRef<string | null>(renderedStorageKey);
  renderedStorageKeyRef.current = renderedStorageKey;

  const initialState = useMemo<AvatarStoredState>(
    () => ({
      avatarSet: null,
      avatarConfig: createDefaultAvatarConfig(petName),
    }),
    [petName],
  );
  const [avatarSet, setAvatarSet] = useState<AvatarSet | null>(null);
  const [avatarConfig, setAvatarConfig] = useState<PetAvatarConfig>(
    initialState.avatarConfig,
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [legacyAvatarCandidate, setLegacyAvatarCandidate] =
    useState<AvatarStoredState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const confirmedStateRef = useRef<AvatarStoredState>(initialState);
  const storageKeyRef = useRef<string | null>(null);
  const coordinatorRef = useRef<AvatarWriteCoordinator | null>(null);
  const lifecycleGenerationRef = useRef(0);

  const applyMemoryState = useCallback((next: AvatarStoredState) => {
    confirmedStateRef.current = next;
    setAvatarSet(next.avatarSet);
    setAvatarConfig(next.avatarConfig);
  }, []);

  useEffect(() => {
    const generation = lifecycleGenerationRef.current + 1;
    lifecycleGenerationRef.current = generation;
    let cancelled = false;
    const fresh: AvatarStoredState = {
      avatarSet: null,
      avatarConfig: createDefaultAvatarConfig(petName),
    };
    setIsLoaded(false);
    setStorageError(null);
    setLegacyAvatarCandidate(null);
    applyMemoryState(fresh);
    storageKeyRef.current = null;
    coordinatorRef.current = null;

    if (!careScopeLoaded || !storageScope || !renderedStorageKey) {
      return () => {
        cancelled = true;
        if (lifecycleGenerationRef.current === generation) {
          lifecycleGenerationRef.current += 1;
        }
      };
    }

    const storageKey = renderedStorageKey;
    storageKeyRef.current = storageKey;
    const isCurrent = () =>
      !cancelled &&
      lifecycleGenerationRef.current === generation &&
      storageKeyRef.current === storageKey &&
      renderedStorageKeyRef.current === storageKey;

    void (async () => {
      const scoped = inspectAvatarStorage(
        await AsyncStorage.getItem(storageKey),
        petName,
      );
      if (!isCurrent()) return;
      if (scoped.status === "invalid") {
        setStorageError(
          "Your saved care-twin data could not be read. WoofWatcher kept it untouched; retry before changing the avatar.",
        );
        return;
      }

      let next =
        scoped.status === "valid" ? scoped.state : fresh;
      if (scoped.status === "missing") {
        const legacyRows = new Map(
          await AsyncStorage.multiGet([
            LEGACY_AVATAR_STORAGE_KEYS.avatarSet,
            LEGACY_AVATAR_STORAGE_KEYS.avatarConfig,
          ]),
        );
        if (!isCurrent()) return;
        const legacySet = inspectLegacyAvatarSet(
          legacyRows.get(LEGACY_AVATAR_STORAGE_KEYS.avatarSet) ?? null,
        );
        const legacyConfig = inspectLegacyAvatarConfig(
          legacyRows.get(LEGACY_AVATAR_STORAGE_KEYS.avatarConfig) ?? null,
          petName,
        );
        const legacyPair = inspectLegacyAvatarPair(legacySet, legacyConfig);
        if (storageScope.kind === "local") {
          if (legacyPair.status === "invalid") {
            setStorageError(
              "Older local care-twin data was incomplete or unreadable. It was kept untouched; retry before changing the avatar.",
            );
            return;
          }
          if (legacyPair.status === "valid") next = legacyPair.state;
        } else if (legacyPair.status === "valid") {
          let candidate = legacyPair.state;
          if (candidate.avatarSet) {
            candidate = {
              ...candidate,
              avatarSet: await verifyAvatarSet(candidate.avatarSet),
            };
            if (!isCurrent()) return;
          }
          setLegacyAvatarCandidate(candidate);
        } else if (legacyPair.status === "invalid") {
          setStorageError(
            "Older device care-twin data was incomplete or unreadable and remains separate. This household is using a new care twin.",
          );
        }
      }

      if (next.avatarSet) {
        next = {
          ...next,
          avatarSet: await verifyAvatarSet(next.avatarSet),
        };
        if (!isCurrent()) return;
      }
      coordinatorRef.current = createAvatarWriteCoordinator(next);
      applyMemoryState(next);
      setIsLoaded(true);
    })().catch(() => {
      if (isCurrent()) {
        setStorageError(
          "WoofWatcher could not load this household's care twin from device storage. Saved avatar data was not replaced.",
        );
      }
    });

    return () => {
      cancelled = true;
      if (lifecycleGenerationRef.current === generation) {
        lifecycleGenerationRef.current += 1;
      }
    };
  }, [
    applyMemoryState,
    careScopeLoaded,
    petName,
    reloadToken,
    renderedStorageKey,
    storageScope,
  ]);

  const requireCurrentStorage = useCallback(
    (allowLegacyDecision = false) => {
      const storageKey = storageKeyRef.current;
      const coordinator = coordinatorRef.current;
      const generation = lifecycleGenerationRef.current;
      if (
        !isLoaded ||
        !careScopeLoaded ||
        !renderedStorageKey ||
        !storageKey ||
        !coordinator ||
        storageKey !== renderedStorageKey ||
        renderedStorageKeyRef.current !== storageKey
      ) {
        throw new Error("Avatar storage is not ready for this household.");
      }
      assertAvatarWriteAllowed(legacyAvatarCandidate, allowLegacyDecision);
      return { storageKey, coordinator, generation };
    },
    [
      careScopeLoaded,
      isLoaded,
      legacyAvatarCandidate,
      renderedStorageKey,
    ],
  );

  const persistUpdate = useCallback(
    async (
      update: (current: AvatarStoredState) => AvatarStoredState,
      errorMessage: string,
      allowLegacyDecision = false,
    ) => {
      const { storageKey, coordinator, generation } =
        requireCurrentStorage(allowLegacyDecision);
      setStorageError(null);
      try {
        const saved = await coordinator.enqueue(update, async (next) => {
          if (
            lifecycleGenerationRef.current !== generation ||
            storageKeyRef.current !== storageKey ||
            renderedStorageKeyRef.current !== storageKey
          ) {
            throw new Error("stale-avatar-lifecycle");
          }
          await runDeviceOperation(() =>
            AsyncStorage.setItem(storageKey, serializeAvatarState(next)),
          );
          if (
            lifecycleGenerationRef.current !== generation ||
            storageKeyRef.current !== storageKey ||
            renderedStorageKeyRef.current !== storageKey
          ) {
            throw new Error("stale-avatar-lifecycle");
          }
        });
        const committed = commitAvatarMemoryIfCurrent(
          saved,
          () =>
            lifecycleGenerationRef.current === generation &&
            storageKeyRef.current === storageKey &&
            renderedStorageKeyRef.current === storageKey,
          applyMemoryState,
        );
        if (!committed) throw new Error("stale-avatar-lifecycle");
        return saved;
      } catch (error) {
        if (
          lifecycleGenerationRef.current === generation &&
          storageKeyRef.current === storageKey &&
          renderedStorageKeyRef.current === storageKey
        ) {
          setStorageError(errorMessage);
        }
        throw error;
      }
    },
    [applyMemoryState, requireCurrentStorage, runDeviceOperation],
  );

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
      await persistUpdate(
        (current) => ({
          ...current,
          avatarSet: Object.keys(clean).length ? clean : null,
        }),
        "That care-twin image change was not saved. The previous avatar is still active.",
      );
    },
    [persistUpdate],
  );

  const clearAvatarSet = useCallback(async () => {
    await persistUpdate(
      (current) => ({ ...current, avatarSet: null }),
      "The custom care-twin images were not cleared from this device.",
    );
  }, [persistUpdate]);

  const saveAvatarConfig = useCallback(
    async (config: PetAvatarConfig) => {
      const clean = {
        ...normalizeAvatarConfig(
          { ...config, updatedAt: new Date().toISOString() },
          petName,
        ),
        petName,
      };
      await persistUpdate(
        (current) => ({ ...current, avatarConfig: clean }),
        "That care-twin configuration was not saved. The previous design is still active.",
      );
    },
    [persistUpdate, petName],
  );

  const resetAvatarConfig = useCallback(
    async (requestedPetName = petName) => {
      const clean = createDefaultAvatarConfig(
        resolvePetName(requestedPetName),
      );
      await persistUpdate(
        (current) => ({ ...current, avatarConfig: clean }),
        "The care-twin reset was not saved. The previous design is still active.",
      );
    },
    [persistUpdate, petName],
  );

  const resolveLegacyAvatar = useCallback(
    async (decision: "import" | "keep-current") => {
      const candidate = legacyAvatarCandidate;
      if (!candidate) return;
      const decisionStorageKey = renderedStorageKeyRef.current;
      await persistUpdate(
        (current) =>
          resolveAvatarLegacyDecision(current, candidate, decision),
        "Your older care-twin choice was not saved. Both copies remain untouched.",
        true,
      );
      if (
        !decisionStorageKey ||
        renderedStorageKeyRef.current !== decisionStorageKey ||
        storageKeyRef.current !== decisionStorageKey
      ) {
        throw new Error("Avatar storage scope changed during the decision.");
      }
      setLegacyAvatarCandidate(null);
    },
    [legacyAvatarCandidate, persistUpdate],
  );

  const importLegacyAvatar = useCallback(
    () => resolveLegacyAvatar("import"),
    [resolveLegacyAvatar],
  );
  const keepScopedAvatar = useCallback(
    () => resolveLegacyAvatar("keep-current"),
    [resolveLegacyAvatar],
  );
  const retryAvatarStorage = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  const resetAvatarMemoryAfterDeviceWipe = useCallback(() => {
    const fresh: AvatarStoredState = {
      avatarSet: null,
      avatarConfig: createDefaultAvatarConfig(petName),
    };
    storageKeyRef.current = null;
    coordinatorRef.current = null;
    applyMemoryState(fresh);
    setLegacyAvatarCandidate(null);
    setStorageError(null);
    setIsLoaded(false);
    setReloadToken((current) => current + 1);
  }, [applyMemoryState, petName]);

  const hasCustomAvatar = !!avatarSet && Object.keys(avatarSet).length > 0;
  const hasConfiguredAvatar =
    avatarConfig.scanAssisted ||
    avatarConfig.templateId !== "shepherd" ||
    avatarConfig.collarId !== "forest-bandana" ||
    avatarConfig.faceMarkingId !== "mask" ||
    avatarConfig.coatPrimary !== "#1B1714" ||
    avatarConfig.coatSecondary !== "#C99052";

  const value = useMemo<AvatarContextValue>(
    () => ({
      avatarSet,
      avatarConfig,
      hasCustomAvatar,
      hasConfiguredAvatar,
      isLoaded,
      storageError,
      legacyAvatarAvailable: legacyAvatarCandidate != null,
      getAvatarSource,
      saveAvatarSet,
      clearAvatarSet,
      saveAvatarConfig,
      resetAvatarConfig,
      importLegacyAvatar,
      keepScopedAvatar,
      retryAvatarStorage,
      resetAvatarMemoryAfterDeviceWipe,
    }),
    [
      avatarSet,
      avatarConfig,
      hasCustomAvatar,
      hasConfiguredAvatar,
      isLoaded,
      storageError,
      legacyAvatarCandidate,
      getAvatarSource,
      saveAvatarSet,
      clearAvatarSet,
      saveAvatarConfig,
      resetAvatarConfig,
      importLegacyAvatar,
      keepScopedAvatar,
      retryAvatarStorage,
      resetAvatarMemoryAfterDeviceWipe,
    ],
  );

  return (
    <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>
  );
}

export function useAvatar() {
  const context = useContext(AvatarContext);
  if (!context) {
    throw new Error("useAvatar must be used within AvatarProvider");
  }
  return context;
}

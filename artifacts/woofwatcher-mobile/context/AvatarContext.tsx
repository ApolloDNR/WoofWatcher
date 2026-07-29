import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform, type ImageSourcePropType } from "react-native";
import {
  createDefaultAvatarConfig,
  normalizeAvatarConfig,
  type PetAvatarConfig,
} from "@/lib/avatarStudio";
import type { Mood } from "@/lib/phoenixStatus";

const AVATAR_KEY = "woofwatcher.avatarSet.v1";
const AVATAR_CONFIG_KEY = "woofwatcher.petAvatarConfig.v1";

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
    createDefaultAvatarConfig("Phoenix"),
  );
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      let parsed: AvatarSet | null = null;
      let parsedConfig: PetAvatarConfig | null = null;
      try {
        const raw = await AsyncStorage.getItem(AVATAR_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data && typeof data === "object") {
            parsed = data as AvatarSet;
          }
        }
      } catch {
        // ignore corrupt cache
        parsed = null;
      }

      try {
        const rawConfig = await AsyncStorage.getItem(AVATAR_CONFIG_KEY);
        if (rawConfig) {
          parsedConfig = normalizeAvatarConfig(JSON.parse(rawConfig), "Phoenix");
        }
      } catch {
        parsedConfig = null;
      }

      if (parsed) {
        const verified = await verifyAvatarSet(parsed);
        if (verified) {
          parsed = verified.set;
          if (verified.changed) {
            try {
              if (Object.keys(verified.set).length > 0) {
                await AsyncStorage.setItem(
                  AVATAR_KEY,
                  JSON.stringify(verified.set),
                );
              } else {
                await AsyncStorage.removeItem(AVATAR_KEY);
              }
            } catch {
              // ignore persistence errors; in-memory state is already corrected
            }
          }
        }
      }

      if (cancelled) return;
      setAvatarSet(parsed && Object.keys(parsed).length > 0 ? parsed : null);
      setAvatarConfig(parsedConfig ?? createDefaultAvatarConfig("Phoenix"));
      setIsLoaded(true);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const getAvatarSource = useCallback(
    (mood: Mood): ImageSourcePropType => {
      const uri = avatarSet?.[mood];
      if (uri) return { uri };
      return DEFAULT_SOURCES[mood] ?? DEFAULT_SOURCES.calm;
    },
    [avatarSet],
  );

  const saveAvatarSet = useCallback(async (set: AvatarSet) => {
    const clean: AvatarSet = {};
    for (const m of MOODS) {
      if (set[m]) clean[m] = set[m];
    }
    setAvatarSet(clean);
    await AsyncStorage.setItem(AVATAR_KEY, JSON.stringify(clean));
  }, []);

  const clearAvatarSet = useCallback(async () => {
    setAvatarSet(null);
    await AsyncStorage.removeItem(AVATAR_KEY);
  }, []);

  const saveAvatarConfig = useCallback(async (config: PetAvatarConfig) => {
    const clean = normalizeAvatarConfig(
      {
        ...config,
        updatedAt: new Date().toISOString(),
      },
      config.petName || "Phoenix",
    );
    setAvatarConfig(clean);
    await AsyncStorage.setItem(AVATAR_CONFIG_KEY, JSON.stringify(clean));
  }, []);

  const resetAvatarConfig = useCallback(async (petName = "Phoenix") => {
    const clean = createDefaultAvatarConfig(petName);
    setAvatarConfig(clean);
    await AsyncStorage.setItem(AVATAR_CONFIG_KEY, JSON.stringify(clean));
  }, []);

  const hasCustomAvatar = !!avatarSet && Object.keys(avatarSet).length > 0;
  const hasConfiguredAvatar =
    avatarConfig.scanAssisted ||
    avatarConfig.templateId !== "shepherd" ||
    avatarConfig.collarId !== "forest-bandana" ||
    avatarConfig.faceMarkingId !== "mask" ||
    avatarConfig.coatPrimary !== "#1B1714" ||
    avatarConfig.coatSecondary !== "#C99052";

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

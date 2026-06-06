import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ImageSourcePropType } from "react-native";
import type { Mood } from "@/lib/phoenixStatus";

const AVATAR_KEY = "woofwatcher.avatarSet.v1";

export const MOODS: Mood[] = ["happy", "excited", "calm", "anxious", "unwell"];

const DEFAULT_SOURCES: Record<Mood, ImageSourcePropType> = {
  happy: require("@/assets/phoenix/phoenix-happy.png"),
  excited: require("@/assets/phoenix/phoenix-excited.png"),
  calm: require("@/assets/phoenix/phoenix-calm.png"),
  anxious: require("@/assets/phoenix/phoenix-anxious.png"),
  unwell: require("@/assets/phoenix/phoenix-unwell.png"),
};

export type AvatarSet = Partial<Record<Mood, string>>;

interface AvatarContextValue {
  avatarSet: AvatarSet | null;
  hasCustomAvatar: boolean;
  isLoaded: boolean;
  getAvatarSource: (mood: Mood) => ImageSourcePropType;
  saveAvatarSet: (set: AvatarSet) => Promise<void>;
  clearAvatarSet: () => Promise<void>;
}

const AvatarContext = createContext<AvatarContextValue | null>(null);

export function AvatarProvider({ children }: { children: React.ReactNode }) {
  const [avatarSet, setAvatarSet] = useState<AvatarSet | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(AVATAR_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            setAvatarSet(parsed as AvatarSet);
          }
        } catch {
          // ignore corrupt cache
        }
      }
      setIsLoaded(true);
    });
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

  const hasCustomAvatar = !!avatarSet && Object.keys(avatarSet).length > 0;

  const value = useMemo(
    () => ({
      avatarSet,
      hasCustomAvatar,
      isLoaded,
      getAvatarSource,
      saveAvatarSet,
      clearAvatarSet,
    }),
    [avatarSet, hasCustomAvatar, isLoaded, getAvatarSource, saveAvatarSet, clearAvatarSet],
  );

  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>;
}

export function useAvatar() {
  const ctx = useContext(AvatarContext);
  if (!ctx) throw new Error("useAvatar must be used within AvatarProvider");
  return ctx;
}

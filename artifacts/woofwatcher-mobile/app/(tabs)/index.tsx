import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  deriveBileVomitEvidence30,
  deriveAdventureMode,
  deriveCareIntelligence,
  normalizeCareEventType,
  type CareEventDetails,
  type CareEventType,
} from "@workspace/care-domain";

import Reanimated, {
  Easing as ReanimatedEasing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  BoardCard,
  BoardPill,
  BoardSectionHeader,
  CareRow,
  QuickActionTile,
  StatusMeter,
} from "@/components/board/BoardPrimitives";
import { enterUp, PressScale } from "@/components/motion/GameFeel";
import { notifyDialog } from "@/lib/confirmDialog";
import {
  LivingPhoenixRoom,
  type PhoenixRoomReaction,
  type PhoenixRoomStat,
} from "@/components/LivingPhoenixRoom";
import { PetPortrait } from "@/components/PetPortrait";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { BoardMedallion, hasMedallion } from "@/components/BoardMedallion";
import { useAvatar } from "@/context/AvatarContext";
import { useAppViewport } from "@/context/AppViewportContext";
import { useCare, type Entry } from "@/context/CareContext";
import { useDevicePreferences } from "@/context/DevicePreferencesContext";
import { announce } from "@/lib/announce";
import { isClerkEnabledForBuild } from "@/lib/auth";
import { useActiveCurrentTime } from "@/hooks/useActiveCurrentTime";
import { useColors } from "@/hooks/useColors";
import { getAvatarTemplate } from "@/lib/avatarStudio";
import {
  getFloatingFeedbackBottomOffset,
  getFloatingTabChromeMetrics,
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import { deriveAvatarMotion } from "@/lib/avatarMotion";
import { deriveCareTwinScene } from "@/lib/avatarLifeEngine";
import { deriveCareTwinChoreography } from "@/lib/careTwinChoreography";
import { describeCareTwinReactionForLog } from "@/lib/careTwinReactionPolicy";
import {
  buildHomeMissionDeck,
  type HomeMissionRoute,
  type HomeMissionTone,
} from "@/lib/homeMissionDeck";
import { getHomeFirstScreenLayout } from "@/lib/homeFirstScreenLayout";
import {
  getHomeFixedHeroCollapseOffset,
  getHomeFixedHeroTop,
  resolveHomeWelcomeCardHeight,
  resolveHomeWelcomeCardMaxHeight,
  shouldHoldHomeFixedHeroTop,
} from "@/lib/homeFixedHeroLayout";
import {
  applyHomeWelcomePreferenceHydration,
  isHomeSceneReady,
  shouldDeferHomeWelcomeAfterReadFailure,
} from "@/lib/homeSceneReady";
import { getHomeMissionDeckLayout } from "@/lib/homeMissionLayout";
import {
  deriveHomeEvidenceCopy,
  formatHomeCompletion,
  selectObservableHomeEntries,
} from "@/lib/homeEvidence";
import { findOpenAloneTimeSession } from "@/lib/aloneTimeSession";
import {
  careXpForEntry,
  deriveCareCareer,
  deriveCareStreak,
} from "@/lib/careCareer";
import {
  buildQuickLogEntry,
  findRecentQuickLogDuplicate,
  getQuickLogPolicy,
  QUICK_LOG_DEDUPE_WINDOW_MS,
} from "@/lib/quickLogEntry";
import {
  buildWalkSessionFinishPatch,
  buildWalkSessionStartEntry,
  findOpenWalkSession,
} from "@/lib/walkSession";
import {
  derivePhoenixStatus,
  isCareEntryObservableAt,
  type Mood,
  type ObservedEnergyLevel,
} from "@/lib/phoenixStatus";
import {
  buildCareTwinRoomAccessibilityLabel,
  buildPetSetupCopy,
  resolveConsumerPetName,
} from "@/lib/petIdentity";
import { deriveTodayCommand, findPendingMealOutcome } from "@/lib/todayCommand";
import { getConsumerSurfacePolicy } from "@/lib/consumerSurfacePolicy";
import { deriveHomeRoutinePlan } from "@/lib/homeRoutinePlan";
import {
  CARE_READ_ONLY_MESSAGE,
  runAcceptedCareMutation,
} from "@/lib/careWriteProtection";
import {
  canonicalHealthRoute,
  canonicalMoreRoute,
  canonicalPlansReminderCenterRoute,
  canonicalPlansRoute,
} from "@/lib/canonicalRouteBuilders";
import { executePrimaryTabTaskPath } from "@/lib/primaryTabExperience";
import {
  HOME_WELCOME_DISMISSED_KEY,
  createDevicePreferenceHydrationRetryScheduler,
} from "@/lib/devicePreferences";
import { createExclusiveAsyncAction } from "@/lib/exclusiveAsyncAction";
import { LocalDataResetInProgressError } from "@/lib/removableLocalDataStorage";

const HOME_PROVIDER_SYNC_ENABLED =
  isClerkEnabledForBuild && getConsumerSurfacePolicy().providerSyncControls;
const HOME_PREFERENCE_ANNOUNCEMENT_DELAY_MS = 1000;

interface QuickItem {
  key: string;
  icon: PixelIconName;
  label: string;
  type: CareEventType;
  title: string;
  mood?: string;
  severity?: string;
  route?: "/log";
  /** Always open the detail flow - some logs need context before saving. */
  forceDetail?: boolean;
}

type StatusTileTarget = "mood" | "health" | "diet" | "bond";
type TodayMetricTarget = "activity" | "meals" | "potty";
type HomeWatchTarget = "health" | "bile" | "alone";
type HomePresenceRoute =
  | `/log?entry=${string}`
  | `/log?type=${string}&detail=1&intent=${number}`;
type HomeNextUpRoute =
  | "/calendar"
  | `/log?entry=${string}`
  | `/log?type=${string}&detail=1&intent=${number}`;
type HomeNextUpItem = {
  label: string;
  time: string;
  icon: PixelIconName;
  route: HomeNextUpRoute;
  meta?: string;
  /** open-loop = an active session/outcome to close; routine = a planned item. */
  kind: "open-loop" | "routine" | "suggestion";
  routineId?: string;
  owner?: string;
};

const todayMetricRouteType: Record<TodayMetricTarget, CareEventType> = {
  activity: "walk",
  meals: "meal",
  potty: "potty",
};

// Framed storybook room: the living sprite layer floats over this backdrop
// inside the Today card. The art is lifted straight from Apollo's mock
// boards (baked-in dog and camera chip removed with the approved edit
// pipeline, recomposed to 3:2 for the card). The room follows the
// household's real clock - lamplit night after 8 PM, daylight from 6 AM -
// so the world feels alive without faking anything.
// Full-bleed home scene from the mock boards: tall 9:16 art where the
// furniture band and paw-print rug live in the top third (the dog's traffic
// area) and calm wooden floor flows down behind the floating console.
const HOME_IMMERSIVE_ROOM_DAY = require("@/assets/avatar/rooms/home-fullbleed-day.png");
const HOME_IMMERSIVE_ROOM_NIGHT = require("@/assets/avatar/rooms/home-fullbleed-night.png");
// During a real walk session the home scene becomes the park and the twin
// visibly walks it - the room returns when the walk is finished.
const HOME_IMMERSIVE_PARK_DAY = require("@/assets/avatar/rooms/home-fullbleed-park-day.png");
const HOME_IMMERSIVE_PARK_NIGHT = require("@/assets/avatar/rooms/home-fullbleed-park-night.png");

export function homeImmersiveRoomIsNight(hour: number): boolean {
  return hour >= 20 || hour < 6;
}

// Storybook status sentence, non-diagnostic by design.
const HOME_MOOD_WORD: Record<Mood, string> = {
  happy: "happy",
  excited: "excited",
  calm: "calm",
  anxious: "a little unsettled",
  unwell: "having a gentle day",
};

// Mock-board Quick Log row: Meal · Potty · Walk · Meds · Water · Note.
// Meds and Note always open their detail flow - a med log needs dosage
// context and a note needs words before anything is saved.
const HOME_QUICK_LOG: QuickItem[] = [
  { key: "meal", icon: "meal", label: "Meal", type: "meal", title: "Meal" },
  { key: "potty", icon: "pee", label: "Potty", type: "potty", title: "Potty" },
  { key: "walk", icon: "walk", label: "Walk", type: "walk", title: "Walk" },
  {
    key: "meds",
    icon: "medication",
    label: "Meds",
    type: "medication",
    title: "Medication",
  },
  {
    key: "water",
    icon: "bile",
    label: "Water",
    type: "water",
    title: "Fresh water",
  },
  {
    key: "note",
    icon: "note",
    label: "Note",
    type: "note",
    title: "Care note",
    forceDetail: true,
  },
];

const SPEECH_BY_MOOD: Record<Mood, string> = {
  happy: "Good morning!\nWalk time soon?\nI'm ready!",
  excited: "Good morning!\nWalk time soon?\nI'm ready!",
  calm: "Good morning!\nWalk time soon?\nI'm ready!",
  anxious: "Stay close today.\nA calm plan helps.",
  unwell: "Tummy feels off.\nLet's watch gently.",
};

const MOOD_ICON: Record<Mood, PixelIconName> = {
  happy: "mood_great",
  excited: "mood_great",
  calm: "mood_good",
  anxious: "mood_meh",
  unwell: "mood_rough",
};

function routineIcon(type: string): PixelIconName {
  const t = normalizeCareEventType(type);
  if (t === "walk") return "walk";
  if (t === "meal") return "meal";
  if (t === "training") return "training";
  if (t === "potty") return "pee";
  if (t === "medication") return "medication";
  if (t === "play") return "play";
  if (t === "treat") return "treat";
  if (t === "water") return "bile";
  if (t === "vomit") return "bile";
  return "clock";
}

function formatDuration(min: number): string {
  if (min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function isToday(iso: string, now: number): boolean {
  if (!isCareEntryObservableAt({ occurredAt: iso }, now)) return false;
  const d = new Date(iso);
  const n = new Date(now);
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function observedEnergyLabel(level: ObservedEnergyLevel | null): string {
  if (level === "low") return "Low";
  if (level === "steady") return "Steady";
  if (level === "high") return "High";
  return "No data";
}

function observedEnergyProgress(level: ObservedEnergyLevel | null): number {
  if (level === "low") return 0.3;
  if (level === "steady") return 0.65;
  if (level === "high") return 1;
  return 0;
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function detailValue(details: unknown, key: string): unknown {
  if (!details || typeof details !== "object" || Array.isArray(details))
    return undefined;
  return (details as Record<string, unknown>)[key];
}

function careDetails(details: unknown): CareEventDetails {
  if (!details || typeof details !== "object" || Array.isArray(details))
    return undefined;
  return details as CareEventDetails;
}

function homeLogEntryRoute(entryId: string): `/log?entry=${string}` {
  return `/log?entry=${encodeURIComponent(entryId)}`;
}

function homeLogDetailRoute(
  type: CareEventType,
  intent: number,
): `/log?type=${string}&detail=1&intent=${number}` {
  return `/log?type=${type}&detail=1&intent=${intent}`;
}

function adventureQuestIcon(id: string): PixelIconName {
  if (id.includes("walk")) return "walk";
  if (id.includes("training")) return "training";
  if (id.includes("play")) return "play";
  return "heart";
}

function HomeHeaderAction({
  label,
  accessibilityLabel,
  route,
}: {
  label: string;
  accessibilityLabel: string;
  route: HomeMissionRoute;
}) {
  const colors = useColors();
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={MOBILE_INLINE_HIT_SLOP}
      onPress={() => router.push(route as never)}
      style={({ pressed }) => [
        s.homeHeaderAction,
        {
          backgroundColor: pressed ? colors.secondary : colors.background,
          borderColor: colors.border,
        },
      ]}
    >
      <Text
        style={[
          s.homeHeaderActionText,
          { color: colors.navy, fontFamily: "Inter_800ExtraBold" },
        ]}
      >
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={13} color={colors.navy} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const homeScreenMountedRef = useRef(true);
  useEffect(() => {
    homeScreenMountedRef.current = true;
    return () => {
      homeScreenMountedRef.current = false;
    };
  }, []);
  const { width: viewportWidth, height: viewportHeight } = useAppViewport();
  const { fontScale } = useWindowDimensions();
  const router = useRouter();
  const {
    state,
    careMutationsBlocked,
    addEntry,
    deleteEntry,
    updateEntry,
    refresh,
    storageWarning,
    legacyImport,
    isLoaded,
  } = useCare();
  const showCareReadOnly = () =>
    notifyDialog("Update WoofWatcher", CARE_READ_ONLY_MESSAGE);
  // The data-loss warning must reach screen-reader users on every platform.
  useEffect(() => {
    if (storageWarning === "save-failed") {
      announce("Device storage is failing. Recent care logs may not be saved.");
    } else if (storageWarning === "read-failed") {
      announce(
        "Could not read saved care data. Saving is paused this session.",
      );
    } else if (storageWarning === "reset") {
      announce(
        "Saved care data could not be read and was reset. A recovery copy was kept.",
      );
    } else if (storageWarning === "newer-version") {
      announce(
        "This care data was created by a newer WoofWatcher version. This version will not overwrite it.",
      );
    }
  }, [storageWarning]);
  const { avatarConfig, hasConfiguredAvatar } = useAvatar();

  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "tabbed",
  });
  const tabChrome = getFloatingTabChromeMetrics({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const bottomPadding = getTabbedRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const bottomChromeClearance = Math.max(
    tabChrome.tabBarBottom + tabChrome.tabBarHeight,
    tabChrome.centerFabBottom + tabChrome.centerFabSize,
  );
  const homeFirstScreenLayout = useMemo(
    () =>
      getHomeFirstScreenLayout({
        width: viewportWidth,
        height: viewportHeight,
        topPadding,
        bottomChromeClearance,
      }),
    [bottomChromeClearance, topPadding, viewportHeight, viewportWidth],
  );
  const now = useActiveCurrentTime();

  const petName = resolveConsumerPetName(state.profile.name);
  // Home is a household-shared surface. Private entries are removed once at
  // the boundary, before any status, story, activity, or recommendation can
  // select their title, caregiver, details, or derived signals.
  const homeEntries = useMemo(
    () => selectObservableHomeEntries(state.entries, now),
    [now, state.entries],
  );
  const todayHomeEntries = useMemo(
    () => homeEntries.filter((entry) => isToday(entry.occurredAt, now)),
    [homeEntries, now],
  );
  const bileCount = useMemo(
    () =>
      deriveBileVomitEvidence30({ entries: todayHomeEntries, now })
        .vomitEntriesNewestFirst.length,
    [now, todayHomeEntries],
  );
  const status = useMemo(
    () => derivePhoenixStatus({ ...state, entries: homeEntries }, now),
    [homeEntries, now, state],
  );
  const homeEvidenceCopy = useMemo(
    () =>
      deriveHomeEvidenceCopy({
        todayLogCount: todayHomeEntries.length,
        healthAlert: status.counts.healthAlert,
        bileCount,
      }),
    [bileCount, status.counts.healthAlert, todayHomeEntries.length],
  );
  const hasMoodEvidence = status.evidence.mood !== null;
  const hasEnergyEvidence = status.evidence.energy !== null;
  const energyEvidenceLabel = observedEnergyLabel(status.evidence.energy);
  const energyEvidenceProgress = observedEnergyProgress(status.evidence.energy);
  const bondEvidenceCount = todayHomeEntries.filter((entry) =>
    ["play", "training"].includes(
      normalizeCareEventType(entry.type, entry.details),
    ),
  ).length;
  const openWalkSession = useMemo(
    () => findOpenWalkSession(homeEntries),
    [homeEntries],
  );
  // Session-scoped reaction gate: the room only reacts to care logged in
  // THIS session. Without the floor, a meal logged minutes before an app
  // reload replayed "Meal logged. Tail wag." plus the eat loop on mount -
  // reactions arrived from storage instead of being earned live. Entries
  // already on disk when Home mounts derive the standing scene (quiet-hours
  // sleep, routine pressure, steady) instead of a reaction state.
  const reactionSessionFloor = useRef(now);
  const avatarMotion = useMemo(
    () =>
      deriveAvatarMotion({
        entries: homeEntries,
        routines: state.routines,
        caregivers: state.caregivers,
        petName,
        now,
        energy: status.energy,
        activeWalk: Boolean(openWalkSession),
        reactionsSince: reactionSessionFloor.current,
      }),
    [
      homeEntries,
      state.routines,
      state.caregivers,
      petName,
      now,
      openWalkSession,
      status.energy,
    ],
  );
  // The heart status line and the living room must tell one story: the room
  // scheduler can have the twin asleep (quiet hours, low energy) while the
  // day's walk math still reads "excited" - and "Phoenix is excited." over
  // a sleeping dog looks broken. Upbeat words defer to rest; concern moods
  // (anxious, unwell) keep their honest care signal.
  const restWord =
    avatarMotion.state === "sleeping"
      ? "snoozing"
      : avatarMotion.state === "tired"
        ? "resting"
        : null;
  const homeMoodWord =
    restWord &&
    (status.mood === "happy" ||
      status.mood === "excited" ||
      status.mood === "calm")
      ? restWord
      : HOME_MOOD_WORD[status.mood];

  // Care Sense only presents a reading when the corresponding local evidence
  // exists. Missing mood/activity evidence and missing meal targets stay
  // visibly unknown instead of receiving a synthetic baseline.
  const careSenseHeadline =
    todayHomeEntries.length === 0 || !hasMoodEvidence
      ? homeEvidenceCopy.headline
      : status.mood === "unwell"
        ? "Extra-gentle day underway."
        : status.mood === "anxious"
          ? "A gentle day - stay close."
          : status.mood === "excited"
            ? "Ready for adventure!"
            : status.mood === "happy"
              ? "Great day so far!"
              : "A calm, steady day.";
  const careSenseMoodRatio =
    status.mood === "happy"
      ? 0.95
      : status.mood === "excited"
        ? 0.8
        : status.mood === "calm"
          ? 0.7
          : status.mood === "anxious"
            ? 0.45
            : 0.3;
  const careIntelligence = useMemo(
    () =>
      deriveCareIntelligence({
        entries: homeEntries,
        routines: state.routines,
        caregivers: state.caregivers,
        now,
        providerSyncEnabled: HOME_PROVIDER_SYNC_ENABLED,
      }),
    [homeEntries, state.routines, state.caregivers, now],
  );
  const careCareer = useMemo(
    () => deriveCareCareer(homeEntries, now),
    [homeEntries, now],
  );
  const careStreak = useMemo(
    () => deriveCareStreak(homeEntries, now),
    [homeEntries, now],
  );
  const todayCommand = useMemo(
    () =>
      deriveTodayCommand(
        {
          profile: state.profile,
          entries: homeEntries,
          routines: state.routines,
          caregivers: state.caregivers,
          providerSyncEnabled: HOME_PROVIDER_SYNC_ENABLED,
        },
        now,
      ),
    [homeEntries, state.caregivers, state.profile, state.routines, now],
  );

  const petSetupCopy = buildPetSetupCopy(state.profile.name);
  const avatarTemplate = useMemo(
    () => getAvatarTemplate(avatarConfig.templateId),
    [avatarConfig.templateId],
  );
  // Never invent a person: with no caregivers yet, care is simply "You".
  const hasCaregivers = state.caregivers.length > 0;
  const caregiver = state.caregivers[0]?.name ?? "you";
  // A brand-new household: no care logged and no profile finished yet. We
  // greet them once (dismissible) and point at setup, without ever blocking
  // the app - guest/preview mode stays fully usable behind the card.
  // `null` means the persisted flag has not hydrated yet, so the card never
  // flashes for someone who already dismissed it.
  const { store, operationSettledEpoch } = useDevicePreferences();
  const [welcomeDismissed, setWelcomeDismissed] = useState<boolean | null>(
    null,
  );
  const [welcomePreferenceReadFailed, setWelcomePreferenceReadFailed] =
    useState(false);
  const [welcomePreferenceRetryEpoch, setWelcomePreferenceRetryEpoch] =
    useState(0);
  const welcomeDismissedRef = useRef<boolean | null>(welcomeDismissed);
  const deferWelcomeForSessionRef = useRef(false);
  welcomeDismissedRef.current = welcomeDismissed;
  const homeSceneReady = isHomeSceneReady(
    isLoaded,
    welcomeDismissed,
    storageWarning,
    welcomePreferenceReadFailed,
  );
  const welcomeHydrationRetryRef = useRef<ReturnType<
    typeof createDevicePreferenceHydrationRetryScheduler
  > | null>(null);
  if (welcomeHydrationRetryRef.current === null) {
    welcomeHydrationRetryRef.current =
      createDevicePreferenceHydrationRetryScheduler();
  }
  const hydrationRetry = welcomeHydrationRetryRef.current;
  useEffect(() => {
    let cancelled = false;
    hydrationRetry.activate();
    hydrationRetry.reset();

    function hydrateWelcomePreference() {
      void store
        .hydrate(HOME_WELCOME_DISMISSED_KEY, {
          isCancelled: () => cancelled,
          apply: (raw) => {
            applyHomeWelcomePreferenceHydration(
              raw,
              deferWelcomeForSessionRef.current,
              welcomeDismissedRef,
              setWelcomeDismissed,
            );
          },
        })
        .then((result) => {
          if (cancelled || result === "cancelled") return;
          setWelcomePreferenceReadFailed(false);
          hydrationRetry.reset();
        })
        .catch((error) => {
          if (cancelled || error instanceof LocalDataResetInProgressError)
            return;
          deferWelcomeForSessionRef.current ||=
            shouldDeferHomeWelcomeAfterReadFailure(welcomeDismissedRef.current);
          setWelcomePreferenceReadFailed(true);
          hydrationRetry.request(hydrateWelcomePreference);
        });
    }

    hydrateWelcomePreference();
    return () => {
      cancelled = true;
      hydrationRetry.deactivate();
    };
  }, [
    hydrationRetry,
    operationSettledEpoch,
    store,
    welcomePreferenceRetryEpoch,
  ]);
  useFocusEffect(
    useCallback(() => {
      if (
        Platform.OS !== "ios" ||
        !welcomePreferenceReadFailed ||
        !homeSceneReady ||
        storageWarning
      ) {
        return undefined;
      }

      let announcementTimer: ReturnType<typeof setTimeout> | undefined;
      const clearAnnouncement = () => {
        if (announcementTimer === undefined) return;
        clearTimeout(announcementTimer);
        announcementTimer = undefined;
      };
      const scheduleAnnouncement = () => {
        clearAnnouncement();
        if (AppState.currentState !== "active") return;
        announcementTimer = setTimeout(() => {
          announcementTimer = undefined;
          if (AppState.currentState !== "active") return;
          announce(
            "Couldn't load a Home display preference. Home is available. Retry is available.",
          );
        }, HOME_PREFERENCE_ANNOUNCEMENT_DELAY_MS);
      };

      scheduleAnnouncement();
      const appStateSubscription = AppState.addEventListener(
        "change",
        (nextState) => {
          clearAnnouncement();
          if (nextState === "active") scheduleAnnouncement();
        },
      );
      return () => {
        clearAnnouncement();
        appStateSubscription.remove();
      };
    }, [homeSceneReady, storageWarning, welcomePreferenceReadFailed]),
  );
  const retryWelcomePreference = () => {
    hydrationRetry.reset();
    setWelcomePreferenceRetryEpoch((epoch) => epoch + 1);
  };
  const dismissWelcome = () => {
    setWelcomeDismissed(true);
    void store.save(HOME_WELCOME_DISMISSED_KEY, "true").catch((error) => {
      if (error instanceof LocalDataResetInProgressError) return;
    });
  };
  const isFreshStart =
    !hasCaregivers && homeEntries.length === 0 && !state.profile.breed?.trim();

  // The welcome card leaves by folding shut (height + opacity, ~250ms)
  // instead of unmounting instantly - the first quick log used to yank the
  // whole screen up 200+ px right under the finger. The card keeps rendering
  // through the collapse and is removed only when the fold finishes.
  const welcomeShouldShow = isFreshStart && welcomeDismissed === false;
  const [welcomeCollapsed, setWelcomeCollapsed] = useState(false);
  const welcomeWasShown = useRef(false);
  // Reanimated shared value so the fold runs on the UI thread - RN Animated
  // could only tween maxHeight on the JS thread, a drop-frame risk right
  // after the first quick log. Reduce Motion collapses instantly.
  const reducedMotion = useReducedMotion();
  const welcomeCollapse = useSharedValue(1);
  const [welcomeCardHeight, setWelcomeCardHeight] = useState(0);
  useEffect(() => {
    if (welcomeShouldShow) {
      welcomeWasShown.current = true;
      welcomeCollapse.value = 1;
      setWelcomeCollapsed(false);
      return;
    }
    if (!welcomeWasShown.current || welcomeCollapsed) return;
    if (reducedMotion) {
      welcomeCollapse.value = 0;
      setWelcomeCollapsed(true);
      return;
    }
    welcomeCollapse.value = withTiming(
      0,
      { duration: 250, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) },
      (finished) => {
        if (finished) runOnJS(setWelcomeCollapsed)(true);
      },
    );
  }, [reducedMotion, welcomeCollapse, welcomeCollapsed, welcomeShouldShow]);
  const welcomeCardAnimatedStyle = useAnimatedStyle(() => {
    const maxHeight = resolveHomeWelcomeCardMaxHeight({
      naturalHeight: welcomeCardHeight,
      welcomeCollapse: welcomeCollapse.value,
      welcomeShouldShow,
    });
    return {
      opacity: welcomeCollapse.value,
      ...(maxHeight === undefined ? {} : { maxHeight }),
    };
  });
  const fixedHeroCollapseStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: getHomeFixedHeroCollapseOffset({
          welcomeCardHeight,
          welcomeCollapse: welcomeCollapse.value,
        }),
      },
    ],
  }));
  const welcomeVisible =
    welcomeShouldShow || (welcomeWasShown.current && !welcomeCollapsed);
  const timeLabel = useMemo(
    () => shortTime(new Date(now).toISOString()),
    [now],
  );
  const openAloneSession = useMemo(
    () => findOpenAloneTimeSession(homeEntries),
    [homeEntries],
  );
  const openAloneStartedAt = openAloneSession
    ? String(
        openAloneSession.details?.aloneStartedAt ?? openAloneSession.occurredAt,
      )
    : "";
  const openAloneMinutes = useMemo(() => {
    if (!openAloneStartedAt) return 0;
    const startedAt = Date.parse(openAloneStartedAt);
    if (!Number.isFinite(startedAt)) return 0;
    return Math.max(0, Math.round((now - startedAt) / 60000));
  }, [now, openAloneStartedAt]);
  const openWalkStartedAt = openWalkSession
    ? String(
        openWalkSession.details?.walkStartedAt ?? openWalkSession.occurredAt,
      )
    : "";
  const openWalkMinutes = useMemo(() => {
    if (!openWalkStartedAt) return 0;
    const startedAt = Date.parse(openWalkStartedAt);
    if (!Number.isFinite(startedAt)) return 0;
    return Math.max(0, Math.round((now - startedAt) / 60000));
  }, [now, openWalkStartedAt]);
  // Care Sense meter ratios that depend on live sessions/counts.
  const careSenseMealsRatio = status.counts.meals.target
    ? Math.min(1, status.counts.meals.done / status.counts.meals.target)
    : status.counts.meals.done > 0
      ? 1
      : 0;
  const careSenseAloneRatio = openAloneSession
    ? Math.min(1, openAloneMinutes / 240)
    : 0;

  const presenceState = openAloneSession
    ? "home-alone"
    : openWalkSession
      ? "on-walk"
      : "no-session";
  const presenceLabel = openAloneSession
    ? `${petName} is home alone`
    : openWalkSession
      ? `${petName} on a walk`
      : "No active away session";
  const presenceSub = openAloneSession
    ? `${formatDuration(openAloneMinutes)} active - tap I\u2019m Home in Log`
    : openWalkSession
      ? `${formatDuration(openWalkMinutes)} active - tap Finish in Next Up`
      : `Presence not logged - ${timeLabel}`;
  const presenceRoute: HomePresenceRoute = openAloneSession
    ? openAloneSession.id
      ? homeLogEntryRoute(openAloneSession.id)
      : homeLogDetailRoute("alone", now)
    : openWalkSession
      ? openWalkSession.id
        ? homeLogEntryRoute(openWalkSession.id)
        : homeLogDetailRoute("walk", now)
      : homeLogDetailRoute("alone", now);
  const presenceActionHint = openAloneSession
    ? "Opens the active Alone Time log so you can complete the return check-in."
    : openWalkSession
      ? "Opens the active walk log so you can finish or edit the walk."
      : "Opens the Alone Time flow to log heading out or time apart.";

  const meals = status.counts.meals;
  const hasMealTarget = meals.target > 0;
  const fed = meals.target > 0 && meals.done >= meals.target;
  const hungerLabel = formatHomeCompletion(meals.done, meals.target);
  const hungerScore = meals.target > 0 ? careSenseMealsRatio * 100 : 0;
  const hungerTone = hasMealTarget
    ? fed
      ? colors.sage
      : colors.copper
    : colors.mutedForeground;
  const moodIcon = MOOD_ICON[status.mood];

  // Shared with Today Command: pending meal outcomes stay actionable across
  // the midnight rollover (up to 12h) instead of vanishing at 12:00 AM.
  const pendingMeal = useMemo(
    () => findPendingMealOutcome(homeEntries, now),
    [homeEntries, now],
  );

  // Session-local snooze: a snoozed routine steps out of Next Up for 30
  // minutes on this device, without touching the Plan schedule itself.
  const [snoozedUntil, setSnoozedUntil] = useState<Record<string, number>>({});
  const homeRoutinePlan = useMemo(
    () =>
      deriveHomeRoutinePlan({
        routines: state.routines,
        entries: homeEntries,
        snoozedUntil,
        now,
      }),
    [homeEntries, now, snoozedUntil, state.routines],
  );

  const nextUp = useMemo<HomeNextUpItem[]>(() => {
    if (openAloneSession) {
      return [
        {
          label: "Home alone",
          time: `${formatDuration(openAloneMinutes)} - log return`,
          icon: "clock" as PixelIconName,
          route: openAloneSession.id
            ? homeLogEntryRoute(openAloneSession.id)
            : homeLogDetailRoute("alone", now),
          meta: "Return",
          kind: "open-loop" as const,
        },
      ];
    }
    if (openWalkSession) {
      return [
        {
          label: "Walk active",
          time: `${formatDuration(openWalkMinutes)} - tap Finish to complete`,
          icon: "walk" as PixelIconName,
          route: openWalkSession.id
            ? homeLogEntryRoute(openWalkSession.id)
            : homeLogDetailRoute("walk", now),
          meta: "Finish",
          kind: "open-loop" as const,
        },
      ];
    }
    if (homeRoutinePlan.scheduledItems.length) {
      return homeRoutinePlan.scheduledItems.slice(0, 3).map((r) => {
        const routineType = normalizeCareEventType(r.type ?? "note");
        return {
          label: r.label,
          time: r.time,
          icon: routineIcon(routineType),
          route: homeLogDetailRoute(routineType, now),
          meta: "Start",
          kind: "routine" as const,
          routineId: r.id,
          owner: r.owner || undefined,
        };
      });
    }
    if (homeRoutinePlan.hasSavedRoutines) {
      // Everything scheduled is snoozed right now.
      return [];
    }
    return [
      {
        label: "Plan today's care",
        time: "No routines scheduled",
        icon: "clock" as PixelIconName,
        route: "/calendar" as const,
        meta: "Plan",
        kind: "suggestion" as const,
      },
    ];
  }, [
    openAloneMinutes,
    openAloneSession,
    openWalkMinutes,
    openWalkSession,
    homeRoutinePlan,
    now,
  ]);

  // Served meal awaiting its outcome: rendered as its own open-loop chip
  // stacked above the planned Next Up item, so closing the meal loop never
  // hides the plan (or the "more in Plans" link) from the hero flow.
  const pendingMealOpenLoop = useMemo(
    () =>
      pendingMeal
        ? {
            label: `${(pendingMeal.title ?? "Meal").split(" - ")[0] || "Meal"} served`,
            time: "Outcome pending",
            icon: "meal" as PixelIconName,
            route: pendingMeal.id
              ? homeLogEntryRoute(pendingMeal.id)
              : homeLogDetailRoute("meal", now),
          }
        : null,
    [now, pendingMeal],
  );

  const nextPrimary = nextUp[0];
  const nextCount = nextUp.length;
  const nextMeta = openAloneSession
    ? "I'm Home"
    : openWalkSession
      ? "Finish walk"
      : status.minutesUntilNext !== null
        ? `In ${formatDuration(status.minutesUntilNext)}`
        : (nextPrimary?.time ?? "Ready");
  const nextDetail = openAloneSession
    ? `${formatDuration(openAloneMinutes)} active - log return`
    : openWalkSession
      ? `${formatDuration(openWalkMinutes)} active - tap Finish to complete`
      : status.minutesUntilNext !== null
        ? `${nextMeta} - ${nextPrimary?.time ?? "Scheduled"}`
        : (nextPrimary?.time ?? "Ready when you are");
  const nextUpRoute = nextPrimary?.route ?? "/calendar";

  const snoozeNextUp = (item: HomeNextUpItem) => {
    if (!item.routineId) return;
    void Haptics.selectionAsync();
    setSnoozedUntil((prev) => ({
      ...prev,
      [item.routineId as string]: now + 30 * 60000,
    }));
    showToast(`${item.label} snoozed 30 min`);
  };

  // "Walk with Emma in 25 min · Dinner at 7:00 PM" - built from the same
  // real Next Up items, never invented.
  const glanceLine = useMemo(() => {
    // Next Up already owns the live-walk "Finish" CTA, so the mood card falls
    // back to the calm command line instead of echoing the active walk here.
    if (openWalkSession) return todayCommand.primaryAction.detail;
    const parts = nextUp.slice(0, 2).map((item, index) => {
      if (item.kind === "suggestion") return item.time;
      if (
        index === 0 &&
        item.kind === "routine" &&
        status.minutesUntilNext !== null
      ) {
        return `${item.label} in ${formatDuration(status.minutesUntilNext)}`;
      }
      return `${item.label} ${item.time.includes(" - ") ? "" : "at "}${item.time}`;
    });
    if (!parts.length) return todayCommand.primaryAction.detail;
    return parts.join(" · ");
  }, [
    nextUp,
    openWalkSession,
    status.minutesUntilNext,
    todayCommand.primaryAction.detail,
  ]);
  const careSenseSubline =
    todayHomeEntries.length === 0
      ? `${petName}: ${homeEvidenceCopy.summary}`
      : hasMoodEvidence
        ? `${petName} is ${homeMoodWord}. ${glanceLine}`
        : `${petName}: ${homeEvidenceCopy.summary} ${glanceLine}`;

  // The old Fed/Potty/Walk/Alone recency chips folded into the Care Sense
  // meters above - same real-log truth, one calmer surface.

  const todayCommandTone =
    todayCommand.primaryAction.urgency === "alert"
      ? colors.rose
      : todayCommand.primaryAction.urgency === "watch"
        ? colors.amber
        : colors.sage;
  const todayCommandCta =
    todayCommand.primaryAction.kind === "sync"
      ? "Review"
      : todayCommand.primaryAction.kind === "health"
        ? "Open"
        : todayCommand.primaryAction.kind === "routine"
          ? "Plans"
          : todayCommand.primaryAction.kind === "update-meal-outcome"
            ? "Update"
            : "Start";
  const careStatusTone = openAloneSession
    ? colors.amber
    : openWalkSession
      ? colors.sage
      : colors.copper;
  const careStatusLabel = openAloneSession
    ? "Alone"
    : openWalkSession
      ? "On walk"
      : "No session";

  const health = {
    status: homeEvidenceCopy.health.status,
    sub: homeEvidenceCopy.health.detail,
    color: status.counts.healthAlert ? colors.amber : colors.mutedForeground,
  };
  const bile = {
    status: homeEvidenceCopy.bile.status,
    sub: homeEvidenceCopy.bile.detail,
    color: bileCount > 0 ? colors.amber : colors.mutedForeground,
  };

  // Header bell badge mirrors the Health/Bile watch cards below: one signal
  // per watch surface that currently needs owner attention, hidden when calm.
  const watchSignalCount =
    (status.counts.healthAlert ? 1 : 0) + (bileCount > 0 ? 1 : 0);

  // Header care line + heart card, straight from real state: watch signals
  // first, then live sessions, then the calm baseline.
  const careLine =
    watchSignalCount > 0
      ? "Needs a look today"
      : openWalkSession
        ? "On a walk now"
        : openAloneSession
          ? "Home alone now"
          : homeEvidenceCopy.careLine;

  const roomStats = useMemo<PhoenixRoomStat[]>(
    () => [
      {
        label: "Mood",
        value: hasMoodEvidence ? status.meta.label : "No data",
        icon: moodIcon,
        tone:
          status.mood === "unwell"
            ? colors.rose
            : status.mood === "anxious"
              ? colors.amber
              : colors.sage,
        progress: hasMoodEvidence
          ? status.mood === "unwell"
            ? 44
            : status.mood === "anxious"
              ? 62
              : 92
          : 0,
      },
      {
        label: "Energy",
        value: energyEvidenceLabel,
        icon: "energy",
        tone: colors.sage,
        progress: Math.round(energyEvidenceProgress * 100),
      },
      {
        label: "Hunger",
        value: hungerLabel,
        icon: "hunger",
        tone: hungerTone,
        progress: hungerScore,
      },
    ],
    [
      colors.amber,
      colors.copper,
      colors.rose,
      colors.sage,
      fed,
      hungerTone,
      hasEnergyEvidence,
      hasMoodEvidence,
      energyEvidenceLabel,
      energyEvidenceProgress,
      hungerLabel,
      hungerScore,
      moodIcon,
      status.energy,
      status.meta.label,
      status.mood,
    ],
  );

  const aloneMinutes = useMemo(
    () =>
      homeEntries
        .filter(
          (e) =>
            isToday(e.occurredAt, now) &&
            normalizeCareEventType(e.type, e.details) === "alone",
        )
        .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0),
    [homeEntries, now],
  );
  const alone = {
    status: openAloneSession
      ? "Home alone"
      : aloneMinutes > 0
        ? formatDuration(aloneMinutes)
        : "0m",
    sub: openAloneSession
      ? `${formatDuration(openAloneMinutes)} active`
      : aloneMinutes > 0
        ? "Time alone today"
        : "None logged today",
    color: openAloneSession ? colors.amber : colors.copper,
  };

  const recentActivity = useMemo(
    () =>
      [...homeEntries]
        .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
        .slice(0, 3)
        .map((entry) => ({
          id: entry.id,
          title: entry.title,
          time: shortTime(entry.occurredAt),
          icon: routineIcon(entry.type),
          caregiver: entry.caregiver,
        })),
    [homeEntries],
  );

  const questLine = careIntelligence.title;
  const adventureMode = useMemo(
    () =>
      deriveAdventureMode({
        petName,
        entries: homeEntries,
        memories: state.adventureMemories,
        now,
      }),
    [homeEntries, petName, state.adventureMemories, now],
  );
  const adventureQuest = adventureMode.quests[0];

  // The old four-tile status grid folded into Care Sense; the Care Status
  // card now carries only Bond and the diet-profile door via openStatusTile.
  const openStatusTile = (target: StatusTileTarget) => {
    void Haptics.selectionAsync();
    if (target === "mood") {
      router.push(`/log?type=mood&detail=1&intent=${Date.now()}` as never);
      return;
    }
    if (target === "health") {
      router.push(canonicalHealthRoute("overview") as never);
      return;
    }
    if (target === "diet") {
      router.push(canonicalHealthRoute("diet") as never);
      return;
    }
    router.push(`/log?type=play&detail=1&intent=${Date.now()}` as never);
  };

  const openTodayMetric = (target: TodayMetricTarget) => {
    void Haptics.selectionAsync();
    router.push(
      `/log?type=${todayMetricRouteType[target]}&detail=1&intent=${Date.now()}` as never,
    );
  };

  const openHomeWatchCard = (target: HomeWatchTarget) => {
    void Haptics.selectionAsync();
    if (target === "health") {
      router.push(canonicalHealthRoute("overview") as never);
      return;
    }
    if (target === "bile") {
      router.push(canonicalHealthRoute("bile-watch") as never);
      return;
    }
    router.push(`/log?type=alone&detail=1&intent=${Date.now()}` as never);
  };

  const openPresencePanel = () => {
    void Haptics.selectionAsync();
    router.push(presenceRoute as never);
  };

  const openHomeCareIntelligenceNextAction = () => {
    void Haptics.selectionAsync();
    if (careIntelligence.nextAction.kind === "retry-sync") {
      refresh();
      return;
    }
    if (careIntelligence.nextAction.targetEntryId) {
      router.push(
        `/log?entry=${encodeURIComponent(careIntelligence.nextAction.targetEntryId)}` as never,
      );
      return;
    }
    if (
      careIntelligence.nextAction.kind === "handle-routine" ||
      careIntelligence.nextAction.targetRoutineId
    ) {
      router.push(canonicalPlansRoute());
      return;
    }
    if (careIntelligence.nextAction.kind === "update-meal-outcome") {
      router.push(`/log?type=meal&detail=1&intent=${Date.now()}` as never);
      return;
    }
    router.push("/log");
  };

  const homeCareIntelligenceIcon: PixelIconName =
    careIntelligence.nextAction.kind === "update-meal-outcome"
      ? "meal"
      : careIntelligence.nextAction.kind === "handle-routine"
        ? "clock"
        : careIntelligence.nextAction.kind === "retry-sync"
          ? "note"
          : "heart";
  const homeCareIntelligenceCta =
    careIntelligence.nextAction.kind === "retry-sync"
      ? "Retry"
      : careIntelligence.nextAction.kind === "handle-routine"
        ? "Plans"
        : careIntelligence.nextAction.targetEntryId
          ? "Open log"
          : "Open";
  const homeMissions = useMemo(
    () =>
      buildHomeMissionDeck({
        petName,
        caregiverName: caregiver,
        nextCare: {
          label: nextPrimary?.label ?? "Review today's care",
          detail: nextDetail,
          icon: nextPrimary?.icon ?? "clock",
          route: nextUpRoute,
          openLoop: Boolean(pendingMeal || openAloneSession || openWalkSession),
        },
        adventure: {
          title: adventureQuest.title,
          level: adventureMode.level,
          todayXp: adventureMode.todayXp,
          memoriesCount: adventureMode.memoriesCount,
        },
        health: {
          label: bileCount ? "Bile Watch" : "Health Watch",
          status: bile.status,
          detail: bileCount ? bile.sub : health.sub,
          needsReview: Boolean(bileCount || status.counts.healthAlert),
        },
        carePass: {
          label: state.reportArtifacts[0]?.title ?? "Care Pass",
          detail:
            state.records.length || state.reportArtifacts.length
              ? `${state.records.length} records and ${state.reportArtifacts.length} reports ready`
              : `Build a vet, sitter, or trainer packet from ${petName}'s care history`,
          ready: Boolean(state.records.length || state.reportArtifacts.length),
        },
      }),
    [
      adventureMode.level,
      adventureMode.memoriesCount,
      adventureMode.todayXp,
      adventureQuest.title,
      bile.status,
      bile.sub,
      bileCount,
      caregiver,
      health.sub,
      nextDetail,
      nextPrimary?.icon,
      nextPrimary?.label,
      nextUpRoute,
      openAloneSession,
      openWalkSession,
      pendingMeal,
      petName,
      state.records.length,
      state.reportArtifacts.length,
      state.reportArtifacts[0]?.title,
      status.counts.healthAlert,
    ],
  );
  // The Next Up card already owns today's care action; the deck keeps the
  // quest, health, and Care Pass missions so nothing repeats on one screen.
  const deckMissions = useMemo(
    () => homeMissions.filter((mission) => mission.key !== "care-today"),
    [homeMissions],
  );
  const missionLayout = useMemo(
    () =>
      getHomeMissionDeckLayout({
        width: viewportWidth,
        missionCount: deckMissions.length,
      }),
    [deckMissions.length, viewportWidth],
  );

  const missionToneColor = (tone: HomeMissionTone) => {
    if (tone === "copper") return colors.copper;
    if (tone === "amber") return colors.amber;
    if (tone === "rose") return colors.rose;
    if (tone === "navy") return colors.blueSignal;
    return colors.sage;
  };

  const [toast, setToast] = useState<string | null>(null);
  const [quickFeedback, setQuickFeedback] = useState<{
    id: string;
    title: string;
    type: CareEventType;
  } | null>(null);
  const quickFeedbackRef = useRef(quickFeedback);
  quickFeedbackRef.current = quickFeedback;
  const quickFeedbackUndoGateRef = useRef<ReturnType<
    typeof createExclusiveAsyncAction
  > | null>(null);
  if (quickFeedbackUndoGateRef.current === null) {
    quickFeedbackUndoGateRef.current = createExclusiveAsyncAction();
  }
  const quickFeedbackUndoGate = quickFeedbackUndoGateRef.current;
  const [quickFeedbackUndoBusy, setQuickFeedbackUndoBusy] = useState(false);
  const [roomReaction, setRoomReaction] = useState<PhoenixRoomReaction | null>(
    null,
  );
  const roomTapChoreography = useMemo(
    () => deriveCareTwinChoreography(deriveCareTwinScene(avatarMotion)),
    [avatarMotion],
  );
  // Celebrate care level-ups through the room choreography. The level is
  // derived from real logged evidence only, so this fires exactly when a
  // real log crosses the next threshold.
  const prevCareLevel = useRef<number | null>(null);
  useEffect(() => {
    if (prevCareLevel.current === null) {
      prevCareLevel.current = careCareer.level;
      return;
    }
    if (careCareer.level > prevCareLevel.current) {
      setRoomReaction({
        id: Date.now(),
        icon: "energy",
        label: "Level up!",
        detail: `${petName} reached Lv ${careCareer.level} ${careCareer.title}.`,
        tone: colors.amber,
        spriteAction: "celebrate-hop",
      });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
    }
    prevCareLevel.current = careCareer.level;
  }, [careCareer.level, careCareer.title, colors.amber, petName]);
  // Quick logs acknowledge through the room's own speech bubble (the charm
  // layer) instead of stacking a dark reaction card over the dog. Feedback
  // stays two layers total: bubble in the room + one actionable toast above
  // the tab bar carrying XP, Undo, and Add details.
  const [roomSpeechOverride, setRoomSpeechOverride] = useState<string | null>(
    null,
  );
  const roomSpeechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showRoomSpeech = (line: string) => {
    setRoomSpeechOverride(line);
    if (roomSpeechTimer.current) clearTimeout(roomSpeechTimer.current);
    roomSpeechTimer.current = setTimeout(
      () => setRoomSpeechOverride(null),
      3200,
    );
  };
  useEffect(
    () => () => {
      if (roomSpeechTimer.current) clearTimeout(roomSpeechTimer.current);
    },
    [],
  );
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // While the actionable toast for a just-served meal is alive, its "Add
  // details" button opens the exact log the Next Up "Update" chip would.
  // The chip waits and slides in when the toast fades, so the toast never
  // floats on top of a live Update button (and the reveal never jumps).
  const pendingMealChipSuppressed = Boolean(
    toast &&
    quickFeedback &&
    pendingMeal &&
    quickFeedback.id === pendingMeal.id,
  );
  const mealChipReveal = useSharedValue(0);
  useEffect(() => {
    const target = pendingMealChipSuppressed ? 0 : 1;
    if (reducedMotion) {
      mealChipReveal.value = target;
      return;
    }
    mealChipReveal.value = withTiming(target, {
      duration: 220,
      easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
    });
  }, [mealChipReveal, pendingMealChipSuppressed, reducedMotion]);
  const mealChipAnimatedStyle = useAnimatedStyle(() => ({
    opacity: mealChipReveal.value,
    maxHeight: 88 * mealChipReveal.value,
  }));
  const setToastVisibility = (
    toValue: 0 | 1,
    duration: number,
    onComplete?: () => void,
  ) => {
    toastOpacity.stopAnimation();
    if (reducedMotion) {
      toastOpacity.setValue(toValue);
      onComplete?.();
      return;
    }
    Animated.timing(toastOpacity, {
      toValue,
      duration,
      useNativeDriver: Platform.OS !== "web",
    }).start(({ finished }) => {
      if (finished) onComplete?.();
    });
  };
  const showToast = (
    msg: string,
    feedback?: { id: string; title: string; type: CareEventType },
    holdMs?: number,
  ) => {
    quickFeedbackRef.current = feedback ?? null;
    setToast(msg);
    setQuickFeedback(feedback ?? null);
    // The toast is invisible to screen readers and its Undo button vanishes
    // on a timer - announce so the core loop is not silent under VoiceOver.
    announce(feedback ? `${msg}. Undo available.` : msg);
    setToastVisibility(1, 160);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(
      () => {
        setToastVisibility(0, 240, () => {
          quickFeedbackRef.current = null;
          setToast(null);
          setQuickFeedback(null);
        });
      },
      holdMs ?? (feedback ? 5200 : 1400),
    );
  };
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  // Welcome-back notice when boot adopted the legacy web app's saved data
  // (one session only; see CareContext.legacyImport). Held longer than a
  // quick-log toast - a returning owner should actually catch it.
  const legacyImportShown = useRef(false);
  useEffect(() => {
    if (!legacyImport || legacyImportShown.current) return;
    legacyImportShown.current = true;
    const logs =
      legacyImport.entries === 1
        ? "1 care log"
        : `${legacyImport.entries} care logs`;
    showToast(
      legacyImport.entries
        ? `Welcome back. Brought over ${logs} from the earlier WoofWatcher.`
        : "Welcome back. Brought over your care plan from the earlier WoofWatcher.",
      undefined,
      6500,
    );
    // showToast is stable in practice (state setters + refs); the ref guard
    // above makes this effect one-shot regardless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacyImport]);

  const undoQuickFeedback = async () => {
    const feedback = quickFeedback;
    if (!feedback) return;
    if (careMutationsBlocked) {
      showCareReadOnly();
      return;
    }
    await quickFeedbackUndoGate.run(async () => {
      setQuickFeedbackUndoBusy(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      try {
        let deleted = false;
        try {
          deleted = await deleteEntry(feedback.id);
        } catch {
          deleted = false;
        }
        if (!homeScreenMountedRef.current) return;
        if (!deleted) {
          notifyDialog(
            "Undo not completed",
            "WoofWatcher could not confirm that this care log was removed. Check the timeline before trying again.",
          );
          return;
        }
        // A newer quick log may have replaced this feedback while deletion
        // settled. Never clear or relabel that newer action.
        if (quickFeedbackRef.current?.id !== feedback.id) return;
        quickFeedbackRef.current = null;
        // Clear the room bubble in the same commit: the undone log's "Meal
        // served"/"Walk started" line must not linger over the twin for the
        // rest of its 3.2s timer after the entry is already gone.
        if (roomSpeechTimer.current) clearTimeout(roomSpeechTimer.current);
        setRoomSpeechOverride(null);
        showToast(`${feedback.title} undone`);
      } finally {
        if (homeScreenMountedRef.current) {
          setQuickFeedbackUndoBusy(false);
        }
      }
    });
  };

  const openQuickFeedbackDetails = () => {
    if (quickFeedbackUndoGate.isBusy()) return;
    if (!quickFeedback) return;
    const entryId = quickFeedback.id;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    quickFeedbackRef.current = null;
    setToast(null);
    setQuickFeedback(null);
    router.push(`/log?entry=${entryId}` as never);
  };

  const openQuickDetails = (item: QuickItem) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    if (item.route) {
      router.push(item.route);
      return;
    }
    router.push(
      `/log?type=${item.type}&detail=1&intent=${Date.now()}` as never,
    );
  };

  const openActiveWalkFromHomeQuickLog = () => {
    if (!openWalkSession) return;
    const activeWalkRoute = openWalkSession.id
      ? homeLogEntryRoute(openWalkSession.id)
      : homeLogDetailRoute("walk", Date.now());
    showToast("Walk already active");
    router.push(activeWalkRoute as never);
  };

  // Home's Finish completes the walk right here with the same shared
  // lifecycle patch /log's "Finish walk session" applies (route, distance,
  // and notes stay optional and editable from the saved log afterward).
  const finishWalkFromHome = () => {
    if (!openWalkSession?.id) return;
    if (careMutationsBlocked) {
      showCareReadOnly();
      return;
    }
    const patch = buildWalkSessionFinishPatch(openWalkSession, {
      caregiver,
      now: Date.now(),
    });
    const updated = updateEntry(
      openWalkSession.id,
      patch as Partial<Omit<Entry, "id">>,
    );
    const accepted = runAcceptedCareMutation(updated, () => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      showRoomSpeech("Walk completed");
      showToast(
        `Walk completed · ${formatDuration(patch.durationMinutes)} logged · +${careXpForEntry({ ...openWalkSession, details: patch.details })} care XP`,
      );
    });
    if (!accepted) {
      showCareReadOnly();
      return;
    }
  };

  // Double-tap safety: one save per intent on every quick-log surface. The
  // synchronous ref catches a second press in the same tick (React state
  // cannot update between the two), and the shared entry-window check covers
  // slower bounces and cross-surface repeats. A deliberate second log after
  // the 1.5s window still saves normally.
  const recentQuickSave = useRef<{ type: CareEventType; at: number } | null>(
    null,
  );
  const isDuplicateQuickTap = (type: CareEventType): boolean => {
    const prev = recentQuickSave.current;
    return Boolean(
      prev &&
      prev.type === type &&
      Date.now() - prev.at <= QUICK_LOG_DEDUPE_WINDOW_MS,
    );
  };
  const markQuickSave = (type: CareEventType) => {
    recentQuickSave.current = { type, at: Date.now() };
  };

  // One shared start path for every Home surface that begins a real walk
  // session (Quick Log tile and Next Up's walk "Start"): same lifecycle
  // entry, same dedupe guard, same toast. Returns the started entry id, or
  // null when the tap was a duplicate already answered by the first tap.
  const startWalkSessionFromHome = (options?: {
    routineId?: string;
    routineLabel?: string;
  }): string | null => {
    if (careMutationsBlocked) {
      showCareReadOnly();
      return null;
    }
    // A rapid second Walk tap lands before the open session exists in
    // state; it is the same intent, already answered by the first tap.
    if (isDuplicateQuickTap("walk")) return null;
    const entry = buildWalkSessionStartEntry({
      caregiver,
      now,
      routineId: options?.routineId,
      routineLabel: options?.routineLabel,
    });
    const id = addEntry(entry as Omit<Entry, "id">);
    const accepted = runAcceptedCareMutation(id, () => {
      markQuickSave("walk");
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      const reactionPlan = describeCareTwinReactionForLog({
        type: "walk",
        label: "Walk",
        title: "Walk started",
        petName,
        details: entry.details,
      });
      showRoomSpeech(reactionPlan.label);
      showToast("Walk started · care XP lands when you finish", {
        id,
        title: "Walk started",
        type: "walk",
      });
    });
    if (!accepted) {
      showCareReadOnly();
      return null;
    }
    return id;
  };

  const logQuick = (item: QuickItem) => {
    if (item.route) {
      router.push(item.route);
      return;
    }
    if (item.forceDetail) {
      openQuickDetails(item);
      return;
    }
    const policy = getQuickLogPolicy(item.type);
    if (policy.tapBehavior === "detail-required") {
      router.push(homeLogDetailRoute(policy.type, Date.now()) as never);
      return;
    }
    if (item.type === "walk") {
      if (openWalkSession) {
        openActiveWalkFromHomeQuickLog();
        return;
      }
      startWalkSessionFromHome();
      return;
    }
    if (careMutationsBlocked) {
      showCareReadOnly();
      return;
    }
    // Dedupe against the same tick (ref) and the saved timeline (shared
    // window): the first tap's entry and toast already answered this tap.
    // The timeline check runs on wall-clock time - the screen's 30s `now`
    // tick would otherwise make a deliberate second log inside the same
    // tick look like a bounce forever.
    if (
      isDuplicateQuickTap(policy.type) ||
      findRecentQuickLogDuplicate(homeEntries, item.type, Date.now())
    ) {
      return;
    }
    const role = state.caregivers.find(
      (person) => person.name === caregiver,
    )?.role;
    const entry = buildQuickLogEntry(
      {
        type: item.type,
        title: item.title,
        mood: item.mood,
        severity: item.severity,
      },
      state,
      { caregiver, caregiverRole: role, now },
    );
    const id = addEntry(entry);
    const accepted = runAcceptedCareMutation(id, () => {
      markQuickSave(policy.type);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      const reactionPlan = describeCareTwinReactionForLog({
        type: entry.type,
        label: item.label,
        title: entry.title,
        mood: entry.mood,
        severity: entry.severity,
        petName,
        details: entry.details,
      });
      showRoomSpeech(reactionPlan.label);
      // The served-meal explainer lives in this one toast (with the room
      // bubble) - no third dark callout over the sprite. The outcome-pending
      // Next Up chip stays the persistent affordance after the toast fades.
      const mealOutcomeOpen =
        entry.type === "meal" &&
        entry.details?.mealLifecycle === "outcome-pending";
      showToast(
        mealOutcomeOpen
          ? `Meal served · outcome stays open · +${careXpForEntry(entry)} care XP`
          : `${item.title} logged · +${careXpForEntry(entry)} care XP`,
        {
          id,
          title: item.title,
          type: item.type,
        },
      );
    });
    if (!accepted) {
      showCareReadOnly();
      return;
    }
  };

  const tapPhoenixRoom = () => {
    const tapReaction = roomTapChoreography.tapReaction;
    setRoomReaction({
      id: Date.now(),
      icon:
        tapReaction.action === "comfort-loop"
          ? "health"
          : tapReaction.action === "ear-perk"
            ? "clock"
            : "heart",
      label: tapReaction.label,
      detail: tapReaction.qaHint,
      tone: colors.brandNavy,
      spriteAction: tapReaction.action,
    });
    showToast(avatarMotion.line);
  };

  const openAvatarStudio = () => {
    void Haptics.selectionAsync();
    router.push({ pathname: "/more", params: { section: "avatar-studio" } });
  };

  // Today's Story: one honest sentence from the day's real log evidence.
  const todayStoryLine = useMemo(() => {
    const todayKey = new Date(now).toDateString();
    const todaysEntries = homeEntries.filter(
      (entry) => new Date(entry.occurredAt).toDateString() === todayKey,
    );
    if (!todaysEntries.length) {
      return `${petName}'s story is ready for its first care moment today.`;
    }
    const latest = [...todaysEntries].sort((a, b) =>
      b.occurredAt.localeCompare(a.occurredAt),
    )[0];
    const count = todaysEntries.length;
    return `${latest.title} logged by ${latest.caregiver}. ${count} care ${count === 1 ? "moment" : "moments"} today.`;
  }, [homeEntries, now, petName]);

  const isWebRoutePreview = (Platform.OS as string) === "web";
  // The web preview mirrors the native inset so the room console floats
  // with the same clean margins reviewers see on a real device.
  const routeHorizontalPadding = 16;
  // Height-based hero clamp for short phones (SE-class, 568-640pt): the
  // whole stage - room band, roaming twin, bubble - scales down as one
  // unit, so the fixed 150px twin rig shrinks with its floor instead of
  // dwarfing the screen or wandering under the floating tab pill.
  const isShortViewport = viewportHeight > 0 && viewportHeight < 640;
  const heroStageWidth = Math.max(
    240,
    viewportWidth - routeHorizontalPadding * 2,
  );
  const largeTextHeroHeight =
    fontScale >= 1.5 ? Math.ceil(72 * (fontScale - 1)) : 0;
  const heroDesignHeight =
    Math.round(heroStageWidth / homeFirstScreenLayout.heroAspectRatio) +
    largeTextHeroHeight;
  const heroStageScale = isShortViewport
    ? Math.max(0.72, Math.min(1, viewportHeight / 700))
    : 1;
  const heroStageHeight = Math.round(heroDesignHeight * heroStageScale);
  // On those same short screens the first-run welcome card plus the full
  // stage cannot both fit above the tab pill, so the room stays folded
  // behind the welcome card and grows in as the card folds away.
  const heroDeferredForWelcome = isShortViewport && welcomeVisible;
  // Mirror of the welcome fold for the deferred hero: grows in on the UI
  // thread as the card folds away.
  const welcomeHeroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - welcomeCollapse.value,
    maxHeight: heroStageHeight * (1 - welcomeCollapse.value),
  }));
  const [fixedHeroTop, setFixedHeroTop] = useState<number | null>(null);
  const fade = useRef(
    new Animated.Value(isWebRoutePreview || reducedMotion ? 1 : 0),
  ).current;
  useEffect(() => {
    if (isWebRoutePreview || reducedMotion) {
      fade.setValue(1);
      return;
    }
    Animated.timing(fade, {
      toValue: 1,
      duration: 450,
      useNativeDriver: !isWebRoutePreview,
    }).start();
  }, [fade, isWebRoutePreview, reducedMotion]);

  const roomIsNight =
    colors.isDark || homeImmersiveRoomIsNight(new Date(now).getHours());
  const fixedBackdropSource = openWalkSession
    ? roomIsNight
      ? HOME_IMMERSIVE_PARK_NIGHT
      : HOME_IMMERSIVE_PARK_DAY
    : roomIsNight
      ? HOME_IMMERSIVE_ROOM_NIGHT
      : HOME_IMMERSIVE_ROOM_DAY;

  const fixedHero =
    fixedHeroTop === null ? null : (
      <Reanimated.View
        accessibilityElementsHidden
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        testID="home-fixed-hero"
        style={[
          s.fixedHeroLayer,
          {
            top: fixedHeroTop,
            left: routeHorizontalPadding,
            width: heroStageWidth,
            height: heroStageHeight,
          },
          fixedHeroCollapseStyle,
          heroDeferredForWelcome ? welcomeHeroAnimatedStyle : null,
        ]}
      >
        <View
          style={[s.heroWrap, { height: heroStageHeight, overflow: "hidden" }]}
        >
          <View
            style={
              heroStageScale < 1
                ? {
                    width: heroStageWidth,
                    height: heroDesignHeight,
                    transform: [{ scale: heroStageScale }],
                    transformOrigin: "top center",
                  }
                : { width: "100%", height: heroDesignHeight }
            }
          >
            <LivingPhoenixRoom
              mood={avatarMotion.avatarMood}
              motion={avatarMotion}
              speech={
                roomSpeechOverride ??
                (avatarMotion.speech || SPEECH_BY_MOOD[status.mood])
              }
              energy={status.energy}
              presenceLabel={presenceLabel}
              nextLabel={
                openWalkSession
                  ? "Walk active"
                  : openAloneSession
                    ? "Home alone"
                    : avatarMotion.label
              }
              reaction={roomReaction}
              statusReadouts={roomStats}
              avatarConfig={avatarConfig}
              petName={petName}
              awayOnWalk={Boolean(openWalkSession)}
              awayMinutes={openWalkMinutes}
              chromeDensity="compact"
              transparentScene
            />
          </View>
        </View>
      </Reanimated.View>
    );

  if (!homeSceneReady) {
    return (
      <View
        accessibilityLabel="Loading Home"
        accessibilityRole="progressbar"
        aria-busy
        style={[s.root, { backgroundColor: colors.background }]}
      >
        <Image
          source={fixedBackdropSource}
          resizeMode="cover"
          style={s.fullBleedArt}
          fadeDuration={0}
        />
        <ActivityIndicator color={colors.forest} style={s.homeLoading} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Full-bleed storybook backdrop from the mock boards: the scene fills
          the whole screen top to bottom. The dog's traffic area is the top
          band; a soft scrim quiets the lower floor so the floating console
          stays legible while the background still peeks through. */}
      <Image
        source={fixedBackdropSource}
        resizeMode="cover"
        style={s.fullBleedArt}
        fadeDuration={0}
        testID="home-fixed-backdrop"
      />
      {colors.isDark ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(9,17,32,0.16)" },
          ]}
          pointerEvents="none"
        />
      ) : null}
      <LinearGradient
        colors={[
          "rgba(0,0,0,0)",
          colors.background + "55",
          colors.background + "E0",
        ]}
        locations={[0.42, 0.62, 0.95]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {fixedHero}
      <Reanimated.ScrollView
        style={s.container}
        testID="home-scrolling-console"
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          paddingHorizontal: routeHorizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade }}>
          <View
            style={[s.header, { backgroundColor: colors.card }]}
            testID="home-header"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${petName}. ${careStatusLabel}. Open profile`}
              accessibilityHint={`Opens ${petName}'s profile.`}
              onPress={() => router.push(canonicalMoreRoute("dog-profile"))}
              style={({ pressed }) => [
                s.identityWrap,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <PetPortrait size={42} />
              <View style={s.identityCopy}>
                <View style={s.identityNameRow}>
                  <Text
                    numberOfLines={2}
                    style={[
                      s.identityName,
                      {
                        color: colors.foreground,
                        fontFamily: "Fraunces_700Bold",
                      },
                    ]}
                  >
                    {petName}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={14}
                    color={colors.mutedForeground}
                  />
                </View>
                <View style={s.identityCareLine}>
                  <Ionicons
                    name="heart"
                    size={13}
                    color={watchSignalCount > 0 ? colors.amber : colors.forest}
                  />
                  <Text
                    numberOfLines={2}
                    style={[
                      s.identityCareText,
                      {
                        color:
                          watchSignalCount > 0 ? colors.amber : colors.forest,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    {careLine}
                  </Text>
                </View>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Care Team & Supplies"
              accessibilityHint="Opens caregivers, supply inventory, and travel checklists."
              onPress={() =>
                router.push(canonicalMoreRoute("care-team-supplies"))
              }
              style={[
                s.headerButton,
                { borderColor: "transparent", backgroundColor: "transparent" },
              ]}
            >
              <Ionicons
                name="people-outline"
                size={24}
                color={colors.foreground}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open reminders"
              accessibilityHint={
                watchSignalCount > 0
                  ? `${watchSignalCount} ${watchSignalCount === 1 ? "signal needs" : "signals need"} attention`
                  : "Upcoming care reminders"
              }
              onPress={() => router.push(canonicalPlansReminderCenterRoute())}
              style={[
                s.headerButton,
                { borderColor: "transparent", backgroundColor: "transparent" },
              ]}
            >
              <Ionicons
                name="notifications-outline"
                size={23}
                color={colors.navy}
              />
              {watchSignalCount > 0 ? (
                <View style={[s.badge, { backgroundColor: colors.rose }]}>
                  <Text
                    style={[
                      s.badgeText,
                      { color: colors.brandNavy, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {watchSignalCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          {welcomeVisible ? (
            <Reanimated.View
              pointerEvents={welcomeShouldShow ? "auto" : "none"}
              onLayout={(event) => {
                const measured = Math.round(event.nativeEvent.layout.height);
                setWelcomeCardHeight((currentHeight) =>
                  resolveHomeWelcomeCardHeight({
                    currentHeight,
                    measuredHeight: measured,
                    welcomeShouldShow,
                  }),
                );
              }}
              style={[{ overflow: "hidden" }, welcomeCardAnimatedStyle]}
            >
              <View
                style={[
                  s.welcomeCard,
                  s.softShadow,
                  { backgroundColor: colors.forest },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss welcome"
                  onPress={dismissWelcome}
                  style={s.welcomeDismiss}
                >
                  <View style={s.welcomeDismissVisual}>
                    <Ionicons
                      name="close"
                      size={16}
                      color={colors.primaryForeground}
                    />
                  </View>
                </Pressable>
                <Text
                  style={[
                    s.welcomeKicker,
                    {
                      color: colors.amberSoft,
                      fontFamily: "Fredoka_600SemiBold",
                    },
                  ]}
                >
                  WELCOME TO WOOFWATCHER
                </Text>
                <Text
                  style={[
                    s.welcomeTitle,
                    {
                      color: colors.primaryForeground,
                      fontFamily: "Fraunces_700Bold",
                    },
                  ]}
                >
                  {petSetupCopy.title}
                </Text>
                <Text
                  style={[
                    s.welcomeBody,
                    {
                      color: colors.primaryForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  Add your dog's name, breed, and routines so Home, Log, and
                  Health fit your real day. It takes a minute.
                </Text>
                <View style={s.welcomeActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={petSetupCopy.actionLabel}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      router.push("/setup" as never);
                    }}
                    style={({ pressed }) => [
                      s.welcomePrimary,
                      {
                        backgroundColor: colors.primaryForeground,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.welcomePrimaryText,
                        {
                          color: colors.forest,
                          fontFamily: "Inter_800ExtraBold",
                        },
                      ]}
                    >
                      {petSetupCopy.actionLabel}
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={15}
                      color={colors.forest}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Explore first"
                    onPress={dismissWelcome}
                    style={({ pressed }) => [
                      s.welcomeGhost,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text
                      style={[
                        s.welcomeGhostText,
                        {
                          color: colors.primaryForeground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      Explore first
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Reanimated.View>
          ) : null}

          {/* This transparent spacer owns the room's scroll geometry and all
              touch targets. The painted room is a touch-free fixed sibling
              behind the ScrollView, so a swipe that starts over Phoenix is
              still an ordinary page scroll and can cancel the press. */}
          <Reanimated.View
            pointerEvents={heroDeferredForWelcome ? "none" : "auto"}
            testID="home-scrolling-hero-spacer"
            onLayout={(event) => {
              if (
                shouldHoldHomeFixedHeroTop({
                  welcomeWasShown: welcomeWasShown.current,
                  welcomeShouldShow,
                  welcomeCollapsed,
                })
              ) {
                return;
              }
              const top = getHomeFixedHeroTop({
                topPadding,
                spacerY: event.nativeEvent.layout.y,
                welcomeCardHeight,
                welcomeCollapsed,
              });
              setFixedHeroTop((current) => (current === top ? current : top));
            }}
            style={[
              s.heroBackdrop,
              { height: heroStageHeight, overflow: "hidden" },
              heroDeferredForWelcome ? welcomeHeroAnimatedStyle : null,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={buildCareTwinRoomAccessibilityLabel({
                name: state.profile.name,
                templateLabel: avatarTemplate.label,
                motionLabel: avatarMotion.label,
              })}
              accessibilityHint="Tap for a care-twin reaction. Long press to open Avatar Studio."
              onPress={tapPhoenixRoom}
              onLongPress={openAvatarStudio}
              style={StyleSheet.absoluteFill}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open Avatar Studio. ${avatarTemplate.label} care twin ${hasConfiguredAvatar ? "configured" : "ready to customize"}`}
              onPress={openAvatarStudio}
              style={({ pressed }) => [
                s.heroStudioChip,
                {
                  minHeight: homeFirstScreenLayout.heroStudioButtonMinHeight,
                  backgroundColor: pressed
                    ? colors.ivory
                    : "rgba(251,246,231,0.94)",
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="color-wand-outline"
                size={17}
                color={colors.forest}
              />
            </Pressable>
          </Reanimated.View>

          {/* Local-first means a failing device store IS a data risk - never
              hide it. Shown only when storage reads/writes actually fail. */}
          {storageWarning ? (
            <View
              accessibilityRole="alert"
              // role="alert" only maps to a live region on web; Android needs
              // the explicit live region and iOS the announcement effect below.
              aria-live="assertive"
              style={[
                s.storageWarningCard,
                {
                  backgroundColor: colors.amberSoft,
                  borderColor: colors.amber + "66",
                },
              ]}
            >
              <Ionicons name="warning-outline" size={17} color={colors.amber} />
              <Text
                style={[
                  s.storageWarningText,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {storageWarning === "save-failed"
                  ? "Device storage is failing - new care logs may not survive an app restart."
                  : storageWarning === "read-failed"
                    ? "Couldn't read saved care data. Saving is paused this session to protect what's stored."
                    : storageWarning === "newer-version"
                      ? "This care data was created by a newer WoofWatcher version. This version will not overwrite it. Update WoofWatcher to safely open and edit this care plan."
                      : "Saved care data couldn't be read and was reset. A recovery copy was kept on this device."}
              </Text>
            </View>
          ) : null}

          {welcomePreferenceReadFailed ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              aria-live="polite"
              style={[
                s.storageWarningCard,
                {
                  backgroundColor: colors.amberSoft,
                  borderColor: colors.amber + "66",
                },
              ]}
            >
              <Ionicons name="refresh-outline" size={17} color={colors.amber} />
              <View style={s.preferenceWarningBody}>
                <Text
                  style={[
                    s.storageWarningText,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  Couldn't load a Home display preference. Home is available,
                  and retrying will not change care data.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry welcome preference"
                  onPress={retryWelcomePreference}
                  style={({ pressed }) => [
                    s.preferenceRetryButton,
                    {
                      borderColor: colors.amber + "88",
                      backgroundColor: pressed
                        ? colors.amber + "24"
                        : colors.background,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: "Inter_800ExtraBold",
                      fontSize: 12.5,
                    }}
                  >
                    Retry
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* Mock-board Care Sense card: mood, energy, hunger, and alone
              time as chunky pip meters. Missing evidence stays at zero with
              an explicit No data/No target label. */}
          <Reanimated.View entering={reducedMotion ? undefined : enterUp(0)}>
            <BoardCard style={s.careSenseCard}>
              <View style={s.careSenseHeader}>
                <Text
                  style={[
                    s.careSenseKicker,
                    { color: colors.sage, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  Care Sense
                </Text>
                <View style={s.careSenseHeaderActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open Trends and Insights"
                    accessibilityHint="Charts these meters over time from real logged care."
                    onPress={() =>
                      router.push(canonicalHealthRoute("trends") as never)
                    }
                    style={({ pressed }) => [
                      s.careSenseTrendsLink,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Text
                      style={[
                        s.careSenseTrendsText,
                        { color: colors.sage, fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      Trends
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={13}
                      color={colors.sage}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="How Care Sense works"
                    onPress={() =>
                      notifyDialog(
                        "Care Sense",
                        `Care Sense uses care data available on this device. Mood needs an explicit mood or return outcome. Energy needs an energy level from a mood check-in; walks, play, and symptom categories do not invent either reading. Meals are compared only when ${petName} has a daily target. Alone Time fills only while an away session is open. Missing evidence stays marked as No data or No target.`,
                      )
                    }
                    style={({ pressed }) => [
                      s.homeInlineIconAction,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={17}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Today Command. ${careSenseHeadline} ${careSenseSubline}`}
                accessibilityHint="Opens the exact care workflow behind today's recommended action."
                onPress={() =>
                  router.push(todayCommand.primaryAction.route as never)
                }
                style={({ pressed }) => [
                  s.careSenseHeadlineRow,
                  { opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <View style={s.careSenseHeadlineCopy}>
                  <Text
                    numberOfLines={2}
                    style={[
                      s.careSenseHeadline,
                      {
                        color: colors.foreground,
                        fontFamily: "Fredoka_700Bold",
                      },
                    ]}
                  >
                    {careSenseHeadline}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[
                      s.careSenseSub,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    {careSenseSubline}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>
              <View style={s.careSenseMeters}>
                <StatusMeter
                  label="Mood"
                  icon={MOOD_ICON[status.mood]}
                  value={hasMoodEvidence ? careSenseMoodRatio : 0}
                  valueLabel={hasMoodEvidence ? status.meta.label : "No data"}
                  tone={colors.meterMood}
                  onPress={() =>
                    router.push(todayCommand.primaryAction.route as never)
                  }
                  accessibilityLabel={
                    hasMoodEvidence
                      ? `Mood ${status.meta.label}`
                      : "Mood, no data"
                  }
                  accessibilityHint="Opens today's recommended care workflow."
                />
                <StatusMeter
                  label="Energy"
                  icon="energy"
                  value={energyEvidenceProgress}
                  valueLabel={energyEvidenceLabel}
                  tone={colors.meterEnergy}
                  onPress={() =>
                    router.push(homeLogDetailRoute("mood", now) as never)
                  }
                  accessibilityLabel={
                    hasEnergyEvidence
                      ? `Energy ${energyEvidenceLabel}`
                      : "Energy, no logged energy level"
                  }
                  accessibilityHint="Opens the mood check-in to log an energy observation."
                />
                <StatusMeter
                  label="Hunger"
                  icon="hunger"
                  value={hasMealTarget ? careSenseMealsRatio : 0}
                  valueLabel={formatHomeCompletion(
                    status.counts.meals.done,
                    status.counts.meals.target,
                  )}
                  tone={
                    hasMealTarget ? colors.meterHunger : colors.mutedForeground
                  }
                  onPress={() =>
                    router.push(homeLogDetailRoute("meal", now) as never)
                  }
                  accessibilityLabel={`Meals ${formatHomeCompletion(
                    status.counts.meals.done,
                    status.counts.meals.target,
                  )}`}
                  accessibilityHint="Opens the meal detail flow."
                />
                <StatusMeter
                  label="Alone"
                  icon="clock"
                  value={careSenseAloneRatio}
                  polarity="inverse"
                  valueLabel={
                    openAloneSession
                      ? formatDuration(openAloneMinutes)
                      : "None active"
                  }
                  tone={colors.meterAlone}
                  onPress={() =>
                    router.push(
                      (openAloneSession?.id
                        ? homeLogEntryRoute(openAloneSession.id)
                        : homeLogDetailRoute("alone", now)) as never,
                    )
                  }
                  accessibilityLabel={
                    openAloneSession
                      ? `Alone time active, ${formatDuration(openAloneMinutes)}`
                      : "No active alone time session"
                  }
                  accessibilityHint={
                    openAloneSession
                      ? "Opens the return check-in for the active alone time."
                      : "Opens the Alone Time detail flow."
                  }
                />
              </View>
            </BoardCard>
          </Reanimated.View>

          <View style={s.homeSplit}>
            {/* Mock-board Quick Log card: Meal · Potty · Walk · Meds · More
                as springy medallion tiles inside one cream card. More opens
                the fast-log sheet where Water, Note, and the rest live. */}
            <Reanimated.View entering={reducedMotion ? undefined : enterUp(1)}>
              <BoardCard style={s.quickHomeCard}>
                <View style={s.quickSectionHeader}>
                  <Text
                    style={[
                      s.quickSectionTitle,
                      {
                        color: colors.foreground,
                        fontFamily: "Fredoka_700Bold",
                      },
                    ]}
                  >
                    Quick Log
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open full Quick Log"
                    onPress={() => router.push("/log")}
                    style={({ pressed }) => [
                      s.homeInlineIconAction,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                </View>
                <View style={s.homeQuickGrid}>
                  {HOME_QUICK_LOG.slice(0, 4).map((item) => (
                    <PressScale
                      key={item.key}
                      accessibilityRole="button"
                      accessibilityLabel={`Log ${item.label}`}
                      accessibilityHint={
                        item.forceDetail
                          ? "Opens details before saving."
                          : "Long press opens details before saving."
                      }
                      onPress={() => logQuick(item)}
                      onLongPress={() => openQuickDetails(item)}
                      scaleTo={0.92}
                      containerStyle={s.homeQuickTileLayout}
                      style={s.homeQuickTile}
                    >
                      {hasMedallion(item.icon) ? (
                        <BoardMedallion
                          name={item.icon}
                          size={54}
                          style={s.softShadow}
                        />
                      ) : (
                        <View
                          style={[
                            s.homeQuickCircle,
                            s.softShadow,
                            {
                              backgroundColor: colors.card,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <PixelIcon name={item.icon} size={26} />
                        </View>
                      )}
                      <Text
                        numberOfLines={1}
                        style={[
                          s.homeQuickText,
                          {
                            color: colors.navy,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </PressScale>
                  ))}
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel="Log care"
                    accessibilityHint="Opens the fast log sheet with water, notes, and every other care lane."
                    onPress={() =>
                      executePrimaryTabTaskPath("fast-log", {
                        navigate: (route) => router.push(route as never),
                        selectLogView: () => undefined,
                      })
                    }
                    scaleTo={0.92}
                    containerStyle={s.homeQuickTileLayout}
                    style={s.homeQuickTile}
                  >
                    <View
                      style={[
                        s.homeQuickCircle,
                        s.softShadow,
                        {
                          backgroundColor: colors.secondary,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={22}
                        color={colors.forest}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        s.homeQuickText,
                        { color: colors.navy, fontFamily: "Inter_600SemiBold" },
                      ]}
                    >
                      Log care
                    </Text>
                  </PressScale>
                </View>
              </BoardCard>
            </Reanimated.View>

            <BoardCard style={s.nextCard} enter={2}>
              <BoardSectionHeader
                title="Next Up"
                accessory={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      nextCount > 0
                        ? `Open Plans. 1 of ${nextCount} next up.`
                        : "Open Plans. No schedulable next items."
                    }
                    hitSlop={MOBILE_INLINE_HIT_SLOP}
                    onPress={() => router.push("/calendar")}
                    style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                }
              />
              {homeRoutinePlan.correctionSummary ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${homeRoutinePlan.correctionSummary} Review Plans.`}
                  accessibilityHint="Opens Plans to correct saved routine times."
                  onPress={() => router.push("/calendar")}
                  style={({ pressed }) => [
                    s.nextMoreRow,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Ionicons
                    name="warning-outline"
                    size={16}
                    color={colors.amber}
                  />
                  <Text
                    style={[
                      s.nextMoreText,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {homeRoutinePlan.correctionSummary}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={13}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              ) : null}
              {pendingMealOpenLoop ? (
                <Reanimated.View
                  pointerEvents={pendingMealChipSuppressed ? "none" : "auto"}
                  style={[{ overflow: "hidden" }, mealChipAnimatedStyle]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Update ${pendingMealOpenLoop.label}. Outcome pending.`}
                    accessibilityHint="Opens the served meal log so the outcome can be confirmed."
                    onPress={() => {
                      void Haptics.selectionAsync();
                      router.push(pendingMealOpenLoop.route as never);
                    }}
                    style={({ pressed }) => [
                      s.nextOpenLoopChip,
                      {
                        backgroundColor: pressed
                          ? colors.secondary
                          : colors.amberSoft,
                        borderColor: colors.amber,
                      },
                    ]}
                  >
                    <PixelIcon name={pendingMealOpenLoop.icon} size={20} />
                    <View style={s.nextOpenLoopCopy}>
                      <Text
                        numberOfLines={1}
                        style={[
                          s.nextOpenLoopTitle,
                          { color: colors.navy, fontFamily: "Inter_700Bold" },
                        ]}
                      >
                        {pendingMealOpenLoop.label}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          s.nextOpenLoopMeta,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {pendingMealOpenLoop.time}
                      </Text>
                    </View>
                    <View
                      style={[
                        s.nextButton,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          s.nextButtonText,
                          {
                            color: colors.primaryForeground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        Update
                      </Text>
                    </View>
                  </Pressable>
                </Reanimated.View>
              ) : null}
              {nextPrimary ? (
                <View style={s.nextPrimaryRow}>
                  <PetPortrait size={56} />
                  <View style={s.nextPrimaryCopy}>
                    <Text
                      numberOfLines={1}
                      style={[
                        s.nextPrimaryTitle,
                        {
                          color: colors.foreground,
                          fontFamily: "Fredoka_600SemiBold",
                        },
                      ]}
                    >
                      {nextPrimary.label}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[
                        s.nextPrimaryMeta,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {nextPrimary.kind === "open-loop"
                        ? nextDetail
                        : `${nextPrimary.time}${
                            nextPrimary.owner
                              ? ` · ${nextPrimary.owner} assigned`
                              : nextPrimary.kind === "suggestion"
                                ? " · Suggested"
                                : ""
                          }`}
                    </Text>
                    <View style={s.nextButtonRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${nextPrimary.meta ?? "Start"} ${nextPrimary.label}`}
                        accessibilityHint={
                          nextPrimary.kind === "open-loop" &&
                          nextPrimary.icon === "walk"
                            ? "Completes the active walk now and logs the real duration."
                            : nextPrimary.icon === "walk" &&
                                nextPrimary.kind !== "open-loop"
                              ? "Starts the walk session now. Finish it from here or the walk log."
                              : undefined
                        }
                        onPress={() => {
                          // The active-walk Finish acts here instead of
                          // deep-linking to /log - same shared lifecycle
                          // patch, zero extra hunting.
                          if (
                            nextPrimary.kind === "open-loop" &&
                            nextPrimary.icon === "walk" &&
                            openWalkSession
                          ) {
                            finishWalkFromHome();
                            return;
                          }
                          // "Start" on a planned or suggested walk starts
                          // the real session right here - same shared start
                          // path and dedupe guard as the Quick Log walk
                          // tile - so the button does what it says instead
                          // of deep-linking to /log with Walk preselected.
                          if (
                            nextPrimary.icon === "walk" &&
                            nextPrimary.kind !== "open-loop" &&
                            !openWalkSession
                          ) {
                            startWalkSessionFromHome({
                              routineId: nextPrimary.routineId,
                              routineLabel:
                                nextPrimary.kind === "routine"
                                  ? nextPrimary.label
                                  : undefined,
                            });
                            return;
                          }
                          router.push(nextPrimary.route as never);
                        }}
                        style={({ pressed }) => [
                          s.nextButton,
                          {
                            backgroundColor: colors.primary,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.nextButtonText,
                            {
                              color: colors.primaryForeground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {nextPrimary.meta ?? "Start"}
                        </Text>
                      </Pressable>
                      {nextPrimary.kind === "routine" ? (
                        <>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Snooze ${nextPrimary.label} for 30 minutes`}
                            onPress={() => snoozeNextUp(nextPrimary)}
                            style={({ pressed }) => [
                              s.nextButton,
                              s.nextButtonSoft,
                              {
                                backgroundColor: pressed
                                  ? colors.muted
                                  : colors.secondary,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                s.nextButtonText,
                                {
                                  color: colors.navy,
                                  fontFamily: "Inter_600SemiBold",
                                },
                              ]}
                            >
                              Snooze
                            </Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Reassign ${nextPrimary.label} in Plans`}
                            accessibilityHint="Opens the Plans tab, where routines and owners are edited."
                            onPress={() => router.push("/calendar")}
                            style={({ pressed }) => [
                              s.nextButton,
                              s.nextButtonSoft,
                              {
                                backgroundColor: pressed
                                  ? colors.muted
                                  : colors.secondary,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                s.nextButtonText,
                                {
                                  color: colors.navy,
                                  fontFamily: "Inter_600SemiBold",
                                },
                              ]}
                            >
                              Reassign
                            </Text>
                          </Pressable>
                        </>
                      ) : null}
                    </View>
                  </View>
                </View>
              ) : (
                <Text
                  style={[
                    s.nextEmptyText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {homeRoutinePlan.correctionCount > 0
                    ? "No routines can be scheduled until their times are corrected in Plans."
                    : "Everything scheduled is snoozed. It returns in 30 minutes, or open Plans to review."}
                </Text>
              )}
              {nextUp.length > 1 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${nextUp.length - 1} more planned ${nextUp.length - 1 === 1 ? "item" : "items"} in Plans`}
                  onPress={() => router.push("/calendar")}
                  style={({ pressed }) => [
                    s.nextMoreRow,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Text
                    style={[
                      s.nextMoreText,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {nextUp.length - 1} more in Plans
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={13}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              ) : null}
            </BoardCard>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Today's Story. ${todayStoryLine} Open Story & Progress.`}
            accessibilityHint={`Opens ${petName}'s Story & Progress.`}
            onPress={() => router.push(canonicalMoreRoute("story-progress"))}
            style={({ pressed }) => [
              s.todayStoryCard,
              s.softShadow,
              {
                backgroundColor: pressed ? colors.secondary : colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Image
              source={require("@/assets/board/hero.png")}
              style={[s.todayStoryThumb, { borderColor: colors.border }]}
              resizeMode="cover"
            />
            <View style={s.todayStoryCopy}>
              <Text
                style={[
                  s.todayStoryKicker,
                  {
                    color: colors.sage,
                    fontFamily: "Inter_700Bold",
                    letterSpacing: 1.1,
                    textTransform: "uppercase",
                    fontSize: 9,
                  },
                ]}
              >
                Today's Story
              </Text>
              <Text
                numberOfLines={2}
                style={[
                  s.todayStoryText,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {todayStoryLine}
              </Text>
              <View style={s.todayStoryChips}>
                {careCareer.todayXp > 0 ? (
                  <View
                    style={[
                      s.todayStoryChip,
                      { backgroundColor: colors.amberSoft },
                    ]}
                  >
                    <Text
                      style={[
                        s.todayStoryChipText,
                        { color: colors.amber, fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      +{careCareer.todayXp} XP
                    </Text>
                  </View>
                ) : null}
                {careStreak >= 2 ? (
                  <View
                    style={[
                      s.todayStoryChip,
                      { backgroundColor: colors.sageSoft },
                    ]}
                  >
                    <Text
                      style={[
                        s.todayStoryChipText,
                        { color: colors.forest, fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      {careStreak}-day streak
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.mutedForeground}
            />
          </Pressable>

          {/* Presence panel: who Phoenix is with right now, still one tap
              from the live alone-time workflow. During an active walk, Next
              Up already owns the live "Finish" CTA, so the panel steps aside
              instead of echoing the same walk status a second time. */}
          {openWalkSession ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${presenceLabel}. Presence state ${presenceState}`}
              accessibilityHint={presenceActionHint}
              onPress={openPresencePanel}
              style={[
                s.presencePanel,
                s.softShadow,
                {
                  minHeight: homeFirstScreenLayout.presencePanelMinHeight,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  s.presenceAvatar,
                  {
                    backgroundColor: openAloneSession
                      ? colors.amber
                      : openWalkSession
                        ? colors.sage
                        : colors.copper,
                  },
                ]}
              >
                {openAloneSession ? (
                  <Ionicons name="home-outline" size={18} color="#FFFFFF" />
                ) : openWalkSession ? (
                  <PixelIcon name="walk" size={21} />
                ) : (
                  <Text
                    style={[s.presenceInitial, { fontFamily: "Inter_700Bold" }]}
                  >
                    {caregiver.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={s.presenceCopy}>
                <Text
                  numberOfLines={2}
                  style={[
                    s.presenceText,
                    { color: colors.navy, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {openAloneSession
                    ? `${petName} is home alone`
                    : openWalkSession
                      ? `${petName} is on a walk`
                      : presenceLabel}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[
                    s.presenceSub,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {presenceSub}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.navy} />
            </Pressable>
          )}

          {/* Care Status keeps only what Care Sense doesn't already show:
              presence, logged bond evidence, and the diet-profile door. */}
          <BoardCard style={s.careStatusCard}>
            <BoardSectionHeader
              title="Care Status"
              accessory={
                <BoardPill label={careStatusLabel} tone={careStatusTone} />
              }
            />
            <CareRow
              icon="heart"
              title="Bond evidence"
              detail={
                bondEvidenceCount > 0
                  ? `${bondEvidenceCount} play or training ${bondEvidenceCount === 1 ? "moment" : "moments"} logged today`
                  : "No play or training logged today"
              }
              onPress={() => openStatusTile("bond")}
              accessibilityLabel={
                bondEvidenceCount > 0
                  ? `Bond evidence, ${bondEvidenceCount} moments logged today`
                  : "Bond evidence, no play or training logged today"
              }
            />
            <CareRow
              icon="meal"
              title="Diet profile"
              detail={
                Object.values(state.dietProfile).some((value) => value.trim())
                  ? "Meals, portions, and sensitivities on file"
                  : "No diet profile saved yet"
              }
              onPress={() => openStatusTile("diet")}
              accessibilityLabel="Open Diet Profile"
            />
          </BoardCard>

          <BoardCard style={s.careerCard}>
            <View
              accessible
              accessibilityLabel={`Care level ${careCareer.level}, ${careCareer.title}. ${careCareer.levelXp} of ${careCareer.levelSpanXp} XP toward the next level.${careCareer.todayXp > 0 ? ` ${careCareer.todayXp} XP earned today.` : ""}`}
              style={s.careerRow}
            >
              <View
                style={[
                  s.careerBadge,
                  {
                    backgroundColor: colors.amberSoft,
                    borderColor: colors.amber,
                  },
                ]}
              >
                <Text
                  style={[
                    s.careerBadgeKicker,
                    { color: colors.amber, fontFamily: "Inter_800ExtraBold" },
                  ]}
                >
                  LV
                </Text>
                <Text
                  style={[
                    s.careerBadgeLevel,
                    {
                      color: colors.foreground,
                      fontFamily: "Fraunces_700Bold",
                    },
                  ]}
                >
                  {careCareer.level}
                </Text>
              </View>
              <View style={s.careerBody}>
                <View style={s.careerTitleRow}>
                  <Text
                    numberOfLines={1}
                    style={[
                      s.careerTitle,
                      { color: colors.navy, fontFamily: "Fredoka_600SemiBold" },
                    ]}
                  >
                    {careCareer.title}
                  </Text>
                  {careCareer.todayXp > 0 ? (
                    <Text
                      style={[
                        s.careerToday,
                        {
                          color: colors.sage,
                          fontFamily: "Inter_800ExtraBold",
                        },
                      ]}
                    >
                      +{careCareer.todayXp} XP today
                    </Text>
                  ) : null}
                </View>
                <View style={s.careerSegments}>
                  {Array.from({ length: 10 }).map((_, index) => (
                    <View
                      key={`career-seg-${index}`}
                      style={[
                        s.careerSegment,
                        {
                          backgroundColor:
                            index < Math.round(careCareer.levelProgress * 10)
                              ? colors.amber
                              : colors.muted,
                          borderColor:
                            index < Math.round(careCareer.levelProgress * 10)
                              ? colors.amber
                              : colors.border,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text
                  style={[
                    s.careerXp,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {careCareer.levelXp.toLocaleString()} /{" "}
                  {careCareer.levelSpanXp.toLocaleString()} XP ·{" "}
                  {careStreak >= 2
                    ? `${careStreak}-day care streak`
                    : "every point from real care logs"}
                </Text>
              </View>
            </View>
          </BoardCard>

          <BoardCard
            tone="navy"
            style={[s.missionDeck, { padding: missionLayout.deckPadding }]}
          >
            <View
              style={[
                s.missionHeader,
                { marginBottom: missionLayout.headerGap },
              ]}
            >
              <View>
                <Text
                  style={[
                    s.missionKicker,
                    { color: colors.amber, fontFamily: "Fredoka_600SemiBold" },
                  ]}
                >
                  Today's Missions
                </Text>
                <Text
                  numberOfLines={1}
                  style={[s.missionTitle, { fontFamily: "Fredoka_700Bold" }]}
                >
                  Quest board
                </Text>
              </View>
              {missionLayout.showBadge ? (
                <View style={s.missionBadge}>
                  <PixelIcon name="heart" size={25} />
                  <Text
                    style={[
                      s.missionBadgeText,
                      { fontFamily: "Inter_800ExtraBold" },
                    ]}
                  >
                    Care RPG
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={[s.missionRows, { gap: missionLayout.rowGap }]}>
              {deckMissions.map((mission) => {
                const tone = missionToneColor(mission.tone);
                return (
                  <Pressable
                    key={mission.key}
                    accessibilityRole="button"
                    accessibilityLabel={`${mission.label}. ${mission.title}. ${mission.detail}`}
                    accessibilityHint={missionLayout.qaLabel}
                    onPress={() => router.push(mission.route as never)}
                    style={({ pressed }) => [
                      s.missionRow,
                      {
                        minHeight: missionLayout.rowMinHeight,
                        paddingHorizontal: missionLayout.rowPaddingHorizontal,
                        paddingVertical: missionLayout.rowPaddingVertical,
                      },
                      {
                        borderColor: pressed ? tone : "rgba(255,249,239,0.18)",
                        backgroundColor: pressed
                          ? "rgba(255,249,239,0.16)"
                          : "rgba(255,249,239,0.08)",
                      },
                    ]}
                  >
                    <View
                      style={[
                        s.missionIcon,
                        {
                          width: missionLayout.iconBoxSize,
                          height: missionLayout.iconBoxSize,
                          backgroundColor: tone + "24",
                          borderColor: tone + "80",
                        },
                      ]}
                    >
                      <PixelIcon
                        name={mission.icon as PixelIconName}
                        size={missionLayout.iconSize}
                      />
                    </View>
                    <View style={s.missionCopy}>
                      <View style={s.missionCopyTop}>
                        <Text
                          numberOfLines={2}
                          style={[
                            s.missionLabel,
                            { fontFamily: "Inter_800ExtraBold" },
                          ]}
                        >
                          {mission.label}
                        </Text>
                        {/* The Quest board header already carries the "Care
                            RPG" badge, so the adventure row drops its
                            duplicate status pill and reads under its own
                            "Adventure" category label. */}
                        {mission.key === "adventure" ? null : (
                          <Text
                            numberOfLines={2}
                            style={[
                              s.missionStatus,
                              { color: tone, fontFamily: "Inter_800ExtraBold" },
                            ]}
                          >
                            {mission.statusLabel}
                          </Text>
                        )}
                      </View>
                      <Text
                        numberOfLines={2}
                        style={[
                          s.missionRowTitle,
                          { fontFamily: "Fredoka_700Bold" },
                        ]}
                      >
                        {mission.title}
                      </Text>
                      <Text
                        numberOfLines={Math.max(2, missionLayout.detailLines)}
                        style={[
                          s.missionDetail,
                          { fontFamily: "Inter_600SemiBold" },
                        ]}
                      >
                        {mission.detail}
                      </Text>
                    </View>
                    <View
                      style={[
                        s.missionCta,
                        {
                          maxWidth: missionLayout.ctaMaxWidth,
                          minHeight: missionLayout.ctaMinHeight,
                        },
                      ]}
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={17}
                        color="#FFF9EF"
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </BoardCard>

          <View style={s.cardGrid}>
            <BoardCard style={s.gridCard}>
              <BoardSectionHeader title="Today at a glance" />
              <View style={s.todayGrid}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open today activity logs"
                  accessibilityHint="Opens the walk detail flow for today's activity."
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                  onPress={() => openTodayMetric("activity")}
                  style={({ pressed }) => [
                    s.todayMetric,
                    {
                      backgroundColor: pressed
                        ? colors.secondary
                        : colors.background,
                      borderColor: pressed ? colors.sage : colors.border,
                    },
                  ]}
                >
                  <PixelIcon name="walk" size={26} />
                  <Text
                    style={[
                      s.metricValue,
                      { color: colors.navy, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {status.counts.walkMinutes}m
                  </Text>
                  <Text
                    style={[
                      s.metricLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    Activity
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open today meal logs"
                  accessibilityHint="Opens the meal detail flow for portions and outcomes."
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                  onPress={() => openTodayMetric("meals")}
                  style={({ pressed }) => [
                    s.todayMetric,
                    {
                      backgroundColor: pressed
                        ? colors.secondary
                        : colors.background,
                      borderColor: pressed ? colors.copper : colors.border,
                    },
                  ]}
                >
                  <PixelIcon name="meal" size={26} />
                  <Text
                    style={[
                      s.metricValue,
                      { color: colors.navy, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {formatHomeCompletion(meals.done, meals.target)}
                  </Text>
                  <Text
                    style={[
                      s.metricLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    Meals
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open today potty logs"
                  accessibilityHint="Opens the potty detail flow for pee, poop, accidents, and notes."
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                  onPress={() => openTodayMetric("potty")}
                  style={({ pressed }) => [
                    s.todayMetric,
                    {
                      backgroundColor: pressed
                        ? colors.secondary
                        : colors.background,
                      borderColor: pressed ? colors.blueSignal : colors.border,
                    },
                  ]}
                >
                  <PixelIcon name="pee" size={26} />
                  <Text
                    style={[
                      s.metricValue,
                      { color: colors.navy, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {formatHomeCompletion(
                      status.counts.potty.done,
                      status.counts.potty.target,
                    )}
                  </Text>
                  <Text
                    style={[
                      s.metricLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    Potty
                  </Text>
                </Pressable>
              </View>
            </BoardCard>

            <BoardCard style={s.gridCard}>
              <BoardSectionHeader
                title="Recent activity"
                accessory={
                  <HomeHeaderAction
                    label="View all"
                    accessibilityLabel="View all recent care activity"
                    route="/log"
                  />
                }
              />
              {recentActivity.length ? (
                recentActivity.map((entry) => (
                  <CareRow
                    key={entry.id}
                    icon={entry.icon}
                    title={entry.title}
                    detail={entry.caregiver}
                    meta={entry.time}
                    accessibilityLabel={`Open recent care log: ${entry.title}`}
                    onPress={() =>
                      router.push(
                        `/log?entry=${encodeURIComponent(entry.id)}` as never,
                      )
                    }
                  />
                ))
              ) : (
                <Text
                  style={[
                    s.emptyText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  No care logs yet today.
                </Text>
              )}
            </BoardCard>
          </View>

          <View style={s.watchRow}>
            {[
              {
                title: "Health Watch",
                icon: "health" as PixelIconName,
                data: health,
                target: "health" as HomeWatchTarget,
                hint: "Opens Health Watch overview with activity, appetite, stool, hydration, energy, and vomiting signals.",
              },
              {
                title: "Bile Watch",
                icon: "bile" as PixelIconName,
                data: bile,
                target: "bile" as HomeWatchTarget,
                hint: "Opens the Bile Watch tab for yellow bile patterns, food gaps, and owner notes.",
              },
              {
                title: "Alone Time",
                icon: "clock" as PixelIconName,
                data: alone,
                target: "alone" as HomeWatchTarget,
                hint: openAloneSession
                  ? "Opens the return check-in so the household can close the active alone time."
                  : "Opens the Alone Time detail flow for leaving home or logging a return.",
              },
            ].map((w) => (
              <Pressable
                key={w.title}
                accessibilityRole="button"
                accessibilityLabel={`${w.title}. ${w.data.status}`}
                accessibilityHint={w.hint}
                hitSlop={MOBILE_INLINE_HIT_SLOP}
                onPress={() => openHomeWatchCard(w.target)}
                style={({ pressed }) => [
                  { flex: 1, opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <BoardCard style={s.watchCard}>
                  <PixelIcon name={w.icon} size={24} />
                  <Text
                    style={[
                      s.watchTitle,
                      { color: colors.navy, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {w.title}
                  </Text>
                  <Text
                    style={[
                      s.watchStatus,
                      { color: w.data.color, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {w.data.status}
                  </Text>
                  <Text
                    style={[
                      s.watchSub,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    {w.data.sub}
                  </Text>
                </BoardCard>
              </Pressable>
            ))}
          </View>

          {/* Care quest sits on the default card surface, not navy, so it
              reads as its own lighter block instead of a second dark panel
              stacked under the Quest board mission deck. */}
          <BoardCard style={s.questCard}>
            <View style={s.questTop}>
              <View style={s.questTopCopy}>
                <Text
                  style={[
                    s.questKicker,
                    {
                      color: colors.sage,
                      fontFamily: "Inter_700Bold",
                      letterSpacing: 1.1,
                      textTransform: "uppercase",
                      fontSize: 9,
                    },
                  ]}
                >
                  Care quest
                </Text>
                <Text
                  style={[
                    s.questTitle,
                    { color: colors.foreground, fontFamily: "Fredoka_700Bold" },
                  ]}
                >
                  {questLine}
                </Text>
                <Text
                  style={[
                    s.questSub,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {careIntelligence.subtitle}
                </Text>
              </View>
              <View
                style={[
                  s.questBadge,
                  {
                    backgroundColor: colors.rose + "1C",
                    borderColor: colors.rose + "55",
                  },
                ]}
              >
                <PixelIcon name="heart" size={30} />
              </View>
            </View>
            <View style={s.questMetaRow}>
              <Text
                style={[
                  s.questMeta,
                  { color: colors.navy, fontFamily: "Inter_700Bold" },
                ]}
              >
                {/* Zero-log day: "--" instead of a fabricated percentage -
                    the score starts with the first real log. */}
                {careIntelligence.visibleLogCount === 0
                  ? "-- Care IQ"
                  : `${careIntelligence.score}% Care IQ`}
              </Text>
              <Text
                style={[
                  s.questMeta,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                {careIntelligence.visibleLogCount === 0
                  ? "Starts with your first log"
                  : `${careIntelligence.confidenceScore}% log confidence`}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Home Care Intelligence next action: ${careIntelligence.nextAction.label}`}
              accessibilityHint={careIntelligence.nextAction.detail}
              onPress={openHomeCareIntelligenceNextAction}
              style={({ pressed }) => [
                s.questNextAction,
                {
                  borderColor: pressed ? colors.amber : colors.border,
                  backgroundColor: pressed
                    ? colors.secondary
                    : colors.background,
                },
              ]}
            >
              <View
                style={[
                  s.questNextIcon,
                  {
                    backgroundColor: colors.amber + "1C",
                    borderColor: colors.amber + "55",
                  },
                ]}
              >
                <PixelIcon name={homeCareIntelligenceIcon} size={24} />
              </View>
              <View style={s.questNextCopy}>
                <Text
                  style={[
                    s.questNextKicker,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_800ExtraBold",
                    },
                  ]}
                >
                  Next care move
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    s.questNextTitle,
                    { color: colors.foreground, fontFamily: "Fredoka_700Bold" },
                  ]}
                >
                  {careIntelligence.nextAction.label}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[
                    s.questNextDetail,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {careIntelligence.nextAction.detail}
                </Text>
              </View>
              <View
                style={[s.questNextCta, { backgroundColor: colors.primary }]}
              >
                <Text
                  style={[
                    s.questNextCtaText,
                    {
                      color: colors.primaryForeground,
                      fontFamily: "Inter_800ExtraBold",
                    },
                  ]}
                >
                  {homeCareIntelligenceCta}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={15}
                  color={colors.primaryForeground}
                />
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open Adventure Mode. ${adventureQuest.title}. ${adventureMode.summary}`}
              onPress={() => router.push(canonicalMoreRoute("adventure"))}
              style={({ pressed }) => [
                s.adventureInline,
                {
                  backgroundColor: pressed
                    ? colors.secondary
                    : colors.background,
                  borderColor: colors.border,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <View
                style={[
                  s.adventureIcon,
                  {
                    backgroundColor: colors.copper + "1C",
                    borderColor: colors.copper + "55",
                  },
                ]}
              >
                <PixelIcon
                  name={adventureQuestIcon(adventureQuest.id)}
                  size={25}
                />
              </View>
              <View style={s.adventureCopy}>
                <Text
                  style={[
                    s.adventureKicker,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  Adventure Mode
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    s.adventureTitle,
                    { color: colors.foreground, fontFamily: "Fredoka_700Bold" },
                  ]}
                >
                  {adventureQuest.title}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[
                    s.adventureSub,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  Quest level {adventureMode.level} - {adventureMode.todayXp}{" "}
                  quest XP today - {adventureMode.memoriesCount} memories
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.navy} />
            </Pressable>
          </BoardCard>
        </Animated.View>
      </Reanimated.ScrollView>

      {toast && (
        <Animated.View
          pointerEvents={quickFeedback ? "auto" : "none"}
          style={[
            s.toast,
            {
              backgroundColor: colors.brandNavy,
              opacity: toastOpacity,
              // The one feedback toast anchors just above the floating tab
              // bar through the shared chrome metric, never mid-screen.
              bottom: getFloatingFeedbackBottomOffset({
                platform: Platform.OS,
                bottomInset: insets.bottom,
                surface: "tabbed",
              }),
            },
          ]}
        >
          <Text style={[s.toastText, { fontFamily: "Inter_700Bold" }]}>
            {toast}
          </Text>
          {quickFeedback ? (
            <View style={s.toastActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Undo ${quickFeedback.title} quick log`}
                accessibilityState={{ disabled: quickFeedbackUndoBusy }}
                disabled={quickFeedbackUndoBusy}
                onPress={undoQuickFeedback}
                style={({ pressed }) => [
                  s.toastAction,
                  {
                    backgroundColor:
                      pressed && !quickFeedbackUndoBusy
                        ? "rgba(255,249,239,0.16)"
                        : "rgba(255,249,239,0.1)",
                    borderColor: "rgba(255,249,239,0.34)",
                    opacity: quickFeedbackUndoBusy ? 0.5 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    s.toastActionText,
                    { fontFamily: "Inter_800ExtraBold" },
                  ]}
                >
                  Undo
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add details to ${quickFeedback.title}`}
                accessibilityState={{ disabled: quickFeedbackUndoBusy }}
                disabled={quickFeedbackUndoBusy}
                onPress={openQuickFeedbackDetails}
                style={({ pressed }) => [
                  s.toastAction,
                  {
                    backgroundColor:
                      pressed && !quickFeedbackUndoBusy
                        ? colors.copper + "DD"
                        : colors.copper,
                    borderColor: colors.copper,
                    opacity: quickFeedbackUndoBusy ? 0.5 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    s.toastActionText,
                    { fontFamily: "Inter_800ExtraBold" },
                  ]}
                >
                  Add details
                </Text>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, zIndex: 2 },
  fixedHeroLayer: {
    position: "absolute",
    zIndex: 1,
    overflow: "hidden",
  },
  homeLoading: {
    ...StyleSheet.absoluteFillObject,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    marginBottom: 10,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  headerButton: {
    width: MIN_MOBILE_TOUCH_TARGET,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10 },
  identityWrap: {
    flex: 1,
    minWidth: 0,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  identityNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  identityName: {
    fontSize: 20,
    lineHeight: 24,
  },
  identityCareLine: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  identityCareText: {
    fontSize: 11.5,
  },

  heroBackdrop: {
    width: "100%",
    marginBottom: 0,
  },
  fullBleedArt: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  heroStudioChip: {
    position: "absolute",
    bottom: 12,
    right: 12,
    zIndex: 8,
    width: MIN_MOBILE_TOUCH_TARGET,
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroStudioButton: {
    width: 116,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
    justifyContent: "center",
  },
  heroStudioKicker: {
    fontSize: 8.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  heroStudioTitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  heroWrap: {
    width: "100%",
    position: "relative",
  },
  presencePanel: {
    width: "100%",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  // Soft premium elevation for the mock-board surfaces, matching the
  // BoardCard shadow language so everything floats gently on the parchment.
  softShadow: {
    shadowColor: "#2A2118",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  // First-run welcome (fresh household only)
  welcomeCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  welcomeDismiss: {
    position: "absolute",
    top: 2,
    right: 2,
    width: MIN_MOBILE_TOUCH_TARGET,
    height: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    // The card's text stack renders after this absolute button, so without
    // an explicit z-order the full-width kicker Text sits on top and eats
    // every tap - the X looked tappable but was dead.
    zIndex: 5,
  },
  welcomeDismissVisual: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  welcomeKicker: {
    fontSize: 11,
    letterSpacing: 1.3,
    marginBottom: 4,
    paddingRight: MIN_MOBILE_TOUCH_TARGET,
  },
  welcomeTitle: {
    fontSize: 22,
    marginBottom: 6,
    paddingRight: MIN_MOBILE_TOUCH_TARGET,
  },
  welcomeBody: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.92,
    marginBottom: 14,
    paddingRight: 8,
  },
  welcomeActions: {
    flexDirection: "row",
    alignItems: "stretch",
    flexWrap: "wrap",
    gap: 10,
  },
  welcomePrimary: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    maxWidth: "100%",
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  welcomePrimaryText: {
    fontSize: 14,
    flexShrink: 1,
  },
  welcomeGhost: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    maxWidth: "100%",
    flexShrink: 1,
    paddingHorizontal: 10,
    paddingVertical: 11,
    justifyContent: "center",
  },
  welcomeGhostText: {
    fontSize: 13,
  },

  // Mock-board Care Sense card: quiet kicker, big honest headline, four
  // chunky pip meters (mood / energy / hunger / alone time).
  storageWarningCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 12,
  },
  storageWarningText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
  preferenceWarningBody: {
    flex: 1,
    gap: 8,
  },
  preferenceRetryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  careSenseCard: {
    marginTop: 12,
    marginBottom: 4,
  },
  careSenseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  careSenseHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  careSenseTrendsLink: {
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  homeInlineIconAction: {
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  careSenseTrendsText: {
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  careSenseKicker: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    opacity: 0.85,
  },
  careSenseHeadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
  },
  careSenseHeadlineCopy: {
    flex: 1,
    minWidth: 0,
  },
  careSenseHeadline: {
    fontSize: 18,
    lineHeight: 23,
  },
  careSenseSub: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
  careSenseMeters: {
    marginTop: 8,
    gap: 2,
  },
  presenceAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  presenceInitial: { color: "#FFFFFF", fontSize: 17 },
  presenceCopy: { flex: 1, minWidth: 0 },
  todayStoryCard: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  todayStoryThumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
  },
  todayStoryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  todayStoryKicker: {
    fontSize: 11,
  },
  todayStoryText: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  todayStoryChips: {
    flexDirection: "row",
    gap: 6,
  },
  todayStoryChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  todayStoryChipText: {
    fontSize: 10,
  },
  careerCard: {
    marginBottom: 12,
  },
  careerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  careerBadge: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  careerBadgeKicker: {
    fontSize: 8,
    letterSpacing: 1,
  },
  careerBadgeLevel: {
    fontSize: 21,
    lineHeight: 24,
  },
  careerBody: {
    flex: 1,
    minWidth: 0,
  },
  careerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  careerTitle: {
    flexShrink: 1,
    fontSize: 15,
  },
  careerToday: {
    fontSize: 10.5,
  },
  careerSegments: {
    flexDirection: "row",
    gap: 3,
    marginTop: 6,
  },
  careerSegment: {
    flex: 1,
    height: 10,
    borderWidth: 1,
    borderRadius: 2,
  },
  careerXp: {
    fontSize: 10.5,
    marginTop: 5,
  },
  presenceText: { fontSize: 14 },
  presenceSub: { fontSize: 11, marginTop: 2 },
  careStatusCard: {
    marginTop: 0,
    marginBottom: 8,
  },
  statusTiles: {
    flexDirection: "column",
    gap: 6,
    marginBottom: 10,
  },
  statusTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 0,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusTileIcon: {
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTileLabel: { flex: 1, fontSize: 14 },
  statusTileValuePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusTileValue: { fontSize: 13, textAlign: "right" },
  statusTileSegments: {
    flexDirection: "row",
    gap: 3,
  },
  statusTileSegment: {
    width: 13,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
  },
  todayCommandCard: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#081424",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  todayCommandIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  todayCommandCopy: {
    flex: 1,
    minWidth: 0,
  },
  todayCommandKicker: {
    fontSize: 9.5,
    lineHeight: 12,
    textTransform: "uppercase",
  },
  todayCommandTitle: {
    fontSize: 14.5,
    lineHeight: 17,
    marginTop: 1,
  },
  todayCommandDetail: {
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 2,
  },
  todayCommandCta: {
    minHeight: 34,
    borderRadius: 7,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  todayCommandCtaText: {
    color: "#FFF9EF",
    fontSize: 10,
  },

  missionDeck: {
    marginBottom: 10,
    padding: 12,
    overflow: "hidden",
  },
  missionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  missionKicker: {
    fontSize: 11,
    textTransform: "uppercase",
  },
  missionTitle: {
    color: "#FFF9EF",
    fontSize: 17,
    lineHeight: 21,
    marginTop: 1,
  },
  missionBadge: {
    minHeight: 34,
    borderRadius: 7,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,249,239,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,249,239,0.2)",
  },
  missionBadgeText: {
    color: "#FFF9EF",
    fontSize: 9,
    textTransform: "uppercase",
  },
  missionRows: {
    gap: 8,
  },
  missionRow: {
    minHeight: 72,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  missionIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,249,239,0.14)",
  },
  missionCopy: {
    flex: 1,
    minWidth: 0,
  },
  missionCopyTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  missionLabel: {
    color: "rgba(255,249,239,0.76)",
    fontSize: 9.5,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  missionStatus: {
    fontSize: 9.5,
    textTransform: "uppercase",
  },
  missionRowTitle: {
    color: "#FFF9EF",
    fontSize: 14.5,
    lineHeight: 17,
    marginTop: 2,
  },
  missionDetail: {
    color: "rgba(255,249,239,0.7)",
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 2,
  },
  missionCta: {
    maxWidth: 82,
    minHeight: 34,
    borderRadius: 7,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: "rgba(255,249,239,0.12)",
  },
  missionCtaText: {
    color: "#FFF9EF",
    fontSize: 9.5,
    maxWidth: 58,
  },

  homeSplit: {
    flexDirection: "column",
    gap: 10,
    alignItems: "stretch",
    marginBottom: 10,
  },
  homeSplitCard: {
    minWidth: 0,
  },
  nextCard: { marginTop: 0 },
  quickHomeCard: {
    minHeight: 0,
  },
  quickHeaderAction: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  quickHeaderActionText: {
    fontSize: 10,
    letterSpacing: 0,
  },
  homeHeaderAction: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  homeHeaderActionText: {
    fontSize: 10,
    letterSpacing: 0,
  },
  quickSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  quickSectionTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  homeQuickGrid: {
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "space-between",
    marginTop: 4,
  },
  homeQuickTileLayout: {
    width: "18.5%",
  },
  homeQuickTile: {
    width: "100%",
    minHeight: 74,
    alignItems: "center",
    gap: 5,
  },
  homeQuickCircle: {
    width: 52,
    height: 52,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  homeQuickText: {
    fontSize: 9.5,
    textAlign: "center",
  },

  // Open-loop chip stacked above the planned Next Up item: a served meal
  // waiting on its outcome never displaces the plan itself.
  nextOpenLoopChip: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nextOpenLoopCopy: {
    flex: 1,
    minWidth: 0,
  },
  nextOpenLoopTitle: {
    fontSize: 12.5,
  },
  nextOpenLoopMeta: {
    fontSize: 10.5,
    marginTop: 1,
  },

  // Next Up primary row: thumb + copy + Start/Snooze/Reassign
  nextPrimaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingTop: 2,
  },
  nextPrimaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  nextPrimaryTitle: {
    fontSize: 15,
    lineHeight: 19,
  },
  nextPrimaryMeta: {
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 2,
  },
  nextButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  nextButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    maxWidth: "100%",
    flexShrink: 1,
    borderRadius: 999,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  nextButtonSoft: {},
  nextButtonText: {
    fontSize: 11.5,
  },
  nextEmptyText: {
    fontSize: 12,
    lineHeight: 17,
  },
  nextMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    gap: 3,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  nextMoreText: {
    fontSize: 11,
  },
  questCard: {
    marginTop: 10,
    marginBottom: 10,
    padding: 14,
    overflow: "hidden",
  },
  questTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  questTopCopy: {
    flex: 1,
    minWidth: 0,
  },
  questKicker: { fontSize: 11, textTransform: "uppercase" },
  questTitle: {
    fontSize: 17,
    lineHeight: 21,
    marginTop: 2,
  },
  questSub: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 5,
  },
  questBadge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  questMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
  },
  questMeta: {
    fontSize: 11.5,
  },
  questNextAction: {
    marginTop: 11,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  questNextIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  questNextCopy: {
    flex: 1,
    minWidth: 0,
  },
  questNextKicker: {
    fontSize: 8.5,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  questNextTitle: {
    fontSize: 13.5,
    lineHeight: 16,
    marginTop: 1,
  },
  questNextDetail: {
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 2,
  },
  questNextCta: {
    minHeight: 34,
    borderRadius: 7,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  questNextCtaText: {
    fontSize: 10.5,
  },
  adventureInline: {
    marginTop: 13,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  adventureIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  adventureCopy: { flex: 1, minWidth: 0 },
  adventureKicker: {
    fontSize: 9,
    textTransform: "uppercase",
  },
  adventureTitle: {
    fontSize: 14,
    lineHeight: 17,
    marginTop: 1,
  },
  adventureSub: {
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 2,
  },
  cardGrid: { gap: 10, marginTop: 10 },
  gridCard: { minHeight: 124 },
  todayGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  todayMetric: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  metricValue: { fontSize: 17 },
  metricLabel: { fontSize: 10.5 },
  emptyText: { fontSize: 12, lineHeight: 18 },
  watchRow: { flexDirection: "row", gap: 9, marginTop: 10 },
  watchCard: { minHeight: 118, alignItems: "flex-start", gap: 4 },
  watchTitle: { fontSize: 11.5 },
  watchStatus: { fontSize: 12 },
  watchSub: { fontSize: 10.5, lineHeight: 14 },

  toast: {
    position: "absolute",
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    maxWidth: "92%",
    alignItems: "center",
    gap: 8,
  },
  toastText: { color: "#FFFFFF", fontSize: 13 },
  toastActions: { flexDirection: "row", gap: 8 },
  toastAction: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  toastActionText: { color: "#FFFFFF", fontSize: 12 },
});

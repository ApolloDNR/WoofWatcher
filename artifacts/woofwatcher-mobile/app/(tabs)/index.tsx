import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  deriveAdventureMode,
  deriveCareIntelligence,
  normalizeCareEventType,
  type CareEventDetails,
  type CareEventType,
} from "@workspace/care-domain";

import Reanimated, {
  Easing as ReanimatedEasing,
  runOnJS,
  useAnimatedScrollHandler,
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
import { useCare, type Entry } from "@/context/CareContext";
import { announce } from "@/lib/announce";
import { isClerkEnabledForBuild } from "@/lib/auth";
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
  type HomeMissionTone,
} from "@/lib/homeMissionDeck";
import { getHomeFirstScreenLayout } from "@/lib/homeFirstScreenLayout";
import { getHomeMissionDeckLayout } from "@/lib/homeMissionLayout";
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
import { derivePhoenixStatus, type Mood } from "@/lib/phoenixStatus";
import { resolvePetName } from "@/lib/petIdentity";
import { deriveTodayCommand, findPendingMealOutcome } from "@/lib/todayCommand";
import { getConsumerSurfacePolicy } from "@/lib/consumerSurfacePolicy";

const HOME_PROVIDER_SYNC_ENABLED =
  isClerkEnabledForBuild && getConsumerSurfacePolicy().providerSyncControls;

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

// Device-local flag so the first-run welcome card stays dismissed across
// reloads. It keeps the "woofwatcher" key prefix so the privacy
// erase-all-data flow removes it with every other WoofWatcher key.
const HOME_WELCOME_DISMISSED_KEY = "woofwatcher.homeWelcomeDismissed.v1";

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

function completionLabel(done: number, target: number): string {
  if (!target) return `${done}`;
  return `${Math.min(done, target)}/${target}`;
}

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
  const d = new Date(iso);
  const n = new Date(now);
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
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
  route:
    | "/log"
    | "/health?tab=health"
    | "/health?tab=bile"
    | "/calendar"
    | "/records";
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
  const { width: viewportWidth, height: viewportHeight } =
    useWindowDimensions();
  const router = useRouter();
  const { state, addEntry, deleteEntry, updateEntry, refresh, storageWarning, legacyImport } = useCare();
  // The data-loss warning must reach screen-reader users on every platform.
  useEffect(() => {
    if (storageWarning === "save-failed") {
      announce("Device storage is failing. Recent care logs may not be saved.");
    } else if (storageWarning === "read-failed") {
      announce("Could not read saved care data. Saving is paused this session.");
    } else if (storageWarning === "reset") {
      announce("Saved care data could not be read and was reset. A recovery copy was kept.");
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
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);
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
        petName: resolvePetName(state.profile.name),
        entries: state.entries,
        routines: state.routines,
        caregivers: state.caregivers,
        now,
        energy: status.energy,
        reactionsSince: reactionSessionFloor.current,
      }),
    [state.profile.name, state.entries, state.routines, state.caregivers, now, status.energy],
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

  // Care Sense card derivations - each meter is a presentation of the same
  // real, derived state the old chips carried. Mood maps ordinally (the word
  // stays the source of truth in the value label), hunger reads meals done
  // against target, alone time fills over a four-hour window while an away
  // session is actually open. No invented numbers.
  const careSenseHeadline =
    status.mood === "unwell"
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
        entries: state.entries,
        routines: state.routines,
        caregivers: state.caregivers,
        now,
        providerSyncEnabled: HOME_PROVIDER_SYNC_ENABLED,
      }),
    [state.entries, state.routines, state.caregivers, now],
  );
  const careCareer = useMemo(
    () => deriveCareCareer(state.entries, now),
    [state.entries, now],
  );
  const careStreak = useMemo(
    () => deriveCareStreak(state.entries, now),
    [state.entries, now],
  );
  const todayCommand = useMemo(
    () =>
      deriveTodayCommand(
        {
          profile: state.profile,
          entries: state.entries,
          routines: state.routines,
          caregivers: state.caregivers,
          providerSyncEnabled: HOME_PROVIDER_SYNC_ENABLED,
        },
        now,
      ),
    [state.caregivers, state.entries, state.profile, state.routines, now],
  );

  const petName = resolvePetName(state.profile.name);
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
  const [welcomeDismissed, setWelcomeDismissed] = useState<boolean | null>(
    null,
  );
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(HOME_WELCOME_DISMISSED_KEY)
      .then((raw) => {
        if (!cancelled) setWelcomeDismissed(raw === "true");
      })
      .catch(() => {
        if (!cancelled) setWelcomeDismissed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const dismissWelcome = () => {
    setWelcomeDismissed(true);
    AsyncStorage.setItem(HOME_WELCOME_DISMISSED_KEY, "true").catch(() => {});
  };
  const isFreshStart =
    !hasCaregivers &&
    state.entries.length === 0 &&
    !state.profile.breed?.trim();

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
  // Scroll position for the hero parallax; heroExitStart is measured from
  // the hero wrapper's layout (a huge default keeps parallax off until then).
  const scrollY = useSharedValue(0);
  const heroExitStart = useSharedValue(1_000_000);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const welcomeCollapse = useSharedValue(1);
  const [welcomeCardHeight, setWelcomeCardHeight] = useState(0);
  useEffect(() => {
    if (welcomeShouldShow) {
      welcomeWasShown.current = true;
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
  const welcomeCardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: welcomeCollapse.value,
    ...(welcomeCardHeight > 0
      ? { maxHeight: welcomeCollapse.value * welcomeCardHeight }
      : {}),
  }));
  const welcomeVisible =
    welcomeShouldShow || (welcomeWasShown.current && !welcomeCollapsed);
  const timeLabel = useMemo(
    () => shortTime(new Date(now).toISOString()),
    [now],
  );
  const openAloneSession = useMemo(
    () => findOpenAloneTimeSession(state.entries),
    [state.entries],
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
  const openWalkSession = useMemo(
    () => findOpenWalkSession(state.entries),
    [state.entries],
  );
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
      : "with-human";
  const presenceLabel = openAloneSession
    ? `${petName} Home alone`
    : openWalkSession
      ? `${petName} on a walk`
      : `${petName} with ${caregiver}`;
  const presenceSub = openAloneSession
    ? `${formatDuration(openAloneMinutes)} active - tap I\u2019m Home in Log`
    : openWalkSession
      ? `${formatDuration(openWalkMinutes)} active - tap Finish in Next Up`
      : `At home - ${timeLabel}`;
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
  const fed = meals.target > 0 ? meals.done >= meals.target : true;
  const bondLabel = status.mood === "unwell" ? "Okay" : "Strong";
  const hydrationScore = 72;
  const hungerScore = fed ? 86 : 42;
  const hungerLabel = fed ? "Good" : "Hungry";
  const bondScore = status.mood === "anxious" ? 70 : 92;
  const moodIcon = MOOD_ICON[status.mood];

  // Shared with Today Command: pending meal outcomes stay actionable across
  // the midnight rollover (up to 12h) instead of vanishing at 12:00 AM.
  const pendingMeal = useMemo(
    () => findPendingMealOutcome(state.entries, now),
    [state.entries, now],
  );

  // Session-local snooze: a snoozed routine steps out of Next Up for 30
  // minutes on this device, without touching the Plan schedule itself.
  const [snoozedUntil, setSnoozedUntil] = useState<Record<string, number>>({});

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
    const awakeRoutines = state.routines.filter(
      (r) => (snoozedUntil[r.id] ?? 0) <= now,
    );
    if (awakeRoutines.length) {
      return awakeRoutines.slice(0, 3).map((r) => {
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
    if (state.routines.length) {
      // Everything scheduled is snoozed right now.
      return [];
    }
    return [
      {
        label: hasCaregivers ? `Walk with ${caregiver}` : "Evening walk",
        time: "5:30 PM",
        icon: "walk" as PixelIconName,
        route: homeLogDetailRoute("walk", now),
        meta: "Start",
        kind: "suggestion" as const,
        owner: hasCaregivers ? caregiver : undefined,
      },
      {
        label: "Dinner",
        time: "7:00 PM",
        icon: "meal" as PixelIconName,
        route: homeLogDetailRoute("meal", now),
        meta: "Serve",
        kind: "suggestion" as const,
      },
      {
        label: "Training",
        time: "6:30 PM",
        icon: "training" as PixelIconName,
        route: homeLogDetailRoute("training", now),
        meta: "Log",
        kind: "suggestion" as const,
      },
    ];
  }, [
    openAloneMinutes,
    openAloneSession,
    openWalkMinutes,
    openWalkSession,
    snoozedUntil,
    state.routines,
    caregiver,
    hasCaregivers,
    now,
  ]);

  // Served meal awaiting its outcome: rendered as its own open-loop chip
  // stacked above the planned Next Up item, so closing the meal loop never
  // hides the plan (or the "more in Plan" link) from the hero flow.
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
  const nextCount = Math.max(nextUp.length, 1);
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
      if (index === 0 && item.kind === "routine" && status.minutesUntilNext !== null) {
        return `${item.label} in ${formatDuration(status.minutesUntilNext)}`;
      }
      return `${item.label} ${item.time.includes(" - ") ? "" : "at "}${item.time}`;
    });
    if (!parts.length) return todayCommand.primaryAction.detail;
    return parts.join(" · ");
  }, [nextUp, openWalkSession, status.minutesUntilNext, todayCommand.primaryAction.detail]);

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
      : `With ${caregiver}`;

  const health = status.counts.healthAlert
    ? {
        status: "Needs Watch",
        sub: "Recent symptom logged",
        color: colors.amber,
      }
    : { status: "Stable", sub: "All good right now", color: colors.sage };

  const bileCount = useMemo(
    () =>
      state.entries.filter((e) => {
        if (!isToday(e.occurredAt, now)) return false;
        const t = normalizeCareEventType(e.type, e.details);
        return t === "vomit" || t === "symptom" || /bile/i.test(e.title);
      }).length,
    [state.entries, now],
  );
  const bile =
    bileCount === 0
      ? { status: "Low Risk", sub: "Everything looks good", color: colors.sage }
      : {
          status: "Watch",
          sub: `${bileCount} flagged today`,
          color: colors.amber,
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
          : "Care on track";

  const roomStats = useMemo<PhoenixRoomStat[]>(
    () => [
      {
        label: "Mood",
        value: status.meta.label,
        icon: moodIcon,
        tone:
          status.mood === "unwell"
            ? colors.rose
            : status.mood === "anxious"
              ? colors.amber
              : colors.sage,
        progress:
          status.mood === "unwell" ? 44 : status.mood === "anxious" ? 62 : 92,
      },
      {
        label: "Energy",
        value: `${status.energy}%`,
        icon: "energy",
        tone: colors.sage,
        progress: status.energy,
      },
      {
        label: "Hunger",
        value: hungerLabel,
        icon: "hunger",
        tone: fed ? colors.sage : colors.copper,
        progress: hungerScore,
      },
      {
        label: "Hydration",
        value: "Good",
        icon: "bile",
        tone: colors.blueSignal,
        progress: hydrationScore,
      },
      {
        label: "Bond",
        value: bondLabel,
        icon: "heart",
        tone: colors.rose,
        progress: bondScore,
      },
    ],
    [
      bondLabel,
      bondScore,
      colors.amber,
      colors.blueSignal,
      colors.copper,
      colors.rose,
      colors.sage,
      fed,
      hungerLabel,
      hungerScore,
      hydrationScore,
      moodIcon,
      status.energy,
      status.meta.label,
      status.mood,
    ],
  );

  const aloneMinutes = useMemo(
    () =>
      state.entries
        .filter(
          (e) =>
            isToday(e.occurredAt, now) &&
            normalizeCareEventType(e.type, e.details) === "alone",
        )
        .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0),
    [state.entries, now],
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
      [...state.entries]
        .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
        .slice(0, 3)
        .map((entry) => ({
          id: entry.id,
          title: entry.title,
          time: shortTime(entry.occurredAt),
          icon: routineIcon(entry.type),
          caregiver: entry.caregiver,
        })),
    [state.entries],
  );

  const questLine = careIntelligence.title;
  const adventureMode = useMemo(
    () =>
      deriveAdventureMode({
        petName,
        entries: state.entries,
        memories: state.adventureMemories,
        now,
      }),
    [petName, state.entries, state.adventureMemories, now],
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
      router.push("/health?tab=health" as never);
      return;
    }
    if (target === "diet") {
      router.push("/more?section=diet" as never);
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
      router.push("/health?tab=health" as never);
      return;
    }
    if (target === "bile") {
      router.push("/health?tab=bile" as never);
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
      router.push("/calendar");
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
  const showToast = (
    msg: string,
    feedback?: { id: string; title: string; type: CareEventType },
    holdMs?: number,
  ) => {
    setToast(msg);
    setQuickFeedback(feedback ?? null);
    // The toast is invisible to screen readers and its Undo button vanishes
    // on a timer - announce so the core loop is not silent under VoiceOver.
    announce(feedback ? `${msg}. Undo available.` : msg);
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: Platform.OS !== "web",
    }).start();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(
      () => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 240,
          useNativeDriver: Platform.OS !== "web",
        }).start(() => {
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
      legacyImport.entries === 1 ? "1 care log" : `${legacyImport.entries} care logs`;
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

  const undoQuickFeedback = () => {
    if (!quickFeedback) return;
    const title = quickFeedback.title;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    void deleteEntry(quickFeedback.id);
    setQuickFeedback(null);
    // Clear the room bubble in the same commit: the undone log's "Meal
    // served"/"Walk started" line must not linger over the twin for the
    // rest of its 3.2s timer after the entry is already gone.
    if (roomSpeechTimer.current) clearTimeout(roomSpeechTimer.current);
    setRoomSpeechOverride(null);
    showToast(`${title} undone`);
  };

  const openQuickFeedbackDetails = () => {
    if (!quickFeedback) return;
    const entryId = quickFeedback.id;
    if (toastTimer.current) clearTimeout(toastTimer.current);
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
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    const patch = buildWalkSessionFinishPatch(openWalkSession, {
      caregiver,
      now: Date.now(),
    });
    updateEntry(openWalkSession.id, patch as Partial<Omit<Entry, "id">>);
    showRoomSpeech("Walk completed");
    showToast(
      `Walk completed · ${formatDuration(patch.durationMinutes)} logged · +${careXpForEntry({ ...openWalkSession, details: patch.details })} care XP`,
    );
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
    // A rapid second Walk tap lands before the open session exists in
    // state; it is the same intent, already answered by the first tap.
    if (isDuplicateQuickTap("walk")) return null;
    markQuickSave("walk");
    const entry = buildWalkSessionStartEntry({
      caregiver,
      now,
      routineId: options?.routineId,
      routineLabel: options?.routineLabel,
    });
    const id = addEntry(entry as Omit<Entry, "id">);
    const reactionPlan = describeCareTwinReactionForLog({
      type: "walk",
      label: "Walk",
      title: "Walk started",
      details: entry.details,
    });
    showRoomSpeech(reactionPlan.label);
    showToast("Walk started · care XP lands when you finish", {
      id,
      title: "Walk started",
      type: "walk",
    });
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
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (item.type === "walk") {
      if (openWalkSession) {
        openActiveWalkFromHomeQuickLog();
        return;
      }
      startWalkSessionFromHome();
      return;
    }
    // Dedupe against the same tick (ref) and the saved timeline (shared
    // window): the first tap's entry and toast already answered this tap.
    // The timeline check runs on wall-clock time - the screen's 30s `now`
    // tick would otherwise make a deliberate second log inside the same
    // tick look like a bounce forever.
    if (
      isDuplicateQuickTap(policy.type) ||
      findRecentQuickLogDuplicate(state.entries, item.type, Date.now())
    ) {
      return;
    }
    markQuickSave(policy.type);
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
    const reactionPlan = describeCareTwinReactionForLog({
      type: entry.type,
      label: item.label,
      title: entry.title,
      mood: entry.mood,
      severity: entry.severity,
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
    router.push("/portrait");
  };

  // Today's Story: one honest sentence from the day's real log evidence.
  const todayStoryLine = useMemo(() => {
    const todayKey = new Date(now).toDateString();
    const todaysEntries = state.entries.filter(
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
  }, [now, petName, state.entries]);

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
  const heroDesignHeight = Math.round(
    heroStageWidth / homeFirstScreenLayout.heroAspectRatio,
  );
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
  // Storybook depth: once the room's top edge passes the viewport top, the
  // scene drifts down inside its clipped frame (scrolling away ~16% slower)
  // and dims a touch - the page recedes instead of just leaving. Gap-free by
  // construction: the translation only starts after the frame's top is
  // offscreen, so the seam it opens is never visible. Reduce Motion keeps
  // the room fixed.
  const heroParallaxStyle = useAnimatedStyle(() => {
    if (reducedMotion) return { transform: [{ translateY: 0 }], opacity: 1 };
    const height = Math.max(1, heroStageHeight);
    const progress = Math.min(
      Math.max((scrollY.value - heroExitStart.value) / height, 0),
      1,
    );
    return {
      transform: [{ translateY: progress * height * 0.16 }],
      opacity: 1 - progress * 0.18,
    };
  });
  const fade = useRef(new Animated.Value(isWebRoutePreview ? 1 : 0)).current;
  useEffect(() => {
    if (isWebRoutePreview) return;
    Animated.timing(fade, {
      toValue: 1,
      duration: 450,
      useNativeDriver: !isWebRoutePreview,
    }).start();
  }, [fade, isWebRoutePreview]);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Full-bleed storybook backdrop from the mock boards: the scene fills
          the whole screen top to bottom. The dog's traffic area is the top
          band; a soft scrim quiets the lower floor so the floating console
          stays legible while the background still peeks through. */}
      <Image
        accessible={false}
        source={
          openWalkSession
            ? colors.isDark || homeImmersiveRoomIsNight(new Date(now).getHours())
              ? HOME_IMMERSIVE_PARK_NIGHT
              : HOME_IMMERSIVE_PARK_DAY
            : colors.isDark || homeImmersiveRoomIsNight(new Date(now).getHours())
              ? HOME_IMMERSIVE_ROOM_NIGHT
              : HOME_IMMERSIVE_ROOM_DAY
        }
        resizeMode="cover"
        style={s.fullBleedArt}
        fadeDuration={0}
      />
      {colors.isDark ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(9,17,32,0.16)" }]}
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
      <Reanimated.ScrollView
        style={s.container}
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          paddingHorizontal: routeHorizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <Animated.View style={{ opacity: fade }}>
          <View style={[s.header, { backgroundColor: colors.card }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${petName}. ${careStatusLabel}. Open profile`}
              accessibilityHint={`Opens ${petName}'s profile.`}
              onPress={() => router.push("/profile" as never)}
              hitSlop={MOBILE_INLINE_HIT_SLOP}
              style={({ pressed }) => [s.identityWrap, { opacity: pressed ? 0.75 : 1 }]}
            >
              <PetPortrait size={42} />
              <View style={s.identityCopy}>
                <View style={s.identityNameRow}>
                  <Text
                    numberOfLines={1}
                    style={[s.identityName, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}
                  >
                    {petName}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
                </View>
                <View style={s.identityCareLine}>
                  <Ionicons
                    name="heart"
                    size={13}
                    color={watchSignalCount > 0 ? colors.amber : colors.forest}
                  />
                  <Text
                    numberOfLines={1}
                    style={[s.identityCareText, { color: watchSignalCount > 0 ? colors.amber : colors.forest, fontFamily: "Inter_700Bold" }]}
                  >
                    {careLine}
                  </Text>
                </View>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open the Pack"
              accessibilityHint="Opens pets and people who share the care."
              onPress={() => router.push("/pack" as never)}
              hitSlop={MOBILE_INLINE_HIT_SLOP}
              style={[
                s.headerButton,
                { borderColor: "transparent", backgroundColor: "transparent" },
              ]}
            >
              <Ionicons name="people-outline" size={24} color={colors.foreground} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open reminders"
              accessibilityHint={
                watchSignalCount > 0
                  ? `${watchSignalCount} ${watchSignalCount === 1 ? "signal needs" : "signals need"} attention`
                  : "Upcoming care reminders"
              }
              onPress={() => router.push("/reminders" as never)}
              hitSlop={MOBILE_INLINE_HIT_SLOP}
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
                  <Text style={[s.badgeText, { fontFamily: "Inter_700Bold" }]}>
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
                if (welcomeShouldShow && measured > 0) {
                  setWelcomeCardHeight((prev) => Math.max(prev, measured));
                }
              }}
              style={[{ overflow: "hidden" }, welcomeCardAnimatedStyle]}
            >
            <View style={[s.welcomeCard, s.softShadow, { backgroundColor: colors.forest }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss welcome"
                hitSlop={MOBILE_INLINE_HIT_SLOP}
                onPress={dismissWelcome}
                style={s.welcomeDismiss}
              >
                <Ionicons name="close" size={16} color={colors.primaryForeground} />
              </Pressable>
              <Text style={[s.welcomeKicker, { color: colors.amberSoft, fontFamily: "Fredoka_600SemiBold" }]}>
                WELCOME TO WOOFWATCHER
              </Text>
              <Text style={[s.welcomeTitle, { color: colors.primaryForeground, fontFamily: "Fraunces_700Bold" }]}>
                Let's make {petName} yours
              </Text>
              <Text style={[s.welcomeBody, { color: colors.primaryForeground, fontFamily: "Inter_500Medium" }]}>
                Add your dog's name, breed, and routines so Today, Log, and Records fit your real day. It takes a minute.
              </Text>
              <View style={s.welcomeActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Set up ${petName}`}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    router.push("/setup" as never);
                  }}
                  style={({ pressed }) => [
                    s.welcomePrimary,
                    { backgroundColor: colors.primaryForeground, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={[s.welcomePrimaryText, { color: colors.forest, fontFamily: "Inter_800ExtraBold" }]}>
                    Set up {petName}
                  </Text>
                  <Ionicons name="arrow-forward" size={15} color={colors.forest} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Explore first"
                  onPress={dismissWelcome}
                  style={({ pressed }) => [s.welcomeGhost, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[s.welcomeGhostText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
                    Explore first
                  </Text>
                </Pressable>
              </View>
            </View>
            </Reanimated.View>
          ) : null}

          {/* The room is a framed storybook card: day/night art fills the
              frame and the living twin roams inside it, matching Apollo's
              storybook mockup Home. On short phones the stage height is
              clamped (uniform scale) and it stays folded while the first-run
              welcome card is up, growing in as the card folds away. */}
          <Reanimated.View
            pointerEvents={heroDeferredForWelcome ? "none" : "auto"}
            onLayout={(event) => {
              // Where the hero's top crosses the viewport top: its offset in
              // the scroll content (the fade wrapper starts at the content
              // top) plus the container's top padding.
              heroExitStart.value = topPadding + event.nativeEvent.layout.y;
            }}
            style={
              heroDeferredForWelcome
                ? [{ overflow: "hidden" }, welcomeHeroAnimatedStyle]
                : null
            }
          >
          <View style={s.heroBackdrop}>
            <View
              accessibilityLabel={`${petName} Room`}
              accessibilityHint={homeFirstScreenLayout.qaLabel}
              style={[
                s.heroWrap,
                { height: heroStageHeight, overflow: "hidden" },
              ]}
            >
             <Reanimated.View style={heroParallaxStyle}>
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
                onPress={tapPhoenixRoom}
                onLongPress={openAvatarStudio}
                accessibilityHint="Tap for a care-twin reaction. Long press to open Avatar Studio."
              />
            </View>
            </Reanimated.View>
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
                  borderColor: colors.brandNavy,
                },
              ]}
            >
              <Ionicons name="color-wand-outline" size={17} color={colors.brandNavy} />
            </Pressable>
          </View>
          </View>
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
                { backgroundColor: colors.amberSoft, borderColor: colors.amber + "66" },
              ]}
            >
              <Ionicons name="warning-outline" size={17} color={colors.amber} />
              <Text style={[s.storageWarningText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {storageWarning === "save-failed"
                  ? "Device storage is failing - new care logs may not survive an app restart."
                  : storageWarning === "read-failed"
                    ? "Couldn't read saved care data. Saving is paused this session to protect what's stored."
                    : "Saved care data couldn't be read and was reset. A recovery copy was kept on this device."}
              </Text>
            </View>
          ) : null}

          {/* Mock-board Care Sense card: mood, energy, hunger, and alone
              time as chunky pip meters. Every fill derives from real logged
              care - the same truth the old chips carried, now at a glance.
              The headline row is still the Today Command surface. */}
          <Reanimated.View entering={enterUp(0)}>
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
                    hitSlop={MOBILE_INLINE_HIT_SLOP}
                    onPress={() => router.push("/trends" as never)}
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
                    <Ionicons name="chevron-forward" size={13} color={colors.sage} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="How Care Sense works"
                    hitSlop={MOBILE_INLINE_HIT_SLOP}
                    onPress={() =>
                      notifyDialog(
                        "Care Sense",
                        `Every meter reads from real logged care only. Mood and energy derive from today's walks, meals, potty, and notes. Hunger tracks meals against ${petName}'s daily target. Alone Time fills while an away session is open. Nothing here is invented.`,
                      )
                    }
                    style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
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
                accessibilityLabel={`Today Command. ${petName} is ${homeMoodWord}. ${glanceLine}`}
                accessibilityHint="Opens the exact care workflow behind today's recommended action."
                hitSlop={MOBILE_INLINE_HIT_SLOP}
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
                    numberOfLines={1}
                    style={[
                      s.careSenseHeadline,
                      { color: colors.foreground, fontFamily: "Fredoka_700Bold" },
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
                    {petName} is {homeMoodWord}. {glanceLine}
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
                  value={careSenseMoodRatio}
                  valueLabel={status.meta.label}
                  tone={colors.meterMood}
                  onPress={() =>
                    router.push(todayCommand.primaryAction.route as never)
                  }
                  accessibilityLabel={`Mood ${status.meta.label}`}
                  accessibilityHint="Opens today's recommended care workflow."
                />
                <StatusMeter
                  label="Energy"
                  icon="energy"
                  value={status.energy / 100}
                  valueLabel={`${status.energy}%`}
                  tone={colors.meterEnergy}
                  onPress={() =>
                    router.push(homeLogDetailRoute("walk", now) as never)
                  }
                  accessibilityLabel={`Energy ${status.energy} percent`}
                  accessibilityHint="Opens the walk detail flow - activity builds energy."
                />
                <StatusMeter
                  label="Hunger"
                  icon="hunger"
                  value={careSenseMealsRatio}
                  valueLabel={`${status.counts.meals.done}/${Math.max(
                    status.counts.meals.target,
                    status.counts.meals.done,
                  )}`}
                  tone={colors.meterHunger}
                  onPress={() =>
                    router.push(homeLogDetailRoute("meal", now) as never)
                  }
                  accessibilityLabel={`Meals ${status.counts.meals.done} of ${status.counts.meals.target} logged`}
                  accessibilityHint="Opens the meal detail flow."
                />
                <StatusMeter
                  label="Alone"
                  icon="clock"
                  value={careSenseAloneRatio}
                  polarity="inverse"
                  valueLabel={
                    openAloneSession ? formatDuration(openAloneMinutes) : "OK"
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
                      : "Alone time none logged today"
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
            <Reanimated.View entering={enterUp(1)}>
              <BoardCard style={s.quickHomeCard}>
                <View style={s.quickSectionHeader}>
                  <Text
                    style={[
                      s.quickSectionTitle,
                      { color: colors.foreground, fontFamily: "Fredoka_700Bold" },
                    ]}
                  >
                    Quick Log
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open full Quick Log"
                    hitSlop={MOBILE_INLINE_HIT_SLOP}
                    onPress={() => router.push("/log")}
                    style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
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
                        <BoardMedallion name={item.icon} size={54} style={s.softShadow} />
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
                          { color: colors.navy, fontFamily: "Inter_600SemiBold" },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </PressScale>
                  ))}
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel="More quick log options"
                    accessibilityHint="Opens the fast log sheet with water, notes, and every other care lane."
                    onPress={() => router.push("/fastlog" as never)}
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
                      More
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
                    accessibilityLabel={`Open Plan. 1 of ${nextCount} next up.`}
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
                    style={[s.nextButton, { backgroundColor: colors.primary }]}
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
                        { color: colors.foreground, fontFamily: "Fredoka_600SemiBold" },
                      ]}
                    >
                      {nextPrimary.label}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[
                        s.nextPrimaryMeta,
                        { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
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
                            if (Platform.OS !== "web") {
                              Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Light,
                              );
                            }
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
                        <Text style={[s.nextButtonText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
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
                                backgroundColor: pressed ? colors.muted : colors.secondary,
                              },
                            ]}
                          >
                            <Text style={[s.nextButtonText, { color: colors.navy, fontFamily: "Inter_600SemiBold" }]}>
                              Snooze
                            </Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Reassign ${nextPrimary.label} in Plan`}
                            accessibilityHint="Opens the Plan tab, where routines and owners are edited."
                            onPress={() => router.push("/calendar")}
                            style={({ pressed }) => [
                              s.nextButton,
                              s.nextButtonSoft,
                              {
                                backgroundColor: pressed ? colors.muted : colors.secondary,
                              },
                            ]}
                          >
                            <Text style={[s.nextButtonText, { color: colors.navy, fontFamily: "Inter_600SemiBold" }]}>
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
                    { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  Everything scheduled is snoozed. It returns in 30 minutes, or
                  open Plan to review.
                </Text>
              )}
              {nextUp.length > 1 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${nextUp.length - 1} more planned ${nextUp.length - 1 === 1 ? "item" : "items"} in Plan`}
                  onPress={() => router.push("/calendar")}
                  style={({ pressed }) => [s.nextMoreRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text
                    style={[
                      s.nextMoreText,
                      { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    {nextUp.length - 1} more in Plan
                  </Text>
                  <Ionicons name="chevron-forward" size={13} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </BoardCard>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Today's Story. ${todayStoryLine} Open Story.`}
            accessibilityHint={`Opens ${petName}'s living story.`}
            onPress={() => router.push("/story" as never)}
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
              accessible={false}
              source={require("@/assets/board/hero.png")}
              style={[s.todayStoryThumb, { borderColor: colors.border }]}
              resizeMode="cover"
            />
            <View style={s.todayStoryCopy}>
              <Text
                style={[
                  s.todayStoryKicker,
                  { color: colors.sage, fontFamily: "Inter_700Bold", letterSpacing: 1.1, textTransform: "uppercase", fontSize: 9 },
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
                  <View style={[s.todayStoryChip, { backgroundColor: colors.amberSoft }]}>
                    <Text style={[s.todayStoryChipText, { color: colors.amber, fontFamily: "Inter_700Bold" }]}>
                      +{careCareer.todayXp} XP
                    </Text>
                  </View>
                ) : null}
                {careStreak >= 2 ? (
                  <View style={[s.todayStoryChip, { backgroundColor: colors.sageSoft }]}>
                    <Text style={[s.todayStoryChipText, { color: colors.forest, fontFamily: "Inter_700Bold" }]}>
                      {careStreak}-day streak
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
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
                numberOfLines={1}
                style={[
                  s.presenceText,
                  { color: colors.navy, fontFamily: "Inter_700Bold" },
                ]}
              >
                {openAloneSession
                  ? `${petName} is home alone`
                  : openWalkSession
                    ? `${petName} is on a walk`
                    : `${petName} is with ${caregiver}`}
              </Text>
              <Text
                numberOfLines={1}
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
              the presence pill, the Bond meter, and the diet-profile door.
              Mood/energy/hunger live in the Care Sense card up top - one
              meters surface, exactly like the mock boards. */}
          <BoardCard style={s.careStatusCard}>
            <BoardSectionHeader
              title="Care Status"
              accessory={<BoardPill label={careStatusLabel} tone={careStatusTone} />}
            />
            <StatusMeter
              label="Bond"
              icon="heart"
              value={bondScore / 100}
              valueLabel={bondLabel}
              tone={colors.rose}
              onPress={() => openStatusTile("bond")}
              accessibilityLabel={`Bond ${bondLabel}`}
              accessibilityHint="Opens play details - shared play grows the bond."
            />
            <CareRow
              icon="meal"
              title="Diet profile"
              detail="Meals, portions, and sensitivities on file"
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
              <View style={[s.careerBadge, { backgroundColor: colors.amberSoft, borderColor: colors.amber }]}>
                <Text style={[s.careerBadgeKicker, { color: colors.amber, fontFamily: "Inter_800ExtraBold" }]}>
                  LV
                </Text>
                <Text style={[s.careerBadgeLevel, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}>
                  {careCareer.level}
                </Text>
              </View>
              <View style={s.careerBody}>
                <View style={s.careerTitleRow}>
                  <Text
                    numberOfLines={1}
                    style={[s.careerTitle, { color: colors.navy, fontFamily: "Fredoka_600SemiBold" }]}
                  >
                    {careCareer.title}
                  </Text>
                  {careCareer.todayXp > 0 ? (
                    <Text style={[s.careerToday, { color: colors.sage, fontFamily: "Inter_800ExtraBold" }]}>
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
                <Text style={[s.careerXp, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                  {careCareer.levelXp.toLocaleString()} / {careCareer.levelSpanXp.toLocaleString()} XP ·{" "}
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
                          numberOfLines={1}
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
                            numberOfLines={1}
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
                        numberOfLines={1}
                        style={[
                          s.missionRowTitle,
                          { fontFamily: "Fredoka_700Bold" },
                        ]}
                      >
                        {mission.title}
                      </Text>
                      <Text
                        numberOfLines={missionLayout.detailLines}
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
                    {completionLabel(meals.done, meals.target || 2)}
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
                    {completionLabel(
                      status.counts.potty.done,
                      status.counts.potty.target || 3,
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
                    { color: colors.sage, fontFamily: "Inter_700Bold", letterSpacing: 1.1, textTransform: "uppercase", fontSize: 9 },
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
              onPress={() => router.push("/adventure" as never)}
              style={({ pressed }) => [
                s.adventureInline,
                {
                  backgroundColor: pressed ? colors.secondary : colors.background,
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
                onPress={undoQuickFeedback}
                style={({ pressed }) => [
                  s.toastAction,
                  {
                    backgroundColor: pressed
                      ? "rgba(255,249,239,0.16)"
                      : "rgba(255,249,239,0.1)",
                    borderColor: "rgba(255,249,239,0.34)",
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
                onPress={openQuickFeedbackDetails}
                style={({ pressed }) => [
                  s.toastAction,
                  {
                    backgroundColor: pressed
                      ? colors.copper + "DD"
                      : colors.copper,
                    borderColor: colors.copper,
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
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  badgeText: { color: "#FFFFFF", fontSize: 10 },
  identityWrap: {
    flex: 1,
    minWidth: 0,
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
    width: 40,
    height: 40,
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
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    // The card's text stack renders after this absolute button, so without
    // an explicit z-order the full-width kicker Text sits on top and eats
    // every tap - the X looked tappable but was dead.
    zIndex: 5,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  welcomeKicker: {
    fontSize: 11,
    letterSpacing: 1.3,
    marginBottom: 4,
  },
  welcomeTitle: {
    fontSize: 22,
    marginBottom: 6,
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
    alignItems: "center",
    gap: 10,
  },
  welcomePrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  welcomePrimaryText: {
    fontSize: 14,
  },
  welcomeGhost: {
    paddingHorizontal: 10,
    paddingVertical: 11,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
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
    gap: 8,
    marginTop: 10,
  },
  nextButton: {
    minHeight: 34,
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

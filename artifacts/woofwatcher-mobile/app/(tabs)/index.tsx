import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
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

import {
  BoardCard,
  BoardPill,
  BoardSectionHeader,
  CareRow,
  QuickActionTile,
  StatusMeter,
} from "@/components/board/BoardPrimitives";
import {
  LivingPhoenixRoom,
  type PhoenixRoomReaction,
  type PhoenixRoomStat,
} from "@/components/LivingPhoenixRoom";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { useAvatar } from "@/context/AvatarContext";
import { useCare, type Entry } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { getAvatarTemplate } from "@/lib/avatarStudio";
import {
  getFloatingTabChromeMetrics,
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import { deriveAvatarMotion } from "@/lib/avatarMotion";
import { deriveCareTwinScene } from "@/lib/avatarLifeEngine";
import { deriveCareTwinChoreography } from "@/lib/careTwinChoreography";
import {
  describeCareTwinReactionForLog,
  type CareTwinReactionToneRole,
} from "@/lib/careTwinReactionPolicy";
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
import { buildQuickLogEntry, getQuickLogPolicy } from "@/lib/quickLogEntry";
import {
  buildWalkSessionStartEntry,
  findOpenWalkSession,
} from "@/lib/walkSession";
import { derivePhoenixStatus, type Mood } from "@/lib/phoenixStatus";
import { deriveTodayCommand, type TodayCommandIcon } from "@/lib/todayCommand";

interface QuickItem {
  key: string;
  icon: PixelIconName;
  label: string;
  type: CareEventType;
  title: string;
  mood?: string;
  severity?: string;
  route?: "/log";
}

type StatusTileTarget = "mood" | "health" | "diet" | "bond";
type TodayMetricTarget = "activity" | "meals" | "potty";
type PhoenixStatusMeterTarget =
  | "energy"
  | "hunger"
  | "hydration"
  | "bile"
  | "bond";
type HomeWatchTarget = "health" | "bile" | "alone";
type HomePresenceRoute =
  | "/more?section=household"
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
const HOME_IMMERSIVE_ROOM_DAY = require("@/assets/avatar/rooms/phoenix-room-storybook-day.png");
const HOME_IMMERSIVE_ROOM_NIGHT = require("@/assets/avatar/rooms/phoenix-room-storybook-night.png");

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

const HOME_QUICK_LOG: QuickItem[] = [
  { key: "meal", icon: "meal", label: "Meal", type: "meal", title: "Meal" },
  { key: "walk", icon: "walk", label: "Walk", type: "walk", title: "Walk" },
  { key: "potty", icon: "pee", label: "Potty", type: "potty", title: "Potty" },
  {
    key: "water",
    icon: "bile",
    label: "Water",
    type: "water",
    title: "Fresh water",
  },
  {
    key: "training",
    icon: "training",
    label: "Training",
    type: "training",
    title: "Training win",
  },
  {
    key: "treat",
    icon: "treat",
    label: "Treat",
    type: "treat",
    title: "Treat",
  },
  {
    key: "play",
    icon: "play",
    label: "Play",
    type: "play",
    title: "Play session",
  },
  {
    key: "more",
    icon: "note",
    label: "More",
    type: "note",
    title: "Open quick log",
    route: "/log",
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

function isPendingMealLog(entry: { type: string; details?: unknown }): boolean {
  const details = careDetails(entry.details);
  if (normalizeCareEventType(entry.type, details) !== "meal") return false;
  const completion = String(detailValue(entry.details, "mealCompletion") ?? "");
  const lifecycle = String(detailValue(entry.details, "mealLifecycle") ?? "");
  return (
    lifecycle === "outcome-pending" ||
    completion === "served" ||
    completion === "grazing"
  );
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

function todayCommandPixelIcon(icon: TodayCommandIcon): PixelIconName {
  if (icon === "bowl") return "meal";
  if (icon === "paw") return "walk";
  if (icon === "drop") return "bile";
  if (icon === "star") return "training";
  if (icon === "heart") return "heart";
  if (icon === "bone") return "treat";
  if (icon === "candy") return "play";
  if (icon === "bolt") return "energy";
  if (icon === "sad") return "anxious";
  if (icon === "vomit") return "vomit";
  if (icon === "house") return "clock";
  if (icon === "scale") return "health";
  if (icon === "pill") return "medication";
  return "note";
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
  const { state, addEntry, deleteEntry, refresh } = useCare();
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
  const avatarMotion = useMemo(
    () =>
      deriveAvatarMotion({
        entries: state.entries,
        routines: state.routines,
        caregivers: state.caregivers,
        now,
        energy: status.energy,
      }),
    [state.entries, state.routines, state.caregivers, now, status.energy],
  );
  const careIntelligence = useMemo(
    () =>
      deriveCareIntelligence({
        entries: state.entries,
        routines: state.routines,
        caregivers: state.caregivers,
        now,
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
        },
        now,
      ),
    [state.caregivers, state.entries, state.profile, state.routines, now],
  );

  const petName =
    state.profile.name && state.profile.name !== "My Dog"
      ? state.profile.name
      : "Phoenix";
  const avatarTemplate = useMemo(
    () => getAvatarTemplate(avatarConfig.templateId),
    [avatarConfig.templateId],
  );
  const caregiver = state.caregivers[0]?.name ?? "Emma";
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
      ? `${formatDuration(openWalkMinutes)} active - finish in Log`
      : `At home - ${timeLabel}`;
  const presenceRoute: HomePresenceRoute = openAloneSession
    ? openAloneSession.id
      ? homeLogEntryRoute(openAloneSession.id)
      : homeLogDetailRoute("alone", now)
    : openWalkSession
      ? openWalkSession.id
        ? homeLogEntryRoute(openWalkSession.id)
        : homeLogDetailRoute("walk", now)
      : "/more?section=household";
  const presenceActionHint = openAloneSession
    ? "Opens the active Alone Time log so you can complete the return check-in."
    : openWalkSession
      ? "Opens the active walk log so you can finish or edit the walk."
      : "Opens Household Pulse and care-team status in More.";

  const meals = status.counts.meals;
  const fed = meals.target > 0 ? meals.done >= meals.target : true;
  const bondLabel = status.mood === "unwell" ? "Okay" : "Strong";
  const hydrationScore = 72;
  const hungerScore = fed ? 86 : 42;
  const hungerLabel = fed ? "Good" : "Hungry";
  const bondScore = status.mood === "anxious" ? 70 : 92;
  const moodIcon = MOOD_ICON[status.mood];

  const pendingMeal = useMemo(
    () =>
      [...state.entries]
        .filter(
          (entry) => isToday(entry.occurredAt, now) && isPendingMealLog(entry),
        )
        .sort(
          (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
        )[0] ?? null,
    [state.entries, now],
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
        },
      ];
    }
    if (openWalkSession) {
      return [
        {
          label: "Walk active",
          time: `${formatDuration(openWalkMinutes)} - finish in Log`,
          icon: "walk" as PixelIconName,
          route: openWalkSession.id
            ? homeLogEntryRoute(openWalkSession.id)
            : homeLogDetailRoute("walk", now),
          meta: "Finish",
        },
      ];
    }
    if (pendingMeal) {
      const label = pendingMeal.title.split(" - ")[0] || "Meal";
      return [
        {
          label: `${label} served`,
          time: "Outcome pending",
          icon: "meal" as PixelIconName,
          route: pendingMeal.id
            ? homeLogEntryRoute(pendingMeal.id)
            : homeLogDetailRoute("meal", now),
          meta: "Update",
        },
      ];
    }
    if (state.routines.length) {
      return state.routines.slice(0, 3).map((r) => {
        const routineType = normalizeCareEventType(r.type ?? "note");
        return {
          label: r.label,
          time: r.time,
          icon: routineIcon(routineType),
          route: "/calendar" as const,
          meta: "Plan",
        };
      });
    }
    return [
      {
        label: `Walk with ${caregiver}`,
        time: "5:30 PM",
        icon: "walk" as PixelIconName,
        route: homeLogDetailRoute("walk", now),
        meta: "Start",
      },
      {
        label: "Dinner",
        time: "7:00 PM",
        icon: "meal" as PixelIconName,
        route: homeLogDetailRoute("meal", now),
        meta: "Serve",
      },
      {
        label: "Training",
        time: "6:30 PM",
        icon: "training" as PixelIconName,
        route: homeLogDetailRoute("training", now),
        meta: "Log",
      },
    ];
  }, [
    openAloneMinutes,
    openAloneSession,
    openWalkMinutes,
    openWalkSession,
    pendingMeal,
    state.routines,
    caregiver,
    now,
  ]);

  const nextPrimary = nextUp[0];
  const nextCount = Math.max(nextUp.length, 1);
  const nextMeta = pendingMeal
    ? "Open meal"
    : openAloneSession
      ? "I'm Home"
      : openWalkSession
        ? "Finish walk"
        : status.minutesUntilNext !== null
          ? `In ${formatDuration(status.minutesUntilNext)}`
          : (nextPrimary?.time ?? "Ready");
  const nextDetail = pendingMeal
    ? "Outcome pending - update when Phoenix finishes"
    : openAloneSession
      ? `${formatDuration(openAloneMinutes)} active - log return`
      : openWalkSession
        ? `${formatDuration(openWalkMinutes)} active - finish in Log`
        : status.minutesUntilNext !== null
          ? `${nextMeta} - ${nextPrimary?.time ?? "Scheduled"}`
          : (nextPrimary?.time ?? "Ready when you are");
  const nextUpRoute = nextPrimary?.route ?? "/calendar";
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

  const careProgress = careIntelligence.score;
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

  const statusTiles = [
    {
      label: "Happiness",
      value: status.meta.label,
      icon: "happy" as PixelIconName,
      tone: colors.amber,
      target: "mood" as StatusTileTarget,
      actionLabel: "Open mood details",
      progress: undefined as number | undefined,
    },
    {
      label: "Energy",
      value: `${status.energy}%`,
      icon: "energy" as PixelIconName,
      tone: colors.sage,
      target: "health" as StatusTileTarget,
      actionLabel: "Open Health Watch",
      progress: status.energy as number | undefined,
    },
    {
      label: "Hunger",
      value: hungerLabel,
      icon: "hunger" as PixelIconName,
      tone: fed ? colors.sage : colors.copper,
      target: "diet" as StatusTileTarget,
      actionLabel: "Open Diet Profile",
      progress: hungerScore as number | undefined,
    },
    {
      label: "Bond",
      value: bondLabel,
      icon: "heart" as PixelIconName,
      tone: colors.rose,
      target: "bond" as StatusTileTarget,
      actionLabel: "Open play details",
      progress: bondScore as number | undefined,
    },
  ];
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

  const openPhoenixStatusMeter = (target: PhoenixStatusMeterTarget) => {
    void Haptics.selectionAsync();
    if (target === "energy") {
      router.push("/health?tab=health" as never);
      return;
    }
    if (target === "bile") {
      router.push("/health?tab=bile" as never);
      return;
    }
    if (target === "hunger") {
      router.push(`/log?type=meal&detail=1&intent=${Date.now()}` as never);
      return;
    }
    if (target === "hydration") {
      router.push(`/log?type=water&detail=1&intent=${Date.now()}` as never);
      return;
    }
    router.push(`/log?type=play&detail=1&intent=${Date.now()}` as never);
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
              : "Build a vet, sitter, or trainer packet from Phoenix's care history",
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
  const missionLayout = useMemo(
    () =>
      getHomeMissionDeckLayout({
        width: viewportWidth,
        missionCount: homeMissions.length,
      }),
    [homeMissions.length, viewportWidth],
  );

  const missionToneColor = (tone: HomeMissionTone) => {
    if (tone === "copper") return colors.copper;
    if (tone === "amber") return colors.amber;
    if (tone === "rose") return colors.rose;
    if (tone === "navy") return colors.blueSignal;
    return colors.sage;
  };
  const reactionToneColor = (tone: CareTwinReactionToneRole) => {
    if (tone === "health") return colors.rose;
    if (tone === "reward") return colors.copper;
    if (tone === "hydration") return colors.blueSignal;
    if (tone === "soft") return colors.sage;
    return colors.brandNavy;
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
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (
    msg: string,
    feedback?: { id: string; title: string; type: CareEventType },
  ) => {
    setToast(msg);
    setQuickFeedback(feedback ?? null);
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
      feedback ? 5200 : 1400,
    );
  };
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const undoQuickFeedback = () => {
    if (!quickFeedback) return;
    const title = quickFeedback.title;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    void deleteEntry(quickFeedback.id);
    setQuickFeedback(null);
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

  const logQuick = (item: QuickItem) => {
    if (item.route) {
      router.push(item.route);
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
      const entry = buildWalkSessionStartEntry({ caregiver, now });
      const id = addEntry(entry as Omit<Entry, "id">);
      const reactionPlan = describeCareTwinReactionForLog({
        type: "walk",
        label: "Walk",
        title: "Walk started",
        details: entry.details,
      });
      setRoomReaction({
        id: Date.now(),
        icon: reactionPlan.icon,
        label: reactionPlan.label,
        detail: reactionPlan.detail,
        tone: reactionToneColor(reactionPlan.toneRole),
        spriteAction: reactionPlan.spriteAction,
      });
      showToast(`Walk started · +${careXpForEntry(entry)} care XP`, {
        id,
        title: "Walk started",
        type: "walk",
      });
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
    const reactionPlan = describeCareTwinReactionForLog({
      type: entry.type,
      label: item.label,
      title: entry.title,
      mood: entry.mood,
      severity: entry.severity,
      details: entry.details,
    });
    setRoomReaction({
      id: Date.now(),
      icon: reactionPlan.icon,
      label: reactionPlan.label,
      detail:
        avatarMotion.cue === "health-watch" &&
        reactionPlan.toneRole !== "health"
          ? "Main Phoenix stays gentle while health context remains visible."
          : reactionPlan.detail,
      tone: reactionToneColor(reactionPlan.toneRole),
      spriteAction: reactionPlan.spriteAction,
    });
    showToast(`${item.title} logged · +${careXpForEntry(entry)} care XP`, {
      id,
      title: item.title,
      type: item.type,
    });
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
      <ScrollView
        style={s.container}
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          paddingHorizontal: routeHorizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade }}>
          <View style={[s.header, { backgroundColor: colors.card }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${petName}. ${careStatusLabel}. Open the Pack`}
              accessibilityHint="Opens pets and people who share the care."
              onPress={() => router.push("/pack" as never)}
              hitSlop={MOBILE_INLINE_HIT_SLOP}
              style={({ pressed }) => [s.identityWrap, { opacity: pressed ? 0.75 : 1 }]}
            >
              <Image
                source={require("@/assets/images/phoenix-avatar.png")}
                style={[s.identityAvatar, { borderColor: colors.border, backgroundColor: colors.secondary }]}
              />
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
                <View style={[s.identityChip, { backgroundColor: colors.sageSoft }]}>
                  <View style={[s.identityDot, { backgroundColor: colors.forest }]} />
                  <Text
                    numberOfLines={1}
                    style={[s.identityChipText, { color: colors.forest, fontFamily: "Inter_700Bold" }]}
                  >
                    {careStatusLabel}
                  </Text>
                </View>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open More"
              onPress={() => router.push("/more")}
              hitSlop={MOBILE_INLINE_HIT_SLOP}
              style={[
                s.headerButton,
                { borderColor: "transparent", backgroundColor: "transparent" },
              ]}
            >
              <Ionicons name="menu" size={25} color={colors.foreground} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Health Watch"
              accessibilityHint={
                watchSignalCount > 0
                  ? `${watchSignalCount} ${watchSignalCount === 1 ? "signal needs" : "signals need"} attention`
                  : "No active signals"
              }
              onPress={() => router.push("/health?tab=health" as never)}
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

          {/* The room is a framed storybook card: day/night art fills the
              frame and the living twin roams inside it, matching Apollo's
              storybook mockup Home. */}
          <View style={[s.heroBackdrop, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Image
              source={
                homeImmersiveRoomIsNight(new Date(now).getHours())
                  ? HOME_IMMERSIVE_ROOM_NIGHT
                  : HOME_IMMERSIVE_ROOM_DAY
              }
              resizeMode="cover"
              // Explicit size: react-native-web falls back to the asset's
              // intrinsic dimensions without it and blows the card open.
              style={[StyleSheet.absoluteFill, s.heroRoomArt]}
              fadeDuration={0}
            />
            <View
              accessibilityLabel="Phoenix Room"
              accessibilityHint={homeFirstScreenLayout.qaLabel}
              style={[
                s.heroWrap,
                { aspectRatio: homeFirstScreenLayout.heroAspectRatio },
              ]}
            >
              <LivingPhoenixRoom
                mood={avatarMotion.avatarMood}
                motion={avatarMotion}
                speech={avatarMotion.speech || SPEECH_BY_MOOD[status.mood]}
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
                chromeDensity="compact"
                transparentScene
                onPress={tapPhoenixRoom}
                onLongPress={openAvatarStudio}
                accessibilityHint="Tap for a care-twin reaction. Long press to open Avatar Studio."
              />
            </View>
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
              <Ionicons name="color-wand-outline" size={17} color={colors.forest} />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${presenceLabel}. Presence state ${presenceState}`}
            accessibilityHint={presenceActionHint}
            onPress={openPresencePanel}
            style={[
              s.presencePanel,
              {
                width: `${homeFirstScreenLayout.presencePanelWidthPercent}%`,
                minHeight: homeFirstScreenLayout.presencePanelMinHeight,
                marginTop: -homeFirstScreenLayout.presencePanelOverlap,
                marginBottom: homeFirstScreenLayout.presencePanelMarginBottom,
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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Today Command. ${todayCommand.primaryAction.label}. ${todayCommand.primaryAction.detail}`}
            accessibilityHint="Opens the exact care workflow behind today's recommended action."
            hitSlop={MOBILE_INLINE_HIT_SLOP}
            onPress={() =>
              router.push(todayCommand.primaryAction.route as never)
            }
            style={({ pressed }) => [
              s.todayCommandCard,
              {
                backgroundColor: pressed ? colors.secondary : colors.card,
                borderColor: pressed ? todayCommandTone : colors.border,
              },
            ]}
          >
            <View
              style={[
                s.todayCommandIcon,
                { backgroundColor: todayCommandTone + "18" },
              ]}
            >
              <PixelIcon
                name={todayCommandPixelIcon(todayCommand.primaryAction.icon)}
                size={28}
              />
            </View>
            <View style={s.todayCommandCopy}>
              <Text
                style={[
                  s.todayCommandKicker,
                  { color: colors.copper, fontFamily: "Fredoka_600SemiBold" },
                ]}
              >
                Today Command
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  s.todayCommandTitle,
                  { color: colors.navy, fontFamily: "Fredoka_700Bold" },
                ]}
              >
                {petName} is {HOME_MOOD_WORD[status.mood]}. {todayCommand.primaryAction.label}.
              </Text>
              <Text
                numberOfLines={2}
                style={[
                  s.todayCommandDetail,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                {todayCommand.primaryAction.detail}
              </Text>
            </View>
            <View
              style={[s.todayCommandCta, { backgroundColor: todayCommandTone }]}
            >
              <Text
                style={[
                  s.todayCommandCtaText,
                  { fontFamily: "Inter_800ExtraBold" },
                ]}
              >
                {todayCommandCta}
              </Text>
              <Ionicons name="chevron-forward" size={15} color="#FFF9EF" />
            </View>
          </Pressable>

          <BoardCard style={s.careStatusCard}>
            <BoardSectionHeader
              title="Care Status"
              accessory={<BoardPill label={careStatusLabel} tone={careStatusTone} />}
            />
            <View
              style={[
                s.statusTiles,
                {
                  gap: homeFirstScreenLayout.statusTileGap,
                  marginBottom: 0,
                },
              ]}
            >
              {statusTiles.map((tile) => (
                <Pressable
                  key={tile.label}
                  accessibilityRole="button"
                  accessibilityLabel={`${tile.label}. ${tile.value}. ${tile.actionLabel}`}
                  onPress={() => openStatusTile(tile.target)}
                  style={({ pressed }) => [
                    s.statusTile,
                    {
                      minHeight: homeFirstScreenLayout.statusTileMinHeight,
                      backgroundColor: pressed ? colors.secondary : colors.background,
                      borderColor: colors.border,
                      opacity: pressed ? 0.78 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <View
                    style={[
                      s.statusTileIcon,
                      {
                        width: homeFirstScreenLayout.statusTileIconBoxSize,
                        height: homeFirstScreenLayout.statusTileIconBoxSize,
                        backgroundColor: tile.tone + "16",
                      },
                    ]}
                  >
                    <PixelIcon
                      name={tile.icon}
                      size={homeFirstScreenLayout.statusTileIconSize}
                    />
                  </View>
                  <Text
                    style={[
                      s.statusTileLabel,
                      { color: colors.navy, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {tile.label}
                  </Text>
                  {tile.progress != null ? (
                    <View style={s.statusTileSegments}>
                      {Array.from({ length: 8 }).map((_, index) => (
                        <View
                          key={`${tile.label}-seg-${index}`}
                          style={[
                            s.statusTileSegment,
                            {
                              backgroundColor:
                                index <
                                Math.max(
                                  1,
                                  Math.round(((tile.progress ?? 0) / 100) * 8),
                                )
                                  ? tile.tone
                                  : colors.muted,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  ) : (
                    <Text
                      style={[
                        s.statusTileValue,
                        { color: tile.tone, fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      {tile.value}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          </BoardCard>

          <View style={s.homeSplit}>
            <BoardCard style={[s.quickHomeCard, s.homeSplitCard]}>
              <BoardSectionHeader
                title="Quick Log"
                accessory={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open full Quick Log"
                    hitSlop={MOBILE_INLINE_HIT_SLOP}
                    onPress={() => router.push("/log")}
                    style={({ pressed }) => [
                      s.quickHeaderAction,
                      {
                        backgroundColor: pressed
                          ? colors.secondary
                          : colors.accent,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.quickHeaderActionText,
                        {
                          color: colors.navy,
                          fontFamily: "Inter_800ExtraBold",
                        },
                      ]}
                    >
                      Open
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={13}
                      color={colors.navy}
                    />
                  </Pressable>
                }
              />
              <View style={s.homeQuickGrid}>
                {HOME_QUICK_LOG.slice(0, 6).map((item) => (
                  <QuickActionTile
                    key={item.key}
                    icon={item.icon}
                    label={item.label}
                    accessibilityLabel={
                      item.route ? "Open Quick Log" : `Log ${item.label}`
                    }
                    accessibilityHint={
                      item.route
                        ? "Opens the full Quick Log."
                        : "Long press opens details before saving."
                    }
                    onPress={() => logQuick(item)}
                    onLongPress={() => openQuickDetails(item)}
                    accent={colors.secondary}
                    style={s.homeQuickTile}
                    iconSize={24}
                    labelStyle={s.homeQuickText}
                  />
                ))}
              </View>
            </BoardCard>

            <BoardCard style={[s.nextCard, s.homeSplitCard]}>
              <BoardSectionHeader
                title="Next Up"
                accessory={
                  <BoardPill
                    label={`1 of ${nextCount}`}
                    icon="list-outline"
                    tone={colors.sage}
                  />
                }
              />
              {nextUp.slice(0, 3).map((item, index) => (
                <CareRow
                  key={`${item.label}-${item.time}-${index}`}
                  icon={item.icon}
                  title={item.label}
                  detail={index === 0 ? nextDetail : item.time}
                  meta={item.meta ?? ""}
                  onPress={() => router.push(item.route as never)}
                />
              ))}
            </BoardCard>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Today's Story. ${todayStoryLine} Open Story.`}
            accessibilityHint="Opens Phoenix's living story."
            onPress={() => router.push("/story" as never)}
            style={({ pressed }) => [
              s.todayStoryCard,
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
                  { color: colors.copper, fontFamily: "Fredoka_600SemiBold" },
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
                  Care RPG command center
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
              {homeMissions.map((mission) => {
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
                        <Text
                          numberOfLines={1}
                          style={[
                            s.missionStatus,
                            { color: tone, fontFamily: "Inter_800ExtraBold" },
                          ]}
                        >
                          {mission.statusLabel}
                        </Text>
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
                      <Text
                        numberOfLines={1}
                        style={[
                          s.missionCtaText,
                          {
                            maxWidth: missionLayout.ctaTextMaxWidth,
                            fontFamily: "Inter_800ExtraBold",
                          },
                        ]}
                      >
                        {mission.cta}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={15}
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

          <BoardCard tone="navy" style={s.questCard}>
            <View style={s.questTop}>
              <View>
                <Text
                  style={[
                    s.questKicker,
                    { color: colors.amber, fontFamily: "Fredoka_600SemiBold" },
                  ]}
                >
                  Care quest
                </Text>
                <Text style={[s.questTitle, { fontFamily: "Fredoka_700Bold" }]}>
                  {questLine}
                </Text>
                <Text style={[s.questSub, { fontFamily: "Inter_600SemiBold" }]}>
                  {careIntelligence.subtitle}
                </Text>
              </View>
              <View style={s.questBadge}>
                <PixelIcon name="heart" size={30} />
              </View>
            </View>
            <View style={s.questProofGrid}>
              {careIntelligence.metrics.slice(0, 3).map((metric) => (
                <View key={metric.label} style={s.questProofTile}>
                  <Text
                    style={[
                      s.questProofValue,
                      { fontFamily: "Fredoka_700Bold" },
                    ]}
                  >
                    {metric.value}
                  </Text>
                  <Text
                    style={[s.questProofLabel, { fontFamily: "Inter_700Bold" }]}
                  >
                    {metric.label}
                  </Text>
                </View>
              ))}
            </View>
            <View style={s.questMeterWrap}>
              {Array.from({ length: 10 }).map((_, index) => {
                const active = index < Math.round(careProgress / 10);
                return (
                  <View
                    key={`quest-${index}`}
                    style={[
                      s.questPip,
                      {
                        backgroundColor: active
                          ? colors.sage
                          : "rgba(255,249,239,0.18)",
                        borderColor: active
                          ? colors.sage
                          : "rgba(255,249,239,0.26)",
                      },
                    ]}
                  />
                );
              })}
            </View>
            <View style={s.questMetaRow}>
              <Text style={[s.questMeta, { fontFamily: "Inter_700Bold" }]}>
                {careIntelligence.score}% Care IQ
              </Text>
              <Text style={[s.questMeta, { fontFamily: "Inter_600SemiBold" }]}>
                {careIntelligence.confidenceScore}% log confidence
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
                  borderColor: pressed
                    ? colors.amber
                    : "rgba(255,249,239,0.26)",
                  backgroundColor: pressed
                    ? "rgba(255,249,239,0.16)"
                    : "rgba(255,249,239,0.1)",
                },
              ]}
            >
              <View style={s.questNextIcon}>
                <PixelIcon name={homeCareIntelligenceIcon} size={24} />
              </View>
              <View style={s.questNextCopy}>
                <Text
                  style={[
                    s.questNextKicker,
                    { fontFamily: "Inter_800ExtraBold" },
                  ]}
                >
                  Next care move
                </Text>
                <Text
                  numberOfLines={1}
                  style={[s.questNextTitle, { fontFamily: "Fredoka_700Bold" }]}
                >
                  {careIntelligence.nextAction.label}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[
                    s.questNextDetail,
                    { fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {careIntelligence.nextAction.detail}
                </Text>
              </View>
              <View style={s.questNextCta}>
                <Text
                  style={[
                    s.questNextCtaText,
                    { fontFamily: "Inter_800ExtraBold" },
                  ]}
                >
                  {homeCareIntelligenceCta}
                </Text>
                <Ionicons name="chevron-forward" size={15} color="#FFF9EF" />
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open Adventure Mode. ${adventureQuest.title}. ${adventureMode.summary}`}
              onPress={() => router.push("/adventure" as never)}
              style={({ pressed }) => [
                s.adventureInline,
                {
                  borderColor: "rgba(255,249,239,0.28)",
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <View style={s.adventureIcon}>
                <PixelIcon
                  name={adventureQuestIcon(adventureQuest.id)}
                  size={25}
                />
              </View>
              <View style={s.adventureCopy}>
                <Text
                  style={[s.adventureKicker, { fontFamily: "Inter_700Bold" }]}
                >
                  Adventure Mode
                </Text>
                <Text
                  numberOfLines={1}
                  style={[s.adventureTitle, { fontFamily: "Fredoka_700Bold" }]}
                >
                  {adventureQuest.title}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[s.adventureSub, { fontFamily: "Inter_600SemiBold" }]}
                >
                  Level {adventureMode.level} - {adventureMode.todayXp} XP today
                  - {adventureMode.memoriesCount} memories
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#FFF9EF" />
            </Pressable>
          </BoardCard>

          <BoardCard style={s.statusCard}>
            <BoardSectionHeader
              title="Phoenix status"
              accessory={
                <HomeHeaderAction
                  label="View full report"
                  accessibilityLabel="Open full Health Watch"
                  route="/health?tab=health"
                />
              }
            />
            <View style={s.meterStack}>
              <StatusMeter
                label="Energy"
                icon="energy"
                value={status.energy}
                valueLabel={`${status.energy}%`}
                tone={colors.sage}
                accessibilityLabel="Open Phoenix energy in Health Watch"
                accessibilityHint="Opens Health Watch for energy and activity context."
                onPress={() => openPhoenixStatusMeter("energy")}
              />
              <StatusMeter
                label="Hunger"
                icon="hunger"
                value={hungerScore}
                valueLabel={fed ? "Full" : "Hungry"}
                tone={fed ? colors.sage : colors.copper}
                accessibilityLabel="Open Phoenix meal detail from hunger"
                accessibilityHint="Opens the meal detail flow for portions and outcomes."
                onPress={() => openPhoenixStatusMeter("hunger")}
              />
              <StatusMeter
                label="Hydration"
                icon="bile"
                value={hydrationScore}
                valueLabel="Good"
                tone={colors.blueSignal}
                accessibilityLabel="Open Phoenix water detail from hydration"
                accessibilityHint="Opens the water detail flow for hydration notes."
                onPress={() => openPhoenixStatusMeter("hydration")}
              />
              <StatusMeter
                label="Bile Risk"
                icon="bile"
                value={bileCount ? 46 : 82}
                valueLabel={bile.status}
                tone={bile.color}
                accessibilityLabel="Open Phoenix bile risk in Health Watch"
                accessibilityHint="Opens Health Watch and Bile Watch context."
                onPress={() => openPhoenixStatusMeter("bile")}
              />
              <StatusMeter
                label="Bond"
                icon="bond"
                value={bondScore}
                valueLabel={bondLabel}
                tone={colors.sage}
                accessibilityLabel="Open Phoenix bond play detail"
                accessibilityHint="Opens the play detail flow for bond-building care."
                onPress={() => openPhoenixStatusMeter("bond")}
              />
            </View>
          </BoardCard>
        </Animated.View>
      </ScrollView>

      {toast && (
        <Animated.View
          pointerEvents={quickFeedback ? "auto" : "none"}
          style={[
            s.toast,
            {
              backgroundColor: colors.brandNavy,
              opacity: toastOpacity,
              bottom: insets.bottom + 96,
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
  identityAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
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
  identityChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  identityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  identityChipText: {
    fontSize: 10.5,
  },

  heroBackdrop: {
    width: "100%",
    marginBottom: 0,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  heroRoomArt: {
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
    width: "84%",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    alignSelf: "flex-start",
    marginTop: -30,
    marginLeft: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: "#081424",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
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
  statusTileValue: { fontSize: 13, textAlign: "right" },
  statusTileSegments: {
    flexDirection: "row",
    gap: 3,
  },
  statusTileSegment: {
    width: 13,
    height: 18,
    borderRadius: 4,
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
  homeQuickGrid: {
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  homeQuickTile: {
    width: "15.5%",
    minHeight: 62,
    borderWidth: 0,
    borderRadius: 14,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 4,
  },
  homeQuickText: {
    fontSize: 9.5,
    textAlign: "center",
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
  questKicker: { fontSize: 11, textTransform: "uppercase" },
  questTitle: {
    color: "#FFF9EF",
    fontSize: 17,
    lineHeight: 21,
    marginTop: 2,
    maxWidth: 245,
  },
  questSub: {
    color: "rgba(255,249,239,0.78)",
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 5,
    maxWidth: 245,
  },
  questBadge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,249,239,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,249,239,0.18)",
  },
  questProofGrid: {
    flexDirection: "row",
    gap: 7,
    marginTop: 13,
  },
  questProofTile: {
    flex: 1,
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,249,239,0.16)",
    backgroundColor: "rgba(255,249,239,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 7,
    justifyContent: "center",
  },
  questProofValue: {
    color: "#FFF9EF",
    fontSize: 16,
  },
  questProofLabel: {
    color: "rgba(255,249,239,0.68)",
    fontSize: 9,
    lineHeight: 12,
    marginTop: 1,
    textTransform: "uppercase",
  },
  questMeterWrap: {
    flexDirection: "row",
    gap: 5,
    marginTop: 13,
  },
  questPip: {
    flex: 1,
    height: 12,
    borderWidth: 1,
    borderRadius: 2,
  },
  questMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 9,
  },
  questMeta: {
    color: "rgba(255,249,239,0.82)",
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
    backgroundColor: "rgba(255,249,239,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,249,239,0.2)",
  },
  questNextCopy: {
    flex: 1,
    minWidth: 0,
  },
  questNextKicker: {
    color: "rgba(255,249,239,0.64)",
    fontSize: 8.5,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  questNextTitle: {
    color: "#FFF9EF",
    fontSize: 13.5,
    lineHeight: 16,
    marginTop: 1,
  },
  questNextDetail: {
    color: "rgba(255,249,239,0.74)",
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
    backgroundColor: "rgba(255,249,239,0.12)",
  },
  questNextCtaText: {
    color: "#FFF9EF",
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
    backgroundColor: "rgba(255,249,239,0.09)",
  },
  adventureIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,249,239,0.16)",
  },
  adventureCopy: { flex: 1, minWidth: 0 },
  adventureKicker: {
    color: "rgba(255,249,239,0.68)",
    fontSize: 9,
    textTransform: "uppercase",
  },
  adventureTitle: {
    color: "#FFF9EF",
    fontSize: 14,
    lineHeight: 17,
    marginTop: 1,
  },
  adventureSub: {
    color: "rgba(255,249,239,0.74)",
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 2,
  },
  statusCard: { marginBottom: 10 },
  meterStack: { gap: 8 },
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

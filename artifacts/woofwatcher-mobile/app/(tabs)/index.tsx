import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
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
  deriveRoutineBoard,
  normalizeCareEventType,
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

import { BoardCard } from "@/components/board/BoardPrimitives";
import { HomeEvidenceCard } from "@/components/home/HomeEvidenceCard";
import {
  HomeNowNextCard,
  type HomeNextItem,
  type HomeNowItem,
} from "@/components/home/HomeNowNextCard";
import { HomeStorySummary } from "@/components/home/HomeStorySummary";
import { QuickLogGrid } from "@/components/logging/QuickLogGrid";
import { useQuickLogController } from "@/components/logging/useQuickLogController";
import { enterUp } from "@/components/motion/GameFeel";
import {
  LivingPhoenixRoom,
  type PhoenixRoomReaction,
  type PhoenixRoomStat,
} from "@/components/LivingPhoenixRoom";
import { PetPortrait } from "@/components/PetPortrait";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { useAvatar } from "@/context/AvatarContext";
import { useCare, type Entry } from "@/context/CareContext";
import { announce } from "@/lib/announce";
import { useColors } from "@/hooks/useColors";
import { useWebQaFontScale } from "@/hooks/useWebQaFontScale";
import { getAvatarTemplate } from "@/lib/avatarStudio";
import {
  createWebQaLayoutMarker,
  getAccessibleLayoutMetrics,
  getFloatingFeedbackBottomOffset,
  getFloatingTabChromeMetrics,
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import { deriveAvatarMotion } from "@/lib/avatarMotion";
import {
  deriveCareEvidenceSnapshot,
  isHouseholdVisibleCareEntry,
  type EvidenceLaneId,
} from "@/lib/careEvidence";
import { deriveCareTwinScene } from "@/lib/avatarLifeEngine";
import { deriveCareTwinChoreography } from "@/lib/careTwinChoreography";
import { describeCareTwinReactionForLog } from "@/lib/careTwinReactionPolicy";
import { getHomeFirstScreenLayout } from "@/lib/homeFirstScreenLayout";
import { findOpenAloneTimeSession } from "@/lib/aloneTimeSession";
import {
  careXpForEntry,
  deriveCareCareer,
  deriveCareStreak,
} from "@/lib/careCareer";
import { quickLogActionByKey } from "@/lib/quickLogPolicy";
import {
  buildWalkSessionFinishPatch,
  findOpenWalkSession,
} from "@/lib/walkSession";
import { derivePhoenixStatus, type Mood } from "@/lib/phoenixStatus";
import { resolvePetName } from "@/lib/petIdentity";
import { findPendingMealOutcome } from "@/lib/todayCommand";
import { resolveQuickLogEntry } from "@/lib/quickLogRuntime";
import { selectHomeRoutineQueue } from "@/lib/homeRoutineQueue";

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
  routineId: string;
  owner?: string;
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

const WALK_QUICK_LOG_ACTION = quickLogActionByKey("walk");

const SPEECH_BY_MOOD: Record<Mood, string> = {
  happy: "Good morning!\nWalk time soon?\nI'm ready!",
  excited: "Good morning!\nWalk time soon?\nI'm ready!",
  calm: "Good morning!\nWalk time soon?\nI'm ready!",
  anxious: "Stay close today.\nA calm plan helps.",
  unwell: "Tummy feels off.\nLet's watch gently.",
};

const EVIDENCE_ICON: Record<EvidenceLaneId, PixelIconName> = {
  mood: "heart",
  energy: "energy",
  appetite: "meal",
  hydration: "bile",
  stool: "poo",
  activity: "walk",
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

function homeLogEntryRoute(entryId: string): `/log?entry=${string}` {
  return `/log?entry=${encodeURIComponent(entryId)}`;
}

function homeLogDetailRoute(
  type: CareEventType,
  intent: number,
): `/log?type=${string}&detail=1&intent=${number}` {
  return `/log?type=${type}&detail=1&intent=${intent}`;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    width: viewportWidth,
    height: viewportHeight,
    fontScale: runtimeFontScale,
  } =
    useWindowDimensions();
  const { fontScale, qaFontScale } = useWebQaFontScale(runtimeFontScale);
  const router = useRouter();
  const {
    state,
    updateEntry,
    refreshError,
    syncRefreshError,
    storageWarning,
    legacyImport,
  } = useCare();
  // The data-loss warning must reach screen-reader users on every platform.
  useEffect(() => {
    if (storageWarning === "save-failed") {
      announce("Device storage is failing. Recent care logs may not be saved.");
    } else if (storageWarning === "read-failed") {
      announce("Could not read saved care data. Saving is paused this session.");
    } else if (storageWarning === "reset") {
      announce("Saved care data could not be read and was reset. A recovery copy was kept.");
    } else if (refreshError) {
      announce(refreshError);
    } else if (syncRefreshError) {
      announce(syncRefreshError);
    }
  }, [refreshError, storageWarning, syncRefreshError]);
  const { avatarConfig, hasConfiguredAvatar } = useAvatar();

  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "tabbed",
  });
  const tabChrome = getFloatingTabChromeMetrics({
    platform: Platform.OS,
    bottomInset: insets.bottom,
    fontScale,
  });
  const bottomPadding = getTabbedRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
    fontScale,
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
  const homeAccessibleLayout = getAccessibleLayoutMetrics({
    platform: Platform.OS,
    fontScale,
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const petName = resolvePetName(state.profile.name);
  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);
  const careEvidence = useMemo(
    () => deriveCareEvidenceSnapshot(state.entries, now),
    [state.entries, now],
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
        entries: state.entries,
        routines: state.routines,
        caregivers: state.caregivers,
        petName,
        now,
        energy: status.energyObserved ? status.energy : null,
        reactionsSince: reactionSessionFloor.current,
      }),
    [
      state.entries,
      state.routines,
      state.caregivers,
      petName,
      now,
      status.energy,
      status.energyObserved,
    ],
  );
  const careCareer = useMemo(
    () => deriveCareCareer(state.entries, now),
    [state.entries, now],
  );
  const careStreak = useMemo(
    () => deriveCareStreak(state.entries, now),
    [state.entries, now],
  );
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
      : "not-logged";
  const presenceLabel = openAloneSession
    ? `${petName} Home alone`
    : openWalkSession
      ? `${petName} on a walk`
      : "Presence not logged";
  const presenceSub = openAloneSession
    ? `${formatDuration(openAloneMinutes)} active - tap I\u2019m Home in Log`
    : openWalkSession
      ? `${formatDuration(openWalkMinutes)} active - open the walk log`
      : "No active walk or alone-time session.";
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

  // Pending meal outcomes stay actionable across
  // the midnight rollover (up to 12h) instead of vanishing at 12:00 AM.
  const pendingMeal = useMemo(
    () => findPendingMealOutcome(state.entries, now),
    [state.entries, now],
  );

  // Session-local snooze: a snoozed routine steps out of Next Up for 30
  // minutes on this device, without touching the Plan schedule itself.
  const [snoozedUntil, setSnoozedUntil] = useState<Record<string, number>>({});

  const routineBoard = useMemo(
    () =>
      deriveRoutineBoard({
        routines: state.routines,
        entries: state.entries,
        caregivers: state.caregivers,
        now,
      }),
    [now, state.caregivers, state.entries, state.routines],
  );
  const nextUp = useMemo<HomeNextUpItem[]>(() => {
    return selectHomeRoutineQueue(routineBoard.items, snoozedUntil, now)
      .slice(0, 3)
      .map((routine) => {
      const routineType = normalizeCareEventType(routine.type ?? "note");
      return {
        label: routine.label,
        time: routine.time,
        icon: routineIcon(routineType),
        route: homeLogDetailRoute(routineType, now),
        routineId: routine.id,
        owner: routine.owner || undefined,
      };
    });
  }, [
    routineBoard.items,
    snoozedUntil,
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
  const snoozeNextUp = (item: HomeNextUpItem) => {
    if (!item.routineId) return;
    void Haptics.selectionAsync();
    setSnoozedUntil((prev) => ({
      ...prev,
      [item.routineId as string]: now + 30 * 60000,
    }));
    showToast(`${item.label} snoozed 30 min`);
  };

  const bileCount = useMemo(
    () =>
      state.entries.filter((e) => {
        if (!isHouseholdVisibleCareEntry(e)) return false;
        if (
          new Date(e.occurredAt).toDateString() !==
          new Date(now).toDateString()
        ) {
          return false;
        }
        const t = normalizeCareEventType(e.type, e.details);
        return t === "vomit" || t === "symptom" || /bile/i.test(e.title);
      }).length,
    [state.entries, now],
  );
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
          : careEvidence.observedCount > 0
            ? `${careEvidence.observedCount} of ${careEvidence.totalCount} care areas observed`
            : "Ready for the first care log";

  const roomStats = useMemo<PhoenixRoomStat[]>(
    () =>
      careEvidence.lanes.map((lane) => ({
        label: lane.label,
        value: lane.detail,
        icon: EVIDENCE_ICON[lane.id],
        tone:
          lane.status === "watch"
            ? colors.amber
            : lane.status === "observed"
              ? colors.sage
              : colors.mutedForeground,
        progress: lane.status === "not-logged" ? 0 : 100,
      })),
    [
      careEvidence.lanes,
      colors.amber,
      colors.mutedForeground,
      colors.sage,
    ],
  );

  const openPresencePanel = () => {
    void Haptics.selectionAsync();
    router.push(presenceRoute as never);
  };

  const [toast, setToast] = useState<string | null>(null);
  const [quickFeedback, setQuickFeedback] = useState<{
    id: string;
    title: string;
    type: CareEventType;
    occurredAt: string;
    caregiver?: string;
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
  const resolvedQuickFeedbackEntry = useMemo(
    () =>
      quickFeedback
        ? resolveQuickLogEntry(state.entries, {
            id: quickFeedback.id,
            type: quickFeedback.type,
            occurredAt: quickFeedback.occurredAt,
            caregiver: quickFeedback.caregiver,
          })
        : null,
    [quickFeedback, state.entries],
  );
  const pendingMealChipSuppressed = Boolean(
    toast &&
      quickFeedback &&
      pendingMeal &&
      resolvedQuickFeedbackEntry?.id === pendingMeal.id,
  );
  const showToast = (
    msg: string,
    feedback?: {
      id: string;
      title: string;
      type: CareEventType;
      occurredAt: string;
      caregiver?: string;
    },
    holdMs?: number,
    announceMessage = true,
  ) => {
    setToast(msg);
    setQuickFeedback(feedback ?? null);
    // The toast is invisible to screen readers and its Undo button vanishes
    // on a timer - announce so the core loop is not silent under VoiceOver.
    if (announceMessage) {
      announce(feedback ? `${msg}. Undo available.` : msg);
    }
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

  const quickLogController = useQuickLogController({
    announceFailures: false,
    onSaved: (feedback) => {
      const reaction = describeCareTwinReactionForLog({
        type: feedback.entry.type,
        label: feedback.action.label,
        title: feedback.entry.title,
        mood: feedback.entry.mood,
        severity: feedback.entry.severity,
        details: feedback.entry.details,
      });
      showRoomSpeech(reaction.label);
      showToast(feedback.message, {
        id: feedback.id,
        title: feedback.action.title,
        type: feedback.action.type,
        occurredAt: feedback.entry.occurredAt,
        caregiver: feedback.entry.caregiver,
      }, undefined, false);
    },
    onUndone: (feedback) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setQuickFeedback(null);
      if (roomSpeechTimer.current) clearTimeout(roomSpeechTimer.current);
      setRoomSpeechOverride(null);
      showToast(`${feedback.action.title} undone`, undefined, undefined, false);
    },
  });
  const homeQuickLogFailure =
    storageWarning || refreshError || syncRefreshError
      ? null
      : quickLogController.failure;
  useEffect(() => {
    if (homeQuickLogFailure) announce(homeQuickLogFailure);
  }, [homeQuickLogFailure]);

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
    void quickLogController.undo();
  };

  const openQuickFeedbackDetails = () => {
    if (!quickFeedback) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
    setQuickFeedback(null);
    quickLogController.openFeedbackDetails();
  };

  // Home's Finish completes the walk right here with the same shared
  // lifecycle patch /log's "Finish walk session" applies (route, distance,
  // and notes stay optional and editable from the saved log afterward).
  const finishWalkFromHome = () => {
    if (!openWalkSession?.id) return;
    const patch = buildWalkSessionFinishPatch(openWalkSession, {
      caregiver,
      now: Date.now(),
    });
    if (
      !updateEntry(
        openWalkSession.id,
        patch as Partial<Omit<Entry, "id">>,
      )
    ) {
      showToast("Resolve this walk conflict before finishing it");
      router.push(homeLogEntryRoute(openWalkSession.id) as never);
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    showRoomSpeech("Walk completed");
    showToast(
      `Walk completed · ${formatDuration(patch.durationMinutes)} logged · +${careXpForEntry({ ...openWalkSession, details: patch.details })} care XP`,
    );
  };

  // Next Up and the shared grid use the same controller-owned walk start,
  // dedupe, feedback, and active-session routing path.
  const startWalkSessionFromHome = (options?: {
    routineId?: string;
    routineLabel?: string;
  }) => {
    quickLogController.press(WALK_QUICK_LOG_ACTION, options);
  };

  const homeNowItems = useMemo<HomeNowItem[]>(() => {
    const items: HomeNowItem[] = [];
    if (pendingMealOpenLoop && !pendingMealChipSuppressed) {
      items.push({
        id: "meal-outcome",
        kind: "meal-outcome",
        label: pendingMealOpenLoop.label,
        detail: pendingMealOpenLoop.time,
        icon: pendingMealOpenLoop.icon,
        actionLabel: "Update",
      });
    }
    if (openWalkSession) {
      items.push({
        id: "walk-session",
        kind: "walk-session",
        label: "Walk in progress",
        detail: `${formatDuration(openWalkMinutes)} active`,
        icon: "walk",
        actionLabel: "Finish",
      });
    }
    if (openAloneSession) {
      items.push({
        id: "alone-session",
        kind: "alone-session",
        label: "Alone time active",
        detail: `${formatDuration(openAloneMinutes)} active`,
        icon: "clock",
        actionLabel: "I'm Home",
      });
    }
    return items;
  }, [
    openAloneMinutes,
    openAloneSession,
    openWalkMinutes,
    openWalkSession,
    pendingMealChipSuppressed,
    pendingMealOpenLoop,
  ]);

  const homeNextItem = useMemo<HomeNextItem | null>(
    () =>
      nextPrimary
        ? {
            id: nextPrimary.routineId ?? nextPrimary.label,
            label: nextPrimary.label,
            detail: `${nextPrimary.time}${
              nextPrimary.owner ? ` · ${nextPrimary.owner} assigned` : ""
            }`,
            icon: nextPrimary.icon,
            actionLabel: nextPrimary.icon === "walk" ? "Start" : "Open",
            statusLabel: nextPrimary.time,
          }
        : null,
    [nextPrimary],
  );

  const openHomeNowItem = (item: HomeNowItem) => {
    if (item.kind === "meal-outcome" && pendingMealOpenLoop) {
      void Haptics.selectionAsync();
      router.push(pendingMealOpenLoop.route as never);
      return;
    }
    if (item.kind === "walk-session") {
      finishWalkFromHome();
      return;
    }
    openPresencePanel();
  };

  const startHomeNextItem = (item: HomeNextItem) => {
    if (!nextPrimary || item.id !== (nextPrimary.routineId ?? nextPrimary.label)) {
      router.push("/calendar");
      return;
    }
    if (nextPrimary.icon === "walk" && !openWalkSession) {
      startWalkSessionFromHome({
        routineId: nextPrimary.routineId,
        routineLabel: nextPrimary.label,
      });
      return;
    }
    router.push(nextPrimary.route as never);
  };

  const snoozeHomeNextItem = (item: HomeNextItem) => {
    if (!nextPrimary || item.id !== (nextPrimary.routineId ?? nextPrimary.label)) {
      return;
    }
    snoozeNextUp(nextPrimary);
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

  const todayEntries = useMemo(() => {
    const todayKey = new Date(now).toDateString();
    return state.entries
      .filter(
        (entry) =>
          isHouseholdVisibleCareEntry(entry) &&
          Date.parse(entry.occurredAt) <= now &&
          new Date(entry.occurredAt).toDateString() === todayKey,
      )
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }, [now, state.entries]);

  // Today's Story: one honest sentence from today's real shared log evidence.
  const todayStoryLine = useMemo(() => {
    if (!todayEntries.length) return null;
    const latest = todayEntries[0];
    const count = todayEntries.length;
    return `${latest.title} logged by ${latest.caregiver}. ${count} care ${
      count === 1 ? "moment" : "moments"
    } today.`;
  }, [todayEntries]);

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
    <View style={[s.root, { backgroundColor: colors.background }]}
      testID="qa-layout-today"
      nativeID={createWebQaLayoutMarker(
        qaFontScale,
        homeAccessibleLayout,
      )}
    >
      {/* Full-bleed storybook backdrop from the mock boards: the scene fills
          the whole screen top to bottom. The dog's traffic area is the top
          band; a soft scrim quiets the lower floor so the floating console
          stays legible while the background still peeks through. */}
      <Image
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
              accessibilityLabel={`${petName}. ${careLine}. Open profile`}
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
              <View
                style={[
                  s.welcomeActions,
                  homeAccessibleLayout.stackStatusRows &&
                    s.welcomeActionsReflow,
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Set up ${petName}`}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    router.push("/setup" as never);
                  }}
                  style={({ pressed }) => [
                    s.welcomePrimary,
                    { minHeight: homeAccessibleLayout.controlMinHeight },
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
                  style={({ pressed }) => [
                    s.welcomeGhost,
                    { minHeight: homeAccessibleLayout.controlMinHeight },
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
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
                  width: homeFirstScreenLayout.heroStudioButtonWidth,
                  height: Math.max(
                    homeFirstScreenLayout.heroStudioButtonMinHeight,
                    homeAccessibleLayout.controlMinHeight,
                  ),
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
          </View>
          </Reanimated.View>

          {/* Local-first storage and household refresh failures stay visible;
              cached care remains available while the owner decides to retry. */}
          {storageWarning || refreshError || syncRefreshError ? (
            <View
              style={[
                s.storageWarningCard,
                { backgroundColor: colors.amberSoft, borderColor: colors.amber + "66" },
              ]}
            >
              <Ionicons name="warning-outline" size={17} color={colors.amber} />
              <Text
                selectable
                style={[s.storageWarningText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
              >
                {storageWarning === "save-failed"
                  ? "Device storage is failing - new care logs may not survive an app restart."
                  : storageWarning === "read-failed"
                    ? "Couldn't read saved care data. Saving is paused this session to protect what's stored."
                    : storageWarning === "reset"
                      ? "Saved care data couldn't be read and was reset. A recovery copy was kept on this device."
                      : refreshError ||
                        syncRefreshError ||
                        "Couldn't refresh household care. Cached care is still available; try again."}
              </Text>
            </View>
          ) : null}

          <Pressable
            testID="home-presence"
            accessibilityRole="button"
            accessibilityLabel={`${presenceLabel}. Presence state ${presenceState}`}
            accessibilityHint={presenceActionHint}
            onPress={openPresencePanel}
            style={[
              s.presencePanel,
              homeAccessibleLayout.stackStatusRows &&
                s.presencePanelReflow,
              s.softShadow,
              {
                minHeight: Math.max(
                  homeFirstScreenLayout.presencePanelMinHeight,
                  homeAccessibleLayout.controlMinHeight,
                ),
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
                      : colors.mutedForeground,
                },
              ]}
            >
              {openAloneSession ? (
                <Ionicons name="home-outline" size={18} color="#FFFFFF" />
              ) : openWalkSession ? (
                <PixelIcon name="walk" size={21} />
              ) : (
                <Ionicons name="help-outline" size={18} color="#FFFFFF" />
              )}
            </View>
            <View style={s.presenceCopy}>
              <Text
                numberOfLines={
                  homeAccessibleLayout.stackStatusRows ? 2 : 1
                }
                style={[
                  s.presenceText,
                  { color: colors.navy, fontFamily: "Inter_700Bold" },
                ]}
              >
                {presenceLabel}
              </Text>
              <Text
                numberOfLines={
                  homeAccessibleLayout.stackStatusRows ? 2 : 1
                }
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
            <Ionicons
              name="chevron-forward"
              size={17}
              color={colors.navy}
              style={
                homeAccessibleLayout.stackStatusRows
                  ? s.presenceChevronReflow
                  : undefined
              }
            />
          </Pressable>

          <Reanimated.View entering={enterUp(0)}>
            <HomeNowNextCard
              nowItems={homeNowItems}
              nextItem={homeNextItem}
              hasConfiguredRoutines={state.routines.length > 0}
              remainingCount={Math.max(0, nextUp.length - 1)}
              onOpenNow={openHomeNowItem}
              onStartNext={startHomeNextItem}
              onSnoozeNext={snoozeHomeNextItem}
              onOpenPlan={() => router.push("/calendar")}
            />
          </Reanimated.View>

          <Reanimated.View entering={enterUp(1)}>
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
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                  onPress={() => router.push("/fastlog" as never)}
                  style={({ pressed }) => [
                    s.quickLogLink,
                    {
                      minWidth: homeAccessibleLayout.controlMinHeight,
                      minHeight: homeAccessibleLayout.controlMinHeight,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              </View>
              <QuickLogGrid
                controller={quickLogController}
                variant="compact"
                showFailure={Boolean(homeQuickLogFailure)}
              />
            </BoardCard>
          </Reanimated.View>

          <HomeEvidenceCard
            snapshot={careEvidence}
            onOpenHealth={() =>
              router.push("/health?tab=health" as never)
            }
          />

          <HomeStorySummary
            storyLine={todayStoryLine}
            todayCount={todayEntries.length}
            todayXp={careCareer.todayXp}
            streakDays={careStreak}
            onOpenStory={() => router.push("/story" as never)}
            onOpenAdventure={() => router.push("/adventure" as never)}
            onOpenHistory={() => router.push("/log" as never)}
          />

          <View
            testID="home-secondary-links"
            style={[
              s.secondaryLinks,
              homeAccessibleLayout.stackStatusRows &&
                s.secondaryLinksReflow,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Records"
              onPress={() => router.push("/records" as never)}
              style={({ pressed }) => [
                s.secondaryLink,
                homeAccessibleLayout.stackStatusRows &&
                  s.secondaryLinkReflow,
                {
                  minHeight: homeAccessibleLayout.controlMinHeight,
                  backgroundColor: pressed ? colors.secondary : colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="folder-outline" size={18} color={colors.forest} />
              <Text
                style={[
                  s.secondaryLinkText,
                  { color: colors.foreground, fontFamily: "Inter_700Bold" },
                ]}
              >
                Records
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Pack"
              onPress={() => router.push("/pack" as never)}
              style={({ pressed }) => [
                s.secondaryLink,
                homeAccessibleLayout.stackStatusRows &&
                  s.secondaryLinkReflow,
                {
                  minHeight: homeAccessibleLayout.controlMinHeight,
                  backgroundColor: pressed ? colors.secondary : colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="people-outline" size={18} color={colors.forest} />
              <Text
                style={[
                  s.secondaryLinkText,
                  { color: colors.foreground, fontFamily: "Inter_700Bold" },
                ]}
              >
                Pack
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open More"
              onPress={() => router.push("/more" as never)}
              style={({ pressed }) => [
                s.secondaryLink,
                homeAccessibleLayout.stackStatusRows &&
                  s.secondaryLinkReflow,
                {
                  minHeight: homeAccessibleLayout.controlMinHeight,
                  backgroundColor: pressed ? colors.secondary : colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={18}
                color={colors.forest}
              />
              <Text
                style={[
                  s.secondaryLinkText,
                  { color: colors.foreground, fontFamily: "Inter_700Bold" },
                ]}
              >
                More
              </Text>
            </Pressable>
          </View>

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
                disabled={quickLogController.undoing}
                onPress={undoQuickFeedback}
                style={({ pressed }) => [
                  s.toastAction,
                  {
                    backgroundColor: pressed
                      ? "rgba(255,249,239,0.16)"
                      : "rgba(255,249,239,0.1)",
                    borderColor: "rgba(255,249,239,0.34)",
                    opacity: quickLogController.undoing ? 0.55 : 1,
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
                disabled={quickLogController.undoing}
                onPress={openQuickFeedbackDetails}
                style={({ pressed }) => [
                  s.toastAction,
                  {
                    backgroundColor: pressed
                      ? colors.copper + "DD"
                      : colors.copper,
                    borderColor: colors.copper,
                    opacity: quickLogController.undoing ? 0.55 : 1,
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
  presencePanelReflow: {
    alignItems: "stretch",
    flexDirection: "column",
    paddingVertical: 12,
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
  welcomeActionsReflow: {
    alignItems: "stretch",
    flexDirection: "column",
  },
  welcomePrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    justifyContent: "center",
  },
  welcomePrimaryText: {
    fontSize: 14,
  },
  welcomeGhost: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  welcomeGhostText: {
    fontSize: 13,
  },

  // Care evidence card: quiet kicker, factual headline, and four coverage
  // meters (mood / energy / appetite / hydration).
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
  presenceAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  presenceCopy: { flex: 1, minWidth: 0 },
  presenceChevronReflow: { alignSelf: "flex-end" },
  presenceText: { fontSize: 14 },
  presenceSub: { fontSize: 11, marginTop: 2 },
  quickHomeCard: {
    minHeight: 0,
  },
  quickSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  quickLogLink: {
    alignItems: "center",
    justifyContent: "center",
  },
  quickSectionTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  secondaryLinks: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  secondaryLinksReflow: {
    flexWrap: "wrap",
  },
  secondaryLink: {
    flex: 1,
    minWidth: 0,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  secondaryLinkReflow: {
    flexBasis: "48%",
  },
  secondaryLinkText: { fontSize: 12 },

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

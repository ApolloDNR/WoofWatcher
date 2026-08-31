import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWoofAuth } from "@/lib/auth";
import { getConsumerSurfacePolicy } from "@/lib/consumerSurfacePolicy";
import {
  deriveCareReminderCenter,
  deriveHouseholdResponsibility,
  deriveRoutineBoard,
  normalizeCareEventType,
  type CareReminderItem,
  type RoutineBoardItem,
  type RoutineBoardStatus,
} from "@workspace/care-domain";
import { useCare, CalendarEvent, Routine } from "@/context/CareContext";
import { announce } from "@/lib/announce";
import { useColors } from "@/hooks/useColors";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { PressScale, ProgressFill } from "@/components/motion/GameFeel";
import { SpriteSheetPlayer } from "@/components/SpriteSheetPlayer";
import { deriveCareStreak } from "@/lib/careCareer";
import { confirmThroughSteps } from "@/lib/confirmDialog";
import { parseLocalDate } from "@/lib/time";
import { resolvePetName } from "@/lib/petIdentity";
import { CARE_TWIN_SPRITE_MANIFEST } from "@/lib/avatarLifeEngine";
import { getCareTwinSpriteAsset } from "@/lib/careTwinAssets";
import { buildMonthView, dateKeyOf, WEEKDAY_LABELS } from "@/lib/monthCalendar";
import {
  applyReminderNotificationPreferenceDraft,
  buildReminderNotificationPreferencesForCenter,
} from "@/lib/reminderNotificationPreferences";
import {
  getFormKeyboardScrollProps,
  getModalSheetBottomPadding,
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import { pixelImageStyle, stageImageFill } from "@/lib/pixelRendering";
import { BoardCard, BoardPill, BoardRouteHeader, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import {
  BoardActionButton,
  BoardSegmentTabs,
  BoardStatusPill,
  type BoardStatusPillTone,
} from "@/components/board/BoardPrimitives";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";
// Purpose-composed wide banner (1264x383, calm rug/floor band of the storybook
// day room) so the wide command deck doesn't crop a square room to a mid-wall band.
const PLANS_COMMAND_STAGE_ROOM = require("@/assets/avatar/rooms/phoenix-room-day-banner.png");
const PLANS_COMMAND_STAGE_SPRITE = getCareTwinSpriteAsset("idle-breathe");
const PLANS_COMMAND_STAGE_TRACK = CARE_TWIN_SPRITE_MANIFEST["idle-breathe"];

// Potty carries a green tint here (its glyph is drawn from the shared pixel
// "pee" leaf at render time, matching every care timeline); the blue "drop"
// glyph stays reserved for Water.
const ROUTINE_ICON: Record<string, PulseIconName> = {
  meal: "bowl",
  walk: "paw",
  treat: "bone",
  play: "candy",
  training: "star",
  potty: "heart",
  note: "heart",
};

const ROUTINE_TYPES: { key: string; label: string; icon: PulseIconName }[] = [
  { key: "meal", label: "Meal", icon: "bowl" },
  { key: "walk", label: "Walk", icon: "paw" },
  { key: "treat", label: "Treat", icon: "bone" },
  { key: "play", label: "Play", icon: "candy" },
  { key: "training", label: "Training", icon: "star" },
  { key: "potty", label: "Potty", icon: "heart" },
  { key: "note", label: "Check-in", icon: "heart" },
];

/**
 * Type-keyed quick-pick suggestions so a routine can be built by tapping
 * instead of typing. Time chips emit the exact "H:MM AM/PM" string the routine
 * board parses (routineMinutes / routineDateMs), so a tapped time always reads
 * back cleanly - a free-typed "0700" never would.
 */
const ROUTINE_LABEL_SUGGESTIONS: Record<string, string[]> = {
  meal: ["Breakfast", "Lunch", "Dinner", "Bedtime snack"],
  walk: ["Morning walk", "Evening walk", "Lunch walk"],
  treat: ["Afternoon treat"],
  play: ["Play session"],
  training: ["Training session"],
  potty: ["Potty break"],
  note: ["Check-in", "Medication"],
};
const ROUTINE_TIME_SUGGESTIONS: Record<string, string[]> = {
  meal: ["7:00 AM", "12:00 PM", "6:00 PM"],
  walk: ["8:00 AM", "5:30 PM"],
  treat: ["3:00 PM"],
  play: ["4:00 PM"],
  training: ["10:00 AM"],
  potty: ["7:00 AM", "9:00 PM"],
  note: ["9:00 PM"],
};
const DEFAULT_TIME_SUGGESTIONS = ["7:00 AM", "12:00 PM", "6:00 PM"];

const EVENT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  beach: "sunny",
  hike: "trail-sign",
  meetup: "people",
  playdate: "paw",
  training: "ribbon",
  grooming: "cut",
  vet: "medkit",
  event: "calendar",
  custom: "calendar",
};

const EVENT_TYPES = [
  { key: "event", label: "Outing" },
  { key: "beach", label: "Beach" },
  { key: "hike", label: "Hike" },
  { key: "meetup", label: "Meetup" },
  { key: "playdate", label: "Playdate" },
  { key: "vet", label: "Vet" },
  { key: "grooming", label: "Grooming" },
  { key: "training", label: "Training" },
] as const;

const REMINDER_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  routine: "alarm-outline",
  medication: "medkit-outline",
  record: "folder-open-outline",
  grooming: "sparkles-outline",
};

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

function routineMinutes(time: string): number {
  const [clock, period] = time.split(" ");
  const [hStr, mStr] = clock.split(":");
  let h = parseInt(hStr, 10);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + parseInt(mStr || "0", 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Next full clock hour as "7:00 AM"-style text. Used to prefill the free-text
 * time fields with a real, immediately-submittable value instead of a grey
 * placeholder that looks filled but fails validation.
 */
function nextRoundHourLabel(now: Date = new Date()): string {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  const hours24 = next.getHours();
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:00 ${period}`;
}

// Mockup week board runs Monday-first: M T W T F S S.
const WEEK_DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const WEEK_DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** Local-calendar day key, matching deriveCareStreak's day bucketing. */
function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const today = todayISO();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (iso === today) return "Today";
  if (iso === tomorrow) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function routineStatusLabel(status: RoutineBoardStatus): string {
  if (status === "done") return "Done";
  if (status === "overdue") return "Overdue";
  if (status === "due") return "Due now";
  return "Upcoming";
}

function scheduleStatusPill(
  status: RoutineBoardStatus,
  isNextUpcoming: boolean,
): { label: string; tone: BoardStatusPillTone } {
  if (status === "done") return { label: "Done", tone: "done" };
  if (status === "overdue" || status === "due") return { label: "Due", tone: "due" };
  if (isNextUpcoming) return { label: "Up Next", tone: "upNext" };
  return { label: "Upcoming", tone: "upcoming" };
}

function routineBoardPillTone(status: RoutineBoardStatus): BoardStatusPillTone {
  if (status === "done") return "done";
  if (status === "overdue" || status === "due") return "due";
  return "upcoming";
}

/** Time-of-day band for grouping the schedule like a real day planner. */
function scheduleBandForTime(time: string): "Morning" | "Afternoon" | "Evening" | "Anytime" {
  const match = /(\d+):(\d+)\s*(AM|PM)/i.exec(time);
  if (!match) return "Anytime";
  let hour = parseInt(match[1], 10) % 12;
  if (/pm/i.test(match[3])) hour += 12;
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

function reminderUrgencyLabel(urgency: string): string {
  if (urgency === "alert") return "Urgent";
  if (urgency === "watch") return "Watch";
  return "Heads up";
}

function routinePixelIcon(type: string): PixelIconName {
  const normalized = normalizeCareEventType(type);
  if (normalized === "meal") return "meal";
  if (normalized === "walk") return "walk";
  if (normalized === "training") return "training";
  if (normalized === "potty") return "pee";
  if (normalized === "treat") return "treat";
  if (normalized === "play") return "play";
  if (normalized === "medication") return "medication";
  return "clock";
}

interface SuggestedEvent {
  title: string;
  type: string;
  date: string;
  time?: string;
  location?: string;
  note?: string;
}

interface PlanMissionRow {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
  icon: PixelIconName;
  tone: string;
  actionLabel: string;
  onPress: () => void;
}

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const consumerSurfacePolicy = getConsumerSurfacePolicy();
  const ownerOps = consumerSurfacePolicy.ownerOps;
  const { state, updateCareDoc, addEntry, deleteEntry } = useCare();

  const { getToken } = useWoofAuth();
  const {
    routines,
    calendarEvents,
    profile,
    entries,
    caregivers,
    records,
    launchProviderProfile,
    reminderNotificationPreferences,
  } = state;

  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "tabbed",
  });
  const bottomPadding = getTabbedRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const modalSheetBottomPadding = getModalSheetBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const now = Date.now();
  const today = todayISO();
  const [scheduleTab, setScheduleTab] = useState<"day" | "week" | "month">("day");

  // Add-event modal
  const [addOpen, setAddOpen] = useState(false);
  const [evTitle, setEvTitle] = useState("");
  const [evType, setEvType] = useState<string>("event");
  const [evDate, setEvDate] = useState(today);
  const [evTime, setEvTime] = useState("");
  const [evLocation, setEvLocation] = useState("");

  // Routine editor
  const [routineOpen, setRoutineOpen] = useState(false);
  const [routineEditId, setRoutineEditId] = useState<string | null>(null);
  const [rLabel, setRLabel] = useState("");
  const [rType, setRType] = useState("meal");
  const [rTime, setRTime] = useState("");
  const [rOwner, setROwner] = useState("");
  const [rNote, setRNote] = useState("");
  const [rTimeError, setRTimeError] = useState<string | null>(null);
  const [routineFeedback, setRoutineFeedback] = useState<{ id: string; title: string; type: string } | null>(null);
  const routineFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // WoofGuide discovery
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedEvent[]>([]);
  const [discoverMode, setDiscoverMode] = useState<string | null>(null);
  // Terminal state of the last event search: the Find button must never
  // resolve to silence - an unreachable endpoint or zero results without
  // feedback reads as a dead button.
  const [discoverStatus, setDiscoverStatus] = useState<"idle" | "empty" | "error">("idle");

  const sortedRoutines = useMemo(
    () => [...routines].sort((a, b) => routineMinutes(a.time) - routineMinutes(b.time)),
    [routines],
  );

  const routineBoard = useMemo(
    () => deriveRoutineBoard({ routines: sortedRoutines, entries, caregivers, now }),
    [sortedRoutines, entries, caregivers, now],
  );
  // Month segment: the current month's real logs bucketed into local days
  // (reuses the same pure month math as the full /calendar-month route).
  const monthView = useMemo(() => {
    const base = new Date(now);
    return buildMonthView({
      year: base.getFullYear(),
      month: base.getMonth(),
      todayKey: dateKeyOf(base),
      entries,
    });
  }, [now, entries]);
  const monthEntryDays = useMemo(
    () => monthView.weeks.flat().filter((cell) => cell.inMonth && cell.hasEntries).length,
    [monthView],
  );
  const monthEntryLabel = monthEntryDays === 0 ? "No logs yet" : `${monthEntryDays} active`;
  // Fresh installs have no routines yet, so the schedule falls back to a
  // hardcoded sample day. Those rows have no backing routine, so they must
  // render as clearly-labeled, non-interactive preview content.
  const isSampleSchedule = routineBoard.items.length === 0;
  const scheduleRows = useMemo(() => {
    const fallback: {
      id: string;
      label: string;
      type: string;
      time: string;
      detail: string;
      status: RoutineBoardStatus;
      owner?: string;
    }[] = [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:00 AM", detail: "1 1/4 cups", status: "done" as RoutineBoardStatus },
      { id: "walk-am", label: "Walk", type: "walk", time: "8:00 AM", detail: "45 min", status: "done" as RoutineBoardStatus },
      { id: "training", label: "Training", type: "training", time: "10:00 AM", detail: "15 min", status: "done" as RoutineBoardStatus },
      { id: "alone", label: "Alone Time", type: "alone", time: "12:30 PM", detail: "1h 30m", status: "due" as RoutineBoardStatus },
      { id: "walk-pm", label: "Walk", type: "walk", time: "5:30 PM", detail: "30 min", status: "upcoming" as RoutineBoardStatus },
      { id: "dinner", label: "Dinner", type: "meal", time: "7:00 PM", detail: "1 1/4 cups", status: "upcoming" as RoutineBoardStatus },
      { id: "snack", label: "Bedtime Snack", type: "meal", time: "9:00 PM", detail: "small", status: "upcoming" as RoutineBoardStatus },
    ];
    const rows = routineBoard.items.length
      ? routineBoard.items.map((item) => ({
          id: item.id,
          label: item.label,
          type: item.normalizedType,
          time: item.time,
          owner: item.owner || "",
          detail: item.note || "",
          status: item.status,
        }))
      : fallback;
    return rows;
  }, [routineBoard.items]);

  // Monday-start week containing today, for the mockup M T W T F S S dots.
  const weekDays = useMemo(() => {
    const monday = new Date(now);
    monday.setHours(12, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + index);
      return day;
    });
  }, [now]);
  const todayWeekIndex = weekDays.findIndex((day) => localDayKey(day) === localDayKey(new Date(now)));

  // Week-board dot fills reuse the exact routine board derivation the Today
  // tab shows: deriveRoutineBoard scoped to each past day of this week marks
  // a routine "done" only when a real completing log matches it that local
  // day (routineId link, then type + time window, then title match). Today's
  // column reads straight from the live routineBoard; future days can hold
  // no logs yet, so they never fill.
  const weeklyRoutineDots = useMemo(() => {
    const todayKey = localDayKey(new Date(now));
    return weekDays.map((day) => {
      const dayKey = localDayKey(day);
      if (dayKey === todayKey) {
        return new Map(routineBoard.items.map((item) => [item.id, item.status === "done"]));
      }
      if (day.getTime() > now) return new Map<string, boolean>();
      const dayBoard = deriveRoutineBoard({ routines: sortedRoutines, entries, caregivers, now: day.getTime() });
      return new Map(dayBoard.items.map((item) => [item.id, item.status === "done"]));
    });
  }, [weekDays, routineBoard.items, sortedRoutines, entries, caregivers, now]);

  // Weekly goal counts the days of this week with at least one real care
  // log - the same day-with-a-log rule deriveCareStreak counts, so the goal
  // and the streak chip tell one coherent story.
  const weeklyGoalDays = useMemo(() => {
    const loggedDays = new Set<string>();
    for (const entry of entries) {
      const occurred = Date.parse(entry.occurredAt ?? "");
      if (!Number.isFinite(occurred) || occurred > now) continue;
      loggedDays.add(localDayKey(new Date(occurred)));
    }
    return weekDays.filter((day) => loggedDays.has(localDayKey(day))).length;
  }, [entries, weekDays, now]);
  const careStreak = useMemo(() => deriveCareStreak(entries, now), [entries, now]);

  const householdResponsibility = useMemo(
    () => deriveHouseholdResponsibility({ routines: sortedRoutines, entries, caregivers, now }),
    [sortedRoutines, entries, caregivers, now],
  );
  const reminderNotificationPreferenceInput = useMemo(
    () => buildReminderNotificationPreferencesForCenter(launchProviderProfile, reminderNotificationPreferences),
    [launchProviderProfile, reminderNotificationPreferences],
  );
  const careReminderCenter = useMemo(
    () => deriveCareReminderCenter({
      routines: sortedRoutines,
      entries,
      records,
      caregivers,
      notificationPreferences: reminderNotificationPreferenceInput,
      now,
      limit: 4,
    }),
    [sortedRoutines, entries, records, caregivers, reminderNotificationPreferenceInput, now],
  );
  const reminderCount = careReminderCenter.total;
  const reminderTone =
    careReminderCenter.status === "attention"
      ? colors.rose
      : careReminderCenter.status === "watch"
        ? colors.amber
        : colors.sage;
  const responsibility = householdResponsibility;
  const assignedOwnerLoads = responsibility.members.filter((member) => member.assigned > 0);
  const responsibilityTone =
    responsibility.status === "needs-care"
      ? colors.rose
      : responsibility.status === "needs-assignment"
        ? colors.amber
        : colors.sage;
  const responsibilityIsCovered = responsibility.status === "balanced" || responsibility.status === "steady";
  const completedScheduleCount = scheduleRows.filter((row) => row.status === "done").length;
  const openScheduleCount = Math.max(0, scheduleRows.length - completedScheduleCount);
  const nextScheduleRow = scheduleRows.find((row) => row.status !== "done") ?? scheduleRows[0];
  const nextScheduleStatus = nextScheduleRow ? routineStatusLabel(nextScheduleRow.status) : "Ready";
  const firstUpcomingScheduleIndex = scheduleRows.findIndex((row) => row.status === "upcoming");
  const commandDeckTone =
    nextScheduleRow?.status === "overdue"
      ? colors.rose
      : nextScheduleRow?.status === "due"
        ? colors.amber
        : colors.sage;
  const commandDeckSpeech = isSampleSchedule
    ? "Here's a sample day. Add your first routine to make it yours."
    : nextScheduleRow
      ? `${nextScheduleRow.label} is next at ${nextScheduleRow.time}.`
      : `${resolvePetName(profile.name)} has a clear care board.`;
  const commandDeckStatusTone: BoardStatusPillTone = isSampleSchedule
    ? "neutral"
    : nextScheduleRow?.status === "done"
      ? "done"
      : nextScheduleRow?.status === "overdue" || nextScheduleRow?.status === "due"
        ? "due"
        : "upcoming";

  // Group upcoming one-off events by date.
  const upcoming = useMemo(() => {
    const future = [...calendarEvents]
      .filter((e) => e.date >= today)
      .sort((a, b) => (a.date === b.date ? (a.time ?? "").localeCompare(b.time ?? "") : a.date.localeCompare(b.date)));
    const groups: { date: string; events: CalendarEvent[] }[] = [];
    for (const e of future) {
      const g = groups.find((x) => x.date === e.date);
      if (g) g.events.push(e);
      else groups.push({ date: e.date, events: [e] });
    }
    return groups;
  }, [calendarEvents, today]);

  const addEvent = (ev: Omit<CalendarEvent, "id">) => {
    const id = `event_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    updateCareDoc((doc) => ({ ...doc, calendarEvents: [...doc.calendarEvents, { id, ...ev }] }));
  };

  const removeEvent = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateCareDoc((doc) => ({ ...doc, calendarEvents: doc.calendarEvents.filter((e) => e.id !== id) }));
  };

  const [dateError, setDateError] = useState<string | null>(null);

  const openAddEvent = () => {
    // Prefill real, submittable defaults (today + next round hour) so the
    // sheet never opens with grey placeholders that look like filled values.
    if (!parseLocalDate(evDate)) setEvDate(todayISO());
    if (!evTime.trim()) setEvTime(nextRoundHourLabel());
    setDateError(null);
    setAddOpen(true);
  };

  const submitEvent = () => {
    if (!evTitle.trim()) return;
    if (!parseLocalDate(evDate)) {
      setDateError("Enter a valid date (YYYY-MM-DD)");
      return;
    }
    setDateError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addEvent({
      title: evTitle.trim(),
      type: evType,
      date: evDate,
      time: evTime.trim() || undefined,
      location: evLocation.trim() || undefined,
      source: "manual",
    });
    setEvTitle("");
    setEvTime("");
    setEvLocation("");
    setEvType("event");
    setEvDate(today);
    setAddOpen(false);
  };

  const openNewRoutine = () => {
    setRoutineEditId(null);
    setRLabel("");
    setRType("meal");
    // Real default instead of a placeholder-lookalike so Add Routine works
    // immediately; owners can still type any "4:00 PM"-style time over it.
    setRTime(nextRoundHourLabel());
    setROwner("");
    setRNote("");
    setRTimeError(null);
    setRoutineOpen(true);
  };

  const openEditRoutine = (r: Routine) => {
    setRoutineEditId(r.id);
    setRLabel(r.label);
    setRType(r.type);
    setRTime(r.time);
    setROwner(r.owner ?? "");
    setRNote(r.note ?? "");
    setRTimeError(null);
    setRoutineOpen(true);
  };

  const openBoardRoutine = (routine: RoutineBoardItem) => {
    openEditRoutine({
      id: routine.id,
      label: routine.label,
      type: routine.type,
      time: routine.time,
      owner: routine.owner,
      note: routine.note ?? "",
    });
  };

  const saveReminderNotificationPreferences = (
    draft: Parameters<typeof applyReminderNotificationPreferenceDraft>[1],
  ) => {
    Haptics.selectionAsync();
    const savedAt = new Date().toISOString();
    updateCareDoc((doc) => applyReminderNotificationPreferenceDraft(doc, draft, savedAt));
  };

  const openPushNotificationProofMission = () => {
    Haptics.selectionAsync();
    router.push("/care-twin-qa?qaSurface=push-notifications-proof" as never);
  };

  const openReminderLogDetailRoute = (type: string) => {
    router.push(`/log?type=${encodeURIComponent(type)}&detail=1&intent=${Date.now()}` as never);
  };

  const openReminderAction = (item: CareReminderItem) => {
    Haptics.selectionAsync();
    const routine = item.sourceId ? routineBoard.items.find((candidate) => candidate.id === item.sourceId) : null;
    if (item.kind === "routine" && routine) {
      openBoardRoutine(routine);
      return;
    }
    if (item.kind === "medication" && routine) {
      openReminderLogDetailRoute("medication");
      return;
    }
    if (item.kind === "grooming") {
      openReminderLogDetailRoute("grooming");
      return;
    }
    if (item.kind === "record" || item.kind === "medication") {
      router.push("/records");
    }
  };

  const deleteRoutine = (id: string) => {
    confirmThroughSteps(
      [
        {
          title: "Delete Routine",
          message: "Remove this routine from your schedule?",
          confirmLabel: "Delete",
          destructive: true,
        },
      ],
      () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        updateCareDoc((doc) => ({ ...doc, routines: doc.routines.filter((r) => r.id !== id) }));
        setRoutineOpen(false);
      },
    );
  };

  const submitRoutine = () => {
    if (!rLabel.trim()) return;
    if (!rTime.trim()) {
      setRTimeError("Enter a time (e.g. 7:00 AM)");
      return;
    }
    setRTimeError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (routineEditId) {
      updateCareDoc((doc) => ({
        ...doc,
        routines: doc.routines.map((r) =>
          r.id === routineEditId
            ? { ...r, label: rLabel.trim(), type: rType, time: rTime.trim(), owner: rOwner.trim(), note: rNote.trim() }
            : r,
        ),
      }));
    } else {
      const id = `routine_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      updateCareDoc((doc) => ({
        ...doc,
        routines: [...doc.routines, { id, label: rLabel.trim(), type: rType, time: rTime.trim(), owner: rOwner.trim(), note: rNote.trim() }],
      }));
    }
    setRoutineOpen(false);
  };

  const clearRoutineFeedbackTimer = () => {
    if (routineFeedbackTimer.current) {
      clearTimeout(routineFeedbackTimer.current);
      routineFeedbackTimer.current = null;
    }
  };

  const showRoutineFeedback = (feedback: { id: string; title: string; type: string }) => {
    clearRoutineFeedbackTimer();
    setRoutineFeedback(feedback);
    // The feedback card auto-dismisses in 9s - announce for screen readers.
    announce(`${feedback.title} logged. Undo available.`);
    routineFeedbackTimer.current = setTimeout(() => {
      setRoutineFeedback(null);
      routineFeedbackTimer.current = null;
    }, 9000);
  };

  const undoRoutineFeedback = () => {
    if (!routineFeedback) return;
    clearRoutineFeedbackTimer();
    void deleteEntry(routineFeedback.id);
    setRoutineFeedback(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const openRoutineFeedbackDetails = () => {
    if (!routineFeedback) return;
    const entryId = routineFeedback.id;
    clearRoutineFeedbackTimer();
    setRoutineFeedback(null);
    Haptics.selectionAsync();
    router.push(`/log?entry=${encodeURIComponent(entryId)}` as never);
  };

  const logRoutineDone = (routine: {
    id: string;
    label: string;
    type: string;
    time: string;
    owner?: string | null;
    note?: string | null;
  }) => {
    const type = normalizeCareEventType(routine.type);
    const owner = typeof routine.owner === "string" ? routine.owner.trim() : "";
    const note = typeof routine.note === "string" ? routine.note.trim() : "";
    const caregiver = owner || caregivers[0]?.name || "You";
    const details: { [key: string]: unknown } = {
      routineId: routine.id,
      routineLabel: routine.label,
      routineTime: routine.time,
    };
    if (type === "meal") {
      details.mealCompletion = "complete";
      details.householdVisible = true;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const id = addEntry({
      type,
      title: routine.label,
      caregiver,
      occurredAt: new Date().toISOString(),
      ...(note ? { note } : {}),
      details,
    });
    showRoutineFeedback({ id, title: routine.label, type });
  };

  const discover = async () => {
    if (loadingEvents) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingEvents(true);
    setSuggestions([]);
    setDiscoverStatus("idle");
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/woofguide-events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          location: location.trim(),
          profile: { name: profile.name, breed: profile.breed, careFocus: profile.careFocus, background: profile.background },
        }),
      });
      const data = await res.json();
      const events = Array.isArray(data.events) ? data.events : [];
      setSuggestions(events);
      setDiscoverMode(data.mode ?? null);
      if (!events.length) {
        setDiscoverStatus("empty");
        announce("No dog events found for that area yet.");
      }
    } catch {
      setSuggestions([]);
      setDiscoverStatus("error");
      announce("Event search is unreachable right now.");
    } finally {
      setLoadingEvents(false);
    }
  };

  const addSuggestion = (sug: SuggestedEvent) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addEvent({
      title: sug.title,
      type: sug.type || "event",
      date: sug.date,
      time: sug.time,
      location: sug.location,
      note: sug.note,
      source: "woofguide",
    });
    setSuggestions((prev) => prev.filter((s) => s !== sug));
  };

  const nextScheduleRoutine = nextScheduleRow
    ? routineBoard.items.find((item) => item.id === nextScheduleRow.id)
    : null;
  const leadReminder = careReminderCenter.items[0] ?? null;
  const planMissionRows: PlanMissionRow[] = [];

  if (nextScheduleRow) {
    planMissionRows.push(
      isSampleSchedule
        ? {
            id: "next-plan",
            eyebrow: "Next Mission",
            title: "Add your first routine",
            detail: "The schedule shows a sample day until you do",
            icon: routinePixelIcon(nextScheduleRow.type),
            tone: commandDeckTone,
            actionLabel: "Add",
            onPress: () => {
              Haptics.selectionAsync();
              openNewRoutine();
            },
          }
        : {
            id: "next-plan",
            eyebrow: "Next Mission",
            title: nextScheduleRow.label,
            // No dangling "6:30 PM -" when the routine carries no note.
            detail: [nextScheduleRow.time, nextScheduleRow.detail].filter(Boolean).join(" - "),
            icon: routinePixelIcon(nextScheduleRow.type),
            tone: commandDeckTone,
            actionLabel: nextScheduleRoutine ? "Open" : nextScheduleStatus,
            onPress: () => {
              Haptics.selectionAsync();
              if (nextScheduleRoutine) openBoardRoutine(nextScheduleRoutine);
            },
          },
    );
  }

  planMissionRows.push({
    id: "household-sync",
    eyebrow: "Household Sync",
    title: responsibilityIsCovered ? "Care board is covered" : "Needs owner attention",
    detail: responsibility.nextStep,
    icon: "heart",
    tone: responsibilityTone,
    actionLabel: responsibilityIsCovered ? "Covered" : "Review",
    onPress: () => {
      Haptics.selectionAsync();
      router.push("/more" as never);
    },
  });

  planMissionRows.push(
    leadReminder
      ? {
          id: "lead-reminder",
          eyebrow: "Reminder",
          title: leadReminder.label,
          detail: leadReminder.action,
          icon: leadReminder.kind === "medication" ? "medication" : "clock",
          tone: reminderTone,
          actionLabel: "Resolve",
          onPress: () => openReminderAction(leadReminder),
        }
      : {
          id: "clear-reminder",
          eyebrow: "Reminder",
          title: "No owner reminders",
          detail: careReminderCenter.summary,
          icon: "happy",
          tone: colors.sage,
          actionLabel: "Clear",
          onPress: () => {
            Haptics.selectionAsync();
          },
        },
  );

  const isAdded = (sug: SuggestedEvent) =>
    calendarEvents.some((e) => e.title === sug.title && e.date === sug.date);

  // Mount animation
  const isWebRoutePreview = (Platform.OS as string) === "web";
  const fade = useRef(new Animated.Value(isWebRoutePreview ? 1 : 0)).current;
  const slide = useRef(new Animated.Value(isWebRoutePreview ? 0 : 16)).current;
  useEffect(() => {
    return () => {
      if (routineFeedbackTimer.current) clearTimeout(routineFeedbackTimer.current);
    };
  }, []);
  useEffect(() => {
    if (isWebRoutePreview) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 460, useNativeDriver: !isWebRoutePreview }),
      Animated.spring(slide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: !isWebRoutePreview }),
    ]).start();
  }, [fade, isWebRoutePreview, slide]);

  const dateLabel = new Date(now).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const H_PAD = 16;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        {...getFormKeyboardScrollProps(Platform.OS)}
        style={s.container}
        contentContainerStyle={{ paddingTop: topPadding, paddingBottom: bottomPadding, paddingHorizontal: H_PAD }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <BoardRouteHeader
            title="Plan"
            subtitle={dateLabel}
            actionIcon="add"
            actionLabel="Add plan"
            onAction={() => {
              Haptics.selectionAsync();
              openAddEvent();
            }}
          />

          <BoardCard enter={0} style={s.commandDeckCard}>
            <View style={s.commandDeckStage} testID="plans-command-pixel-stage">
              <View style={s.commandDeckTop}>
                <View style={s.commandDeckCopy}>
                  <Text style={[s.commandDeckKicker, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                    Plans Command Deck
                  </Text>
                  <Text style={[s.commandDeckSpeech, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {commandDeckSpeech}
                  </Text>
                  <BoardStatusPill
                    label={isSampleSchedule ? "Sample day" : nextScheduleStatus}
                    tone={commandDeckStatusTone}
                    style={s.commandDeckStatusPill}
                  />
                </View>
                <ImageBackground
                  accessible={false}
                  source={PLANS_COMMAND_STAGE_ROOM}
                  resizeMode="cover"
                  imageStyle={[stageImageFill, s.commandDeckSceneImage, pixelImageStyle]}
                  style={[s.commandDeckScene, { borderColor: colors.brandNavy + "33" }]}
                >
                  <SpriteSheetPlayer
                    asset={PLANS_COMMAND_STAGE_SPRITE}
                    track={PLANS_COMMAND_STAGE_TRACK}
                    width={58}
                    height={58}
                    testID="plans-command-pixel-sprite"
                  />
                </ImageBackground>
              </View>

              <View style={s.commandDeckStats}>
                {[
                  { key: "done", label: "Done", value: isSampleSchedule ? "—" : `${completedScheduleCount}/${scheduleRows.length}` },
                  { key: "open", label: "Open", value: isSampleSchedule ? "—" : `${openScheduleCount}` },
                ].map((stat) => (
                  <View
                    key={stat.key}
                    accessible
                    accessibilityLabel={`${stat.label}: ${stat.value}`}
                    style={[s.commandDeckStatChip, { backgroundColor: colors.background, borderColor: colors.border }]}
                  >
                    <Text style={[s.commandDeckStatLabel, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                      {stat.label}
                    </Text>
                    <Text style={[s.commandDeckStatValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                      {stat.value}
                    </Text>
                  </View>
                ))}
                <View
                  accessible
                  accessibilityLabel={`Signal: ${isSampleSchedule ? 1 : Math.max(1, Math.min(5, openScheduleCount + 1))} of 5`}
                  style={[s.commandDeckStatChip, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <Text style={[s.commandDeckStatLabel, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>Signal</Text>
                  <View style={s.commandDeckSignalRow}>
                    {[0, 1, 2, 3, 4].map((bar) => {
                      const activeBars = isSampleSchedule ? 1 : Math.max(1, Math.min(5, openScheduleCount + 1));
                      const filled = bar < activeBars;
                      return (
                        <View
                          key={bar}
                          style={[
                            s.commandDeckSignalBar,
                            {
                              height: 6 + bar * 2,
                              backgroundColor: filled
                                ? isSampleSchedule
                                  ? colors.mutedForeground
                                  : commandDeckTone
                                : colors.muted,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>
          </BoardCard>

          <BoardCard enter={1} style={s.scheduleCard}>
            <View style={s.scheduleCardHeader}>
              <View style={s.scheduleHeaderCopy}>
                <Text style={[s.scheduleEyebrow, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>Mission Schedule</Text>
                <Text style={[s.scheduleHeaderTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {scheduleTab === "day" ? "Today's care plan" : scheduleTab === "week" ? "This week's plan" : "This month"}
                </Text>
              </View>
              {scheduleTab === "week" ? (
                <BoardPill label={`${weeklyGoalDays}/7 days`} tone={colors.sage} />
              ) : scheduleTab === "month" ? (
                <BoardPill label={monthEntryLabel} tone={colors.sage} />
              ) : isSampleSchedule ? (
                <BoardPill label="Sample day" tone={colors.mutedForeground} />
              ) : (
                <BoardPill
                  label={openScheduleCount === 0 ? "Clear" : `${openScheduleCount} open`}
                  tone={openScheduleCount === 0 ? colors.sage : commandDeckTone}
                />
              )}
            </View>
            <BoardSegmentTabs
              segments={[
                { key: "day" as const, label: "Day" },
                { key: "week" as const, label: "Week" },
                { key: "month" as const, label: "Month" },
              ]}
              active={scheduleTab}
              onChange={(key) => {
                Haptics.selectionAsync();
                setScheduleTab(key);
              }}
              style={s.scheduleTabs}
            />

            {scheduleTab === "week" ? (
              <>
                <View
                  accessible
                  accessibilityLabel={`Weekly goal: ${weeklyGoalDays} of 7 days with care logged this week. Current streak ${careStreak} ${careStreak === 1 ? "day" : "days"}.`}
                  style={[s.weeklyGoalPanel, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <View style={s.weeklyGoalTop}>
                    <View style={s.weeklyGoalCopy}>
                      <Text style={[s.weeklyGoalKicker, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                        Weekly goal
                      </Text>
                      <Text style={[s.weeklyGoalValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                        {weeklyGoalDays}/7 days
                      </Text>
                    </View>
                    <View style={[s.weeklyStreakChip, { backgroundColor: colors.sageSoft }]}>
                      <Ionicons name="flame" size={13} color={colors.forest} />
                      <Text style={[s.weeklyStreakText, { color: colors.forest, fontFamily: "Inter_700Bold" }]}>
                        Current streak {careStreak} {careStreak === 1 ? "day" : "days"}
                      </Text>
                    </View>
                  </View>
                  <ProgressFill
                    ratio={weeklyGoalDays / 7}
                    color={colors.forest}
                    trackColor={colors.muted}
                    height={8}
                    style={s.weeklyGoalBar}
                  />
                  <Text style={[s.weeklyGoalHint, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    Days with at least one care log count toward the goal.
                  </Text>
                </View>

                {routineBoard.items.length === 0 ? (
                  <View style={[s.weekPlanEmpty, { backgroundColor: colors.background }]}>
                    <PixelIcon name="clock" size={26} />
                    <Text style={[s.weekPlanEmptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      No routines yet. Add one below and this board fills in as real care gets logged.
                    </Text>
                  </View>
                ) : (
                  <View style={s.weekPlanList}>
                    {routineBoard.items.map((routine, index) => {
                      const dotFills = weeklyRoutineDots.map((dayMap) => dayMap.get(routine.id) === true);
                      const doneDays = dotFills.filter(Boolean).length;
                      return (
                        <PressScale
                          key={routine.id}
                          accessibilityRole="button"
                          accessibilityLabel={`${routine.label}: completed ${doneDays} of 7 days this week. Opens the routine editor.`}
                          haptic="none"
                          scaleTo={0.98}
                          onPress={() => {
                            Haptics.selectionAsync();
                            openBoardRoutine(routine);
                          }}
                          style={[s.weekPlanRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}
                        >
                          <View style={[s.scheduleIconChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                            <PixelIcon name={routinePixelIcon(routine.normalizedType)} size={20} />
                          </View>
                          <View style={s.weekPlanCopy}>
                            <View style={s.weekPlanTitleLine}>
                              <Text
                                numberOfLines={1}
                                style={[s.weekPlanTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                              >
                                {routine.label}
                              </Text>
                              <Text style={[s.weekPlanMeta, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                                {routine.time}
                              </Text>
                            </View>
                            <View style={s.weekDotRow}>
                              {WEEK_DAY_LETTERS.map((letter, dayIndex) => {
                                const filled = dotFills[dayIndex];
                                const isToday = dayIndex === todayWeekIndex;
                                const isFuture = dayIndex > todayWeekIndex;
                                return (
                                  <View
                                    key={`${routine.id}-${WEEK_DAY_NAMES[dayIndex]}`}
                                    accessible
                                    accessibilityLabel={`${WEEK_DAY_NAMES[dayIndex]}${isToday ? ", today" : ""}: ${filled ? "done" : isFuture ? "upcoming" : "not done"}`}
                                    style={[s.weekDotRing, { borderColor: isToday ? colors.forest : "transparent" }]}
                                  >
                                    <View
                                      style={[
                                        s.weekDot,
                                        {
                                          backgroundColor: filled ? colors.forest : "transparent",
                                          borderColor: filled ? colors.forest : colors.border,
                                          opacity: isFuture ? 0.5 : 1,
                                        },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          s.weekDotText,
                                          {
                                            color: filled
                                              ? colors.primaryForeground
                                              : isToday
                                                ? colors.forest
                                                : colors.mutedForeground,
                                            fontFamily: "Inter_700Bold",
                                          },
                                        ]}
                                      >
                                        {letter}
                                      </Text>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                        </PressScale>
                      );
                    })}
                  </View>
                )}
              </>
            ) : scheduleTab === "month" ? (
              <View>
                <View style={s.monthWeekdayRow}>
                  {WEEKDAY_LABELS.map((label, i) => (
                    <Text
                      key={`${label}-${i}`}
                      style={[s.monthWeekdayLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}
                    >
                      {label}
                    </Text>
                  ))}
                </View>
                {monthView.weeks.map((week, wi) => (
                  <View key={`month-week-${wi}`} style={s.monthWeekRow}>
                    {week.map((cell, di) => {
                      if (!cell.inMonth || cell.day === null) {
                        return <View key={`blank-${wi}-${di}`} style={s.monthDayCell} />;
                      }
                      return (
                        <View key={cell.dateKey ?? `${wi}-${di}`} style={s.monthDayCell}>
                          <View
                            style={[
                              s.monthDayCircle,
                              cell.isToday && { borderWidth: 1.5, borderColor: colors.primary },
                            ]}
                          >
                            <Text
                              style={[
                                s.monthDayNumber,
                                {
                                  color: cell.isToday ? colors.forest : colors.foreground,
                                  fontFamily: cell.isToday ? "Inter_700Bold" : "Inter_600SemiBold",
                                },
                              ]}
                            >
                              {cell.day}
                            </Text>
                          </View>
                          <View
                            style={[s.monthDayDot, { backgroundColor: cell.hasEntries ? colors.forest : "transparent" }]}
                          />
                        </View>
                      );
                    })}
                  </View>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open the full month calendar with day-by-day detail"
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push("/calendar-month" as never);
                  }}
                  style={({ pressed }) => [
                    s.monthOpenBtn,
                    { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="calendar-outline" size={15} color={colors.forest} />
                  <Text style={[s.monthOpenBtnText, { color: colors.forest, fontFamily: "Inter_700Bold" }]}>
                    Open full month
                  </Text>
                </Pressable>
              </View>
            ) : (
            <View style={s.scheduleList}>
              {scheduleRows.map((row, index) => {
                const done = row.status === "done";
                const pill = scheduleStatusPill(row.status, index === firstUpcomingScheduleIndex);
                const showRowPill = pill.label !== "Upcoming";
                const band = scheduleBandForTime(row.time);
                const showBandHeader =
                  index === 0 || scheduleBandForTime(scheduleRows[index - 1].time) !== band;
                const showNowLine =
                  scheduleTab === "day" && !isSampleSchedule && index === firstUpcomingScheduleIndex;
                const bandHeader = showBandHeader ? (
                  <View style={s.scheduleBand}>
                    <Text style={[s.scheduleBandText, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                      {band.toUpperCase()}
                    </Text>
                    <View style={[s.scheduleBandRule, { backgroundColor: colors.border }]} />
                  </View>
                ) : null;
                const nowLine = showNowLine ? (
                  <View style={s.scheduleNowLine} accessible accessibilityLabel="Current time marker">
                    <View style={[s.scheduleNowChip, { backgroundColor: colors.primary }]}>
                      <Text style={[s.scheduleNowChipText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
                        NOW
                      </Text>
                    </View>
                    <View style={[s.scheduleNowBar, { backgroundColor: colors.primary }]} />
                  </View>
                ) : null;
                if (isSampleSchedule) {
                  // Preview-only sample rows: no backing routine exists, so no
                  // Pressable wrappers and no mark-done toggles render here.
                  return (
                    <React.Fragment key={`${row.id}-${index}`}>
                    {bandHeader}
                    <View
                      accessible
                      accessibilityLabel={`Sample day preview: ${row.time} ${row.label}`}
                      style={[
                        s.scheduleRow,
                        s.scheduleSampleRow,
                        index > 0 && !showBandHeader && { borderTopColor: colors.border, borderTopWidth: 1 },
                      ]}
                    >
                      <Text style={[s.scheduleTime, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                        {row.time}
                      </Text>
                      <View style={[s.scheduleIconChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <PixelIcon name={routinePixelIcon(row.type)} size={20} />
                      </View>
                      <View style={s.scheduleRowCopy}>
                        <Text style={[s.scheduleTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                          {row.label}
                        </Text>
                        <Text style={[s.scheduleDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                          {row.detail}
                        </Text>
                        {showRowPill ? (
                          <BoardStatusPill label={pill.label} tone={pill.tone} style={s.scheduleRowPill} />
                        ) : null}
                      </View>
                    </View>
                    </React.Fragment>
                  );
                }
                const sourceRoutine = routineBoard.items.find((item) => item.id === row.id);
                return (
                  <React.Fragment key={`${row.id}-${index}`}>
                  {bandHeader}
                  {nowLine}
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel={`${row.time} ${row.label}`}
                    haptic="none"
                    scaleTo={0.98}
                    onPress={() => {
                      Haptics.selectionAsync();
                      if (sourceRoutine) openBoardRoutine(sourceRoutine);
                    }}
                    style={[
                      s.scheduleRow,
                      index > 0 && !showBandHeader && !showNowLine && { borderTopColor: colors.border, borderTopWidth: 1 },
                    ]}
                  >
                    <Text style={[s.scheduleTime, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      {row.time}
                    </Text>
                    <View style={[s.scheduleIconChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <PixelIcon name={routinePixelIcon(row.type)} size={20} />
                    </View>
                    <View style={s.scheduleRowCopy}>
                      <Text style={[s.scheduleTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        {row.label}
                      </Text>
                      {row.owner ? (
                        <View style={s.scheduleOwnerRow}>
                          <Ionicons name="person-outline" size={11} color={colors.mutedForeground} />
                          <Text
                            numberOfLines={1}
                            style={[s.scheduleDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                          >
                            {row.owner}
                          </Text>
                        </View>
                      ) : row.detail ? (
                        <Text style={[s.scheduleDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                          {row.detail}
                        </Text>
                      ) : null}
                      {showRowPill ? (
                        <BoardStatusPill label={pill.label} tone={pill.tone} style={s.scheduleRowPill} />
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Mark ${row.label} done`}
                      onPress={(event) => {
                        event.stopPropagation();
                        if (sourceRoutine) logRoutineDone(sourceRoutine);
                      }}
                      style={[
                        s.scheduleStatus,
                        {
                          borderColor: done ? colors.sage : colors.border,
                          backgroundColor: done ? colors.sage : "transparent",
                        },
                      ]}
                    >
                      {done ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}
                    </Pressable>
                  </PressScale>
                  </React.Fragment>
                );
              })}
            </View>
            )}

            {isSampleSchedule && scheduleTab === "day" ? (
              <Text style={[s.scheduleSampleNote, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                This is a sample day to show how your plan will look. Add your first routine to make it real.
              </Text>
            ) : null}

            <BoardActionButton
              label={isSampleSchedule ? "Add your first routine" : "Add routine"}
              icon="add"
              accessibilityLabel={isSampleSchedule ? "Add your first routine" : "Add routine"}
              onPress={() => {
                Haptics.selectionAsync();
                openNewRoutine();
              }}
              style={s.scheduleAddButton}
            />
          </BoardCard>

          <BoardCard enter={2} style={s.planMissionBoard}>
            <BoardSectionHeader
              title="Today's Missions"
              accessory={
                <BoardPill
                  label={
                    isSampleSchedule
                      ? "Sample day"
                      : `${completedScheduleCount}/${scheduleRows.length} done`
                  }
                  tone={commandDeckTone}
                />
              }
            />
            <View style={s.planMissionList}>
              {planMissionRows.map((mission, index) => (
                <Pressable
                  key={mission.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${mission.eyebrow}: ${mission.title}`}
                  onPress={mission.onPress}
                  style={({ pressed }) => [
                    s.planMissionRow,
                    {
                      backgroundColor: pressed ? mission.tone + "10" : colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={[s.planMissionIcon, { backgroundColor: mission.tone + "18" }]}>
                    <PixelIcon name={mission.icon} size={22} />
                  </View>
                  <View style={s.planMissionCopy}>
                    <Text style={[s.planMissionEyebrow, { color: mission.tone, fontFamily: "Inter_800ExtraBold" }]}>
                      {mission.eyebrow}
                    </Text>
                    <Text numberOfLines={1} style={[s.planMissionTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                      {mission.title}
                    </Text>
                    <Text numberOfLines={1} style={[s.planMissionDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {mission.detail}
                    </Text>
                  </View>
                  <View style={[s.planMissionAction, { backgroundColor: mission.tone + "16" }]}>
                    <Text style={[s.planMissionActionText, { color: mission.tone, fontFamily: "Inter_800ExtraBold" }]}>
                      {mission.actionLabel}
                    </Text>
                    <Ionicons name="chevron-forward" size={13} color={mission.tone} />
                  </View>
                  {index < planMissionRows.length - 1 ? <View style={[s.planMissionDivider, { backgroundColor: colors.border }]} /> : null}
                </Pressable>
              ))}
            </View>
          </BoardCard>

          {consumerSurfacePolicy.discoverEvents ? (
            <>
              {/* Server-backed discovery stays available for internal QA but
                  is not a promise in the free, local-first store build. */}
              <Pressable
                accessibilityRole="button"
                aria-expanded={discoverOpen}
                onPress={() => { Haptics.selectionAsync(); setDiscoverOpen((v) => !v); }}
                style={[s.discoverCard, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
              >
                <View style={s.discoverIcon}>
                  <Ionicons name="sparkles" size={20} color={colors.primaryForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.discoverTitle, { color: colors.primaryForeground, fontFamily: DISPLAY_SEMI }]}>Discover nearby dog events</Text>
                  <Text style={[s.discoverSub, { color: colors.primaryForeground, opacity: 0.85, fontFamily: "Inter_400Regular" }]}>WoofGuide curates outings for {resolvePetName(profile.name)}</Text>
                </View>
                <Ionicons name={discoverOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.primaryForeground} />
              </Pressable>

              {discoverOpen && (
                <View style={[s.discoverPanel, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
                  <View style={s.discoverInputRow}>
                    <Ionicons name="location-outline" size={18} color={colors.mutedForeground} />
                    <TextInput
                      value={location}
                      onChangeText={setLocation}
                      placeholder="Your city or area"
                      placeholderTextColor={colors.mutedForeground}
                      style={[s.discoverInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                      returnKeyType="search"
                      onSubmitEditing={discover}
                    />
                    <Pressable onPress={discover} disabled={loadingEvents} style={[s.discoverGo, { backgroundColor: colors.copper }]}>
                      {loadingEvents ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[s.discoverGoText, { fontFamily: "Inter_700Bold" }]}>Find</Text>}
                    </Pressable>
                  </View>

                  {suggestions.length === 0 && discoverStatus !== "idle" && (
                    <Text
                      aria-live="polite"
                      style={[s.discoverHint, { color: colors.mutedForeground, fontFamily: "Inter_500Medium", marginTop: 6 }]}
                    >
                      {discoverStatus === "empty"
                        ? `No dog events found near "${location.trim() || "your area"}" yet - try a nearby city, or plan your own outing below.`
                        : "Couldn't reach event search - check your connection and try again."}
                    </Text>
                  )}

                  {suggestions.length > 0 && (
                    <View style={{ marginTop: 4 }}>
                      {discoverMode === "local" && (
                        <Text style={[s.discoverHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          Curated ideas to inspire outings - confirm details before you go.
                        </Text>
                      )}
                      {suggestions.map((sug, i) => {
                        const icon = EVENT_ICON[sug.type] ?? "calendar";
                        const added = isAdded(sug);
                        return (
                          <View key={`${sug.title}-${i}`} style={[s.sugRow, i < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                            <View style={[s.sugIcon, { backgroundColor: colors.sage + "16" }]}>
                              <Ionicons name={icon} size={18} color={colors.sage} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.sugTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{sug.title}</Text>
                              <Text style={[s.sugMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                                {dayLabel(sug.date)}{sug.time ? ` - ${sug.time}` : ""}
                              </Text>
                              {sug.note ? (
                                <Text numberOfLines={2} style={[s.sugNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{sug.note}</Text>
                              ) : null}
                            </View>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={added ? `${sug.title} added` : `Add ${sug.title}`}
                              aria-disabled={added}
                              onPress={() => !added && addSuggestion(sug)}
                              hitSlop={MOBILE_INLINE_HIT_SLOP}
                              style={[s.sugAdd, { backgroundColor: added ? colors.sage + "22" : colors.primary }]}
                            >
                              <Ionicons name={added ? "checkmark" : "add"} size={18} color={added ? colors.sage : colors.primaryForeground} />
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </>
          ) : null}

          {/* Upcoming one-off events */}
          <BoardCard enter={3} style={s.upcomingBoardCard}>
            <BoardSectionHeader
              title="Upcoming Events"
              accessory={<BoardPill label={upcoming.length ? `${upcoming.length} days` : "Add one"} tone={colors.primary} />}
            />
            {upcoming.length === 0 ? (
              <View style={[s.emptyPanel, { backgroundColor: colors.background }]}>
                <Ionicons name="calendar-outline" size={30} color={colors.mutedForeground} />
                <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {consumerSurfacePolicy.discoverEvents
                    ? "No events planned. Add one or discover nearby outings above."
                    : "No outings planned. Add one to keep walks, appointments, and adventures in one place."}
                </Text>
              </View>
            ) : (
              upcoming.map((group) => (
                <View key={group.date} style={{ marginBottom: 18 }}>
                  <Text style={[s.dayHeading, { color: colors.copper, fontFamily: "Inter_700Bold" }]}>{dayLabel(group.date)}</Text>
                  {group.events.map((e) => {
                    const icon = EVENT_ICON[e.type] ?? "calendar";
                    const daysUntil = Math.round((new Date(`${e.date}T12:00:00`).getTime() - Date.now()) / 86400000);
                    const countdownLabel = daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : daysUntil <= 7 ? `${daysUntil}d away` : null;
                    return (
                      <View key={e.id} style={[s.eventPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <View style={[s.eventIcon, { backgroundColor: colors.sage + "16" }]}>
                          <Ionicons name={icon} size={20} color={colors.sage} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={s.eventTitleLine}>
                            <Text style={[s.eventTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{e.title}</Text>
                            {e.source === "woofguide" && (
                              <View style={[s.tag, { backgroundColor: colors.primary + "16" }]}>
                                <Ionicons name="sparkles" size={9} color={colors.primary} />
                                <Text style={[s.tagText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>WoofGuide</Text>
                              </View>
                            )}
                            {countdownLabel && (
                              <View style={[s.tag, { backgroundColor: (daysUntil === 0 ? colors.copper : colors.sage) + "18" }]}>
                                <Text style={[s.tagText, { color: daysUntil === 0 ? colors.copper : colors.sage, fontFamily: "Inter_700Bold" }]}>{countdownLabel}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[s.eventMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                            {[e.time, e.location].filter(Boolean).join(" - ") || "All day"}
                          </Text>
                          {e.note ? (
                            <Text numberOfLines={2} style={[s.eventNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{e.note}</Text>
                          ) : null}
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${e.title}`}
                          onPress={() => removeEvent(e.id)}
                          hitSlop={MOBILE_INLINE_HIT_SLOP}
                          style={s.removeBtn}
                        >
                          <Ionicons name="close" size={16} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </BoardCard>

          {/* Reminder Center */}
          <BoardCard enter={4} style={[s.plansBoardCard, { borderColor: reminderTone + "44" }]}>
            <BoardSectionHeader
              title="Reminder Center"
              accessory={<BoardPill label={reminderCount === 0 ? "Clear" : `${reminderCount} active`} tone={reminderTone} />}
            />
            <View style={s.responsibilityTop}>
              <View style={[s.responsibilityIcon, { backgroundColor: reminderTone + "18" }]}>
                <Ionicons name="notifications-outline" size={18} color={reminderTone} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.responsibilityTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Owner Action List</Text>
                <Text style={[s.responsibilitySummary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {careReminderCenter.summary}
                </Text>
              </View>
            </View>
            <View style={s.responsibilityMetrics}>
              {[
                { label: "Urgent", value: careReminderCenter.alertCount },
                { label: "Watch", value: careReminderCenter.watchCount },
                { label: "Total", value: careReminderCenter.total },
              ].map((metric) => (
                <View key={metric.label} style={[s.responsibilityMetric, { backgroundColor: colors.background }]}>
                  <Text style={[s.responsibilityMetricValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{metric.value}</Text>
                  <Text style={[s.responsibilityMetricLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{metric.label}</Text>
                </View>
              ))}
            </View>

            {careReminderCenter.items.length === 0 ? (
              <View style={[s.reminderEmpty, { backgroundColor: colors.background }]}>
                <Ionicons name="checkmark-circle-outline" size={19} color={colors.sage} />
                <Text style={[s.reminderEmptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  No owner reminders need attention right now.
                </Text>
              </View>
            ) : (
              <View style={s.reminderList}>
                {careReminderCenter.items.map((item, index) => {
                  const rowTone = item.urgency === "alert" ? colors.rose : item.urgency === "watch" ? colors.amber : colors.sage;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => openReminderAction(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open reminder action: ${item.label}`}
                      style={({ pressed }) => [
                        s.reminderRow,
                        index < careReminderCenter.items.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
                        { opacity: pressed ? 0.72 : 1 },
                      ]}
                    >
                      <View style={[s.reminderIcon, { backgroundColor: rowTone + "16" }]}>
                        <Ionicons name={REMINDER_ICON[item.kind] ?? "alarm-outline"} size={17} color={rowTone} />
                      </View>
                      <View style={s.reminderMain}>
                        <View style={s.reminderTitleLine}>
                          <Text style={[s.reminderTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{item.label}</Text>
                          <View style={[s.reminderPill, { backgroundColor: rowTone + "16" }]}>
                            <Text style={[s.reminderPillText, { color: rowTone, fontFamily: "Inter_700Bold" }]}>{reminderUrgencyLabel(item.urgency)}</Text>
                          </View>
                        </View>
                        <Text numberOfLines={2} style={[s.reminderDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{item.detail}</Text>
                        <Text numberOfLines={2} style={[s.reminderAction, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{item.action}</Text>
                      </View>
                    </Pressable>
                  );
                })}
                {careReminderCenter.total > careReminderCenter.items.length ? (
                  <Text style={[s.reminderMore, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    + {careReminderCenter.total - careReminderCenter.items.length} more reminder candidate{careReminderCenter.total - careReminderCenter.items.length === 1 ? "" : "s"} in records and routines.
                  </Text>
                ) : null}
              </View>
            )}
            <Text style={[s.reminderNext, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{careReminderCenter.nextStep}</Text>
            <Text style={[s.reminderReadiness, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {careReminderCenter.notificationReadiness}
            </Text>
            {consumerSurfacePolicy.pushNotificationControls ? (
              <View style={[s.reminderNotificationPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[s.reminderNotificationTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  Notification preferences
                </Text>
                <Text style={[s.reminderNotificationText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {careReminderCenter.notificationPreferenceSummary}
                </Text>
                <Text style={[s.reminderNotificationText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {careReminderCenter.notificationQuietHours}
                </Text>
                <Text style={[s.reminderNotificationText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {careReminderCenter.notificationOptOut}
                </Text>
                <View style={s.reminderPreferenceActions}>
                  <Pressable
                    onPress={() => saveReminderNotificationPreferences({ pushEnabled: true, optOut: false })}
                    accessibilityRole="button"
                    accessibilityLabel="Allow reminders when they arrive in a future update"
                    style={({ pressed }) => [
                      s.reminderPreferenceButton,
                      { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.72 : 1 },
                    ]}
                  >
                    <Ionicons name="notifications-outline" size={15} color={colors.primary} />
                    <Text style={[s.reminderPreferenceButtonText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                      Allow future reminders
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => saveReminderNotificationPreferences({ optOut: true })}
                    accessibilityRole="button"
                    accessibilityLabel="Opt out of push reminders"
                    style={({ pressed }) => [
                      s.reminderPreferenceButton,
                      { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.72 : 1 },
                    ]}
                  >
                    <Ionicons name="notifications-off-outline" size={15} color={colors.rose} />
                    <Text style={[s.reminderPreferenceButtonText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                      Opt out
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => saveReminderNotificationPreferences({ quietHoursStart: "9:00 PM", quietHoursEnd: "7:00 AM" })}
                    accessibilityRole="button"
                    accessibilityLabel="Save quiet hours from 9:00 PM to 7:00 AM"
                    style={({ pressed }) => [
                      s.reminderPreferenceButton,
                      { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.72 : 1 },
                    ]}
                  >
                    <Ionicons name="moon-outline" size={15} color={colors.amber} />
                    <Text style={[s.reminderPreferenceButtonText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                      Save quiet hours
                    </Text>
                  </Pressable>
                  {ownerOps ? (
                    <Pressable
                      onPress={openPushNotificationProofMission}
                      accessibilityRole="button"
                      accessibilityLabel="Open push notifications proof mission"
                      style={({ pressed }) => [
                        s.reminderPreferenceButton,
                        { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.72 : 1 },
                      ]}
                    >
                      <Ionicons name="shield-checkmark-outline" size={15} color={colors.amber} />
                      <Text style={[s.reminderPreferenceButtonText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        Open push proof
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={[s.reminderNotificationText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Your choice is saved on this device. Reminder delivery arrives in a future update.
                </Text>
              </View>
            ) : null}
          </BoardCard>

          {/* Daily routine */}
          <BoardCard enter={5} style={s.plansBoardCard}>
            <BoardSectionHeader
              title="Daily Routine"
              accessory={
                <View style={s.routineHeaderAccessory}>
                  {routineBoard.items.length > 0 && (
                    <Text style={[s.routineProgress, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {routineBoard.doneCount}/{routineBoard.items.length} done today
                    </Text>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add routine"
                    onPress={() => { Haptics.selectionAsync(); openNewRoutine(); }}
                    style={[s.sectionAddBtn, { backgroundColor: colors.primary }]}
                  >
                    <Ionicons name="add" size={18} color={colors.primaryForeground} />
                  </Pressable>
                </View>
              }
            />
            {routineBoard.items.length === 0 ? (
              <Pressable onPress={() => { Haptics.selectionAsync(); openNewRoutine(); }} style={[s.emptyPanel, { backgroundColor: colors.background }]}>
                <PulseIcon name="bowl" size={30} />
                <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  No routines yet. Tap to add feeding times, walks, and more.
                </Text>
              </Pressable>
            ) : (
              <>
              <View style={[s.responsibilityPanel, { backgroundColor: colors.background, borderColor: responsibilityTone + "44" }]}>
                <View style={s.responsibilityTop}>
                  <View style={[s.responsibilityIcon, { backgroundColor: responsibilityTone + "18" }]}>
                    <Ionicons name="people-outline" size={18} color={responsibilityTone} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.responsibilityTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Household Responsibility</Text>
                    <Text style={[s.responsibilitySummary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {householdResponsibility.summary}
                    </Text>
                  </View>
                </View>
                <View style={s.responsibilityMetrics}>
                  {[
                    { label: "Open", value: responsibility.openRoutines },
                    { label: "Overdue", value: responsibility.overdueRoutines },
                    { label: "Unassigned", value: responsibility.unassignedRoutines },
                  ].map((metric) => (
                    <View key={metric.label} style={[s.responsibilityMetric, { backgroundColor: colors.background }]}>
                      <Text style={[s.responsibilityMetricValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{metric.value}</Text>
                      <Text style={[s.responsibilityMetricLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{metric.label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[s.responsibilityNext, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {responsibility.nextStep}
                </Text>
              </View>

              {(assignedOwnerLoads.length > 0 || routineBoard.unassignedCount > 0) && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.ownerLoadStrip}
                  style={{ marginBottom: 12 }}
                >
                  {assignedOwnerLoads.map((load) => (
                    <View key={load.name} style={[s.ownerLoadChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={[s.ownerAvatar, { backgroundColor: colors.primary + "18" }]}>
                        <Text style={[s.ownerAvatarText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                          {load.name.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={[s.ownerLoadName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{load.name}</Text>
                        <Text style={[s.ownerLoadCount, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                          {load.done}/{load.assigned} done
                        </Text>
                      </View>
                    </View>
                  ))}
                  {routineBoard.unassignedCount > 0 && (
                    <View style={[s.ownerLoadChip, { backgroundColor: colors.amber + "12", borderColor: colors.amber + "44" }]}>
                      <Ionicons name="person-add-outline" size={18} color={colors.amber} />
                      <View>
                        <Text style={[s.ownerLoadName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Unassigned</Text>
                        <Text style={[s.ownerLoadCount, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                          {routineBoard.unassignedCount} routine{routineBoard.unassignedCount === 1 ? "" : "s"}
                        </Text>
                      </View>
                    </View>
                  )}
                </ScrollView>
              )}

              <View style={s.timeline}>
                {routineBoard.items.map((r, i) => {
                  const icon = ROUTINE_ICON[r.normalizedType] ?? "heart";
                  const tint = PULSE_COLORS[icon];
                  const last = i === routineBoard.items.length - 1;
                  const done = r.status === "done";
                  const statusColor =
                    r.status === "done"
                      ? colors.sage
                      : r.status === "overdue"
                        ? colors.rose
                        : r.status === "due"
                          ? colors.amber
                          : tint;
                  return (
                    <Pressable key={r.id} onPress={() => { Haptics.selectionAsync(); openBoardRoutine(r); }} style={s.timelineRow}>
                      <View style={s.rail}>
                        <View style={[s.railDot, { backgroundColor: statusColor, borderColor: statusColor }]} />
                        {!last && <View style={[s.railLine, { backgroundColor: colors.border }]} />}
                      </View>
                      <View style={[s.routineCard, { backgroundColor: colors.card, shadowColor: colors.primary, opacity: done ? 0.72 : 1 }]}>
                        <View style={[s.routineIconWrap, { backgroundColor: statusColor + "16" }]}>
                          {r.normalizedType === "potty" ? (
                            <PixelIcon name="pee" size={20} />
                          ) : (
                            <PulseIcon name={icon} size={20} color={done ? colors.sage : undefined} />
                          )}
                        </View>
                        <View style={s.routineMain}>
                          <Text style={[s.routineLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{r.label}</Text>
                          <View style={s.routineMetaRow}>
                            <Text style={[s.routineOwner, { color: r.owner ? colors.mutedForeground : colors.amber, fontFamily: "Inter_500Medium" }]}>
                              {r.owner ? `Assigned to ${r.owner}` : "Tap to assign owner"}
                            </Text>
                            {r.completedBy ? (
                              <Text style={[s.routineOwner, { color: colors.sage, fontFamily: "Inter_600SemiBold" }]}>Done by {r.completedBy}</Text>
                            ) : null}
                            {r.completion && r.completion !== "complete" ? (
                              <Text style={[s.routineOwner, { color: colors.amber, fontFamily: "Inter_700Bold" }]}>{r.completionLabel}</Text>
                            ) : null}
                          </View>
                          {r.note ? (
                            <Text numberOfLines={1} style={[s.routineNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{r.note}</Text>
                          ) : null}
                        </View>
                        <View style={s.routineActions}>
                          <BoardStatusPill
                            label={routineStatusLabel(r.status)}
                            tone={routineBoardPillTone(r.status)}
                            style={s.routineRowPill}
                          />
                          <Text style={[s.routineTime, { color: done ? colors.sage : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{r.time}</Text>
                          <Pressable
                            onPress={(event) => {
                              event.stopPropagation?.();
                              if (!done) logRoutineDone(r);
                            }}
                            disabled={done}
                            hitSlop={MOBILE_INLINE_HIT_SLOP}
                            accessibilityRole="button"
                            accessibilityLabel={done ? `${r.label} already logged` : `Log ${r.label} as done`}
                            style={[s.routineDoneBtn, { backgroundColor: done ? colors.sage + "18" : colors.primary }]}
                          >
                            <Ionicons name={done ? "checkmark-circle" : "checkmark"} size={16} color={done ? colors.sage : "#fff"} />
                          </Pressable>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              </>
            )}
          </BoardCard>
        </Animated.View>
      </ScrollView>

      {routineFeedback ? (
        <View
          style={[
            s.routineFeedback,
            {
              backgroundColor: colors.brandNavy,
              borderColor: colors.copper + "66",
              bottom: insets.bottom + 92,
            },
          ]}
        >
          <View style={s.routineFeedbackCopy}>
            <Text style={[s.routineFeedbackTitle, { color: colors.ivory, fontFamily: "Inter_800ExtraBold" }]}>
              {routineFeedback.title} logged
            </Text>
            <Text style={[s.routineFeedbackSub, { color: colors.ivory + "CC", fontFamily: "Inter_600SemiBold" }]}>
              Routine board updated. Add details now or undo this care log.
            </Text>
          </View>
          <View style={s.routineFeedbackActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Undo ${routineFeedback.title} routine log`}
              onPress={undoRoutineFeedback}
              style={({ pressed }) => [
                s.routineFeedbackButton,
                {
                  backgroundColor: pressed ? "rgba(255,249,239,0.17)" : "rgba(255,249,239,0.1)",
                  borderColor: "rgba(255,249,239,0.34)",
                },
              ]}
            >
              <Text style={[s.routineFeedbackButtonText, { color: colors.ivory, fontFamily: "Inter_800ExtraBold" }]}>Undo</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add details to ${routineFeedback.title} routine log`}
              onPress={openRoutineFeedbackDetails}
              style={({ pressed }) => [
                s.routineFeedbackButton,
                {
                  backgroundColor: pressed ? colors.copper + "DD" : colors.copper,
                  borderColor: colors.copper,
                },
              ]}
            >
              <Text style={[s.routineFeedbackButtonText, { color: colors.ivory, fontFamily: "Inter_800ExtraBold" }]}>
                Add details
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Routine editor modal */}
      <Modal visible={routineOpen} transparent animationType="slide" onRequestClose={() => setRoutineOpen(false)}>
        <Pressable accessible={false} style={s.modalBackdrop} onPress={() => setRoutineOpen(false)}>
          <Pressable accessible={false} accessibilityViewIsModal style={[s.modalSheet, { backgroundColor: colors.card, paddingBottom: modalSheetBottomPadding }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>
              {routineEditId ? "Edit Routine" : "New Routine"}
            </Text>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>LABEL</Text>
            <TextInput
              value={rLabel}
              onChangeText={setRLabel}
              placeholder="Morning walk"
              placeholderTextColor={colors.mutedForeground}
              style={[s.field, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
            />
            {(ROUTINE_LABEL_SUGGESTIONS[rType] ?? []).length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.ownerQuickRow}>
                {(ROUTINE_LABEL_SUGGESTIONS[rType] ?? []).map((sug) => (
                  <Pressable
                    key={sug}
                    accessibilityRole="button"
                    accessibilityLabel={`Use label ${sug}`}
                    onPress={() => { Haptics.selectionAsync(); setRLabel(sug); }}
                    style={[s.ownerQuickChip, { backgroundColor: colors.background, borderColor: colors.border }]}
                  >
                    <Text style={[s.ownerQuickText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{sug}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              {ROUTINE_TYPES.map((t) => {
                const active = rType === t.key;
                return (
                  <Pressable key={t.key} onPress={() => { Haptics.selectionAsync(); setRType(t.key); }} style={[s.typeChip, { backgroundColor: active ? colors.primary : colors.background, borderColor: active ? colors.primary : colors.border }]}>
                    {t.key === "potty" ? (
                      <PixelIcon name="pee" size={14} />
                    ) : (
                      <PulseIcon name={t.icon} size={14} color={active ? colors.primaryForeground : undefined} />
                    )}
                    <Text style={[s.typeChipText, { color: active ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={s.fieldRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>TIME</Text>
                <TextInput
                  value={rTime}
                  onChangeText={(v) => { setRTime(v); setRTimeError(null); }}
                  placeholder="7:00 AM"
                  placeholderTextColor={colors.mutedForeground}
                  style={[s.field, { backgroundColor: colors.background, color: rTimeError ? colors.rose : colors.foreground, borderWidth: rTimeError ? 1 : 0, borderColor: rTimeError ? colors.rose : "transparent", fontFamily: "Inter_500Medium" }]}
                />
                {rTimeError && (
                  <Text style={{ color: colors.rose, fontSize: 12, marginTop: 4, fontFamily: "Inter_500Medium" }}>{rTimeError}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>OWNER (OPTIONAL)</Text>
                <TextInput
                  value={rOwner}
                  onChangeText={setROwner}
                  placeholder="Apollo, Maya..."
                  placeholderTextColor={colors.mutedForeground}
                  style={[s.field, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                />
              </View>
            </View>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>QUICK TIMES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.ownerQuickRow}>
              {(ROUTINE_TIME_SUGGESTIONS[rType] ?? DEFAULT_TIME_SUGGESTIONS).map((t) => {
                const active = rTime.trim() === t;
                return (
                  <Pressable
                    key={t}
                    accessibilityRole="button"
                    accessibilityLabel={`Set time ${t}`}
                    aria-selected={active}
                    onPress={() => { Haptics.selectionAsync(); setRTime(t); setRTimeError(null); }}
                    style={[s.ownerQuickChip, { backgroundColor: active ? colors.primary : colors.background, borderColor: active ? colors.primary : colors.border }]}
                  >
                    <Text style={[s.ownerQuickText, { color: active ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_700Bold" }]}>{t}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {caregivers.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.ownerQuickRow}>
                {caregivers.map((caregiver) => {
                  const active = rOwner.trim().toLowerCase() === caregiver.name.trim().toLowerCase();
                  return (
                    <Pressable
                      key={caregiver.name}
                      onPress={() => { Haptics.selectionAsync(); setROwner(caregiver.name); }}
                      style={[s.ownerQuickChip, { backgroundColor: active ? colors.primary : colors.background, borderColor: active ? colors.primary : colors.border }]}
                    >
                      <Text style={[s.ownerQuickText, { color: active ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        {caregiver.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>NOTE (OPTIONAL)</Text>
            <TextInput
              value={rNote}
              onChangeText={setRNote}
              placeholder="Any extra details..."
              placeholderTextColor={colors.mutedForeground}
              style={[s.field, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
            />

            <Pressable onPress={submitRoutine} disabled={!rLabel.trim()} style={[s.saveBtn, { backgroundColor: rLabel.trim() ? colors.primary : colors.border }]}>
              <Text style={[s.saveBtnText, { color: rLabel.trim() ? colors.primaryForeground : colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{routineEditId ? "Save Changes" : "Add Routine"}</Text>
            </Pressable>
            {/* Validation feedback lives next to the submit button so the
                sheet never looks silently broken when a field above is off. */}
            {!rLabel.trim() ? (
              <Text style={[s.sheetSubmitHint, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Add a label above to save this routine.
              </Text>
            ) : rTimeError ? (
              <Text aria-live="polite" style={[s.sheetSubmitHint, { color: colors.rose, fontFamily: "Inter_600SemiBold" }]}>
                {rTimeError}
              </Text>
            ) : null}

            {routineEditId && (
              <Pressable onPress={() => deleteRoutine(routineEditId)} style={s.deleteBtn}>
                <Ionicons name="trash-outline" size={15} color={colors.rose} />
                <Text style={[s.deleteBtnText, { color: colors.rose, fontFamily: "Inter_600SemiBold" }]}>Delete Routine</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add-event modal */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable accessible={false} style={s.modalBackdrop} onPress={() => setAddOpen(false)}>
          <Pressable accessible={false} accessibilityViewIsModal style={[s.modalSheet, { backgroundColor: colors.card, paddingBottom: modalSheetBottomPadding }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>New Event</Text>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>TITLE</Text>
            <TextInput
              value={evTitle}
              onChangeText={setEvTitle}
              placeholder="Beach day, vet visit, hike..."
              placeholderTextColor={colors.mutedForeground}
              style={[s.field, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
            />

            <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              {EVENT_TYPES.map((t) => {
                const active = evType === t.key;
                return (
                  <Pressable key={t.key} onPress={() => { Haptics.selectionAsync(); setEvType(t.key); }} style={[s.typeChip, { backgroundColor: active ? colors.primary : colors.background, borderColor: active ? colors.primary : colors.border }]}>
                    <Ionicons name={EVENT_ICON[t.key] ?? "calendar"} size={14} color={active ? colors.primaryForeground : colors.mutedForeground} />
                    <Text style={[s.typeChipText, { color: active ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={s.fieldRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>DATE</Text>
                <TextInput
                  value={evDate}
                  onChangeText={(raw) => {
                    setDateError(null);
                    // Auto-insert dashes: 2026 -> 2026- -> 2026-06- -> 2026-06-15
                    const digits = raw.replace(/\D/g, "").slice(0, 8);
                    let fmt = digits;
                    if (digits.length > 4) fmt = `${digits.slice(0, 4)}-${digits.slice(4)}`;
                    if (digits.length > 6) fmt = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
                    setEvDate(fmt);
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  maxLength={10}
                  style={[s.field, { backgroundColor: colors.background, color: dateError ? colors.rose : colors.foreground, borderWidth: dateError ? 1 : 0, borderColor: dateError ? colors.rose : "transparent", fontFamily: "Inter_500Medium" }]}
                />
                {dateError && (
                  <Text style={{ color: colors.rose, fontSize: 12, marginTop: 4, fontFamily: "Inter_500Medium" }}>{dateError}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>TIME</Text>
                <TextInput
                  value={evTime}
                  onChangeText={setEvTime}
                  placeholder="9:00 AM"
                  placeholderTextColor={colors.mutedForeground}
                  style={[s.field, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                />
              </View>
            </View>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>LOCATION (OPTIONAL)</Text>
            <TextInput
              value={evLocation}
              onChangeText={setEvLocation}
              placeholder="Where?"
              placeholderTextColor={colors.mutedForeground}
              style={[s.field, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
            />

            <Pressable onPress={submitEvent} disabled={!evTitle.trim()} style={[s.saveBtn, { backgroundColor: evTitle.trim() ? colors.primary : colors.border }]}>
              <Text style={[s.saveBtnText, { color: evTitle.trim() ? colors.primaryForeground : colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>Add to Calendar</Text>
            </Pressable>
            {/* Validation feedback lives next to the submit button so the
                sheet never looks silently broken when a field above is off. */}
            {!evTitle.trim() ? (
              <Text style={[s.sheetSubmitHint, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Add a title above to save this event.
              </Text>
            ) : dateError ? (
              <Text aria-live="polite" style={[s.sheetSubmitHint, { color: colors.rose, fontFamily: "Inter_600SemiBold" }]}>
                {dateError}
              </Text>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  headerIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, marginTop: 2 },
  addBtn: { minWidth: MIN_MOBILE_TOUCH_TARGET, minHeight: MIN_MOBILE_TOUCH_TARGET, borderRadius: 14, alignItems: "center", justifyContent: "center" },

  discoverCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
  discoverIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  discoverTitle: { fontSize: 16 },
  discoverSub: { fontSize: 13, marginTop: 1 },

  discoverPanel: { borderRadius: 20, padding: 14, marginTop: 10, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 2 },
  discoverInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  discoverInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  discoverGo: { paddingHorizontal: 18, minHeight: MIN_MOBILE_TOUCH_TARGET, borderRadius: 12, alignItems: "center", justifyContent: "center", minWidth: 64 },
  discoverGoText: { color: "#fff", fontSize: 14 },
  discoverHint: { fontSize: 12, lineHeight: 17, marginTop: 10, marginBottom: 4 },

  sugRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  sugIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sugTitle: { fontSize: 14.5 },
  sugMeta: { fontSize: 12, marginTop: 2 },
  sugNote: { fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  sugAdd: { minWidth: MIN_MOBILE_TOUCH_TARGET, minHeight: MIN_MOBILE_TOUCH_TARGET, borderRadius: 11, alignItems: "center", justifyContent: "center" },

  commandDeckCard: {
    marginBottom: 10,
  },
  monthViewLink: {
    flexDirection: "row",
    alignSelf: "flex-end",
    alignItems: "center",
    gap: 3,
    marginTop: -2,
    marginBottom: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  monthViewText: {
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  commandDeckStage: {
    minHeight: 146,
    justifyContent: "space-between",
    gap: 12,
  },
  commandDeckTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  commandDeckCopy: {
    flex: 1,
    minWidth: 0,
  },
  commandDeckKicker: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  commandDeckSpeech: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 3,
  },
  commandDeckStatusPill: {
    marginTop: 8,
  },
  commandDeckScene: {
    width: 92,
    height: 84,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 2,
  },
  commandDeckSceneImage: {
    borderRadius: 14,
  },
  commandDeckStats: {
    flexDirection: "row",
    gap: 8,
  },
  commandDeckStatChip: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  commandDeckStatLabel: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  commandDeckStatValue: {
    fontSize: 15,
    lineHeight: 19,
  },
  commandDeckSignalRow: {
    minHeight: 15,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    marginTop: 2,
  },
  commandDeckSignalBar: {
    width: 6,
    borderRadius: 2,
  },

  planMissionBoard: {
    marginBottom: 10,
  },
  planMissionList: {
    gap: 6,
  },
  planMissionRow: {
    position: "relative",
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },
  planMissionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  planMissionCopy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  planMissionEyebrow: {
    fontSize: 8.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  planMissionTitle: {
    fontSize: 13.5,
    marginTop: 1,
  },
  planMissionDetail: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
  },
  planMissionAction: {
    width: 66,
    flexShrink: 0,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 10,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  planMissionActionText: {
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  planMissionDivider: {
    position: "absolute",
    left: 56,
    right: 12,
    bottom: -5,
    height: 1,
    opacity: 0.8,
  },

  scheduleCard: { marginBottom: 10 },
  scheduleCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  scheduleHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  scheduleEyebrow: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  scheduleHeaderTitle: {
    fontSize: 17,
    marginTop: 2,
  },
  monthWeekdayRow: { flexDirection: "row", marginBottom: 4 },
  monthWeekdayLabel: { flex: 1, textAlign: "center", fontSize: 9.5, letterSpacing: 0.4 },
  monthWeekRow: { flexDirection: "row" },
  monthDayCell: { flex: 1, alignItems: "center", paddingVertical: 3 },
  monthDayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  monthDayNumber: { fontSize: 13.5 },
  monthDayDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  monthOpenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 12,
  },
  monthOpenBtnText: { fontSize: 13 },
  scheduleTabs: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  // Segment chips render through BoardSegmentTabs; this block stays as the
  // shared mobile touch-target contract for the schedule tabs.
  scheduleTab: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleList: { marginTop: 2 },
  scheduleBand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    marginBottom: 2,
  },
  scheduleBandText: {
    fontSize: 9,
    letterSpacing: 1.1,
  },
  scheduleBandRule: {
    flex: 1,
    height: 1,
    borderRadius: 1,
  },
  scheduleNowLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 2,
  },
  scheduleNowChip: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  scheduleNowChipText: {
    fontSize: 10,
    letterSpacing: 1.1,
  },
  scheduleNowBar: {
    flex: 1,
    height: 2,
    borderRadius: 2,
    opacity: 0.55,
  },
  scheduleRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 7,
  },
  scheduleTime: {
    width: 66,
    fontSize: 12,
    paddingTop: 2,
  },
  scheduleRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  scheduleTitle: { fontSize: 13.5 },
  scheduleDetail: { fontSize: 11.5, marginTop: 2 },
  scheduleRowPill: { alignSelf: "flex-start", marginTop: 5 },
  scheduleOwnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  scheduleIconChip: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleAddEvent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 12,
  },
  scheduleAddEventText: { fontSize: 13 },
  scheduleSampleRow: { opacity: 0.62 },
  scheduleSampleNote: { fontSize: 11.5, lineHeight: 16, marginTop: 10, textAlign: "center" },
  scheduleStatus: {
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleAddButton: { marginTop: 12 },

  weeklyGoalPanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
    marginBottom: 6,
  },
  weeklyGoalTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  weeklyGoalCopy: {
    flexShrink: 1,
    minWidth: 0,
  },
  weeklyGoalKicker: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  weeklyGoalValue: {
    fontSize: 20,
    lineHeight: 25,
    marginTop: 2,
  },
  weeklyStreakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  weeklyStreakText: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  weeklyGoalBar: {
    marginTop: 10,
  },
  weeklyGoalHint: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 7,
  },
  weekPlanList: {
    marginTop: 2,
  },
  weekPlanRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  weekPlanCopy: {
    flex: 1,
    minWidth: 0,
  },
  weekPlanTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  weekPlanTitle: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13.5,
  },
  weekPlanMeta: {
    flexShrink: 0,
    fontSize: 10.5,
  },
  weekDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 7,
  },
  weekDotRing: {
    borderWidth: 1.5,
    borderRadius: 999,
    padding: 1,
  },
  weekDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  weekDotText: {
    fontSize: 8.5,
    lineHeight: 11,
  },
  weekPlanEmpty: {
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  weekPlanEmptyText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },

  plansBoardCard: { marginTop: 14 },
  routineHeaderAccessory: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionAddBtn: { minWidth: MIN_MOBILE_TOUCH_TARGET, minHeight: MIN_MOBILE_TOUCH_TARGET, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  routineProgress: { fontSize: 12, marginTop: 1 },

  emptyPanel: { borderRadius: 14, padding: 24, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  upcomingBoardCard: { marginTop: 28, marginBottom: 18 },

  dayHeading: { fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  eventPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  eventIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  eventTitleLine: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  eventTitle: { fontSize: 15 },
  tag: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  tagText: { fontSize: 9, letterSpacing: 0.3 },
  eventMeta: { fontSize: 12.5, marginTop: 3 },
  eventNote: { fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  removeBtn: { minWidth: MIN_MOBILE_TOUCH_TARGET, minHeight: MIN_MOBILE_TOUCH_TARGET, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  reminderList: { marginTop: 8 },
  reminderRow: { flexDirection: "row", gap: 11, paddingVertical: 11 },
  reminderIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  reminderMain: { flex: 1, minWidth: 0 },
  reminderTitleLine: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  reminderTitle: { fontSize: 14.5, flexShrink: 1 },
  reminderPill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  reminderPillText: { fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.4 },
  reminderDetail: { fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  reminderAction: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  reminderMore: { fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  reminderNext: { fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  reminderReadiness: { fontSize: 11.5, lineHeight: 16, marginTop: 7 },
  reminderNotificationPanel: { borderRadius: 13, borderWidth: 1, padding: 11, marginTop: 10, gap: 5 },
  reminderNotificationTitle: { fontSize: 12.5, lineHeight: 17 },
  reminderNotificationText: { fontSize: 11.5, lineHeight: 16 },
  reminderPreferenceActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 7 },
  reminderPreferenceButton: {
    flexGrow: 1,
    flexBasis: "46%",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  reminderPreferenceButtonText: { flex: 1, fontSize: 11.5, lineHeight: 15 },
  reminderEmpty: { flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 14, padding: 12, marginTop: 12 },
  reminderEmptyText: { flex: 1, fontSize: 12.5, lineHeight: 18 },

  responsibilityPanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
    marginBottom: 12,
  },
  responsibilityTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  responsibilityIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  responsibilityTitle: { fontSize: 15.5 },
  responsibilitySummary: { fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  responsibilityMetrics: { flexDirection: "row", gap: 8, marginTop: 12 },
  responsibilityMetric: { flex: 1, minHeight: 58, borderRadius: 14, alignItems: "center", justifyContent: "center", padding: 8 },
  responsibilityMetricValue: { fontSize: 16 },
  responsibilityMetricLabel: { fontSize: 10.5, marginTop: 2 },
  responsibilityNext: { fontSize: 12.5, lineHeight: 18, marginTop: 12 },

  ownerLoadStrip: { gap: 8, paddingRight: 20 },
  ownerLoadChip: {
    minWidth: 126,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  ownerAvatar: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  ownerAvatarText: { fontSize: 13 },
  ownerLoadName: { fontSize: 12.5 },
  ownerLoadCount: { fontSize: 11.5, marginTop: 1 },

  timeline: {},
  timelineRow: { flexDirection: "row", gap: 12 },
  rail: { width: 24, alignItems: "center" },
  railDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginTop: 18 },
  railLine: { width: 2, flex: 1, marginVertical: 2 },
  routineCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  routineIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  routineMain: { flex: 1, minWidth: 0 },
  routineLabel: { fontSize: 15 },
  routineOwner: { fontSize: 12.5, marginTop: 2 },
  routineMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  routineNote: { fontSize: 12, lineHeight: 16, marginTop: 3 },
  routineActions: { width: 82, alignItems: "flex-end", gap: 5 },
  routineRowPill: { alignSelf: "flex-end" },
  routineTime: { fontSize: 13 },
  routineDoneBtn: { minWidth: MIN_MOBILE_TOUCH_TARGET, minHeight: MIN_MOBILE_TOUCH_TARGET, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  routineFeedback: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 20,
    borderWidth: 1,
    borderRadius: 22,
    padding: 13,
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 7,
  },
  routineFeedbackCopy: { flex: 1, minWidth: 0 },
  routineFeedbackTitle: { fontSize: 14.5 },
  routineFeedbackSub: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  routineFeedbackActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  routineFeedbackButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    minWidth: 72,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 11,
  },
  routineFeedbackButtonText: { fontSize: 12.5 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22 },
  modalHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.15)", marginBottom: 16 },
  modalTitle: { fontSize: 22, marginBottom: 16 },
  fieldLabel: { fontSize: 11, letterSpacing: 0.6, marginBottom: 7, marginTop: 14 },
  field: { borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  fieldRow: { flexDirection: "row", gap: 12 },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: MIN_MOBILE_TOUCH_TARGET, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  typeChipText: { fontSize: 13 },
  ownerQuickRow: { gap: 8, paddingTop: 10, paddingRight: 20 },
  ownerQuickChip: { borderWidth: 1, borderRadius: 11, minHeight: MIN_MOBILE_TOUCH_TARGET, paddingHorizontal: 12, paddingVertical: 8 },
  ownerQuickText: { fontSize: 12.5 },
  saveBtn: { marginTop: 24, minHeight: MIN_MOBILE_TOUCH_TARGET, borderRadius: 15, paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  saveBtnText: { fontSize: 15.5 },
  sheetSubmitHint: { fontSize: 12, lineHeight: 16, marginTop: 10, textAlign: "center" },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, minHeight: MIN_MOBILE_TOUCH_TARGET, paddingVertical: 10 },
  deleteBtnText: { fontSize: 14 },
});

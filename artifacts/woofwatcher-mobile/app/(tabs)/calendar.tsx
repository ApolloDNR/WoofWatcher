import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { useColors } from "@/hooks/useColors";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { parseLocalDate } from "@/lib/time";
import {
  getModalSheetBottomPadding,
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import { BoardCard, BoardPill, BoardRouteHeader, BoardSectionHeader } from "@/components/board/BoardPrimitives";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

const ROUTINE_ICON: Record<string, PulseIconName> = {
  meal: "bowl",
  walk: "paw",
  treat: "bone",
  play: "candy",
  training: "star",
  potty: "drop",
  note: "heart",
};

const ROUTINE_TYPES: { key: string; label: string; icon: PulseIconName }[] = [
  { key: "meal", label: "Meal", icon: "bowl" },
  { key: "walk", label: "Walk", icon: "paw" },
  { key: "treat", label: "Treat", icon: "bone" },
  { key: "play", label: "Play", icon: "candy" },
  { key: "training", label: "Training", icon: "star" },
  { key: "potty", label: "Potty", icon: "drop" },
  { key: "note", label: "Check-in", icon: "heart" },
];

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

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, updateCareDoc, addEntry, deleteEntry } = useCare();

  const { getToken } = useWoofAuth();
  const { routines, calendarEvents, profile, entries, caregivers, records } = state;

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
  const [scheduleTab, setScheduleTab] = useState<"today" | "tomorrow" | "week">("today");

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

  const sortedRoutines = useMemo(
    () => [...routines].sort((a, b) => routineMinutes(a.time) - routineMinutes(b.time)),
    [routines],
  );

  const routineBoard = useMemo(
    () => deriveRoutineBoard({ routines: sortedRoutines, entries, caregivers, now }),
    [sortedRoutines, entries, caregivers, now],
  );
  const scheduleRows = useMemo(() => {
    const fallback = [
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
          detail: item.owner || item.note || routineStatusLabel(item.status),
          status: item.status,
        }))
      : fallback;
    if (scheduleTab === "tomorrow") {
      return rows.map((row) => ({ ...row, status: "upcoming" as RoutineBoardStatus }));
    }
    return rows;
  }, [routineBoard.items, scheduleTab]);
  const householdResponsibility = useMemo(
    () => deriveHouseholdResponsibility({ routines: sortedRoutines, entries, caregivers, now }),
    [sortedRoutines, entries, caregivers, now],
  );
  const careReminderCenter = useMemo(
    () => deriveCareReminderCenter({ routines: sortedRoutines, entries, records, caregivers, now, limit: 4 }),
    [sortedRoutines, entries, records, caregivers, now],
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
    setRTime("");
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
    Alert.alert("Delete Routine", "Remove this routine from your schedule?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          updateCareDoc((doc) => ({ ...doc, routines: doc.routines.filter((r) => r.id !== id) }));
          setRoutineOpen(false);
        },
      },
    ]);
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
      setSuggestions(Array.isArray(data.events) ? data.events : []);
      setDiscoverMode(data.mode ?? null);
    } catch {
      setSuggestions([]);
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

  const isAdded = (sug: SuggestedEvent) =>
    calendarEvents.some((e) => e.title === sug.title && e.date === sug.date);

  // Mount animation
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    return () => {
      if (routineFeedbackTimer.current) clearTimeout(routineFeedbackTimer.current);
    };
  }, []);
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 460, useNativeDriver: Platform.OS !== "web" }),
      Animated.spring(slide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: Platform.OS !== "web" }),
    ]).start();
  }, [fade, slide]);

  const dateLabel = new Date(now).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const H_PAD = 20;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingTop: topPadding, paddingBottom: bottomPadding, paddingHorizontal: H_PAD }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <BoardRouteHeader
            kicker="Plans"
            title="Plans & Schedule"
            subtitle={dateLabel}
            icon="calendar-outline"
            actionIcon="add"
            actionLabel="Add plan"
            onAction={() => {
              Haptics.selectionAsync();
              setAddOpen(true);
            }}
          />

          <BoardCard style={s.scheduleCard}>
            <View style={s.scheduleTabs}>
              {[
                { key: "today" as const, label: "Today" },
                { key: "tomorrow" as const, label: "Tomorrow" },
                { key: "week" as const, label: "Week" },
              ].map((tab) => {
                const active = scheduleTab === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${tab.label} plans`}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setScheduleTab(tab.key);
                    }}
                    style={[
                      s.scheduleTab,
                      {
                        backgroundColor: active ? colors.brandNavy : colors.background,
                        borderColor: active ? colors.brandNavy : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.scheduleTabText,
                        {
                          color: active ? colors.ivory : colors.navy,
                          fontFamily: active ? "Inter_700Bold" : "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={s.scheduleList}>
              {scheduleRows.map((row, index) => {
                const done = row.status === "done";
                const sourceRoutine = routineBoard.items.find((item) => item.id === row.id);
                return (
                  <Pressable
                    key={`${row.id}-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.time} ${row.label}`}
                    onPress={() => {
                      Haptics.selectionAsync();
                      if (sourceRoutine) openBoardRoutine(sourceRoutine);
                    }}
                    style={[s.scheduleRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}
                  >
                    <Text style={[s.scheduleTime, { color: colors.navy, fontFamily: "Inter_700Bold" }]}>
                      {row.time}
                    </Text>
                    <PixelIcon name={routinePixelIcon(row.type)} size={25} />
                    <View style={s.scheduleRowCopy}>
                      <Text style={[s.scheduleTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        {row.label}
                      </Text>
                      <Text style={[s.scheduleDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                        {scheduleTab === "week" ? `${dayLabel(today)} - ${row.detail}` : row.detail}
                      </Text>
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
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add plan"
              onPress={() => {
                Haptics.selectionAsync();
                openNewRoutine();
              }}
              style={({ pressed }) => [
                s.scheduleAdd,
                { backgroundColor: colors.brandNavy, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Ionicons name="add" size={17} color={colors.ivory} />
              <Text style={[s.scheduleAddText, { color: colors.ivory, fontFamily: "Inter_700Bold" }]}>
                Add Plan
              </Text>
            </Pressable>
          </BoardCard>

          {/* WoofGuide discovery banner */}
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setDiscoverOpen((v) => !v); }}
            style={[s.discoverCard, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
          >
            <View style={s.discoverIcon}>
              <Ionicons name="sparkles" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.discoverTitle, { fontFamily: DISPLAY_SEMI }]}>Discover nearby dog events</Text>
              <Text style={[s.discoverSub, { fontFamily: "Inter_400Regular" }]}>WoofGuide curates outings for {profile.name}</Text>
            </View>
            <Ionicons name={discoverOpen ? "chevron-up" : "chevron-down"} size={20} color="#fff" />
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
                        <Pressable onPress={() => !added && addSuggestion(sug)} hitSlop={MOBILE_INLINE_HIT_SLOP} style={[s.sugAdd, { backgroundColor: added ? colors.sage + "22" : colors.primary }]}>
                          <Ionicons name={added ? "checkmark" : "add"} size={18} color={added ? colors.sage : "#fff"} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Upcoming one-off events */}
          <BoardCard style={s.upcomingBoardCard}>
            <BoardSectionHeader
              title="Upcoming Events"
              accessory={<BoardPill label={upcoming.length ? `${upcoming.length} days` : "Add one"} tone={colors.primary} />}
            />
            {upcoming.length === 0 ? (
              <View style={[s.emptyPanel, { backgroundColor: colors.background }]}>
                <Ionicons name="calendar-outline" size={30} color={colors.mutedForeground} />
                <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  No events planned. Add one or discover nearby outings above.
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
                        <Pressable onPress={() => removeEvent(e.id)} hitSlop={MOBILE_INLINE_HIT_SLOP} style={s.removeBtn}>
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
          <BoardCard style={[s.plansBoardCard, { borderColor: reminderTone + "44" }]}>
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
          </BoardCard>

          {/* Daily routine */}
          <BoardCard style={s.plansBoardCard}>
            <BoardSectionHeader
              title="Daily Routine"
              accessory={
                <View style={s.routineHeaderAccessory}>
                  {routineBoard.items.length > 0 && (
                    <Text style={[s.routineProgress, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {routineBoard.doneCount}/{routineBoard.items.length} done today
                    </Text>
                  )}
                  <Pressable onPress={() => { Haptics.selectionAsync(); openNewRoutine(); }} style={[s.sectionAddBtn, { backgroundColor: colors.primary }]}>
                    <Ionicons name="add" size={18} color="#fff" />
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
                          <PulseIcon name={icon} size={20} color={done ? colors.sage : undefined} />
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
                          <View style={[s.routineStatusPill, { backgroundColor: statusColor + "16" }]}>
                            <Text style={[s.routineStatusText, { color: statusColor, fontFamily: "Inter_700Bold" }]}>
                              {routineStatusLabel(r.status)}
                            </Text>
                          </View>
                          <Text style={[s.routineTime, { color: done ? colors.sage : colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{r.time}</Text>
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
        <Pressable style={s.modalBackdrop} onPress={() => setRoutineOpen(false)}>
          <Pressable style={[s.modalSheet, { backgroundColor: colors.card, paddingBottom: modalSheetBottomPadding }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>
              {routineEditId ? "Edit Routine" : "New Routine"}
            </Text>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>LABEL</Text>
            <TextInput
              value={rLabel}
              onChangeText={setRLabel}
              placeholder="Morning walk, breakfast, bedtime snack..."
              placeholderTextColor={colors.mutedForeground}
              style={[s.field, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
            />

            <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              {ROUTINE_TYPES.map((t) => {
                const active = rType === t.key;
                return (
                  <Pressable key={t.key} onPress={() => { Haptics.selectionAsync(); setRType(t.key); }} style={[s.typeChip, { backgroundColor: active ? colors.primary : colors.background, borderColor: active ? colors.primary : colors.border }]}>
                    <PulseIcon name={t.icon} size={14} color={active ? "#fff" : undefined} />
                    <Text style={[s.typeChipText, { color: active ? "#fff" : colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t.label}</Text>
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
                      <Text style={[s.ownerQuickText, { color: active ? "#fff" : colors.foreground, fontFamily: "Inter_700Bold" }]}>
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
              <Text style={[s.saveBtnText, { fontFamily: "Inter_700Bold" }]}>{routineEditId ? "Save Changes" : "Add Routine"}</Text>
            </Pressable>

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
        <Pressable style={s.modalBackdrop} onPress={() => setAddOpen(false)}>
          <Pressable style={[s.modalSheet, { backgroundColor: colors.card, paddingBottom: modalSheetBottomPadding }]} onPress={(e) => e.stopPropagation()}>
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
                    <Ionicons name={EVENT_ICON[t.key] ?? "calendar"} size={14} color={active ? "#fff" : colors.mutedForeground} />
                    <Text style={[s.typeChipText, { color: active ? "#fff" : colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t.label}</Text>
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
              <Text style={[s.saveBtnText, { fontFamily: "Inter_700Bold" }]}>Add to Calendar</Text>
            </Pressable>
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
  discoverTitle: { fontSize: 16, color: "#fff" },
  discoverSub: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 1 },

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

  scheduleCard: { marginBottom: 14 },
  scheduleTabs: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  scheduleTab: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleTabText: { fontSize: 12.5 },
  scheduleList: { marginTop: 2 },
  scheduleRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
  },
  scheduleTime: {
    width: 66,
    fontSize: 12,
  },
  scheduleRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  scheduleTitle: { fontSize: 13.5 },
  scheduleDetail: { fontSize: 11.5, marginTop: 2 },
  scheduleStatus: {
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleAdd: {
    minHeight: 46,
    borderRadius: 9,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  scheduleAddText: { fontSize: 14 },

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
  routineStatusPill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  routineStatusText: { fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.4 },
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
  saveBtnText: { color: "#fff", fontSize: 15.5 },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, minHeight: MIN_MOBILE_TOUCH_TARGET, paddingVertical: 10 },
  deleteBtnText: { fontSize: 14 },
});

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
import { useAuth } from "@clerk/expo";
import { normalizeCareEventType } from "@workspace/care-domain";
import { useCare, CalendarEvent, Routine } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";
import { parseLocalDate } from "@/lib/time";

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
  const { state, updateCareDoc } = useCare();

  const { getToken } = useAuth();
  const { routines, calendarEvents, profile, entries } = state;

  const topInset = Platform.OS === "web" ? 24 : insets.top;
  const now = Date.now();
  const today = todayISO();

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

  // Smart completion: which routine types have a matching log entry today?
  const todayLoggedTypes = useMemo(() => {
    return new Set(
      entries
        .filter((e) => e.occurredAt.startsWith(today))
        .map((e) => normalizeCareEventType(e.type, e.details)),
    );
  }, [entries, today]);

  // How many routines are completed today?
  const routinesDoneCount = useMemo(
    () => sortedRoutines.filter((r) => todayLoggedTypes.has(normalizeCareEventType(r.type))).length,
    [sortedRoutines, todayLoggedTypes],
  );

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
        contentContainerStyle={{ paddingTop: topInset + 8, paddingBottom: 130, paddingHorizontal: H_PAD }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          {/* Header */}
          <View style={s.header}>
            <View style={[s.headerIcon, { backgroundColor: colors.primary + "14" }]}>
              <Ionicons name="calendar" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: colors.foreground, fontFamily: DISPLAY }]}>Calendar</Text>
              <Text style={[s.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{dateLabel}</Text>
            </View>
            <Pressable onPress={() => { Haptics.selectionAsync(); setAddOpen(true); }} style={[s.addBtn, { backgroundColor: colors.primary }]}>
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          </View>

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
                      Curated ideas to inspire outings — confirm details before you go.
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
                            {dayLabel(sug.date)}{sug.time ? ` · ${sug.time}` : ""}
                          </Text>
                          {sug.note ? (
                            <Text numberOfLines={2} style={[s.sugNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{sug.note}</Text>
                          ) : null}
                        </View>
                        <Pressable onPress={() => !added && addSuggestion(sug)} hitSlop={8} style={[s.sugAdd, { backgroundColor: added ? colors.sage + "22" : colors.primary }]}>
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
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Upcoming Events</Text>
          </View>
          {upcoming.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
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
                    <View key={e.id} style={[s.eventCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
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
                          {[e.time, e.location].filter(Boolean).join(" · ") || "All day"}
                        </Text>
                        {e.note ? (
                          <Text numberOfLines={2} style={[s.eventNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{e.note}</Text>
                        ) : null}
                      </View>
                      <Pressable onPress={() => removeEvent(e.id)} hitSlop={8} style={s.removeBtn}>
                        <Ionicons name="close" size={16} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ))
          )}

          {/* Daily routine */}
          <View style={[s.sectionHeader, { marginTop: 14 }]}>
            <View>
              <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Daily Routine</Text>
              {sortedRoutines.length > 0 && (
                <Text style={[s.routineProgress, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {routinesDoneCount}/{sortedRoutines.length} done today
                </Text>
              )}
            </View>
            <Pressable onPress={() => { Haptics.selectionAsync(); openNewRoutine(); }} style={[s.sectionAddBtn, { backgroundColor: colors.primary }]}>
              <Ionicons name="add" size={18} color="#fff" />
            </Pressable>
          </View>
          {sortedRoutines.length === 0 ? (
            <Pressable onPress={() => { Haptics.selectionAsync(); openNewRoutine(); }} style={[s.emptyCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
              <PulseIcon name="bowl" size={30} />
              <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No routines yet. Tap to add feeding times, walks, and more.
              </Text>
            </Pressable>
          ) : (
            <View style={s.timeline}>
              {sortedRoutines.map((r, i) => {
                const icon = ROUTINE_ICON[r.type] ?? "heart";
                const tint = PULSE_COLORS[icon];
                const last = i === sortedRoutines.length - 1;
                const done = todayLoggedTypes.has(r.type);
                return (
                  <Pressable key={r.id} onPress={() => { Haptics.selectionAsync(); openEditRoutine(r); }} style={s.timelineRow}>
                    <View style={s.rail}>
                      <View style={[s.railDot, { backgroundColor: done ? colors.sage : tint, borderColor: done ? colors.sage : tint }]} />
                      {!last && <View style={[s.railLine, { backgroundColor: colors.border }]} />}
                    </View>
                    <View style={[s.routineCard, { backgroundColor: colors.card, shadowColor: colors.primary, opacity: done ? 0.72 : 1 }]}>
                      <View style={[s.routineIconWrap, { backgroundColor: (done ? colors.sage : tint) + "16" }]}>
                        <PulseIcon name={icon} size={20} color={done ? colors.sage : undefined} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.routineLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{r.label}</Text>
                        {r.owner ? <Text style={[s.routineOwner, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{r.owner}</Text> : null}
                      </View>
                      <Text style={[s.routineTime, { color: done ? colors.sage : colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{r.time}</Text>
                      {done
                        ? <Ionicons name="checkmark-circle" size={18} color={colors.sage} />
                        : <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                      }
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Routine editor modal */}
      <Modal visible={routineOpen} transparent animationType="slide" onRequestClose={() => setRoutineOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setRoutineOpen(false)}>
          <Pressable style={[s.modalSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>
              {routineEditId ? "Edit Routine" : "New Routine"}
            </Text>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>LABEL</Text>
            <TextInput
              value={rLabel}
              onChangeText={setRLabel}
              placeholder="Morning walk, breakfast, bedtime snack…"
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
                  placeholder="Apollo, Maya…"
                  placeholderTextColor={colors.mutedForeground}
                  style={[s.field, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                />
              </View>
            </View>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>NOTE (OPTIONAL)</Text>
            <TextInput
              value={rNote}
              onChangeText={setRNote}
              placeholder="Any extra details…"
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
          <Pressable style={[s.modalSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>New Event</Text>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>TITLE</Text>
            <TextInput
              value={evTitle}
              onChangeText={setEvTitle}
              placeholder="Beach day, vet visit, hike…"
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
                    // Auto-insert dashes: 2026 → 2026- → 2026-06- → 2026-06-15
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
  addBtn: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },

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
  discoverGo: { paddingHorizontal: 18, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", minWidth: 64 },
  discoverGoText: { color: "#fff", fontSize: 14 },
  discoverHint: { fontSize: 12, lineHeight: 17, marginTop: 10, marginBottom: 4 },

  sugRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  sugIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sugTitle: { fontSize: 14.5 },
  sugMeta: { fontSize: 12, marginTop: 2 },
  sugNote: { fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  sugAdd: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sectionTitle: { fontSize: 20, letterSpacing: -0.2 },
  sectionLink: { fontSize: 13 },
  sectionAddBtn: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  routineProgress: { fontSize: 12, marginTop: 1 },

  emptyCard: { borderRadius: 20, padding: 32, alignItems: "center", gap: 12, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 2 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  dayHeading: { fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  eventIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  eventTitleLine: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  eventTitle: { fontSize: 15 },
  tag: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  tagText: { fontSize: 9, letterSpacing: 0.3 },
  eventMeta: { fontSize: 12.5, marginTop: 3 },
  eventNote: { fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  removeBtn: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },

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
  routineLabel: { fontSize: 15 },
  routineOwner: { fontSize: 12.5, marginTop: 2 },
  routineTime: { fontSize: 13 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22 },
  modalHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.15)", marginBottom: 16 },
  modalTitle: { fontSize: 22, marginBottom: 16 },
  fieldLabel: { fontSize: 11, letterSpacing: 0.6, marginBottom: 7, marginTop: 14 },
  field: { borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  fieldRow: { flexDirection: "row", gap: 12 },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  typeChipText: { fontSize: 13 },
  saveBtn: { marginTop: 24, borderRadius: 15, paddingVertical: 15, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 15.5 },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, paddingVertical: 10 },
  deleteBtnText: { fontSize: 14 },
});

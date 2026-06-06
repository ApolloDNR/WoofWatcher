import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCare, Entry } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

const TYPE_ICON: Record<string, PulseIconName> = {
  meal: "bowl",
  treat: "bone",
  walk: "paw",
  park: "paw",
  potty: "drop",
  pee: "drop",
  poop: "drop",
  play: "candy",
  training: "star",
  social: "heart",
  mood: "heart",
  alone: "house",
  vomit: "vomit",
  health: "heart",
  vet: "heart",
  weight: "bone",
  medication: "drop",
  note: "star",
};

interface QuickType {
  type: string;
  label: string;
  icon: PulseIconName;
}

const QUICK_TYPES: QuickType[] = [
  { type: "meal", label: "Meal", icon: "bowl" },
  { type: "treat", label: "Treat", icon: "bone" },
  { type: "walk", label: "Walk", icon: "paw" },
  { type: "potty", label: "Potty", icon: "drop" },
  { type: "play", label: "Play", icon: "candy" },
  { type: "training", label: "Training", icon: "star" },
  { type: "mood", label: "Mood", icon: "heart" },
  { type: "vomit", label: "Vomit", icon: "vomit" },
  { type: "alone", label: "Alone", icon: "house" },
  { type: "note", label: "Note", icon: "star" },
];

const TYPE_LABELS: Record<string, string> = QUICK_TYPES.reduce(
  (acc, q) => ({ ...acc, [q.type]: q.label }),
  {} as Record<string, string>,
);

function relativeTime(iso: string, now: number): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string, now: number): string {
  const d = new Date(iso);
  const today = new Date(now);
  const yest = new Date(now - 86400000);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return "Today";
  if (same(d, yest)) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export default function LogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, addEntry, deleteEntry } = useCare();

  const topInset = Platform.OS === "web" ? 24 : insets.top;
  const now = Date.now();

  const [selectedType, setSelectedType] = useState<string>("meal");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<string | null>(null);

  const caregiver = state.caregivers[0]?.name ?? "Caregiver";

  const caregiverColor = (name: string) => {
    const palette = [colors.primary, colors.copper, colors.sage, colors.amber];
    const idx = state.caregivers.findIndex((c) => c.name === name);
    return palette[(idx >= 0 ? idx : 0) % palette.length];
  };

  // Mount animation
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 460, useNativeDriver: Platform.OS !== "web" }),
      Animated.spring(slide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: Platform.OS !== "web" }),
    ]).start();
  }, [fade, slide]);

  const handleLog = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addEntry({
      type: selectedType,
      title: TYPE_LABELS[selectedType] || selectedType,
      caregiver,
      occurredAt: new Date().toISOString(),
      note: note.trim() || undefined,
      severity: "normal",
    });
    setNote("");
  }, [selectedType, note, addEntry, caregiver]);

  const handleDelete = useCallback(
    (id: string, title: string) => {
      Alert.alert("Delete entry", `Remove "${title}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            deleteEntry(id);
          },
        },
      ]);
    },
    [deleteEntry],
  );

  const filtered = useMemo(() => {
    const sorted = [...state.entries].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
    return filter ? sorted.filter((e) => e.type === filter) : sorted;
  }, [state.entries, filter]);

  const grouped = useMemo(() => {
    const groups: { key: string; label: string; entries: Entry[] }[] = [];
    const map: Record<string, Entry[]> = {};
    for (const e of filtered) {
      const k = dayKey(e.occurredAt);
      if (!map[k]) {
        map[k] = [];
        groups.push({ key: k, label: dayLabel(e.occurredAt, now), entries: map[k] });
      }
      map[k].push(e);
    }
    return groups;
  }, [filtered, now]);

  // Filter chips: only show types present in entries
  const presentTypes = useMemo(() => {
    const set = new Set(state.entries.map((e) => e.type));
    return QUICK_TYPES.filter((q) => set.has(q.type));
  }, [state.entries]);

  const H_PAD = 20;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingTop: topInset + 8, paddingBottom: 130, paddingHorizontal: H_PAD }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          {/* Header */}
          <View style={s.header}>
            <View style={[s.headerIcon, { backgroundColor: colors.primary + "14" }]}>
              <Ionicons name="reader" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: colors.foreground, fontFamily: DISPLAY }]}>Activity Log</Text>
              <Text style={[s.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                The full handoff — every wag accounted for 🐾
              </Text>
            </View>
          </View>

          {/* Quick logger card */}
          <View style={[s.loggerCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <Text style={[s.loggerTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Log something</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.typeRow}
              style={{ marginHorizontal: -4 }}
            >
              {QUICK_TYPES.map((q) => {
                const active = selectedType === q.type;
                const tint = PULSE_COLORS[q.icon];
                return (
                  <Pressable
                    key={q.type}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedType(q.type);
                    }}
                    style={[
                      s.typeChip,
                      {
                        backgroundColor: active ? colors.primary : colors.background,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <View style={[s.typeChipIcon, { backgroundColor: active ? "rgba(255,255,255,0.18)" : tint + "1A" }]}>
                      <PulseIcon name={q.icon} size={15} color={active ? "#FFFFFF" : undefined} />
                    </View>
                    <Text
                      style={[
                        s.typeChipLabel,
                        { color: active ? "#FFFFFF" : colors.foreground, fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" },
                      ]}
                    >
                      {q.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={s.inputRow}>
              <TextInput
                placeholder="Add a note (optional)"
                placeholderTextColor={colors.mutedForeground}
                value={note}
                onChangeText={setNote}
                style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                returnKeyType="done"
                onSubmitEditing={handleLog}
              />
              <Pressable
                onPress={handleLog}
                style={({ pressed }) => [s.logBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Ionicons name="checkmark" size={24} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* Filter chips */}
          {presentTypes.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filterRow}
              style={{ marginHorizontal: -H_PAD, marginTop: 6 }}
            >
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilter(null);
                }}
                style={[s.filterChip, { backgroundColor: filter === null ? colors.foreground : colors.card, borderColor: filter === null ? colors.foreground : colors.border }]}
              >
                <Text style={[s.filterText, { color: filter === null ? "#FFFFFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>All</Text>
              </Pressable>
              {presentTypes.map((q) => {
                const active = filter === q.type;
                const tint = PULSE_COLORS[q.icon];
                return (
                  <Pressable
                    key={q.type}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setFilter(active ? null : q.type);
                    }}
                    style={[s.filterChip, { backgroundColor: active ? tint : colors.card, borderColor: active ? tint : colors.border }]}
                  >
                    <PulseIcon name={q.icon} size={14} color={active ? "#FFFFFF" : undefined} />
                    <Text style={[s.filterText, { color: active ? "#FFFFFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{q.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Timeline */}
          {grouped.length === 0 ? (
            <View style={[s.empty, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
              <Ionicons name="clipboard-outline" size={32} color={colors.mutedForeground} />
              <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {filter ? "Nothing logged for this filter yet." : "No entries logged yet."}
              </Text>
            </View>
          ) : (
            grouped.map((g) => (
              <View key={g.key} style={{ marginTop: 22 }}>
                <Text style={[s.dayHeading, { color: colors.foreground, fontFamily: DISPLAY }]}>{g.label}</Text>
                <View style={[s.dayCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
                  {g.entries.map((e, i) => {
                    const icon = TYPE_ICON[e.type] ?? "paw";
                    const cg = caregiverColor(e.caregiver);
                    const sev = e.severity && e.severity !== "normal" ? e.severity : null;
                    const sevColor = sev === "urgent" || sev === "alert" ? colors.rose : colors.amber;
                    return (
                      <View
                        key={e.id}
                        style={[s.entryRow, i < g.entries.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                      >
                        <View style={[s.entryAvatar, { backgroundColor: cg + "1A" }]}>
                          <Text style={[s.entryInitial, { color: cg, fontFamily: "Inter_700Bold" }]}>
                            {(e.caregiver || "?").charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={[s.entryIconWrap, { backgroundColor: PULSE_COLORS[icon] + "16" }]}>
                          <PulseIcon name={icon} size={18} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={s.entryTitleLine}>
                            <Text numberOfLines={1} style={[s.entryTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                              {e.title}
                            </Text>
                            {sev && (
                              <View style={[s.sevBadge, { backgroundColor: sevColor + "1A" }]}>
                                <Text style={[s.sevText, { color: sevColor, fontFamily: "Inter_700Bold" }]}>{sev}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[s.entryMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                            {e.caregiver} · {relativeTime(e.occurredAt, now)}
                          </Text>
                          {e.note ? (
                            <Text numberOfLines={3} style={[s.entryNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                              {e.note}
                            </Text>
                          ) : null}
                        </View>
                        <Pressable onPress={() => handleDelete(e.id, e.title)} hitSlop={12} style={s.delBtn}>
                          <Ionicons name="trash-outline" size={18} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </Animated.View>
      </ScrollView>
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

  loggerCard: {
    borderRadius: 24,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  loggerTitle: { fontSize: 16, marginBottom: 12 },
  typeRow: { gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingLeft: 6,
    paddingRight: 13,
    paddingVertical: 6,
    borderRadius: 22,
    borderWidth: 1,
  },
  typeChipIcon: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  typeChipLabel: { fontSize: 13.5 },
  inputRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  input: { flex: 1, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15 },
  logBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2E5846",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },

  filterRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 6 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 13 },

  dayHeading: { fontSize: 18, letterSpacing: -0.2, marginBottom: 10, marginLeft: 2 },
  dayCard: {
    borderRadius: 22,
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  entryRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 14 },
  entryAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  entryInitial: { fontSize: 14 },
  entryIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  entryTitleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  entryTitle: { fontSize: 15, flexShrink: 1 },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  sevText: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4 },
  entryMeta: { fontSize: 12.5, marginTop: 2 },
  entryNote: { fontSize: 13.5, lineHeight: 19, marginTop: 5 },
  delBtn: { padding: 4 },

  empty: {
    borderRadius: 22,
    padding: 40,
    alignItems: "center",
    gap: 12,
    marginTop: 22,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  emptyText: { fontSize: 15 },
});

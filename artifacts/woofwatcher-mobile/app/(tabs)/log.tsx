import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
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
import { useGetMe } from "@workspace/api-client-react";
import { useCare, Entry } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

type Severity = "normal" | "watch" | "alert";

interface Choice {
  id: string;
  label: string;
  suffix?: string;
  mood?: string;
  severity?: Severity;
}

interface ChoiceGroup {
  key: string;
  label: string;
  options: Choice[];
}

interface LogType {
  type: string;
  label: string;
  icon: PulseIconName;
  baseTitle: string;
  groups?: ChoiceGroup[];
  stepper?: { label: string; unit: string; values: number[] };
  numeric?: { label: string; placeholder: string };
  noteField?: { placeholder: string };
}

const LOG_TYPES: LogType[] = [
  {
    type: "meal",
    label: "Meal",
    icon: "bowl",
    baseTitle: "Meal",
    groups: [
      {
        key: "portion",
        label: "Portion",
        options: [
          { id: "full", label: "Full bowl", suffix: "full bowl" },
          { id: "half", label: "Half", suffix: "half portion" },
          { id: "light", label: "Light", suffix: "light portion" },
          { id: "snack", label: "Snack", suffix: "snack" },
        ],
      },
    ],
  },
  {
    type: "water",
    label: "Water",
    icon: "drop",
    baseTitle: "Water",
    groups: [
      {
        key: "amount",
        label: "Amount",
        options: [
          { id: "sip", label: "A sip", suffix: "a sip" },
          { id: "bowl", label: "Full bowl", suffix: "full bowl" },
          { id: "refill", label: "Refill", suffix: "refill" },
        ],
      },
    ],
  },
  { type: "treat", label: "Treat", icon: "bone", baseTitle: "Treat" },
  {
    type: "walk",
    label: "Walk",
    icon: "paw",
    baseTitle: "Walk",
    stepper: { label: "Duration", unit: "min", values: [10, 15, 20, 30, 45, 60] },
  },
  {
    type: "potty",
    label: "Potty",
    icon: "drop",
    baseTitle: "Potty",
    groups: [
      {
        key: "kind",
        label: "Kind",
        options: [
          { id: "pee", label: "Pee", suffix: "pee" },
          { id: "poop", label: "Poop", suffix: "poop" },
          { id: "both", label: "Both", suffix: "pee & poop" },
        ],
      },
      {
        key: "condition",
        label: "Condition",
        options: [
          { id: "normal", label: "Normal", severity: "normal" },
          { id: "soft", label: "Soft", severity: "watch" },
          { id: "off", label: "Off", severity: "alert" },
        ],
      },
    ],
  },
  {
    type: "play",
    label: "Play",
    icon: "candy",
    baseTitle: "Play",
    stepper: { label: "Duration", unit: "min", values: [5, 10, 15, 20, 30] },
  },
  { type: "training", label: "Training", icon: "star", baseTitle: "Training win" },
  {
    type: "mood",
    label: "Mood",
    icon: "heart",
    baseTitle: "Mood",
    groups: [
      {
        key: "mood",
        label: "How are they feeling?",
        options: [
          { id: "happy", label: "Happy", suffix: "happy", mood: "happy" },
          { id: "excited", label: "Excited", suffix: "excited", mood: "excited" },
          { id: "calm", label: "Calm", suffix: "calm", mood: "calm" },
          { id: "anxious", label: "Anxious", suffix: "anxious", mood: "anxious", severity: "watch" },
          { id: "unwell", label: "Unwell", suffix: "unwell", mood: "unwell", severity: "alert" },
        ],
      },
    ],
  },
  {
    type: "meds",
    label: "Meds",
    icon: "drop",
    baseTitle: "Medication",
    noteField: { placeholder: "Which medication & dose?" },
  },
  { type: "weight", label: "Weight", icon: "bone", baseTitle: "Weight", numeric: { label: "Weight", placeholder: "0.0" } },
  {
    type: "symptom",
    label: "Symptom",
    icon: "vomit",
    baseTitle: "Symptom",
    groups: [
      {
        key: "what",
        label: "What happened?",
        options: [
          { id: "vomit", label: "Vomit", suffix: "vomit" },
          { id: "diarrhea", label: "Diarrhea", suffix: "diarrhea" },
          { id: "itching", label: "Itching", suffix: "itching" },
          { id: "limping", label: "Limping", suffix: "limping" },
          { id: "other", label: "Other", suffix: "symptom" },
        ],
      },
      {
        key: "severity",
        label: "Severity",
        options: [
          { id: "watch", label: "Watch", severity: "watch" },
          { id: "alert", label: "Alert", severity: "alert" },
        ],
      },
    ],
  },
  {
    type: "grooming",
    label: "Grooming",
    icon: "star",
    baseTitle: "Grooming",
    groups: [
      {
        key: "kind",
        label: "Type",
        options: [
          { id: "brush", label: "Brush", suffix: "brushing" },
          { id: "bath", label: "Bath", suffix: "bath" },
          { id: "nails", label: "Nails", suffix: "nail trim" },
          { id: "teeth", label: "Teeth", suffix: "teeth" },
        ],
      },
    ],
  },
  { type: "note", label: "Note", icon: "star", baseTitle: "Note", noteField: { placeholder: "What's on your mind?" } },
];

const TYPE_BY_ID: Record<string, LogType> = LOG_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.type]: t }),
  {} as Record<string, LogType>,
);

// Icon resolution covers the composer types plus legacy entry types.
const TYPE_ICON: Record<string, PulseIconName> = {
  ...LOG_TYPES.reduce((acc, t) => ({ ...acc, [t.type]: t.icon }), {} as Record<string, PulseIconName>),
  pee: "drop",
  poop: "drop",
  park: "paw",
  social: "heart",
  alone: "house",
  vomit: "vomit",
  health: "heart",
  vet: "heart",
  medication: "drop",
};

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
  const { state, addEntry, deleteEntry, updateEntry, updateCareDoc } = useCare();
  const me = useGetMe();

  const topInset = Platform.OS === "web" ? 24 : insets.top;
  const now = Date.now();

  const caregiver =
    me.data?.user.displayName?.trim() || state.caregivers[0]?.name || "You";

  const [selectedType, setSelectedType] = useState<string>("meal");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [numeric, setNumeric] = useState("");
  const [noteText, setNoteText] = useState("");
  const [filter, setFilter] = useState<string | null>(null);

  const config = TYPE_BY_ID[selectedType];

  // Reset contextual controls whenever the type changes.
  useEffect(() => {
    const init: Record<string, string> = {};
    config?.groups?.forEach((g) => {
      init[g.key] = g.options[0].id;
    });
    setChoices(init);
    setStepIndex(config?.stepper ? Math.min(2, config.stepper.values.length - 1) : 0);
    setNumeric(selectedType === "weight" ? String(state.profile.weight.current ?? "") : "");
    setNoteText("");
  }, [selectedType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Post-log quick-note prompt
  const [promptId, setPromptId] = useState<string | null>(null);
  const [promptTitle, setPromptTitle] = useState("");
  const [promptNote, setPromptNote] = useState("");
  const promptRef = useRef<TextInput>(null);

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

  const buildEntry = useCallback((): Omit<Entry, "id"> | null => {
    if (!config) return null;
    const parts: string[] = [];
    let mood: string | undefined;
    let severity: Severity | undefined;

    config.groups?.forEach((g) => {
      const opt = g.options.find((o) => o.id === choices[g.key]) ?? g.options[0];
      if (opt.suffix) parts.push(opt.suffix);
      if (opt.mood) mood = opt.mood;
      if (opt.severity && opt.severity !== "normal") severity = opt.severity;
    });

    let durationMinutes: number | undefined;
    if (config.stepper) durationMinutes = config.stepper.values[stepIndex];

    let amount: string | undefined;
    if (config.numeric) {
      const n = parseFloat(numeric);
      if (Number.isNaN(n) || n <= 0) {
        Alert.alert("Add a value", `Enter a ${config.numeric.label.toLowerCase()} to log.`);
        return null;
      }
      amount = String(n);
      parts.push(`${n} ${state.profile.weight.unit}`);
    }

    const note = config.noteField ? noteText.trim() || undefined : undefined;
    if (durationMinutes) parts.push(`${durationMinutes} ${config.stepper!.unit}`);
    const title = parts.length ? `${config.baseTitle} · ${parts.join(", ")}` : config.baseTitle;

    return {
      type: config.type,
      title,
      caregiver,
      occurredAt: new Date().toISOString(),
      ...(note ? { note } : {}),
      ...(mood ? { mood } : {}),
      ...(severity ? { severity } : {}),
      ...(durationMinutes ? { durationMinutes } : {}),
      ...(amount != null ? { amount } : {}),
    };
  }, [config, choices, stepIndex, numeric, noteText, caregiver, state.profile.weight.unit]);

  const handleLog = useCallback(() => {
    const entry = buildEntry();
    if (!entry) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const id = addEntry(entry);

    // Weight logs also update the living profile weight.
    if (entry.type === "weight" && entry.amount != null) {
      const w = parseFloat(entry.amount);
      if (!Number.isNaN(w)) {
        updateCareDoc((doc) => ({
          ...doc,
          profile: { ...doc.profile, weight: { ...doc.profile.weight, current: w } },
        }));
      }
    }

    setNumeric(entry.type === "weight" ? (entry.amount ?? "") : "");
    setNoteText("");

    // If a note was already captured inline, skip the prompt.
    if (config?.noteField) return;

    setPromptId(id);
    setPromptTitle(entry.title);
    setPromptNote("");
    setTimeout(() => promptRef.current?.focus(), 250);
  }, [buildEntry, addEntry, updateCareDoc, config]);

  const saveQuickNote = useCallback(() => {
    const text = promptNote.trim();
    if (promptId && text) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateEntry(promptId, { note: text });
    }
    setPromptId(null);
    setPromptNote("");
  }, [promptId, promptNote, updateEntry]);

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

  const presentTypes = useMemo(() => {
    const set = new Set(state.entries.map((e) => e.type));
    return LOG_TYPES.filter((q) => set.has(q.type));
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
                Logging as {caregiver} — every wag accounted for 🐾
              </Text>
            </View>
          </View>

          {/* Composer card */}
          <View style={[s.loggerCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <Text style={[s.loggerTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Log something</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.typeRow}
              style={{ marginHorizontal: -4 }}
            >
              {LOG_TYPES.map((q) => {
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

            {/* Contextual controls */}
            {config?.groups?.map((g) => (
              <View key={g.key} style={s.fieldBlock}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                  {g.label}
                </Text>
                <View style={s.segRow}>
                  {g.options.map((o) => {
                    const active = (choices[g.key] ?? g.options[0].id) === o.id;
                    const tone =
                      o.severity === "alert" ? colors.rose : o.severity === "watch" ? colors.amber : colors.primary;
                    return (
                      <Pressable
                        key={o.id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setChoices((prev) => ({ ...prev, [g.key]: o.id }));
                        }}
                        style={[
                          s.segPill,
                          {
                            backgroundColor: active ? tone : colors.background,
                            borderColor: active ? tone : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.segText,
                            { color: active ? "#FFFFFF" : colors.foreground, fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" },
                          ]}
                        >
                          {o.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {config?.stepper && (
              <View style={s.fieldBlock}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                  {config.stepper.label}
                </Text>
                <View style={s.segRow}>
                  {config.stepper.values.map((v, i) => {
                    const active = stepIndex === i;
                    return (
                      <Pressable
                        key={v}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setStepIndex(i);
                        }}
                        style={[
                          s.segPill,
                          { backgroundColor: active ? colors.primary : colors.background, borderColor: active ? colors.primary : colors.border },
                        ]}
                      >
                        <Text
                          style={[
                            s.segText,
                            { color: active ? "#FFFFFF" : colors.foreground, fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" },
                          ]}
                        >
                          {v} {config.stepper!.unit}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {config?.numeric && (
              <View style={s.fieldBlock}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                  {config.numeric.label} ({state.profile.weight.unit})
                </Text>
                <TextInput
                  placeholder={config.numeric.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  value={numeric}
                  onChangeText={setNumeric}
                  keyboardType="decimal-pad"
                  style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                />
              </View>
            )}

            {config?.noteField && (
              <View style={s.fieldBlock}>
                <TextInput
                  placeholder={config.noteField.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  value={noteText}
                  onChangeText={setNoteText}
                  multiline
                  style={[s.input, s.inputMulti, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                />
              </View>
            )}

            <Pressable
              onPress={handleLog}
              style={({ pressed }) => [s.logBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={[s.logBtnText, { fontFamily: "Inter_700Bold" }]}>Log {config?.label.toLowerCase()}</Text>
            </Pressable>
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
                    const sevColor = sev === "alert" ? colors.rose : colors.amber;
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
                            <Text numberOfLines={4} style={[s.entryNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
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

      {/* Post-log quick-note prompt */}
      <Modal visible={promptId !== null} transparent animationType="fade" onRequestClose={() => setPromptId(null)}>
        <Pressable style={s.modalBackdrop} onPress={saveQuickNote}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalCenter}>
            <Pressable style={[s.modalCard, { backgroundColor: colors.card }]} onPress={() => {}}>
              <View style={[s.modalIcon, { backgroundColor: colors.sage + "1A" }]}>
                <Ionicons name="checkmark" size={22} color={colors.sage} />
              </View>
              <Text style={[s.modalTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                {promptTitle} logged
              </Text>
              <Text style={[s.modalSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Add a quick note? (optional)
              </Text>
              <TextInput
                ref={promptRef}
                placeholder="e.g. ate eagerly, left some kibble…"
                placeholderTextColor={colors.mutedForeground}
                value={promptNote}
                onChangeText={setPromptNote}
                multiline
                style={[s.input, s.inputMulti, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_400Regular", marginTop: 14 }]}
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={saveQuickNote}
              />
              <View style={s.modalActions}>
                <Pressable
                  onPress={() => {
                    setPromptId(null);
                    setPromptNote("");
                  }}
                  style={({ pressed }) => [s.modalSkip, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[s.modalSkipText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Skip</Text>
                </Pressable>
                <Pressable
                  onPress={saveQuickNote}
                  style={({ pressed }) => [s.modalSave, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={[s.modalSaveText, { fontFamily: "Inter_700Bold" }]}>Save note</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
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

  fieldBlock: { marginTop: 16 },
  fieldLabel: { fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 9 },
  segRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segPill: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 13, borderWidth: 1 },
  segText: { fontSize: 13.5 },

  input: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15 },
  inputMulti: { minHeight: 64, textAlignVertical: "top" },

  logBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
    marginTop: 18,
    shadowColor: "#2E5846",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  logBtnText: { color: "#fff", fontSize: 15.5 },

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

  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,31,36,0.45)" },
  modalCenter: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  modalCard: {
    borderRadius: 26,
    padding: 24,
    shadowColor: "#0F1F33",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 8,
  },
  modalIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  modalTitle: { fontSize: 19, letterSpacing: -0.2 },
  modalSub: { fontSize: 14, marginTop: 4 },
  modalActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  modalSkip: { flex: 1, height: 48, alignItems: "center", justifyContent: "center" },
  modalSkipText: { fontSize: 15 },
  modalSave: { flex: 2, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  modalSaveText: { color: "#fff", fontSize: 15 },
});

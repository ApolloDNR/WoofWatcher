import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Line,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import {
  buildPetCredential,
  buildCarePass,
  createCarePassArtifact,
  deriveAloneTime,
  deriveCareTrends,
  deriveGroomingCare,
  deriveHealthWatch,
  deriveMedicationAdherence,
  deriveMedicationFollowUps,
  deriveMedicationHistory,
  derivePottyHealth,
  deriveRecordReminders,
  deriveTrainingProgress,
  deriveWalkActivity,
  deriveWalkRouteTemplates,
  deriveWaterHydration,
  deriveWeightTrend,
  getCarePassArtifactPrintView,
  getPetCredentialPrintView,
  getRecordDueStatus,
  normalizeCareEventType,
  summarizeRecordVault,
  type CarePass,
  type CarePassAudience,
  type CarePassArtifact,
  type MedicationHistoryOutcomeFilter,
  type RecordKind,
} from "@workspace/care-domain";
import { useCare, Entry } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";
import { BoardRouteHeader, BoardSectionHeader } from "@/components/board/BoardPrimitives";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const HEALTH_ICON: Record<string, PulseIconName> = {
  vomit: "vomit",
  symptom: "vomit",
  health: "heart",
  vet: "heart",
  mood: "sad",
  alone: "house",
  medication: "pill",
  meds: "pill",
};

const MOOD_META: Record<string, { label: string; score: number; tone: "good" | "watch" | "alert" }> = {
  happy: { label: "Happy", score: 5, tone: "good" },
  excited: { label: "Excited", score: 4, tone: "good" },
  calm: { label: "Calm", score: 4, tone: "good" },
  anxious: { label: "Anxious", score: 2, tone: "watch" },
  unwell: { label: "Unwell", score: 1, tone: "alert" },
};

const PERIODS = [
  { key: 7, label: "Week" },
  { key: 30, label: "Month" },
  { key: 90, label: "Quarter" },
] as const;

const CARE_PASS_OPTIONS: {
  audience: CarePassAudience;
  label: string;
  detail: string;
  icon: IoniconName;
}[] = [
  { audience: "sitter", label: "Sitter", detail: "Routine, food, next care", icon: "home-outline" },
  { audience: "vet", label: "Vet", detail: "Health signals, records", icon: "medkit-outline" },
  { audience: "trainer", label: "Trainer", detail: "Behavior, activity, focus", icon: "school-outline" },
  { audience: "caregiver", label: "Caregiver", detail: "Shift handoff", icon: "people-outline" },
];

const RECORD_OPTIONS: {
  kind: RecordKind;
  label: string;
  detail: string;
  icon: IoniconName;
  dueLabel: string;
}[] = [
  { kind: "vaccine", label: "Vaccine", detail: "Shots and boosters", icon: "shield-checkmark-outline", dueLabel: "Due date or expiry" },
  { kind: "vet", label: "Vet Visit", detail: "Visits and exam notes", icon: "medkit-outline", dueLabel: "Visit date" },
  { kind: "receipt", label: "Receipt", detail: "Bills and purchases", icon: "receipt-outline", dueLabel: "Receipt date or amount" },
  { kind: "insurance", label: "Insurance", detail: "Policy and card details", icon: "card-outline", dueLabel: "Policy number or renewal" },
  { kind: "microchip", label: "Microchip", detail: "Chip and registry info", icon: "scan-outline", dueLabel: "Chip number" },
  { kind: "medication", label: "Medication", detail: "Prescriptions and doses", icon: "bandage-outline", dueLabel: "Dose or refill date" },
  { kind: "weight", label: "Weight", detail: "Weigh-ins and targets", icon: "scale-outline", dueLabel: "Date or value" },
  { kind: "document", label: "Document", detail: "Certificates and files", icon: "document-text-outline", dueLabel: "Date or reference" },
];

const MEDICATION_OUTCOME_FILTERS: { id: MedicationHistoryOutcomeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "taken", label: "Taken" },
  { id: "attention", label: "Needs review" },
  { id: "skipped", label: "Skipped" },
  { id: "missed", label: "Missed" },
];

function daysBetween(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / 86400000;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function relativeDay(iso: string, now: number): string {
  const d = Math.floor(daysBetween(iso, now));
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return shortDate(iso);
}

function entryType(entry: Entry): string {
  return normalizeCareEventType(entry.type, entry.details);
}

function hasAttachment(record: unknown): boolean {
  const attachment = (record as { attachmentUri?: unknown }).attachmentUri;
  return typeof attachment === "string" && attachment.trim().length > 0;
}

export default function RecordsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, updateCareDoc } = useCare();
  const { width } = useWindowDimensions();

  const topInset = Platform.OS === "web" ? 24 : insets.top;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const unit = state.profile.weight.unit;

  const [period, setPeriod] = useState<number>(30);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordType, setRecordType] = useState<RecordKind>("vaccine");
  const [recordTitle, setRecordTitle] = useState("");
  const [recordDue, setRecordDue] = useState("");
  const [recordNote, setRecordNote] = useState("");
  const [recordAttachmentUri, setRecordAttachmentUri] = useState("");
  const [carePassPreview, setCarePassPreview] = useState<CarePass | null>(null);
  const [medicationSearch, setMedicationSearch] = useState("");
  const [medicationOutcomeFilter, setMedicationOutcomeFilter] = useState<MedicationHistoryOutcomeFilter>("all");

  const recordOption = RECORD_OPTIONS.find((option) => option.kind === recordType) ?? RECORD_OPTIONS[0];

  const healthWatch = useMemo(
    () => deriveHealthWatch({ entries: state.entries, routines: state.routines, now }),
    [state.entries, state.routines, now],
  );
  const careTrends = useMemo(
    () => deriveCareTrends({ entries: state.entries, now, windowDays: 7 }),
    [state.entries, now],
  );
  const medicationAdherence = useMemo(
    () => deriveMedicationAdherence({ entries: state.entries, routines: state.routines, now }),
    [state.entries, state.routines, now],
  );
  const medicationFollowUps = useMemo(
    () => deriveMedicationFollowUps({ entries: state.entries, routines: state.routines, records: state.records, now }).slice(0, 3),
    [state.entries, state.routines, state.records, now],
  );
  const medicationHistory = useMemo(
    () => deriveMedicationHistory({ entries: state.entries, now, limit: 8, query: medicationSearch, outcome: medicationOutcomeFilter }),
    [state.entries, now, medicationSearch, medicationOutcomeFilter],
  );
  const waterHydration = useMemo(
    () => deriveWaterHydration({ entries: state.entries, now }),
    [state.entries, now],
  );
  const walkActivity = useMemo(
    () => deriveWalkActivity({ entries: state.entries, now }),
    [state.entries, now],
  );
  const walkRouteTemplates = useMemo(
    () => deriveWalkRouteTemplates({ entries: state.entries, now, limit: 3 }),
    [state.entries, now],
  );
  const pottyHealth = useMemo(
    () => derivePottyHealth({ entries: state.entries, now }),
    [state.entries, now],
  );
  const trainingProgress = useMemo(
    () => deriveTrainingProgress({ entries: state.entries, now, lookbackDays: 30 }),
    [state.entries, now],
  );
  const aloneTime = useMemo(
    () => deriveAloneTime({ entries: state.entries, now, lookbackDays: 30 }),
    [state.entries, now],
  );
  const groomingCare = useMemo(
    () => deriveGroomingCare({ entries: state.entries, now, lookbackDays: 45 }),
    [state.entries, now],
  );
  const weightTrend = useMemo(
    () => deriveWeightTrend({ entries: state.entries, profile: state.profile, goals: state.goals, now, lookbackDays: 90, limit: 8 }),
    [state.entries, state.profile, state.goals, now],
  );
  const current = weightTrend.currentWeight || state.profile.weight.current;

  // ---- Weight trend (prefer real weight logs, fall back to gentle synthesis) ----
  const goalWeight = weightTrend.goalWeight || Math.round(current) + 2;

  const { series, labels, isRealWeight } = useMemo(() => {
    const real = weightTrend.items;
    if (real.length >= 2) {
      return {
        series: real.map((item) => item.weight),
        labels: real.map((item, i) => (i === real.length - 1 ? "Now" : shortDate(item.occurredAt))),
        isRealWeight: true,
      };
    }
    const n = 7;
    const start = current - 1.6;
    const wobble = [0, 0.25, -0.15, 0.35, 0.1, 0.4, 0];
    const arr: number[] = [];
    for (let i = 0; i < n; i++) {
      const base = start + (current - start) * (i / (n - 1));
      arr.push(Math.round((base + (i < n - 1 ? wobble[i] : 0)) * 10) / 10);
    }
    arr[n - 1] = current;
    return {
      series: arr,
      labels: arr.map((_, i) => (i === n - 1 ? "Now" : `${n - 1 - i}w`)),
      isRealWeight: false,
    };
  }, [weightTrend.items, current]);

  // ---- Mood distribution (last 30 days) ----
  const moodStats = useMemo(() => {
    const recent = state.entries.filter(
      (e) => e.mood && MOOD_META[e.mood] && daysBetween(e.occurredAt, now) <= 30,
    );
    const counts: Record<string, number> = {};
    let total = 0;
    let scoreSum = 0;
    for (const e of recent) {
      counts[e.mood as string] = (counts[e.mood as string] ?? 0) + 1;
      total += 1;
      scoreSum += MOOD_META[e.mood as string].score;
    }
    const avg = total ? scoreSum / total : 0;
    const bars = Object.keys(MOOD_META)
      .map((k) => ({ key: k, ...MOOD_META[k], count: counts[k] ?? 0 }))
      .filter((b) => b.count > 0)
      .sort((a, b) => b.count - a.count);
    return { total, avg, bars };
  }, [state.entries, now]);

  // ---- Incident lookback ----
  const incidents = useMemo(
    () =>
      state.entries
        .filter((e) => entryType(e) === "vomit" || entryType(e) === "symptom")
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    [state.entries],
  );
  const incident7 = incidents.filter((e) => daysBetween(e.occurredAt, now) <= 7).length;
  const incident30 = incidents.filter((e) => daysBetween(e.occurredAt, now) <= 30).length;
  const incident90 = incidents.filter((e) => daysBetween(e.occurredAt, now) <= 90).length;
  const healthTone =
    healthWatch.status === "alert"
      ? colors.rose
      : healthWatch.status === "watch"
        ? colors.amber
        : colors.sage;

  // ---- Progress report (period-scoped, computed from real logs) ----
  const report = useMemo(() => {
    const within = state.entries.filter((e) => daysBetween(e.occurredAt, now) <= period);
    const count = (types: string[]) => within.filter((e) => types.includes(entryType(e))).length;
    const walkMinutes = within
      .filter((e) => entryType(e) === "walk")
      .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
    const byCaregiver: Record<string, number> = {};
    for (const e of within) {
      if (e.caregiver) byCaregiver[e.caregiver] = (byCaregiver[e.caregiver] ?? 0) + 1;
    }
    const topCaregiver = Object.entries(byCaregiver).sort((a, b) => b[1] - a[1])[0];
    return {
      total: within.length,
      meals: count(["meal"]),
      walks: count(["walk"]),
      walkMinutes,
      play: count(["play", "training"]),
      potty: count(["potty"]),
      treats: count(["treat"]),
      incidents: count(["vomit", "symptom"]),
      topCaregiver: topCaregiver ? { name: topCaregiver[0], count: topCaregiver[1] } : null,
    };
  }, [state.entries, period, now]);

  const dietHistory = useMemo(
    () =>
      state.entries
        .filter((e) => entryType(e) === "meal" && e.note)
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 4),
    [state.entries],
  );

  const recordVault = useMemo(() => summarizeRecordVault(state.records), [state.records]);
  const recordReminders = useMemo(
    () => deriveRecordReminders(state.records, { now }).slice(0, 4),
    [state.records, now],
  );
  const credential = useMemo(
    () =>
      buildPetCredential({
        profile: state.profile,
        caregivers: state.caregivers,
        records: state.records,
      }),
    [state.profile, state.caregivers, state.records],
  );

  const openRecordForm = (kind: RecordKind = "vaccine") => {
    setRecordType(kind);
    setRecordTitle("");
    setRecordDue("");
    setRecordNote("");
    setRecordAttachmentUri("");
    setRecordOpen(true);
    Haptics.selectionAsync();
  };

  const pickRecordAttachment = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setRecordAttachmentUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert("Attachment unavailable", "Choose the file details manually for now.");
    }
  };

  const saveRecord = () => {
    const title = recordTitle.trim();
    if (!title) {
      Alert.alert("Add a title", `Name this ${recordOption.label.toLowerCase()} record.`);
      return;
    }
    const id = `record_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateCareDoc((doc) => ({
      ...doc,
      records: [
        ...doc.records,
        {
          id,
          type: recordType,
          title,
          due: recordDue.trim(),
          note: recordNote.trim(),
          ...(recordAttachmentUri
            ? {
                attachmentUri: recordAttachmentUri,
                attachmentName: `${recordOption.label} attachment`,
              }
            : {}),
        },
      ],
    }));
    setRecordOpen(false);
  };

  const deleteRecord = (id: string | undefined, title: string) => {
    if (!id) return;
    Alert.alert("Delete record", `Remove "${title}" from ${state.profile.name}'s vault?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          updateCareDoc((doc) => ({ ...doc, records: doc.records.filter((record) => record.id !== id) }));
        },
      },
    ]);
  };

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "Month";

  const shareReport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const lines = [
      `WOOFWATCHER PROGRESS REPORT - Last ${period} days`,
      `${state.profile.name} (${state.profile.breed})`,
      "",
      `Total entries logged: ${report.total}`,
      `Meals: ${report.meals}`,
      `Walks: ${report.walks} (${report.walkMinutes} min)`,
      `Play & training: ${report.play}`,
      `Potty breaks: ${report.potty}`,
      `Treats: ${report.treats}`,
      `Health incidents: ${report.incidents}`,
      report.topCaregiver ? `Most active caregiver: ${report.topCaregiver.name} (${report.topCaregiver.count})` : "",
      "",
      `Current weight: ${current} ${unit} (goal ${goalWeight} ${unit})`,
      moodStats.total ? `Mood average: ${moodStats.avg.toFixed(1)}/5 over ${moodStats.total} check-ins` : "",
      "",
      "Shared from WoofWatcher - patterns for caregiver & vet review.",
    ]
      .filter(Boolean)
      .join("\n");
    Share.share({ message: lines, title: `${state.profile.name} - ${periodLabel} report` }).catch(() =>
      Alert.alert("Progress report", lines),
    );
  };

  const shareCredential = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Share.share({ message: credential.message, title: `${credential.name} Dog ID` }).catch(() =>
      Alert.alert(`${credential.name} Dog ID`, credential.message),
    );
  };

  const sharePrintableCredential = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const printable = getPetCredentialPrintView(credential);
    Share.share({ message: printable.html, title: printable.fileName }).catch(() =>
      Alert.alert(printable.fileName, printable.html),
    );
  };

  const buildCarePassFor = (audience: CarePassAudience) =>
    buildCarePass({
      audience,
      profile: state.profile,
      dietProfile: state.dietProfile,
      entries: state.entries,
      routines: state.routines,
      caregivers: state.caregivers,
      records: state.records,
      goals: state.goals,
      now,
    });

  const openCarePassPreview = (audience: CarePassAudience) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCarePassPreview(buildCarePassFor(audience));
  };

  const reportArtifacts = useMemo(
    () =>
      [...state.reportArtifacts]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [state.reportArtifacts],
  );

  const shareCarePass = (pass: CarePass) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const artifact = createCarePassArtifact(pass);
    updateCareDoc((doc) => ({
      ...doc,
      reportArtifacts: [
        artifact,
        ...doc.reportArtifacts.filter((item) => item.id !== artifact.id),
      ].slice(0, 12),
    }));
    Share.share({ message: pass.message, title: pass.title }).catch(() =>
      Alert.alert(pass.title, pass.message),
    );
  };

  const shareReportArtifact = (artifact: CarePassArtifact) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Share.share({ message: artifact.message, title: artifact.title }).catch(() =>
      Alert.alert(artifact.title, artifact.message),
    );
  };

  const sharePrintableReportArtifact = (artifact: CarePassArtifact) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const printable = getCarePassArtifactPrintView(artifact);
    Share.share({ message: printable.html, title: printable.fileName }).catch(() =>
      Alert.alert(printable.fileName, printable.html),
    );
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

  // Chart geometry
  const H_PAD = 20;
  const cardPad = 18;
  const chartW = width - H_PAD * 2 - cardPad * 2;
  const chartH = 140;
  const padL = 6;
  const padR = 6;
  const padT = 12;
  const padB = 26;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const allVals = [...series, goalWeight];
  const minV = Math.min(...allVals) - 0.6;
  const maxV = Math.max(...allVals) + 0.6;
  const xAt = (i: number) => padL + (i / Math.max(1, series.length - 1)) * plotW;
  const yAt = (v: number) => padT + (1 - (v - minV) / (maxV - minV || 1)) * plotH;
  const linePath = series.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${xAt(series.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${xAt(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
  const goalY = yAt(goalWeight);
  const remaining = weightTrend.goalWeight ? weightTrend.remainingToGoal : Math.max(0, goalWeight - current);
  const maxBar = Math.max(1, ...moodStats.bars.map((b) => b.count));
  const incidentMax = Math.max(1, incident7, incident30, incident90);

  const streak = useMemo(() => {
    const days = new Set(state.entries.map((e) => e.occurredAt.slice(0, 10)));
    let s = 0;
    let d = new Date(now);
    for (let i = 0; i < 365; i++) {
      const key = d.toISOString().slice(0, 10);
      if (!days.has(key)) break;
      s++;
      d = new Date(d.getTime() - 86400000);
    }
    return s;
  }, [state.entries, now]);

  const lastIncidentDays = useMemo(() => {
    if (incidents.length === 0) return null;
    return Math.floor(daysBetween(incidents[0].occurredAt, now));
  }, [incidents, now]);

  const reportStats: { icon: PulseIconName; label: string; value: string }[] = [
    { icon: "bowl", label: "Meals", value: String(report.meals) },
    { icon: "paw", label: "Walks", value: `${report.walks} - ${report.walkMinutes}m` },
    { icon: "candy", label: "Play & train", value: String(report.play) },
    { icon: "drop", label: "Potty", value: String(report.potty) },
    { icon: "bone", label: "Treats", value: String(report.treats) },
    { icon: "vomit", label: "Incidents", value: String(report.incidents) },
  ];
  const trendSignals = careTrends.signals.slice(0, 3);
  const walkMinutes = careTrends.current.walks.totalMinutes;
  const mealCompletion = careTrends.current.meals.completionPercent;

  const recordSections = recordVault.sections.filter((section) =>
    ["vaccine", "vet", "receipt", "insurance", "microchip", "document"].includes(section.kind),
  );
  const recordList = recordVault.priorityRecords;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingTop: topInset + 8, paddingBottom: 130, paddingHorizontal: H_PAD }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <BoardRouteHeader
            kicker="Records"
            title="Records"
            subtitle={`${state.profile.name}'s file cabinet - trends, incidents & reports`}
            icon="folder-open-outline"
          />

          {/* Care highlights strip */}
          <View style={[s.highlightStrip, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            {[
              { value: streak > 0 ? `${streak}d` : "--", label: "Streak", color: streak >= 7 ? colors.sage : streak > 0 ? colors.primary : colors.mutedForeground },
              { value: String(report.total), label: `${periodLabel} entries`, color: colors.primary },
              { value: lastIncidentDays !== null ? `${lastIncidentDays}d` : "Clear", label: "Since incident", color: lastIncidentDays === 0 ? colors.rose : lastIncidentDays !== null && lastIncidentDays <= 3 ? colors.amber : colors.sage },
            ].map((h, i) => (
              <View key={h.label} style={[s.highlightCell, i < 2 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
                <Text style={[s.highlightValue, { color: h.color, fontFamily: DISPLAY }]}>{h.value}</Text>
                <Text style={[s.highlightLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{h.label}</Text>
              </View>
            ))}
          </View>

          {/* Care trends */}
          <BoardSectionHeader title="Care Trends" action="7 days" style={{ marginTop: 28 }} />
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.trendHeroRow}>
              <View style={[s.watchSummaryIcon, { backgroundColor: colors.primary + "14" }]}>
                <Ionicons name="analytics-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.watchSummaryTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {careTrends.current.totalLogs ? "Weekly pattern" : "Build a trend baseline"}
                </Text>
                <Text style={[s.watchSummaryDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {careTrends.summary}
                </Text>
              </View>
            </View>
            <View style={s.trendStatGrid}>
              {[
                { label: "Logs", value: String(careTrends.current.totalLogs), color: colors.primary },
                { label: "Meal %", value: careTrends.current.meals.total ? `${mealCompletion}%` : "--", color: colors.copper },
                { label: "Walk min", value: String(walkMinutes), color: colors.sage },
              ].map((item) => (
                <View key={item.label} style={s.trendStatCell}>
                  <Text style={[s.trendStatValue, { color: item.color, fontFamily: DISPLAY_SEMI }]}>{item.value}</Text>
                  <Text style={[s.trendStatLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{item.label}</Text>
                </View>
              ))}
            </View>
            {trendSignals.length ? (
              <View style={s.trendSignalStack}>
                {trendSignals.map((signal) => {
                  const tone =
                    signal.tone === "alert"
                      ? colors.rose
                      : signal.tone === "watch"
                        ? colors.amber
                        : signal.tone === "good"
                          ? colors.sage
                          : colors.primary;
                  return (
                    <View key={signal.kind} style={[s.trendSignalRow, { borderTopColor: colors.border }]}>
                      <View style={[s.watchSignalDot, { backgroundColor: tone }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.trendSignalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{signal.label}</Text>
                        <Text style={[s.trendSignalDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{signal.detail}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
            <Text style={[s.hydrationNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{careTrends.nextStep}</Text>
          </View>

          {/* Dog ID card */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>{credential.name} ID Card</Text>
            <View style={s.shareInlineGroup}>
              <Pressable
                onPress={shareCredential}
                accessibilityRole="button"
                accessibilityLabel="Share dog ID card"
                hitSlop={8}
                style={s.shareInline}
              >
                <Ionicons name="share-outline" size={15} color={colors.copper} />
                <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Share</Text>
              </Pressable>
              <Pressable
                onPress={sharePrintableCredential}
                accessibilityRole="button"
                accessibilityLabel="Share printable dog ID source"
                hitSlop={8}
                style={s.shareInline}
              >
                <Ionicons name="print-outline" size={15} color={colors.copper} />
                <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Print</Text>
              </Pressable>
            </View>
          </View>
          <View style={[s.idCard, { backgroundColor: colors.navy, shadowColor: colors.midnight }]}>
            <View style={s.idCardTop}>
              <View style={[s.idBadge, { backgroundColor: colors.copper }]}>
                <Ionicons name="paw" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.idEyebrow, { color: colors.cream, fontFamily: "Inter_700Bold" }]}>WOOFWATCHER DOG ID</Text>
                <Text style={[s.idName, { color: "#FFFFFF", fontFamily: DISPLAY }]}>{credential.name}</Text>
              </View>
            </View>
            <View style={s.idGrid}>
              {[
                { label: "Breed", value: credential.breed },
                { label: "Weight", value: credential.weight },
                { label: "Microchip", value: credential.microchip },
                { label: "Insurance", value: credential.insurance },
                { label: "Primary vet", value: credential.primaryVet },
                { label: "Emergency", value: credential.emergencyContact },
              ].map((item) => (
                <View key={item.label} style={s.idField}>
                  <Text style={[s.idFieldLabel, { color: colors.cream, fontFamily: "Inter_600SemiBold" }]}>{item.label}</Text>
                  <Text numberOfLines={2} style={[s.idFieldValue, { color: "#FFFFFF", fontFamily: "Inter_500Medium" }]}>{item.value}</Text>
                </View>
              ))}
            </View>
            <View style={[s.idFooter, { borderTopColor: "rgba(255,255,255,0.14)" }]}>
              <Text numberOfLines={2} style={[s.idFooterText, { color: colors.cream, fontFamily: "Inter_500Medium" }]}>
                Vaccines: {credential.vaccines}
              </Text>
            </View>
          </View>

          {/* Record vault */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Record Vault</Text>
            <Pressable onPress={() => openRecordForm("document")} hitSlop={8} style={s.shareInline}>
              <Ionicons name="add-circle-outline" size={15} color={colors.copper} />
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Add</Text>
            </Pressable>
          </View>
          <View style={s.vaultGrid}>
            {recordSections.map((section) => {
              const option = RECORD_OPTIONS.find((item) => item.kind === section.kind) ?? RECORD_OPTIONS[0];
              const tone = section.status === "On file" ? colors.sage : colors.amber;
              return (
                <Pressable
                  key={section.kind}
                  onPress={() => openRecordForm(section.kind)}
                  style={({ pressed }) => [
                    s.vaultCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: section.status === "On file" ? colors.border : colors.amber + "66",
                      shadowColor: colors.primary,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={[s.vaultIcon, { backgroundColor: tone + "16" }]}>
                    <Ionicons name={option.icon} size={17} color={tone} />
                  </View>
                  <Text style={[s.vaultLabel, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{section.label}</Text>
                  <Text style={[s.vaultMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {section.count > 0 ? `${section.count} on file` : "Add now"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {recordVault.missingCritical.length > 0 ? (
            <View style={[s.vaultNotice, { backgroundColor: colors.amber + "12", borderColor: colors.amber + "44" }]}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.amber} />
              <Text style={[s.vaultNoticeText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                Missing: {recordVault.missingCritical.join(", ")}
              </Text>
            </View>
          ) : null}
          {recordReminders.length > 0 ? (
            <View style={[s.reminderList, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {recordReminders.map((reminder, index) => {
                const tone = reminder.urgency === "alert" ? colors.rose : colors.amber;
                return (
                  <View
                    key={`${reminder.kind}_${reminder.recordId ?? reminder.label}`}
                    style={[s.reminderRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                  >
                    <View style={[s.reminderIcon, { backgroundColor: tone + "16" }]}>
                      <Ionicons name={reminder.urgency === "alert" ? "alert-circle" : "time-outline"} size={16} color={tone} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.reminderTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        {reminder.label}
                      </Text>
                      <Text style={[s.reminderDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {reminder.detail}
                      </Text>
                      <Text style={[s.reminderAction, { color: tone, fontFamily: "Inter_700Bold" }]}>
                        {reminder.action}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* Weight trend */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Weight Trend</Text>
            <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>
              {remaining > 0 ? `${remaining.toFixed(1)} ${unit} ${weightTrend.direction === "reduce" ? "over goal" : "to go"}` : "Goal reached"}
            </Text>
          </View>
          <View style={[s.chartCard, { backgroundColor: colors.card, shadowColor: colors.primary, padding: cardPad }]}>
            <View style={s.chartTopRow}>
              <View>
                <Text style={[s.chartBig, { color: colors.foreground, fontFamily: DISPLAY }]}>
                  {current}
                  <Text style={[s.chartUnit, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}> {unit}</Text>
                </Text>
                <Text style={[s.chartCaption, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {isRealWeight ? "From logged weigh-ins" : "Current weight"}
                </Text>
              </View>
              <View style={[s.goalPill, { backgroundColor: colors.sage + "16" }]}>
                <Ionicons name="flag" size={13} color={colors.sage} />
                <Text style={[s.goalPillText, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                  Goal {goalWeight} {unit}
                </Text>
              </View>
            </View>

            <Svg width={chartW} height={chartH}>
              <Defs>
                <SvgGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.sage} stopOpacity={0.28} />
                  <Stop offset="1" stopColor={colors.sage} stopOpacity={0.02} />
                </SvgGradient>
              </Defs>
              {[0.25, 0.5, 0.75].map((t) => {
                const gy = padT + t * plotH;
                return <Line key={t} x1={padL} y1={gy} x2={padL + plotW} y2={gy} stroke={colors.border} strokeWidth={1} opacity={0.7} />;
              })}
              <Line x1={padL} y1={goalY} x2={padL + plotW} y2={goalY} stroke={colors.sage} strokeWidth={1.5} strokeDasharray="5 5" opacity={0.55} />
              <Path d={areaPath} fill="url(#weightFill)" />
              <Path d={linePath} fill="none" stroke={colors.primary} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              {series.map((v, i) => {
                const last = i === series.length - 1;
                return (
                  <Circle key={i} cx={xAt(i)} cy={yAt(v)} r={last ? 5.5 : 3} fill={last ? colors.copper : colors.card} stroke={last ? colors.card : colors.primary} strokeWidth={last ? 2.5 : 2} />
                );
              })}
              {labels.map((lbl, i) => (
                <SvgText key={`l${i}`} x={xAt(i)} y={chartH - 8} fill={colors.mutedForeground} fontSize={10} fontFamily="Inter_500Medium" textAnchor="middle">
                  {lbl}
                </SvgText>
              ))}
            </Svg>
            <Text style={[s.chartNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {isRealWeight ? weightTrend.nextStep : "Gentle, vet-guided pacing - slow and steady."}
            </Text>
          </View>

          {/* Mood trend */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Mood Trend</Text>
            {moodStats.total > 0 && (
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>
                {moodStats.avg.toFixed(1)}/5 avg
              </Text>
            )}
          </View>
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            {moodStats.bars.length === 0 ? (
              <Text style={[s.empty, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No mood check-ins yet. Log a mood to see trends.
              </Text>
            ) : (
              moodStats.bars.map((b) => {
                const tone = b.tone === "alert" ? colors.rose : b.tone === "watch" ? colors.amber : colors.sage;
                const pct = moodStats.total > 0 ? Math.round((b.count / moodStats.total) * 100) : 0;
                return (
                  <View key={b.key} style={s.moodRow}>
                    <Text style={[s.moodLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{b.label}</Text>
                    <View style={[s.moodTrack, { backgroundColor: colors.background }]}>
                      <View style={[s.moodFill, { backgroundColor: tone, width: `${(b.count / maxBar) * 100}%` }]} />
                    </View>
                    <Text style={[s.moodPct, { color: tone, fontFamily: "Inter_700Bold" }]}>{pct}%</Text>
                    <Text style={[s.moodCount, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>({b.count})</Text>
                  </View>
                );
              })
            )}
          </View>

          {/* Hydration */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Hydration</Text>
            <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>
              {waterHydration.total ? `${waterHydration.total} logs` : "No logs"}
            </Text>
          </View>
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.hydrationSummary}>
              <View style={[s.watchSummaryIcon, { backgroundColor: colors.primary + "18" }]}>
                <Ionicons name="water-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.watchSummaryTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {waterHydration.status === "logged" ? "Fresh water logged" : "Water watch"}
                </Text>
                <Text style={[s.watchSummaryDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {waterHydration.summary}
                </Text>
              </View>
            </View>
            <View style={[s.hydrationMeter, { backgroundColor: colors.background }]}>
              <View style={[s.hydrationMeterFill, { backgroundColor: colors.primary, width: `${waterHydration.percent}%` }]} />
            </View>
            <View style={s.hydrationStats}>
              {[
                { label: "Bowl refills", value: String(waterHydration.refillEquivalent) },
                { label: "Goal", value: `${waterHydration.targetRefills}` },
                { label: "Caregivers", value: String(waterHydration.caregivers.length) },
              ].map((item, index) => (
                <View key={item.label} style={[s.hydrationStat, index < 2 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
                  <Text style={[s.hydrationValue, { color: colors.foreground, fontFamily: DISPLAY }]}>{item.value}</Text>
                  <Text style={[s.hydrationLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{item.label}</Text>
                </View>
              ))}
            </View>
            <Text style={[s.hydrationNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {waterHydration.nextStep}
            </Text>
            {waterHydration.last ? (
              <View style={[s.watchPatternRow, { borderTopColor: colors.border }]}>
                <View style={[s.watchSignalDot, { backgroundColor: colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.watchPatternLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    Latest: {waterHydration.last.amountLabel}
                  </Text>
                  <Text style={[s.watchPatternEvidence, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {waterHydration.last.caregiver} - {relativeDay(waterHydration.last.occurredAt, now)}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Walk activity */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Walk Activity</Text>
            <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>
              {walkActivity.total ? `${walkActivity.total} walks` : "No walks"}
            </Text>
          </View>
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.hydrationSummary}>
              <View style={[s.watchSummaryIcon, { backgroundColor: colors.sage + "18" }]}>
                <Ionicons name="walk-outline" size={18} color={colors.sage} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.watchSummaryTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {walkActivity.status === "active" ? "Activity steady" : walkActivity.status === "light" ? "Light activity" : "Walk check"}
                </Text>
                <Text style={[s.watchSummaryDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {walkActivity.summary}
                </Text>
              </View>
            </View>
            <View style={[s.hydrationMeter, { backgroundColor: colors.background }]}>
              <View style={[s.hydrationMeterFill, { backgroundColor: colors.sage, width: `${walkActivity.percent}%` }]} />
            </View>
            <View style={s.hydrationStats}>
              {[
                { label: "Minutes", value: String(walkActivity.totalMinutes) },
                { label: "dog interactions", value: String(walkActivity.dogInteractions) },
                { label: "Places", value: String(walkActivity.places.length) },
              ].map((item, index) => (
                <View key={item.label} style={[s.hydrationStat, index < 2 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
                  <Text style={[s.hydrationValue, { color: colors.foreground, fontFamily: DISPLAY }]}>{item.value}</Text>
                  <Text style={[s.hydrationLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{item.label}</Text>
                </View>
              ))}
            </View>
            <Text style={[s.hydrationNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {walkActivity.nextStep}
            </Text>
            {walkActivity.last ? (
              <View style={[s.watchPatternRow, { borderTopColor: colors.border }]}>
                <View style={[s.watchSignalDot, { backgroundColor: colors.sage }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.watchPatternLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    Latest: {walkActivity.last.label}
                  </Text>
                  <Text style={[s.watchPatternEvidence, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {[
                      walkActivity.last.place,
                      walkActivity.last.caregiver,
                      relativeDay(walkActivity.last.occurredAt, now),
                    ].filter(Boolean).join(" - ")}
                  </Text>
                  {walkActivity.last.socialOutcome ? (
                    <Text style={[s.watchPatternNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {walkActivity.last.socialOutcome}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
            {walkRouteTemplates.length > 0 ? (
              <View style={[s.routeTemplateList, { borderTopColor: colors.border }]}>
                <View style={s.routeTemplateHeader}>
                  <Text style={[s.routeTemplateTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Saved Routes</Text>
                  <Text style={[s.routeTemplateCount, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    {walkRouteTemplates.length} templates
                  </Text>
                </View>
                {walkRouteTemplates.map((template, index) => (
                  <View
                    key={template.id}
                    style={[s.routeTemplateRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                  >
                    <View style={[s.routeTemplateIcon, { backgroundColor: colors.sage + "14" }]}>
                      <Ionicons name="map-outline" size={16} color={colors.sage} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[s.routeTemplateName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        {template.name}
                      </Text>
                      <Text style={[s.routeTemplateMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                        {template.suggestedUse} - {template.visits} {template.visits === 1 ? "visit" : "visits"} - {template.averageMinutes}m avg
                      </Text>
                      {template.socialOutcomes[0] ? (
                        <Text numberOfLines={2} style={[s.routeTemplateNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          {template.socialOutcomes[0]}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[s.routeTemplateMetric, { backgroundColor: colors.background }]}>
                      <Text style={[s.routeTemplateMetricValue, { color: colors.sage, fontFamily: DISPLAY_SEMI }]}>{template.dogInteractions}</Text>
                      <Text style={[s.routeTemplateMetricLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>dogs</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* Training progress */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Training Progress</Text>
            <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>
              {trainingProgress.totalSessions ? `${trainingProgress.totalSessions} sessions` : "No sessions"}
            </Text>
          </View>
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.hydrationSummary}>
              <View style={[s.watchSummaryIcon, { backgroundColor: colors.copper + "18" }]}>
                <Ionicons name="school-outline" size={18} color={colors.copper} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.watchSummaryTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {trainingProgress.status === "needs-practice"
                    ? "Practice focus"
                    : trainingProgress.status === "steady"
                      ? "Training steady"
                      : trainingProgress.status === "building"
                        ? "Training building"
                        : "Build training baseline"}
                </Text>
                <Text style={[s.watchSummaryDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {trainingProgress.summary}
                </Text>
              </View>
            </View>
            <View style={s.hydrationStats}>
              {[
                { label: "Minutes", value: String(trainingProgress.totalMinutes) },
                { label: "Wins", value: String(trainingProgress.winCount) },
                { label: "Skills", value: String(trainingProgress.skillCount) },
              ].map((item, index) => (
                <View key={item.label} style={[s.hydrationStat, index < 2 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
                  <Text style={[s.hydrationValue, { color: colors.foreground, fontFamily: DISPLAY }]}>{item.value}</Text>
                  <Text style={[s.hydrationLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{item.label}</Text>
                </View>
              ))}
            </View>
            {trainingProgress.focusSkills.length ? (
              <Text style={[s.hydrationNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Skills: {trainingProgress.focusSkills.slice(0, 4).join(", ")}
              </Text>
            ) : null}
            <Text style={[s.hydrationNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: trainingProgress.focusSkills.length ? 5 : 0 }]}>
              {trainingProgress.nextStep}
            </Text>
            {trainingProgress.latest ? (
              <View style={[s.watchPatternRow, { borderTopColor: colors.border }]}>
                <View style={[s.watchSignalDot, { backgroundColor: trainingProgress.struggleCount ? colors.amber : colors.copper }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.watchPatternLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    Latest: {trainingProgress.latest.label}
                  </Text>
                  <Text style={[s.watchPatternEvidence, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {[
                      trainingProgress.latest.outcome,
                      trainingProgress.latest.skill,
                      trainingProgress.latest.caregiver,
                      relativeDay(trainingProgress.latest.occurredAt, now),
                    ].filter(Boolean).join(" - ")}
                  </Text>
                  {trainingProgress.latest.nextPractice ? (
                    <Text style={[s.watchPatternNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {trainingProgress.latest.nextPractice}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>

          {/* Alone time */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Alone Time</Text>
            <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>
              {aloneTime.totalSessions ? `${aloneTime.totalSessions} logs` : "No logs"}
            </Text>
          </View>
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.hydrationSummary}>
              <View style={[s.watchSummaryIcon, { backgroundColor: colors.secondary + "18" }]}>
                <Ionicons name="home-outline" size={18} color={colors.secondary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.watchSummaryTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {aloneTime.status === "needs-support"
                    ? "Support needed"
                    : aloneTime.status === "watch"
                      ? "Anxiety watch"
                      : aloneTime.status === "steady"
                        ? "Alone steady"
                        : "Build alone baseline"}
                </Text>
                <Text style={[s.watchSummaryDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {aloneTime.summary}
                </Text>
              </View>
            </View>
            <View style={s.hydrationStats}>
              {[
                { label: "Minutes", value: String(aloneTime.totalMinutes) },
                { label: "Anxious", value: String(aloneTime.anxiousCount) },
                { label: "Distress", value: String(aloneTime.distressedCount) },
              ].map((item, index) => (
                <View key={item.label} style={[s.hydrationStat, index < 2 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
                  <Text style={[s.hydrationValue, { color: colors.foreground, fontFamily: DISPLAY }]}>{item.value}</Text>
                  <Text style={[s.hydrationLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{item.label}</Text>
                </View>
              ))}
            </View>
            {aloneTime.triggers.length ? (
              <Text style={[s.hydrationNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Triggers: {aloneTime.triggers.slice(0, 4).join(", ")}
              </Text>
            ) : null}
            {aloneTime.supports.length ? (
              <Text style={[s.hydrationNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 5 }]}>
                Supports: {aloneTime.supports.slice(0, 4).join(", ")}
              </Text>
            ) : null}
            <Text style={[s.hydrationNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: aloneTime.triggers.length || aloneTime.supports.length ? 5 : 0 }]}>
              {aloneTime.nextStep}
            </Text>
            {aloneTime.latest ? (
              <View style={[s.watchPatternRow, { borderTopColor: colors.border }]}>
                <View style={[s.watchSignalDot, { backgroundColor: aloneTime.distressedCount ? colors.rose : aloneTime.anxiousCount ? colors.amber : colors.secondary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.watchPatternLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    Latest: {aloneTime.latest.label}
                  </Text>
                  <Text style={[s.watchPatternEvidence, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {[
                      aloneTime.latest.outcome,
                      aloneTime.latest.caregiver,
                      aloneTime.latest.durationMinutes ? `${aloneTime.latest.durationMinutes} min` : "",
                      aloneTime.latest.recoveryMinutes ? `${aloneTime.latest.recoveryMinutes} min recovery` : "",
                      relativeDay(aloneTime.latest.occurredAt, now),
                    ].filter(Boolean).join(" - ")}
                  </Text>
                  {aloneTime.latest.calmingSupport ? (
                    <Text style={[s.watchPatternNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      Support: {aloneTime.latest.calmingSupport}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>

          {/* Grooming care */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Grooming Care</Text>
            <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>
              {groomingCare.totalSessions ? `${groomingCare.totalSessions} logs` : "No logs"}
            </Text>
          </View>
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.hydrationSummary}>
              <View style={[s.watchSummaryIcon, { backgroundColor: colors.sage + "18" }]}>
                <Ionicons name="sparkles-outline" size={18} color={colors.sage} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.watchSummaryTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {groomingCare.status === "watch"
                    ? "Coat watch"
                    : groomingCare.status === "due-soon"
                      ? "Grooming due soon"
                      : groomingCare.status === "steady"
                        ? "Grooming steady"
                        : "Build grooming baseline"}
                </Text>
                <Text style={[s.watchSummaryDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {groomingCare.summary}
                </Text>
              </View>
            </View>
            <View style={s.hydrationStats}>
              {[
                { label: "Brush", value: String(groomingCare.brushCount) },
                { label: "Bath", value: String(groomingCare.bathCount) },
                { label: "Nails", value: String(groomingCare.nailCount) },
              ].map((item, index) => (
                <View key={item.label} style={[s.hydrationStat, index < 2 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
                  <Text style={[s.hydrationValue, { color: colors.foreground, fontFamily: DISPLAY }]}>{item.value}</Text>
                  <Text style={[s.hydrationLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{item.label}</Text>
                </View>
              ))}
            </View>
            {groomingCare.products.length ? (
              <Text style={[s.hydrationNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Products: {groomingCare.products.slice(0, 4).join(", ")}
              </Text>
            ) : null}
            {groomingCare.nextDue ? (
              <Text style={[s.hydrationNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: groomingCare.products.length ? 5 : 0 }]}>
                Next due: {groomingCare.nextDue}
              </Text>
            ) : null}
            <Text style={[s.hydrationNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: groomingCare.products.length || groomingCare.nextDue ? 5 : 0 }]}>
              {groomingCare.nextStep}
            </Text>
            {groomingCare.latest ? (
              <View style={[s.watchPatternRow, { borderTopColor: colors.border }]}>
                <View style={[s.watchSignalDot, { backgroundColor: groomingCare.watchCount ? colors.amber : colors.sage }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.watchPatternLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    Latest: {groomingCare.latest.kindLabel}
                  </Text>
                  <Text style={[s.watchPatternEvidence, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {[
                      groomingCare.latest.condition,
                      groomingCare.latest.caregiver,
                      groomingCare.latest.durationMinutes ? `${groomingCare.latest.durationMinutes} min` : "",
                      relativeDay(groomingCare.latest.occurredAt, now),
                    ].filter(Boolean).join(" - ")}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Potty health */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Potty Health</Text>
            <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>
              {pottyHealth.total ? `${pottyHealth.total} logs` : "No logs"}
            </Text>
          </View>
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.hydrationSummary}>
              <View style={[s.watchSummaryIcon, { backgroundColor: colors.amber + "18" }]}>
                <Ionicons name="medical-outline" size={18} color={colors.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.watchSummaryTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {pottyHealth.status === "watch" ? "Stool watch" : pottyHealth.status === "steady" ? "Potty steady" : "Potty check"}
                </Text>
                <Text style={[s.watchSummaryDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {pottyHealth.summary}
                </Text>
              </View>
            </View>
            <View style={s.hydrationStats}>
              {[
                { label: "Pee", value: String(pottyHealth.peeCount) },
                { label: "Poop", value: String(pottyHealth.poopCount) },
                { label: "Review", value: String(pottyHealth.watchCount) },
              ].map((item, index) => (
                <View key={item.label} style={[s.hydrationStat, index < 2 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
                  <Text style={[s.hydrationValue, { color: colors.foreground, fontFamily: DISPLAY }]}>{item.value}</Text>
                  <Text style={[s.hydrationLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{item.label}</Text>
                </View>
              ))}
            </View>
            <Text style={[s.hydrationNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {pottyHealth.nextStep}
            </Text>
            {pottyHealth.stoolColors.length ? (
              <Text style={[s.hydrationNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 6 }]}>
                Colors: {pottyHealth.stoolColors.join(", ")}
              </Text>
            ) : null}
            {pottyHealth.contexts.length ? (
              <Text style={[s.hydrationNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 4 }]}>
                Context: {pottyHealth.contexts.join(", ")}
              </Text>
            ) : null}
            {pottyHealth.last ? (
              <View style={[s.watchPatternRow, { borderTopColor: colors.border }]}>
                <View style={[s.watchSignalDot, { backgroundColor: pottyHealth.watchCount ? colors.amber : colors.sage }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.watchPatternLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    Latest: {pottyHealth.last.kindLabel}
                  </Text>
                  <Text style={[s.watchPatternEvidence, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {[
                      pottyHealth.last.condition !== "not logged" ? pottyHealth.last.condition : "",
                      pottyHealth.last.stoolColor ? `${pottyHealth.last.stoolColor} stool detail` : "",
                      pottyHealth.last.context,
                      pottyHealth.last.caregiver,
                      relativeDay(pottyHealth.last.occurredAt, now),
                    ].filter(Boolean).join(" - ")}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Incident lookback */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Incident Lookback</Text>
          </View>
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.watchSummary}>
              <View style={[s.watchSummaryIcon, { backgroundColor: healthTone + "18" }]}>
                <Ionicons
                  name={healthWatch.status === "good" ? "heart" : "alert-circle"}
                  size={18}
                  color={healthTone}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.watchSummaryTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {healthWatch.status === "good"
                    ? "Health steady"
                    : healthWatch.status === "alert"
                      ? "Health alert"
                      : "Health watch"}
                </Text>
                <Text style={[s.watchSummaryDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {healthWatch.summary}
                </Text>
              </View>
            </View>
            {healthWatch.patterns.slice(0, 3).map((pattern) => {
              const tone = pattern.status === "alert" ? colors.rose : pattern.status === "watch" ? colors.amber : colors.sage;
              return (
                <View key={pattern.kind} style={[s.watchPatternRow, { borderTopColor: colors.border }]}>
                  <View style={[s.watchSignalDot, { backgroundColor: tone }]} />
                  <View style={{ flex: 1 }}>
                    <View style={s.watchPatternTop}>
                      <Text style={[s.watchPatternLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        {pattern.label}
                      </Text>
                      <Text style={[s.watchPatternWindow, { color: tone, fontFamily: "Inter_700Bold" }]}>
                        {pattern.window}
                      </Text>
                    </View>
                    <Text style={[s.watchPatternEvidence, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                      {pattern.evidence}
                    </Text>
                    <Text style={[s.watchPatternNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {pattern.nextStep}
                    </Text>
                  </View>
                </View>
              );
            })}
            <Text style={[s.watchBoundary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {healthWatch.vetBoundary}
            </Text>
            <View style={s.incidentRow}>
              {[
                { label: "7 days", value: incident7 },
                { label: "30 days", value: incident30 },
                { label: "90 days", value: incident90 },
              ].map((b, i) => (
                <View key={b.label} style={[s.incidentCol, i < 2 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
                  <Text style={[s.incidentValue, { color: b.value > 0 ? colors.rose : colors.sage, fontFamily: DISPLAY }]}>{b.value}</Text>
                  <Text style={[s.incidentLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{b.label}</Text>
                  <View style={[s.incidentBarTrack, { backgroundColor: colors.background }]}>
                    <View style={[s.incidentBarFill, { backgroundColor: b.value > 0 ? colors.rose : colors.sage, width: `${(b.value / incidentMax) * 100}%` }]} />
                  </View>
                </View>
              ))}
            </View>
            {incidents.slice(0, 4).map((e, i) => (
              <View key={e.id} style={[s.row, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={[s.rowIconWrap, { backgroundColor: PULSE_COLORS[HEALTH_ICON[entryType(e)] ?? "vomit"] + "16" }]}>
                  <PulseIcon name={HEALTH_ICON[entryType(e)] ?? "vomit"} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[s.rowTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{e.title}</Text>
                  <Text style={[s.rowMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {e.caregiver} - {relativeDay(e.occurredAt, now)}
                  </Text>
                </View>
                {e.severity && e.severity !== "normal" && (
                  <View style={[s.sevBadge, { backgroundColor: (e.severity === "alert" ? colors.rose : colors.amber) + "1A" }]}>
                    <Text style={[s.sevText, { color: e.severity === "alert" ? colors.rose : colors.amber, fontFamily: "Inter_700Bold" }]}>{e.severity}</Text>
                  </View>
                )}
              </View>
            ))}
            {incidents.length === 0 && (
              <Text style={[s.empty, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No incidents logged. Tail wags all around.
              </Text>
            )}
          </View>

          {/* Medication plan */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Medication Plan</Text>
            <Pressable
              onPress={() => router.push("/calendar")}
              accessibilityRole="button"
              accessibilityLabel="Open calendar medication routines"
              hitSlop={8}
              style={s.shareInline}
            >
              <Ionicons name="calendar-outline" size={15} color={colors.copper} />
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Routines</Text>
            </Pressable>
          </View>
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={[s.medSummaryRow, { borderBottomColor: colors.border }]}>
              {[
                { value: `${medicationAdherence.adherencePercent}%`, label: "Logged", color: medicationAdherence.missedCount > 0 ? colors.rose : colors.sage },
                { value: String(medicationAdherence.dueCount), label: "Due now", color: medicationAdherence.dueCount > 0 ? colors.amber : colors.sage },
                { value: String(medicationAdherence.missedCount), label: "Missed", color: medicationAdherence.missedCount > 0 ? colors.rose : colors.sage },
              ].map((item, index) => (
                <View key={item.label} style={[s.medSummaryCell, index < 2 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
                  <Text style={[s.medSummaryValue, { color: item.color, fontFamily: DISPLAY }]}>{item.value}</Text>
                  <Text style={[s.medSummaryLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{item.label}</Text>
                </View>
              ))}
            </View>
            {medicationAdherence.next ? (
              <View style={[s.medNext, { borderBottomColor: colors.border }]}>
                <Ionicons
                  name={medicationAdherence.next.status === "missed" ? "alert-circle" : "time"}
                  size={16}
                  color={medicationAdherence.next.status === "missed" ? colors.rose : colors.amber}
                />
                <Text style={[s.medNextText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  Next: {medicationAdherence.next.label} at {medicationAdherence.next.time}
                </Text>
              </View>
            ) : null}
            {medicationAdherence.total === 0 ? (
              <Text style={[s.empty, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Add medication routines in Calendar, then medication logs will show what was taken, missed, or still coming up.
              </Text>
            ) : (
              medicationAdherence.items.slice(0, 5).map((item, index) => {
                const tone =
                  item.status === "taken"
                    ? colors.sage
                    : item.status === "missed"
                      ? colors.rose
                      : item.status === "due"
                        ? colors.amber
                        : colors.primary;
                const statusLabel =
                  item.status === "taken"
                    ? "Taken"
                    : item.status === "missed"
                      ? "Missed"
                      : item.status === "due"
                        ? "Due now"
                        : "Upcoming";
                const iconName =
                  item.status === "taken"
                    ? "checkmark-circle"
                    : item.status === "missed"
                      ? "alert-circle"
                      : item.status === "due"
                        ? "time"
                        : "time-outline";
                return (
                  <View key={item.id} style={[s.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <View style={[s.rowIconWrap, { backgroundColor: tone + "16" }]}>
                      <Ionicons name={iconName} size={18} color={tone} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[s.rowTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        {item.label}
                      </Text>
                      <Text numberOfLines={1} style={[s.rowMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                        {item.dose} - {item.time}{item.owner ? ` - ${item.owner}` : ""}
                      </Text>
                      {item.takenBy && item.takenAt ? (
                        <Text numberOfLines={1} style={[s.rowMeta, { color: colors.sage, fontFamily: "Inter_600SemiBold" }]}>
                          Logged by {item.takenBy} - {relativeDay(item.takenAt, now)}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[s.medStatusPill, { backgroundColor: tone + "16" }]}>
                      <Text style={[s.medStatusText, { color: tone, fontFamily: "Inter_700Bold" }]}>{statusLabel}</Text>
                    </View>
                  </View>
                );
              })
            )}
            <View style={[s.medFollowUps, { borderTopColor: colors.border }]}>
              <View style={s.medFollowUpHeader}>
                <Text style={[s.medFollowUpTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  Medication Follow-ups
                </Text>
                <Text style={[s.medFollowUpCount, { color: colors.copper, fontFamily: "Inter_700Bold" }]}>
                  {medicationFollowUps.length ? `${medicationFollowUps.length} active` : "Clear"}
                </Text>
              </View>
              {medicationFollowUps.length === 0 ? (
                <Text style={[s.medFollowUpEmpty, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  No medication follow-ups right now. Refill records and medication routines will surface here when they need attention.
                </Text>
              ) : (
                medicationFollowUps.map((item, index) => {
                  const tone = item.urgency === "alert" ? colors.rose : item.urgency === "watch" ? colors.amber : colors.primary;
                  return (
                    <View
                      key={item.id}
                      style={[s.medFollowUpRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                    >
                      <View style={[s.rowIconWrap, { backgroundColor: tone + "16" }]}>
                        <Ionicons name={item.kind === "refill" ? "reload-circle" : "notifications-outline"} size={18} color={tone} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[s.rowTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                          {item.label}
                        </Text>
                        <Text style={[s.rowMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                          {item.detail}
                        </Text>
                        <Text style={[s.medFollowUpAction, { color: tone, fontFamily: "Inter_700Bold" }]}>
                          {item.action}
                        </Text>
                        <Text style={[s.medFollowUpRule, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                          {item.notificationRule}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
            <View style={[s.medHistory, { borderTopColor: colors.border }]}>
              <View style={s.medFollowUpHeader}>
                <Text style={[s.medFollowUpTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  Medication History
                </Text>
                <Text style={[s.medFollowUpCount, { color: colors.copper, fontFamily: "Inter_700Bold" }]}>
                  {medicationHistory.total ? `${medicationHistory.total} logs` : "No logs"}
                </Text>
              </View>
              <View style={[s.medSearchCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="search" size={16} color={colors.mutedForeground} />
                <TextInput
                  value={medicationSearch}
                  onChangeText={setMedicationSearch}
                  placeholder="Search meds, dose, caregiver..."
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[s.medSearchInput, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                />
                {medicationSearch.trim() ? (
                  <Pressable
                    accessibilityLabel="Clear medication search"
                    onPress={() => {
                      Haptics.selectionAsync();
                      setMedicationSearch("");
                    }}
                    style={[s.medSearchClear, { backgroundColor: colors.card }]}
                  >
                    <Ionicons name="close" size={14} color={colors.mutedForeground} />
                  </Pressable>
                ) : null}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.medFilterRow}>
                {MEDICATION_OUTCOME_FILTERS.map((option) => {
                  const active = medicationOutcomeFilter === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityLabel={`Filter medication history: ${option.label}`}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setMedicationOutcomeFilter(option.id);
                      }}
                      style={[
                        s.medFilterPill,
                        {
                          backgroundColor: active ? colors.primary : colors.background,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[s.medFilterText, { color: active ? "#FFFFFF" : colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {medicationHistory.hasActiveFilters ? (
                <Text style={[s.medHistorySummary, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                  {medicationHistory.summary}
                </Text>
              ) : null}
              {medicationHistory.items.length === 0 ? (
                <Text style={[s.medFollowUpEmpty, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {medicationHistory.emptyMessage}
                </Text>
              ) : (
                medicationHistory.items.map((item, index) => {
                  const tone =
                    item.outcome === "taken"
                      ? colors.sage
                      : item.outcome === "skipped" || item.outcome === "missed"
                        ? colors.rose
                        : colors.primary;
                  const iconName =
                    item.outcome === "taken"
                      ? "checkmark-circle"
                      : item.outcome === "missed"
                        ? "alert-circle"
                        : item.outcome === "skipped"
                          ? "remove-circle"
                          : "document-text-outline";
                  return (
                    <View
                      key={item.id}
                      style={[s.medHistoryRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                    >
                      <View style={[s.rowIconWrap, { backgroundColor: tone + "16" }]}>
                        <Ionicons name={iconName} size={18} color={tone} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={s.medHistoryTop}>
                          <Text numberOfLines={1} style={[s.rowTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                            {item.label}
                          </Text>
                          <View style={[s.medStatusPill, { backgroundColor: tone + "16" }]}>
                            <Text style={[s.medStatusText, { color: tone, fontFamily: "Inter_700Bold" }]}>{item.statusLabel}</Text>
                          </View>
                        </View>
                        <Text numberOfLines={1} style={[s.rowMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                          {item.dose} - {item.caregiver} - {relativeDay(item.occurredAt, now)}
                        </Text>
                        {item.note ? (
                          <Text style={[s.medHistoryNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                            {item.note}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          {/* Care pass */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Care Pass</Text>
            <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Preview</Text>
          </View>
          <View style={s.carePassGrid}>
            {CARE_PASS_OPTIONS.map((option) => (
              <Pressable
                key={option.audience}
                onPress={() => openCarePassPreview(option.audience)}
                style={({ pressed }) => [
                  s.carePassCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    shadowColor: colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={[s.carePassIcon, { backgroundColor: colors.primary + "14" }]}>
                  <Ionicons name={option.icon} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.carePassLabel, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    {option.label}
                  </Text>
                  <Text numberOfLines={2} style={[s.carePassDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {option.detail}
                  </Text>
                </View>
                <Ionicons name="share-outline" size={16} color={colors.copper} />
              </Pressable>
            ))}
          </View>

          <View style={[s.sectionHeader, { marginTop: 18 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Report History</Text>
            <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>
              {reportArtifacts.length ? `${reportArtifacts.length} saved` : "No saved"}
            </Text>
          </View>
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            {reportArtifacts.length === 0 ? (
              <Text style={[s.empty, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Shared Care Passes will appear here for quick resend.
              </Text>
            ) : (
              reportArtifacts.map((artifact, index) => {
                const printable = getCarePassArtifactPrintView(artifact);
                const sectionCount = Array.isArray(artifact.sectionTitles) ? artifact.sectionTitles.length : 0;
                return (
                  <View
                    key={artifact.id}
                    style={[
                      s.reportArtifactRow,
                      index < reportArtifacts.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                  >
                    <View style={[s.rowIconWrap, { backgroundColor: colors.primary + "14" }]}>
                      <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[s.rowTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                        {artifact.title}
                      </Text>
                      <Text numberOfLines={1} style={[s.rowMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                        {shortDate(artifact.createdAt)} - {sectionCount} sections - {printable.status === "ready" ? "Print-ready" : "Print restored"}
                      </Text>
                      <Text numberOfLines={1} style={[s.rowMeta, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>
                        {printable.fileName}
                      </Text>
                    </View>
                    <View style={s.reportArtifactActions}>
                      <View style={[s.artifactBadge, { backgroundColor: colors.sage + "14" }]}>
                        <Text style={[s.artifactBadgeText, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                          {artifact.audience}
                        </Text>
                      </View>
                      <View style={s.reportArtifactButtonRow}>
                        <Pressable
                          onPress={() => shareReportArtifact(artifact)}
                          accessibilityRole="button"
                          accessibilityLabel={`Resend ${artifact.title}`}
                          hitSlop={8}
                          style={({ pressed }) => [
                            s.artifactIconButton,
                            { backgroundColor: colors.primary + "12", opacity: pressed ? 0.75 : 1 },
                          ]}
                        >
                          <Ionicons name="share-outline" size={15} color={colors.primary} />
                        </Pressable>
                        <Pressable
                          onPress={() => sharePrintableReportArtifact(artifact)}
                          accessibilityRole="button"
                          accessibilityLabel={`Share printable report source for ${artifact.title}`}
                          hitSlop={8}
                          style={({ pressed }) => [
                            s.artifactIconButton,
                            { backgroundColor: colors.copper + "14", opacity: pressed ? 0.75 : 1 },
                          ]}
                        >
                          <Ionicons name="print-outline" size={15} color={colors.copper} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Progress report */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Progress Report</Text>
            <Pressable onPress={shareReport} hitSlop={8} style={s.shareInline}>
              <Ionicons name="share-outline" size={15} color={colors.copper} />
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Share</Text>
            </Pressable>
          </View>
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={[s.segRow, { backgroundColor: colors.background }]}>
              {PERIODS.map((p) => {
                const active = period === p.key;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPeriod(p.key);
                    }}
                    style={[s.segPill, active && { backgroundColor: colors.card, shadowColor: colors.primary }]}
                  >
                    <Text style={[s.segText, { color: active ? colors.foreground : colors.mutedForeground, fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" }]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={[s.reportTotalRow, { backgroundColor: colors.primary + "10" }]}>
              <View>
                <Text style={[s.reportTotalValue, { color: colors.primary, fontFamily: DISPLAY }]}>{report.total}</Text>
                <Text style={[s.reportTotalLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>total care entries</Text>
              </View>
              {report.topCaregiver && (
                <View style={[s.topCaregiverInline, { backgroundColor: colors.sage + "14" }]}>
                  <Ionicons name="ribbon" size={13} color={colors.sage} />
                  <Text style={[s.topCaregiverInlineText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {report.topCaregiver.name}
                    <Text style={{ fontFamily: "Inter_400Regular", color: colors.mutedForeground }}> - {report.topCaregiver.count} logs</Text>
                  </Text>
                </View>
              )}
            </View>
            <View style={s.reportGrid}>
              {reportStats.map((r) => (
                <View key={r.label} style={[s.reportCell, { backgroundColor: colors.background }]}>
                  <View style={[s.reportIcon, { backgroundColor: PULSE_COLORS[r.icon] + "16" }]}>
                    <PulseIcon name={r.icon} size={16} />
                  </View>
                  <Text style={[s.reportValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{r.value}</Text>
                  <Text style={[s.reportLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{r.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Diet folder */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Diet on File</Text>
            <Pressable onPress={() => router.push("/more")} hitSlop={8}>
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Edit</Text>
            </Pressable>
          </View>
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.dietHead}>
              <View style={[s.rowIconWrap, { backgroundColor: colors.copper + "16" }]}>
                <PulseIcon name="bowl" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{state.dietProfile.primaryFood}</Text>
                <Text style={[s.rowMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {state.dietProfile.normalPortion} - {state.dietProfile.mealSchedule}
                </Text>
              </View>
            </View>
            {dietHistory.length > 0 && (
              <View style={{ marginTop: 4 }}>
                <Text style={[s.subHeading, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>RECENT MEAL NOTES</Text>
                {dietHistory.map((e) => (
                  <View key={e.id} style={s.dietNoteRow}>
                    <View style={[s.dot, { backgroundColor: colors.copper }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.rowNote, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{e.note}</Text>
                      <Text style={[s.rowMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{relativeDay(e.occurredAt, now)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Records cabinet */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Records Cabinet</Text>
            <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>
              {recordVault.total} saved
            </Text>
          </View>
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            {recordList.length === 0 ? (
              <View style={s.recordEmpty}>
                <Ionicons name="folder-open-outline" size={28} color={colors.mutedForeground} />
                <Text style={[s.empty, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  No records saved yet. Add vaccines, visits, receipts, insurance, or microchip info.
                </Text>
                <Pressable
                  onPress={() => openRecordForm("vaccine")}
                  style={({ pressed }) => [s.emptyAddBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={[s.emptyAddText, { fontFamily: "Inter_700Bold" }]}>Add first record</Text>
                </Pressable>
              </View>
            ) : (
              recordList.map((r, i) => {
                const option = RECORD_OPTIONS.find((item) => item.kind === r.type) ?? RECORD_OPTIONS[7];
                const tone = r.type === "receipt" ? colors.copper : r.type === "insurance" || r.type === "microchip" ? colors.primary : colors.sage;
                const dueStatus = getRecordDueStatus(r, now);
                const statusTone =
                  dueStatus.status === "expired"
                    ? colors.rose
                    : dueStatus.status === "due_soon"
                      ? colors.amber
                      : dueStatus.status === "current"
                        ? colors.sage
                        : colors.mutedForeground;
                return (
                  <View key={r.id ?? `${r.type}-${i}`} style={[s.row, i < recordList.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <View style={[s.rowIconWrap, { backgroundColor: tone + "16" }]}>
                      <Ionicons name={option.icon} size={19} color={tone} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.rowTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{r.title}</Text>
                      {r.note ? (
                        <Text numberOfLines={2} style={[s.rowNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{r.note}</Text>
                      ) : null}
                      {hasAttachment(r) ? (
                        <Text style={[s.rowMeta, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Attachment saved</Text>
                      ) : null}
                    </View>
                    <View style={s.recordStatusStack}>
                      <View style={[s.duePill, { backgroundColor: statusTone + "16" }]}>
                        <Text numberOfLines={1} style={[s.dueText, { color: statusTone, fontFamily: "Inter_700Bold" }]}>{dueStatus.label}</Text>
                      </View>
                      {r.due ? (
                        <Text numberOfLines={1} style={[s.recordDueRef, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                          {dueStatus.date ?? r.due}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable onPress={() => deleteRecord(r.id, r.title)} hitSlop={10} style={s.deleteRecordBtn}>
                      <Ionicons name="trash-outline" size={15} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>

          {/* Vet boundary */}
          <View style={[s.notice, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark" size={16} color={colors.sage} />
            <Text style={[s.noticeText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{state.profile.vetBoundary}</Text>
          </View>
        </Animated.View>
      </ScrollView>

      <Modal visible={carePassPreview !== null} transparent animationType="slide" onRequestClose={() => setCarePassPreview(null)}>
        <Pressable style={s.modalBackdrop} onPress={() => setCarePassPreview(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalDock}>
            <Pressable style={[s.recordSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 18 }]} onPress={(e) => e.stopPropagation()}>
              <View style={s.sheetHandle} />
              {carePassPreview ? (
                <>
                  <View style={s.sheetHeader}>
                    <View style={[s.rowIconWrap, { backgroundColor: colors.primary + "14" }]}>
                      <Ionicons name="newspaper-outline" size={19} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.sheetTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{carePassPreview.title}</Text>
                      <Text style={[s.sheetSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{carePassPreview.generatedAt}</Text>
                    </View>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={s.passPreviewScroll}>
                    <Text style={[s.passSummary, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{carePassPreview.summary}</Text>
                    {carePassPreview.sections.map((section) => (
                      <View key={section.title} style={[s.passSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Text style={[s.passSectionTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{section.title}</Text>
                        {section.lines.map((line) => (
                          <View key={line} style={s.passLineRow}>
                            <View style={[s.passDot, { backgroundColor: colors.primary }]} />
                            <Text style={[s.passLine, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{line}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </ScrollView>
                  <View style={s.sheetActions}>
                    <Pressable onPress={() => setCarePassPreview(null)} style={s.sheetCancel}>
                      <Text style={[s.sheetCancelText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Close</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => shareCarePass(carePassPreview)}
                      style={({ pressed }) => [s.sheetSave, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                    >
                      <Text style={[s.sheetSaveText, { fontFamily: "Inter_700Bold" }]}>Save & share</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Modal visible={recordOpen} transparent animationType="slide" onRequestClose={() => setRecordOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setRecordOpen(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalDock}>
            <Pressable style={[s.recordSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 18 }]} onPress={() => {}}>
              <View style={s.sheetHandle} />
              <View style={s.sheetHeader}>
                <View style={[s.rowIconWrap, { backgroundColor: colors.primary + "14" }]}>
                  <Ionicons name={recordOption.icon} size={19} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.sheetTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Add {recordOption.label}</Text>
                  <Text style={[s.sheetSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{recordOption.detail}</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recordTypeRow}>
                {RECORD_OPTIONS.map((option) => {
                  const active = option.kind === recordType;
                  return (
                    <Pressable
                      key={option.kind}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setRecordType(option.kind);
                      }}
                      style={[
                        s.recordTypePill,
                        {
                          backgroundColor: active ? colors.primary : colors.background,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Ionicons name={option.icon} size={14} color={active ? "#FFFFFF" : colors.primary} />
                      <Text style={[s.recordTypeText, { color: active ? "#FFFFFF" : colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={[s.editFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>TITLE</Text>
              <TextInput
                value={recordTitle}
                onChangeText={setRecordTitle}
                placeholder={`${recordOption.label} name`}
                placeholderTextColor={colors.mutedForeground}
                style={[s.recordInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
              />
              <Text style={[s.editFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{recordOption.dueLabel.toUpperCase()}</Text>
              <TextInput
                value={recordDue}
                onChangeText={setRecordDue}
                placeholder={recordOption.dueLabel}
                placeholderTextColor={colors.mutedForeground}
                style={[s.recordInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
              />
              <Text style={[s.editFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>NOTES</Text>
              <TextInput
                value={recordNote}
                onChangeText={setRecordNote}
                placeholder="Dose, provider, receipt amount, card details, or anything useful"
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={[s.recordInput, s.recordInputMulti, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              />
              <Pressable
                onPress={pickRecordAttachment}
                style={({ pressed }) => [
                  s.attachmentBtn,
                  { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Ionicons name={recordAttachmentUri ? "checkmark-circle" : "image-outline"} size={17} color={recordAttachmentUri ? colors.sage : colors.primary} />
                <Text style={[s.attachmentText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {recordAttachmentUri ? "Attachment selected" : "Attach photo or receipt"}
                </Text>
              </Pressable>
              <View style={s.sheetActions}>
                <Pressable onPress={() => setRecordOpen(false)} style={s.sheetCancel}>
                  <Text style={[s.sheetCancelText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={saveRecord}
                  style={({ pressed }) => [s.sheetSave, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={[s.sheetSaveText, { fontFamily: "Inter_700Bold" }]}>Save record</Text>
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

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  headerIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, marginTop: 2 },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 20, letterSpacing: -0.2 },
  sectionLink: { fontSize: 14 },
  shareInline: { flexDirection: "row", alignItems: "center", gap: 4 },
  shareInlineGroup: { flexDirection: "row", alignItems: "center", gap: 14 },

  idCard: {
    borderRadius: 22,
    padding: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 5,
  },
  idCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  idBadge: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  idEyebrow: { fontSize: 10.5, letterSpacing: 0.8 },
  idName: { fontSize: 28, letterSpacing: -0.3, marginTop: 1 },
  idGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  idField: { width: "48%" },
  idFieldLabel: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.72 },
  idFieldValue: { fontSize: 13.5, lineHeight: 18, marginTop: 3 },
  idFooter: { borderTopWidth: 1, marginTop: 16, paddingTop: 12 },
  idFooterText: { fontSize: 12.5, lineHeight: 17 },

  vaultGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  vaultCard: {
    width: "48%",
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  vaultIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  vaultLabel: { fontSize: 15 },
  vaultMeta: { fontSize: 12.5, marginTop: 3 },
  vaultNotice: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 16, padding: 12, marginTop: 10 },
  vaultNoticeText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  reminderList: { borderWidth: 1, borderRadius: 18, marginTop: 12, overflow: "hidden" },
  reminderRow: { flexDirection: "row", gap: 10, padding: 12 },
  reminderIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  reminderTitle: { fontSize: 13.5 },
  reminderDetail: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  reminderAction: { fontSize: 11.5, lineHeight: 16, marginTop: 4 },

  chartCard: {
    borderRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  chartTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  chartBig: { fontSize: 30, letterSpacing: -0.5 },
  chartUnit: { fontSize: 15 },
  chartCaption: { fontSize: 12.5, marginTop: 1 },
  goalPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 13 },
  goalPillText: { fontSize: 12.5 },
  chartNote: { fontSize: 12.5, lineHeight: 18, marginTop: 6 },

  padCard: {
    borderRadius: 22,
    padding: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  empty: { fontSize: 14, paddingVertical: 16, textAlign: "center" },
  trendHeroRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  trendStatGrid: { flexDirection: "row", gap: 9, marginBottom: 8 },
  trendStatCell: { flex: 1, paddingVertical: 9, paddingHorizontal: 4, alignItems: "center" },
  trendStatValue: { fontSize: 21, letterSpacing: 0 },
  trendStatLabel: { fontSize: 10.5, marginTop: 2, textAlign: "center" },
  trendSignalStack: { marginTop: 2, marginBottom: 10 },
  trendSignalRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderTopWidth: 1, paddingTop: 10, marginTop: 10 },
  trendSignalTitle: { fontSize: 12.8 },
  trendSignalDetail: { fontSize: 12.3, lineHeight: 17, marginTop: 3 },

  moodRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  moodLabel: { fontSize: 14, width: 64 },
  moodTrack: { flex: 1, height: 12, borderRadius: 6, overflow: "hidden" },
  moodFill: { height: "100%", borderRadius: 6 },
  moodPct: { fontSize: 12.5, width: 34, textAlign: "right" },
  moodCount: { fontSize: 12, width: 28 },

  hydrationSummary: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  hydrationMeter: { height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 12 },
  hydrationMeterFill: { height: "100%", borderRadius: 4 },
  hydrationStats: { flexDirection: "row", borderRadius: 8, overflow: "hidden", marginBottom: 10 },
  hydrationStat: { flex: 1, alignItems: "center", paddingVertical: 8, paddingHorizontal: 6 },
  hydrationValue: { fontSize: 21, letterSpacing: 0 },
  hydrationLabel: { fontSize: 10.5, marginTop: 2, textAlign: "center" },
  hydrationNext: { fontSize: 12.5, lineHeight: 18 },
  routeTemplateList: { borderTopWidth: 1, marginTop: 14, paddingTop: 13 },
  routeTemplateHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 },
  routeTemplateTitle: { fontSize: 15.5 },
  routeTemplateCount: { fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 },
  routeTemplateRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11 },
  routeTemplateIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  routeTemplateName: { fontSize: 14.5 },
  routeTemplateMeta: { fontSize: 12.2, lineHeight: 17, marginTop: 2 },
  routeTemplateNote: { fontSize: 12, lineHeight: 16, marginTop: 4 },
  routeTemplateMetric: { minWidth: 48, borderRadius: 13, alignItems: "center", paddingHorizontal: 8, paddingVertical: 7 },
  routeTemplateMetricValue: { fontSize: 18, letterSpacing: -0.2 },
  routeTemplateMetricLabel: { fontSize: 10.2, marginTop: 1 },

  incidentRow: { flexDirection: "row", marginBottom: 4 },
  watchSummary: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  watchSummaryIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  watchSummaryTitle: { fontSize: 15 },
  watchSummaryDetail: { fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  watchSignalDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  watchPatternRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingTop: 10, marginTop: 10, borderTopWidth: 1 },
  watchPatternTop: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  watchPatternLabel: { fontSize: 12.5, flex: 1 },
  watchPatternWindow: { fontSize: 10.5 },
  watchPatternEvidence: { fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  watchPatternNext: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  watchBoundary: { fontSize: 11.5, lineHeight: 16, marginTop: 12, marginBottom: 10 },
  incidentCol: { flex: 1, alignItems: "center", paddingHorizontal: 10, paddingBottom: 14 },
  incidentValue: { fontSize: 26, letterSpacing: -0.4 },
  incidentLabel: { fontSize: 12, marginTop: 1 },
  incidentBarTrack: { height: 5, borderRadius: 3, width: "70%", marginTop: 8, overflow: "hidden" },
  incidentBarFill: { height: "100%", borderRadius: 3 },

  medSummaryRow: { flexDirection: "row", borderBottomWidth: 1, paddingBottom: 12, marginBottom: 4 },
  medSummaryCell: { flex: 1, minHeight: 58, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  medSummaryValue: { fontSize: 24, letterSpacing: -0.3 },
  medSummaryLabel: { fontSize: 11.5, marginTop: 2, textAlign: "center" },
  medNext: { flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, paddingVertical: 12 },
  medNextText: { flex: 1, fontSize: 12.8, lineHeight: 18 },
  medStatusPill: { minWidth: 76, alignItems: "center", borderRadius: 11, paddingHorizontal: 9, paddingVertical: 6 },
  medStatusText: { fontSize: 10.8, textTransform: "uppercase", letterSpacing: 0.4 },
  medFollowUps: { borderTopWidth: 1, marginTop: 4, paddingTop: 14 },
  medFollowUpHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 2 },
  medFollowUpTitle: { fontSize: 15 },
  medFollowUpCount: { fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 },
  medFollowUpEmpty: { fontSize: 12.5, lineHeight: 18, paddingTop: 8 },
  medFollowUpRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12 },
  medFollowUpAction: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  medFollowUpRule: { fontSize: 11.2, lineHeight: 16, marginTop: 4 },
  medHistory: { borderTopWidth: 1, marginTop: 4, paddingTop: 14 },
  medSearchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 6,
  },
  medSearchInput: { flex: 1, fontSize: 13.5, minHeight: 26, paddingVertical: 0 },
  medSearchClear: { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  medFilterRow: { gap: 7, paddingVertical: 9 },
  medFilterPill: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 11, paddingVertical: 7 },
  medFilterText: { fontSize: 11.5 },
  medHistorySummary: { fontSize: 12, lineHeight: 17, marginBottom: 1 },
  medHistoryRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12 },
  medHistoryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  medHistoryNote: { fontSize: 12.2, lineHeight: 17, marginTop: 5 },

  carePassGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  carePassCard: {
    width: "48%",
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  carePassIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 9 },
  carePassLabel: { fontSize: 15 },
  carePassDetail: { fontSize: 12, lineHeight: 16, marginTop: 2, paddingRight: 14 },
  reportArtifactRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  reportArtifactActions: { alignItems: "flex-end", gap: 8 },
  reportArtifactButtonRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  artifactIconButton: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  artifactBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  artifactBadgeText: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4 },

  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  rowIconWrap: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 15, flexShrink: 1 },
  rowNote: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  rowMeta: { fontSize: 12, marginTop: 4 },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  sevText: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4 },
  recordStatusStack: { alignItems: "flex-end", maxWidth: 96, gap: 4 },
  duePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  dueText: { fontSize: 11.5 },
  recordDueRef: { fontSize: 10.5, maxWidth: 96 },
  deleteRecordBtn: { padding: 4 },
  recordEmpty: { alignItems: "center", gap: 8, paddingVertical: 10 },
  emptyAddBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  emptyAddText: { color: "#FFFFFF", fontSize: 13.5 },

  highlightStrip: {
    flexDirection: "row",
    borderRadius: 22,
    marginBottom: 0,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
    overflow: "hidden",
  },
  highlightCell: { flex: 1, alignItems: "center", paddingVertical: 18, paddingHorizontal: 6 },
  highlightValue: { fontSize: 24, letterSpacing: -0.4 },
  highlightLabel: { fontSize: 11.5, marginTop: 3, textAlign: "center" },

  reportTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  reportTotalValue: { fontSize: 30, letterSpacing: -0.5 },
  reportTotalLabel: { fontSize: 12.5, marginTop: 1 },
  topCaregiverInline: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  topCaregiverInlineText: { fontSize: 13 },

  segRow: { flexDirection: "row", borderRadius: 14, padding: 4, marginBottom: 16 },
  segPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  segText: { fontSize: 13.5 },
  reportGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  reportCell: { width: "31%", borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  reportIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 7 },
  reportValue: { fontSize: 18, letterSpacing: -0.3 },
  reportLabel: { fontSize: 11, marginTop: 2 },
  dietHead: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 6 },
  subHeading: { fontSize: 11, letterSpacing: 0.6, marginTop: 10, marginBottom: 4 },
  dietNoteRow: { flexDirection: "row", gap: 10, paddingVertical: 7, alignItems: "flex-start" },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },

  notice: { flexDirection: "row", gap: 10, borderRadius: 18, borderWidth: 1, padding: 16, marginTop: 24 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,31,36,0.45)" },
  modalDock: { flex: 1, justifyContent: "flex-end" },
  recordSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, maxHeight: "92%" },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.15)", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  sheetTitle: { fontSize: 20, letterSpacing: -0.2 },
  sheetSub: { fontSize: 13, marginTop: 2 },
  passPreviewScroll: { maxHeight: 420 },
  passSummary: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  passSection: { borderWidth: 1, borderRadius: 16, padding: 13, marginBottom: 10 },
  passSectionTitle: { fontSize: 15, marginBottom: 8 },
  passLineRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  passDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  passLine: { flex: 1, fontSize: 12.8, lineHeight: 18 },
  recordTypeRow: { gap: 8, paddingVertical: 4 },
  recordTypePill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  recordTypeText: { fontSize: 12.5 },
  editFieldLabel: { fontSize: 11, letterSpacing: 0.6, marginBottom: 7, marginTop: 14 },
  recordInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14.5 },
  recordInputMulti: { minHeight: 76, textAlignVertical: "top" },
  attachmentBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderRadius: 14, paddingVertical: 12, marginTop: 14 },
  attachmentText: { fontSize: 13.5 },
  sheetActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  sheetCancel: { flex: 1, height: 48, alignItems: "center", justifyContent: "center" },
  sheetCancelText: { fontSize: 15 },
  sheetSave: { flex: 2, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  sheetSaveText: { color: "#FFFFFF", fontSize: 15 },
});
